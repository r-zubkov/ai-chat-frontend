import { inject, Injectable } from '@angular/core';
import {
  EMPTY,
  Observable,
  ReplaySubject,
  Subject,
  auditTime,
  catchError,
  concatMap,
  from,
  take,
  tap,
} from 'rxjs';
import { Chat, ChatId, ChatRepository, ChatState, ChatStore } from '@entities/chat';
import {
  ChatMessage,
  ChatMessageRole,
  ChatMessageState,
  MessageRepository,
  MessageStore,
} from '@entities/message';
import { ModelType, SettingsStore } from '@entities/settings';
import { SocketService } from '@shared/api';
import { STREAM_PERSIST_INTERVAL, SYSTEM_PROMPT } from '@shared/config';
import { buildApiMessages } from './chat-api.helpers';
import { createChatEntity, createMessageEntity, generateSequelId } from './chat.helpers';

export enum SendMessageEventType {
  SENT = 'sent',
  FINISHED = 'finished',
}

export type SendMessageEvent =
  | {
      type: SendMessageEventType.SENT;
      chatId: ChatId;
      userMessage: ChatMessage;
    }
  | {
      type: SendMessageEventType.FINISHED;
      chatId: ChatId;
      assistantMessage: ChatMessage;
    };

const TYPEWRITER_BACKLOG_SLOW_THRESHOLD = 80;
const TYPEWRITER_BACKLOG_MEDIUM_THRESHOLD = 240;
const TYPEWRITER_BACKLOG_FAST_THRESHOLD = 600;
const TYPEWRITER_CHARS_PER_FRAME_SLOW = 2;
const TYPEWRITER_CHARS_PER_FRAME_MEDIUM = 6;
const TYPEWRITER_CHARS_PER_FRAME_FAST = 12;
const TYPEWRITER_CHARS_PER_FRAME_MAX = 24;

@Injectable({ providedIn: 'root' })
export class SendMessageService {
  private readonly chatRepository = inject(ChatRepository);
  private readonly messageRepository = inject(MessageRepository);
  private readonly chatStore = inject(ChatStore);
  private readonly messageStore = inject(MessageStore);
  private readonly socket = inject(SocketService);
  private readonly settings = inject(SettingsStore);
  private readonly abortedRequestIds = new Set<string>();

  private readonly modelSystemPrompts: Partial<Record<ModelType, string>> = {
    [ModelType.GPT_51]: SYSTEM_PROMPT,
    [ModelType.GEMINI_3_FLASH_PREVIEW]: SYSTEM_PROMPT,
  };

  sendMessage(text: string, messageHistory: ChatMessage[]): Observable<SendMessageEvent> {
    const events$ = new Subject<SendMessageEvent>();
    const trimmed = text.trim();
    const model = this.settings.currentModel();

    if (!trimmed || !model) {
      events$.complete();
      return events$.asObservable();
    }

    void (async () => {
      let chat = this.chatStore.activeChat();
      let chatId: ChatId | null = chat?.id ?? null;
      let assistantMessageId: ChatMessage['id'] | null = null;
      let content = '';

      try {
        if (!chat) {
          const createdChat = createChatEntity(trimmed, model);
          await this.chatRepository.create(createdChat);
          this.chatStore.upsertChat(createdChat);
          await this.chatStore.loadChatsCount();
          this.chatStore.setActive(createdChat.id);

          chat = createdChat;
          chatId = createdChat.id;
        }

        let sequelCounter = 0;
        const activeChatId = chatId;

        if (!activeChatId || !chat) {
          throw new Error('Chat ID is not available');
        }

        const userMessage = createMessageEntity({
          sequelId: generateSequelId(sequelCounter++),
          role: ChatMessageRole.USER,
          model,
          state: ChatMessageState.COMPLETED,
          chatId: activeChatId,
          content: trimmed,
        });

        const assistantMessage = createMessageEntity({
          sequelId: generateSequelId(sequelCounter++),
          role: ChatMessageRole.ASSISTANT,
          model,
          state: ChatMessageState.STREAMING,
          chatId: activeChatId,
          content: '',
        });
        assistantMessageId = assistantMessage.id;

        await this.messageRepository.createMessages([userMessage, assistantMessage]);
        this.messageStore.upsertMessages([userMessage, assistantMessage]);

        const apiMessages = buildApiMessages(
          messageHistory,
          userMessage,
          model,
          this.modelSystemPrompts,
        );

        const { requestId, stream$ } = this.socket.sendChatCompletion(model, apiMessages);

        chat = await this.updateChat(chat, {
          model,
          state: ChatState.THINKING,
          currentRequestId: requestId,
        });

        events$.next({
          type: SendMessageEventType.SENT,
          chatId: activeChatId,
          userMessage,
        });

        let lastPersistedContent = '';

        const persistQueue$ = new Subject<{ content: string; state?: ChatMessageState }>();
        const persistTick$ = new Subject<void>();
        const persistQueueDrained$ = new ReplaySubject<void>(1);
        let persistQueueClosed = false;

        persistQueue$
          .pipe(
            concatMap((payload) => {
              const update: Partial<ChatMessage> = { content: payload.content };
              if (payload.state !== undefined) {
                update.state = payload.state;
              }

              return from(this.messageRepository.updateMessage(assistantMessage.id, update)).pipe(
                tap(() => {
                  lastPersistedContent = payload.content;
                  this.messageStore.patchMessage(assistantMessage.id, update);
                  if (payload.state !== undefined) {
                    this.messageStore.remove(assistantMessage.id);
                  }
                }),
                catchError((persistError: unknown) => {
                  console.error('Error persisting streaming content:', persistError);
                  return EMPTY;
                }),
              );
            }),
          )
          .subscribe({
            complete: () => {
              persistQueueDrained$.next();
              persistQueueDrained$.complete();
            },
          });

        const persistTickSubscription = persistTick$
          .pipe(
            auditTime(STREAM_PERSIST_INTERVAL),
            tap(() => {
              if (content === lastPersistedContent) return;
              persistQueue$.next({ content });
            }),
          )
          .subscribe();

        const flushFinalPersist = (state: ChatMessageState, onDrained: () => void): void => {
          if (!persistQueueClosed) {
            persistQueueClosed = true;
            persistTickSubscription.unsubscribe();
            this.messageStore.patchMessage(assistantMessage.id, { content, state });
            this.messageStore.remove(assistantMessage.id);
            persistQueue$.next({ content, state });
            persistQueue$.complete();
          }

          persistQueueDrained$.pipe(take(1)).subscribe(() => onDrained());
        };

        let incomingBuffer = '';
        let frameId: number | null = null;
        let streamDone = false;

        const clearFrame = (): void => {
          if (frameId === null) {
            return;
          }

          cancelAnimationFrame(frameId);
          frameId = null;
        };

        const commitTypewriterFrame = (): void => {
          if (!incomingBuffer.length) {
            return;
          }

          const step = this.resolveTypewriterStep(incomingBuffer.length);
          content += incomingBuffer.slice(0, step);
          incomingBuffer = incomingBuffer.slice(step);
          this.messageStore.set(assistantMessage.id, content);
          persistTick$.next();
        };

        const finalizeSuccess = (): void => {
          flushFinalPersist(ChatMessageState.COMPLETED, () => {
            void this.updateChat(chat as Chat, {
              model,
              state: ChatState.IDLE,
              currentRequestId: null,
            });

            const finalAssistantMessage: ChatMessage = {
              ...assistantMessage,
              content,
              state: ChatMessageState.COMPLETED,
            };

            events$.next({
              type: SendMessageEventType.FINISHED,
              chatId: activeChatId,
              assistantMessage: finalAssistantMessage,
            });
            events$.complete();
          });
        };

        const handleAbort = (): void => {
          clearFrame();
          incomingBuffer = '';
          finalizeSuccess();
        };

        const maybeFinalizeSuccess = (): void => {
          if (!streamDone || incomingBuffer.length > 0 || frameId !== null) {
            return;
          }

          finalizeSuccess();
        };

        const runTypewriterFrame = (): void => {
          frameId = null;
          commitTypewriterFrame();

          if (incomingBuffer.length > 0) {
            frameId = requestAnimationFrame(runTypewriterFrame);
            return;
          }

          maybeFinalizeSuccess();
        };

        const ensureTypewriterFrame = (): void => {
          if (frameId !== null || !incomingBuffer.length) {
            return;
          }

          frameId = requestAnimationFrame(runTypewriterFrame);
        };

        stream$
          .pipe(
            tap((delta: string) => {
              incomingBuffer += delta;
              ensureTypewriterFrame();
            }),
          )
          .subscribe({
            error: (err: unknown) => {
              this.abortedRequestIds.delete(requestId);
              clearFrame();
              incomingBuffer = '';
              flushFinalPersist(ChatMessageState.ERROR, () => {
                void this.updateChat(chat as Chat, {
                  model,
                  state: ChatState.ERROR,
                  currentRequestId: null,
                });
                events$.error(err);
              });
            },
            complete: () => {
              if (this.abortedRequestIds.delete(requestId)) {
                handleAbort();
                return;
              }

              streamDone = true;
              maybeFinalizeSuccess();
            },
          });
      } catch (err: unknown) {
        if (chatId && chat) {
          void this.updateChat(chat, {
            model,
            state: ChatState.ERROR,
            currentRequestId: null,
          });
        }

        if (assistantMessageId) {
          void this.messageRepository.updateMessage(assistantMessageId, {
            content,
            state: ChatMessageState.ERROR,
          });
          this.messageStore.patchMessage(assistantMessageId, {
            content,
            state: ChatMessageState.ERROR,
          });
          this.messageStore.remove(assistantMessageId);
        }

        events$.error(err);
      }
    })();

    return events$.asObservable();
  }

  stopRequest(requestId: string): void {
    this.abortedRequestIds.add(requestId);
    this.socket.abortRequest(requestId);
  }

  stopAllRequests(): void {
    this.socket.abortAllRequests();
  }

  destroy(): void {
    this.stopAllRequests();
    this.socket.destroy();
  }

  private async updateChat(chat: Chat, data: Partial<Omit<Chat, 'id'>>): Promise<Chat> {
    const next: Chat = {
      ...chat,
      ...data,
      lastUpdate: Date.now(),
    };

    await this.chatRepository.update(chat.id, {
      ...data,
      lastUpdate: next.lastUpdate,
    });

    this.chatStore.upsertChat(next);
    return next;
  }

  private resolveTypewriterStep(backlog: number): number {
    if (backlog <= TYPEWRITER_BACKLOG_SLOW_THRESHOLD) {
      return TYPEWRITER_CHARS_PER_FRAME_SLOW;
    }

    if (backlog <= TYPEWRITER_BACKLOG_MEDIUM_THRESHOLD) {
      return TYPEWRITER_CHARS_PER_FRAME_MEDIUM;
    }

    if (backlog <= TYPEWRITER_BACKLOG_FAST_THRESHOLD) {
      return TYPEWRITER_CHARS_PER_FRAME_FAST;
    }

    return TYPEWRITER_CHARS_PER_FRAME_MAX;
  }
}
