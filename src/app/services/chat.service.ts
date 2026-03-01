import { inject, Injectable } from '@angular/core';
import { Chat, ChatState } from '../types/chat';
import { ModelType } from '../types/model-type';
import { ChatRepositoryService, RepositoryEventType } from './chat-repository.service';
import { ChatSocketService } from './chat-socket.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppService } from './app.service';
import { truncateAtWord } from '../helpers/text-utils';
import { ModelLabelMap } from '../maps/model-label.map';
import { ChatMessage, ChatMessageRole, ChatMessageState } from '../types/chat-message';
import { SendMessageEvent, SendMessageEventType } from '../types/send-message-event';
import { Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { ChatStore } from './chat.store';
import { StreamingStore } from './streaming.store';

const API_HISTORY_LIMIT = 6;
const PERSIST_INTERVAL_MS = 5000;

const MODEL_BASE_SYSTEM_PROMT = `
  Стиль:
  - Короткие абзацы, буллет-пойнты.
  - Markdown по умолчанию.
  - Иногда уместный эмодзи в начале абзаца.
  - Тон: спокойный, уверенный, без канцелярита.
  - Если есть код — отдельный блок с короткими комментариями.
  - Если задачу можно сделать по шагам — пронумеруй шаги.
`;

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly chatStore = inject(ChatStore);
  private readonly streamingStore = inject(StreamingStore);

  readonly modelSystemPrompts: Partial<Record<ModelType, string>> = {
    [ModelType.GPT_51]: MODEL_BASE_SYSTEM_PROMT,
    [ModelType.GEMINI_3_FLASH_PREVIEW]: MODEL_BASE_SYSTEM_PROMT,
  };

  readonly models: Array<{ id: ModelType; label: string }> = [
    { id: ModelType.GROK_4_FAST, label: ModelLabelMap[ModelType.GROK_4_FAST]! },
    { id: ModelType.DEEPSEEK_32, label: ModelLabelMap[ModelType.DEEPSEEK_32]! },
    { id: ModelType.GEMINI_3_FLASH_PREVIEW, label: ModelLabelMap[ModelType.GEMINI_3_FLASH_PREVIEW]! },
    { id: ModelType.GPT_51, label: ModelLabelMap[ModelType.GPT_51]! },
  ];

  readonly chats = this.chatStore.chats;
  readonly chatsCount = this.chatStore.chatsCount;
  readonly activeChatId = this.chatStore.activeChatId;
  readonly activeChat = this.chatStore.activeChat;
  readonly currentModel = this.chatStore.currentModel;

  private readonly globalCurrentModel = this.chatStore.globalCurrentModel;

  private readonly chatsLimitStep: number = 50;
  private chatsLimit: number = this.chatsLimitStep;

  constructor(
    private readonly router: Router,
    private readonly appService: AppService,
    private readonly chatRepositoryService: ChatRepositoryService,
    private readonly chatSocketService: ChatSocketService,
  ) {
    this.watchChatsUpdate()
  }

  private generateSequelId(localCounter: number): number {
    return Date.now() * 1000 + localCounter
  }

  /* Сборка истории сообщений для чата */

  private applySystemPrompt(model: ModelType, messages: ChatMessage[]): ChatMessage[] {
    const systemPrompt = this.modelSystemPrompts[model];
    if (!systemPrompt) return messages;

    const systemMessage: ChatMessage = {
      id: '',
      sequelId: 0,
      chatId: '',
      role: ChatMessageRole.SYSTEM,
      content: systemPrompt,
      model,
      state: ChatMessageState.COMPLETED,
      timestamp: 0,
    };

    return [systemMessage, ...messages];
  }

  private buildApiMessages(messageHistory: ChatMessage[], userMessage: ChatMessage, model: ModelType): ChatMessage[] {
    const historyTail = messageHistory.slice(-API_HISTORY_LIMIT); // Берём хвост из N сообщений
    const historyWithLastUserMsg = [...historyTail, userMessage]; // Добавляем userMessage в конец

    // Добавляем SYSTEM в начало, не мутируя исходный массив
    return this.applySystemPrompt(model, historyWithLastUserMsg); 
  }

  /* Чаты */

  getChats(limit: number): Promise<Chat[]> {
    return this.chatRepositoryService.getChats(limit);
  }

  getChatsCount(): Promise<number> {
    return this.chatRepositoryService.getChatsCount();
  }

  async updateChat(
    chatId: string,
    chatUpdateData: Partial<Omit<Chat, 'id'>>,
    triggerLastUpdate: boolean = true
  ): Promise<void> {
    const dataToUpdate: Partial<Omit<Chat, 'id'>> = {...chatUpdateData}
    if (triggerLastUpdate) dataToUpdate.lastUpdate = Date.now()

    await this.chatRepositoryService.updateChat(chatId, {...dataToUpdate})
  }

  async deleteChat(chatId: string): Promise<void> {
    await this.chatRepositoryService.deleteChat(chatId)
  }

  async deleteAllChats(): Promise<void> {
    this.stopAllRequests()

    await this.chatRepositoryService.deleteAllChats()
  }

  async loadChatsFromDB(): Promise<void> {
    const chats = await this.getChats(this.chatsLimit);
    this.chatStore.setChats(chats);
  }

  async loadChatsCountFromDB(): Promise<void> {
    const count = await this.getChatsCount();
    this.chatStore.setChatsCount(count);
  }

  private createChatEntity(name: string): Chat {
    return {
      id: crypto.randomUUID(),
      title: truncateAtWord(name, 100, null),
      state: ChatState.IDLE,
      model: this.currentModel() as ModelType,
      projectId: null,
      currentRequestId: null,
      lastUpdate: Date.now(),
    };
  }

  private watchChatsUpdate(): void {
    this.chatsUpdated$.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event === RepositoryEventType.CREATING || event === RepositoryEventType.DELETING) {
        this.loadChatsCountFromDB()
      }
      this.loadChatsFromDB()
    })
  }

  /* Сообщения */

  async getActiveChatMessages(): Promise<ChatMessage[]> {
    return this.chatRepositoryService.getMessages(this.activeChatId() || '');
  }

  private createMessageEntity(msg: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
    return {
      ...msg,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
  }

  /* Взаимодействие с моделями чатов */

  async loadCurrentModelFromDB(): Promise<void> {
    const loaded = await this.chatRepositoryService.loadCurrentModel();

    let modelToSet: ModelType;

    if (loaded && this.isModelAvailable(loaded)) {
      modelToSet = loaded;
    } else {
      modelToSet = this.getDefaultModel();
    }

    this.chatStore.setCurrentModel(modelToSet);
    this.chatStore.setGlobalCurrentModel(modelToSet);
  }

  async updateCurrentModel(model: ModelType): Promise<void> {
    let modelToSet: ModelType;

    if (this.isModelAvailable(model)) {
      modelToSet = model;
    } else {
      modelToSet = this.getDefaultModel();
    }

    this.chatStore.setCurrentModel(modelToSet);

    if (!this.activeChatId()) {
      this.chatStore.setGlobalCurrentModel(modelToSet);
      await this.chatRepositoryService.saveCurrentModel(modelToSet);
    }
  }

  private isModelAvailable(modelId: ModelType): boolean {
    return this.models.some(model => model.id === modelId);
  }

  private getDefaultModel(): ModelType {
    return this.models[0].id;
  }

  /* Навигация по чатам */

  initializeChat(chatId: string | null): void {
    this.chatStore.setActiveChatId(chatId);
    const activeChat = this.activeChat();

    if (activeChat) {
      this.updateCurrentModel(activeChat.model);
    } else {
      this.updateCurrentModel(this.globalCurrentModel());
    }

    if (this.appService.isMobile()) {
      this.appService.sidebarOpen.set(false);
    }
  }

  navigateToChat(chatId: string | null): void {
    this.router.navigate(['/chats', chatId || 'new'])
  }

  /* Отправка сообщений / работа с сокетами */

  sendMessage(
    text: string,
    messageHistory: ChatMessage[],
  ): Observable<SendMessageEvent> {
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
          const entity = this.createChatEntity(trimmed);
          await this.chatRepositoryService.createChat(entity);

          chat = entity;
          chatId = entity.id;
        }

        let sequelCounter = 0;
        const activeChatId = chatId;
        if (!activeChatId) {
          throw new Error('Chat ID is not available');
        }

        const userMessage: ChatMessage = this.createMessageEntity({
          sequelId: this.generateSequelId(sequelCounter++),
          role: ChatMessageRole.USER,
          model,
          state: ChatMessageState.COMPLETED,
          chatId: activeChatId,
          content: trimmed,
        });

        const assistantMessage = this.createMessageEntity({
          sequelId: this.generateSequelId(sequelCounter++),
          role: ChatMessageRole.ASSISTANT,
          model,
          state: ChatMessageState.STREAMING,
          chatId: activeChatId,
          content: '',
        });
        assistantMessageId = assistantMessage.id;

        // сохранение сообщений в бд
        await this.chatRepositoryService.createMessages([userMessage, assistantMessage]);

        // system + хвост истории + текущий userMessage
        const apiMessages = this.buildApiMessages(messageHistory, userMessage, model);

        // отправка запроса к модели
        const { requestId, stream$ } = this.chatSocketService.sendChatCompletion(model, apiMessages);

        // обновляем состояние чата
        this.updateChat(activeChatId, { model, state: ChatState.THINKING, currentRequestId: requestId })
        events$.next({
          type: SendMessageEventType.SENT,
          chatId: activeChatId,
          userMessage,
        });

        let lastPersistedContent = '';

        const persistStreamingContent = (): void => {
          if (content === lastPersistedContent) return;

          lastPersistedContent = content;
          this.chatRepositoryService.updateMessage(assistantMessage.id, { content })
        };

        const persistInterval = setInterval(persistStreamingContent, PERSIST_INTERVAL_MS);

        stream$.subscribe({
          next: (delta: string) => {
            content += delta;
            this.streamingStore.set(assistantMessage.id, content);
          },
          error: (err: unknown) => {
            clearInterval(persistInterval);
            this.updateChat(activeChatId, { model, state: ChatState.ERROR, currentRequestId: null })
            this.chatRepositoryService.updateMessage(assistantMessage.id, { content, state: ChatMessageState.ERROR })

            events$.error(err);
          },
          complete: () => {
            clearInterval(persistInterval);
            this.updateChat(activeChatId, { model, state: ChatState.IDLE, currentRequestId: null })
            this.chatRepositoryService.updateMessage(assistantMessage.id, { content, state: ChatMessageState.COMPLETED })

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
          this.updateChat(chatId, { model, state: ChatState.ERROR, currentRequestId: null })
        }

        if (assistantMessageId) {
          this.chatRepositoryService.updateMessage(
            assistantMessageId,
            { content, state: ChatMessageState.ERROR }
          )
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

  /* Обновление данных из indexed db */

  get projectsUpdated$(): Observable<RepositoryEventType> {
    return this.chatRepositoryService.projectsUpdated$
  }

  get chatsUpdated$(): Observable<RepositoryEventType> {
    return this.chatRepositoryService.chatsUpdated$
  }

  get messagesUpdated$(): Observable<RepositoryEventType> {
    return this.chatRepositoryService.messagesUpdated$
  }

  get settingsUpdated$(): Observable<RepositoryEventType> {
    return this.chatRepositoryService.settingsUpdated$
  }

  destroy(): void {
    this.stopAllRequests()
    this.chatSocketService.destroy()
  }
}
