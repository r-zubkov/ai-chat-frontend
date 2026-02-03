import { computed, Injectable, signal } from '@angular/core';
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
  readonly modelSystemPrompts: Partial<Record<ModelType, string>> = {
    [ModelType.GPT_51]: MODEL_BASE_SYSTEM_PROMT,
    [ModelType.GPT_5_MINI]: MODEL_BASE_SYSTEM_PROMT,
    [ModelType.GEMINI_3_FLASH_PREVIEW]: MODEL_BASE_SYSTEM_PROMT,
  };

  readonly models: Array<{ id: ModelType; label: string }> = [
    { id: ModelType.GROK_4_FAST, label: ModelLabelMap[ModelType.GROK_4_FAST]! },
    { id: ModelType.GPT_51, label: ModelLabelMap[ModelType.GPT_51]! },
    { id: ModelType.GPT_5_MINI, label: ModelLabelMap[ModelType.GPT_5_MINI]! },
    { id: ModelType.GEMINI_3_FLASH_PREVIEW, label: ModelLabelMap[ModelType.GEMINI_3_FLASH_PREVIEW]! }
  ];

  private readonly globalCurrentModel = signal<ModelType>(ModelType.GROK_4_FAST);

  readonly currentModel = signal<ModelType>(ModelType.GROK_4_FAST);

  readonly chats = signal<Chat[]>([]);
  readonly chatsCount = signal<number>(0);

  readonly activeChatId = signal<string | null>(null);
  readonly activeChat = computed<Chat | null>(() => this.chats().find((chat) => chat.id === this.activeChatId()) || null);

  private readonly chatsLimitStep: number = 50;
  private chatsLimit: number = this.chatsLimitStep;

  private sequelCounter = 0;

  constructor(
    private readonly router: Router,
    private readonly appServbice: AppService,
    private readonly chatRepositoryService: ChatRepositoryService,
    private readonly chatSocketService: ChatSocketService,
  ) {
    this.watchChatsUpdate()
  }

  private generateSequelId(): number {
    return Date.now() * 1000 + this.sequelCounter++
  }

  private applySystemPrompt(model: ModelType, messages: ChatMessage[]): ChatMessage[] {
    const systemPrompt = this.modelSystemPrompts[model];
    if (!systemPrompt) return messages;

    const systemMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sequelId: this.generateSequelId(),
      chatId: '',
      role: ChatMessageRole.SYSTEM,
      content: systemPrompt,
      model,
      state: ChatMessageState.COMPLETED,
      timestamp: Date.now(),
    };

    return [systemMessage, ...messages];
  }

  private buildApiMessages(messageHistory: ChatMessage[], userMessage: ChatMessage, model: ModelType): ChatMessage[] {
    const historyTail = messageHistory.slice(-API_HISTORY_LIMIT); // Берём хвост из N сообщений
    const historyWithLastUserMsg = [...historyTail, userMessage]; // Добавляем userMessage в конец

    // Добавляем SYSTEM в начало, не мутируя исходный массив
    return this.applySystemPrompt(model, historyWithLastUserMsg); 
  }

  private saveChats(chats: Chat[]): void {
    this.chatRepositoryService.saveChats(chats);
  }

  async loadChats(): Promise<void> {
    const chats = await this.chatRepositoryService.getChats(this.chatsLimit);
    this.chats.set(chats);
  }

  async loadChatsCount(): Promise<void> {
    const count = await this.chatRepositoryService.getChatsCount();
    this.chatsCount.set(count);
  }

  private watchChatsUpdate(): void {
    this.chatsUpdated$.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event === RepositoryEventType.CREATING || event === RepositoryEventType.DELETING) {
        this.loadChatsCount()
      }
      this.loadChats()
    })
  }

  async getMessages(): Promise<ChatMessage[]> {
    return this.chatRepositoryService.getMessages(this.activeChatId() || '');
  }

  loadChatsFromLocalStorage(): void {
    const loaded = this.chatRepositoryService.loadChats();

    // TODO: remove fallback later
    loaded.forEach(chat => {
      if (!('projectId' in chat)) {
        (chat as any).projectId = null;
      }
    })
    
    // complete thinking state
    loaded.forEach(chat => {
      if (chat.state === ChatState.THINKING) {
        chat.state = ChatState.IDLE;
        chat.currentRequestId = null;
      }
    });

    this.chats.set(loaded);
  }

  loadCurrentModelFromLocalStorage(): void {
    const loaded = this.chatRepositoryService.loadCurrentModal() as ModelType | null;

    let modelToSet: ModelType;

    if (loaded && this.isModelAvailable(loaded)) {
      modelToSet = loaded;
    } else {
      modelToSet = this.getDefaultModel();
    }

    this.currentModel.set(modelToSet);
    this.globalCurrentModel.set(modelToSet);
  }

  private isModelAvailable(modelId: ModelType): boolean {
    return this.models.some(model => model.id === modelId);
  }

  private getDefaultModel(): ModelType {
    return this.models[0].id;
  }

  updateCurrentModel(model: ModelType): void {
    let modelToSet: ModelType;

    if (this.isModelAvailable(model)) {
      modelToSet = model;
    } else {
      modelToSet = this.getDefaultModel();
    }

    this.currentModel.set(modelToSet);

    // for global use
    if (!this.activeChatId()) {
      this.globalCurrentModel.set(modelToSet);
      this.chatRepositoryService.saveCurrentModel(this.globalCurrentModel());
    }
  }

  initializeChat(chatId: string | null): void {
    this.activeChatId.set(chatId);
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
    this.router.navigate(['/chat', chatId || 'new'])
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

  async updateChat(chatId: string, chatUpdateData: Partial<Omit<Chat, 'id'>>): Promise<void> {
    await this.chatRepositoryService.updateChat(chatId, {...chatUpdateData})
  }

  async deleteChat(chatId: string): Promise<void> {
    await this.chatRepositoryService.deleteChat(chatId)
  }

  async deleteAllChats(): Promise<void> {
    this.stopAllRequests()

    await this.chatRepositoryService.deleteAllChats()
  }

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

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sequelId: this.generateSequelId(),
      role: ChatMessageRole.USER,
      model,
      state: ChatMessageState.COMPLETED,
      chatId: chat.id,
      content: trimmed,
      timestamp: Date.now(),
    };

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sequelId: this.generateSequelId(),
      role: ChatMessageRole.ASSISTANT,
      model,
      state: ChatMessageState.STREAMING,
      chatId: chat.id,
      content: '',
      timestamp: Date.now(),
    };

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
        this.chatRepositoryService.updateMessage(assistantMessage.id, { content })
      },
      error: (err: any) => {
        this.updateChat(chat.id, { model, state: ChatState.ERROR, currentRequestId: null })
        this.chatRepositoryService.updateMessage(assistantMessage.id, { content, state: ChatMessageState.ERROR })

        options.onError(err);
      },
      complete: () => {
        this.updateChat(chat.id, { model, state: ChatState.IDLE, currentRequestId: null })
        this.chatRepositoryService.updateMessage(assistantMessage.id, { content, state: ChatMessageState.COMPLETED })

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

  destroy(): void {
    this.stopAllRequests()
    this.chatSocketService.destroy()
  }

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
}
