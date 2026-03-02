import { inject, Injectable } from '@angular/core';
import { ChatState } from '../types/chat';
import { ChatMessage, ChatMessageRole, ChatMessageState } from '../types/chat-message';
import { ModelType } from '../types/model-type';
import { SendMessageEvent, SendMessageEventType } from '../types/send-message-event';
import {
  EMPTY,
  Observable,
  Subject,
  auditTime,
  catchError,
  concatMap,
  finalize,
  from,
  tap,
} from 'rxjs';
import { MODEL_BASE_SYSTEM_PROMT, PERSIST_INTERVAL_MS } from '../constants/chat.constants';
import { buildApiMessages } from '../helpers/chat-api.helpers';
import { createChatEntity, createMessageEntity, generateSequelId } from '../helpers/chat.helpers';
import { ChatSocketService } from './chat-socket.service';
import { ChatStore } from './chat.store';
import { StreamingStore } from './streaming.store';
import { ChatPersistenceService } from './chat-persistence.service';

@Injectable({ providedIn: 'root' })
export class ChatMessagingService {
  private readonly chatStore = inject(ChatStore);
  private readonly chatSocketService = inject(ChatSocketService);
  private readonly streamingStore = inject(StreamingStore);
  private readonly chatPersistenceService = inject(ChatPersistenceService);

  private readonly activeChat = this.chatStore.activeChat;
  private readonly currentModel = this.chatStore.currentModel;

  private readonly modelSystemPrompts: Partial<Record<ModelType, string>> = {
    [ModelType.GPT_51]: MODEL_BASE_SYSTEM_PROMT,
    [ModelType.GEMINI_3_FLASH_PREVIEW]: MODEL_BASE_SYSTEM_PROMT,
  };

  sendMessage(text: string, messageHistory: ChatMessage[]): Observable<SendMessageEvent> {
    const events$ = new Subject<SendMessageEvent>();
    const trimmed = text.trim();
    const model = this.currentModel();
    if (!trimmed || !model) {
      events$.complete();
      return events$.asObservable();
    }

    void (async () => {
      let chat = this.activeChat();
      let chatId: string | null = chat?.id ?? null;
      let assistantMessageId: string | null = null;
      let content = '';

      try {
        if (!chat) {
          const entity = createChatEntity(trimmed, model);
          await this.chatPersistenceService.createChat(entity);

          chat = entity;
          chatId = entity.id;
        }

        let sequelCounter = 0;
        const activeChatId = chatId;
        if (!activeChatId) {
          throw new Error('Chat ID is not available');
        }

        const userMessage: ChatMessage = createMessageEntity({
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

        await this.chatPersistenceService.createMessages([userMessage, assistantMessage]);

        const apiMessages = buildApiMessages(
          messageHistory,
          userMessage,
          model,
          this.modelSystemPrompts,
        );

        const { requestId, stream$ } = this.chatSocketService.sendChatCompletion(
          model,
          apiMessages,
        );

        void this.chatPersistenceService.updateChat(activeChatId, {
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
        let terminalMessageState = ChatMessageState.COMPLETED;

        const persistQueue$ = new Subject<{ content: string; state?: ChatMessageState }>();
        const persistTick$ = new Subject<void>();

        persistQueue$
          .pipe(
            concatMap((payload) => {
              const update: Partial<ChatMessage> = { content: payload.content };
              if (payload.state !== undefined) {
                update.state = payload.state;
              }

              return from(
                this.chatPersistenceService.updateMessage(assistantMessage.id, update),
              ).pipe(
                tap(() => {
                  lastPersistedContent = payload.content;
                }),
                catchError((persistError: unknown) => {
                  console.error('Error persisting streaming content:', persistError);
                  return EMPTY;
                }),
              );
            }),
          )
          .subscribe();

        persistTick$
          .pipe(
            auditTime(PERSIST_INTERVAL_MS),
            tap(() => {
              if (content === lastPersistedContent) return;
              persistQueue$.next({ content });
            }),
            finalize(() => {
              persistQueue$.next({ content, state: terminalMessageState });
              persistQueue$.complete();
            }),
          )
          .subscribe();

        stream$
          .pipe(
            tap((delta: string) => {
              content += delta;
              this.streamingStore.set(assistantMessage.id, content);
              persistTick$.next();
            }),
            tap({
              error: () => {
                terminalMessageState = ChatMessageState.ERROR;
              },
            }),
            finalize(() => {
              persistTick$.complete();
            }),
          )
          .subscribe({
            error: (err: unknown) => {
              void this.chatPersistenceService.updateChat(activeChatId, {
                model,
                state: ChatState.ERROR,
                currentRequestId: null,
              });
              events$.error(err);
            },
            complete: () => {
              void this.chatPersistenceService.updateChat(activeChatId, {
                model,
                state: ChatState.IDLE,
                currentRequestId: null,
              });

              const finalAssistantMessage: ChatMessage = { ...assistantMessage, content };
              events$.next({
                type: SendMessageEventType.FINISHED,
                chatId: activeChatId,
                assistantMessage: finalAssistantMessage,
              });
              events$.complete();
            },
          });
      } catch (err: unknown) {
        if (chatId) {
          void this.chatPersistenceService.updateChat(chatId, {
            model,
            state: ChatState.ERROR,
            currentRequestId: null,
          });
        }

        if (assistantMessageId) {
          void this.chatPersistenceService.updateMessage(assistantMessageId, {
            content,
            state: ChatMessageState.ERROR,
          });
        }

        events$.error(err);
      }
    })();

    return events$.asObservable();
  }

  stopRequest(requestId: string): void {
    this.chatSocketService.abortRequest(requestId);
  }

  stopAllRequests(): void {
    this.chatSocketService.abortAllRequests();
  }

  destroy(): void {
    this.stopAllRequests();
    this.chatSocketService.destroy();
  }
}
