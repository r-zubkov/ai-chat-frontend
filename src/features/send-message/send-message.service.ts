import { inject, Injectable } from '@angular/core';
import {
  EMPTY,
  Observable,
  ReplaySubject,
  Subject,
  animationFrameScheduler,
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

@Injectable({ providedIn: 'root' })
export class SendMessageService {
  private readonly chatRepository = inject(ChatRepository);
  private readonly messageRepository = inject(MessageRepository);
  private readonly chatStore = inject(ChatStore);
  private readonly messageStore = inject(MessageStore);
  private readonly socket = inject(SocketService);
  private readonly settings = inject(SettingsStore);

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

        const renderTick$ = new Subject<void>();
        const renderTickSubscription = renderTick$
          .pipe(
            auditTime(0, animationFrameScheduler),
            tap(() => {
              this.messageStore.set(assistantMessage.id, content);
            }),
          )
          .subscribe();

        const flushFinalPersist = (state: ChatMessageState, onDrained: () => void): void => {
          if (!persistQueueClosed) {
            persistQueueClosed = true;
            persistTickSubscription.unsubscribe();
            renderTickSubscription.unsubscribe();
            renderTick$.complete();
            this.messageStore.set(assistantMessage.id, content);
            persistQueue$.next({ content, state });
            persistQueue$.complete();
          }

          persistQueueDrained$.pipe(take(1)).subscribe(() => onDrained());
        };

        stream$
          .pipe(
            tap((delta: string) => {
              content += delta;
              renderTick$.next();
              persistTick$.next();
            }),
          )
          .subscribe({
            error: (err: unknown) => {
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

  stopRequest(chat: Chat): void {
    const requestId = chat.currentRequestId;

    if (requestId) {
      this.socket.abortRequest(requestId);
    }

    if (chat.state !== ChatState.THINKING && !requestId) {
      return;
    }

    void this.updateChat(chat, {
      model: chat.model,
      state: ChatState.IDLE,
      currentRequestId: null,
    });
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
}
