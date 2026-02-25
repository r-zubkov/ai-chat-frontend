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
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ChatStore } from './chat.store';
import { StreamingStore } from './streaming.store';

const API_HISTORY_LIMIT = 6;

const MODEL_BASE_SYSTEM_PROMT = `
  Стиль:
  - Короткие абзацы, буллет-пойнты.
  - Markdown по умолчанию.
  - Иногда уместный эмодзи в начале абзаца.
  - Тон: спокойный, уверенный, без канцелярита.
  - Если есть код — отдельный блок с короткими комментариями.
  - Если задачу можно сделать по шагам — пронумеруй шаги.
`;

interface SendMessageOptions {
  onSend: (msg: ChatMessage) => void;
  onFinish: (msg: ChatMessage) => void;
  onError: (err: any) => void;
}

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
    private readonly appServbice: AppService,
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

    await this.chatRepositoryService.updateChat(chatId, {...chatUpdateData})
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

    if (this.appServbice.isMobile()) {
      this.appServbice.sidebarOpen.set(false);
    }
  }

  navigateToChat(chatId: string | null): void {
    this.router.navigate(['/chats', chatId || 'new'])
  }

  /* Отправка сообщений / работа с сокетами */

  async sendMessage(
    text: string,
    messageHistory: ChatMessage[],
    options: SendMessageOptions
  ): Promise<void> {
    const trimmed = text.trim();
    const model = this.currentModel();
    if (!trimmed || !model) return;

    let chat = this.activeChat();
    if (!chat) {
      const entity = this.createChatEntity(trimmed);
      await this.chatRepositoryService.createChat(entity);

      chat = entity;
    }

    let sequelCounter = 0;

    const userMessage: ChatMessage = this.createMessageEntity({
      sequelId: this.generateSequelId(sequelCounter++),
      role: ChatMessageRole.USER,
      model,
      state: ChatMessageState.COMPLETED,
      chatId: chat.id,
      content: trimmed,
    });

    const assistantMessage: ChatMessage = this.createMessageEntity({
      sequelId: this.generateSequelId(sequelCounter++),
      role: ChatMessageRole.ASSISTANT,
      model,
      state: ChatMessageState.STREAMING,
      chatId: chat.id,
      content: '',
    });

    // сохранение сообщений в бд
    await this.chatRepositoryService.createMessages([userMessage, assistantMessage]);

    // system + хвост истории + текущий userMessage
    const apiMessages = this.buildApiMessages(messageHistory, userMessage, model);

    // отправка запроса к модели
    const { requestId, stream$ } = this.chatSocketService.sendChatCompletion(model, apiMessages);

    // обновляем состояние чата
    this.updateChat(chat.id, { model, state: ChatState.THINKING, currentRequestId: requestId })

    let content = '';

    stream$.subscribe({
      next: (delta: string) => {
        content += delta;
        this.streamingStore.set(assistantMessage.id, content);
      },
      error: (err: any) => {
        this.updateChat(chat.id, { model, state: ChatState.ERROR, currentRequestId: null })
        this.chatRepositoryService.updateMessage(assistantMessage.id, { content, state: ChatMessageState.ERROR })
        this.streamingStore.remove(assistantMessage.id);

        options.onError(err);
      },
      complete: () => {
        this.updateChat(chat.id, { model, state: ChatState.IDLE, currentRequestId: null })
        this.chatRepositoryService.updateMessage(assistantMessage.id, { content, state: ChatMessageState.COMPLETED })
        this.streamingStore.remove(assistantMessage.id);

        options.onFinish({ ...assistantMessage, content });
      },
    });

    options.onSend(userMessage);
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
