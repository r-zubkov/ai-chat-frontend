import { computed, Injectable, signal } from '@angular/core';
import { Chat, ChatState } from '../types/chat';
import { ModelType } from '../types/model-type';
import { ChatRepositoryService, RepositoryEventType } from './chat-repository.service';
import { ChatSocketService } from './chat-socket.service';
import { debounceTime, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppService } from './app.service';
import { truncateAtWord } from '../helpers/text-utils';
import { ModelLabelMap } from '../maps/model-label.map';
import { ChatMessage, ChatMessageMeta, ChatMessageRole, ChatMessageState } from '../types/chat-message';

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

  private readonly saveSubject = new Subject<Chat[]>();

  constructor(
    private readonly appServbice: AppService,
    private readonly chatRepositoryService: ChatRepositoryService,
    private readonly chatSocketService: ChatSocketService
  ) {
    this.watchChatsUpdate()
  }

  private subscribeToSaveSubject(): void {
    this.saveSubject
      .pipe(
        debounceTime(2000),
        takeUntilDestroyed()
      )
      .subscribe((chats) => this.saveChats(chats));
  }

  private applySystemPrompt(chatId: string, model: ModelType, messages: ChatMessage[]): ChatMessage[] {
    const systemPrompt = this.modelSystemPrompts[model];
    if (!systemPrompt) return messages;

    const systemMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: ChatMessageRole.SYSTEM,
      content: systemPrompt,
      model,
      state: ChatMessageState.COMPLETED,
      chatId,
      timestamp: Date.now(),
    };

    return [systemMessage, ...messages];
  }

  private buildApiMessages(chat: Chat, userMessage: ChatMessage, model: ModelType): ChatMessage[] {
    const historyTail = chat.messages.slice(-API_HISTORY_LIMIT); // Берём хвост из N сообщений
    const historyWithLastUserMsg = [...historyTail, userMessage]; // Добавляем userMessage в конец

    // Добавляем SYSTEM в начало, не мутируя исходный массив
    return this.applySystemPrompt(chat.id, model, historyWithLastUserMsg); 
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

  watchChatsUpdate(): void {
    this.chatRepositoryService.chatsUpdated$.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event === RepositoryEventType.CREATING || event === RepositoryEventType.DELETING) {
        this.loadChatsCount()
      }
      this.loadChats()
    })
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

  navigateToChat(chatId: string | null): void {
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

  private createChatEntity(name: string): Chat {
    return {
      id: crypto.randomUUID(),
      title: truncateAtWord(name, 100, null),
      state: ChatState.IDLE,
      model: this.currentModel() as ModelType,
      projectId: null,
      currentRequestId: null,
      lastUpdate: Date.now(),
      messages: [],
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

  updateMessageContent(
    chatId: string,
    messageId: string,
    content: string,
  ): void {
    const chats = this.chats();
    const chatIndex = chats.findIndex(c => c.id === chatId);
    if (chatIndex === -1) return;

    const chat = chats[chatIndex];
    const messageIndex = chat.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const message = chat.messages[messageIndex];
    if (message.content === content) return; // ничего не изменилось

    const updatedMessage = {
      ...message,
      content,
    };

    const updatedMessages = [...chat.messages];
    updatedMessages[messageIndex] = updatedMessage;

    const updatedChat = {
      ...chat,
      lastUpdate: Date.now(),
      messages: updatedMessages,
    };

    const nextChats = [...chats];
    nextChats[chatIndex] = updatedChat;

    this.chats.set(nextChats);
    this.saveSubject.next(nextChats);
  }

  private buildMessageMeta(content: string): ChatMessageMeta {
    const length = content.length;

    return { length }
  }

  private buildMessageMetaFromMessage(message: ChatMessage): ChatMessageMeta {
    return this.buildMessageMeta(message.content ?? '')
  }

  private addMessageMeta(chatId: string, messageId: string): void {
    const chats = this.chats();
    const chatIndex = chats.findIndex(c => c.id === chatId);
    if (chatIndex === -1) return;

    const chat = chats[chatIndex];
    const messageIndex = chat.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const message = chat.messages[messageIndex];

    if (message.meta) return;

    const { length } = this.buildMessageMetaFromMessage(message)

    const updatedMessage: ChatMessage = {
      ...message,
      meta: { length },
    };

    const updatedMessages = [...chat.messages];
    updatedMessages[messageIndex] = updatedMessage;

    const updatedChat: Chat = {
      ...chat,
      messages: updatedMessages,
    };

    const nextChats = [...chats];
    nextChats[chatIndex] = updatedChat;

    this.chats.set(nextChats);
    this.saveSubject.next(nextChats);
  }

  async sendMessage(
    text: string,
    onSend: (msg: ChatMessage) => void,
    onFinish: (msg: ChatMessage) => void,
    onError: (err: any) => void,
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
      role: ChatMessageRole.USER,
      model,
      state: ChatMessageState.COMPLETED,
      chatId: chat.id,
      content: trimmed,
      meta: this.buildMessageMeta(trimmed),
      timestamp: Date.now(),
    };

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: ChatMessageRole.ASSISTANT,
      model,
      state: ChatMessageState.STREAMING,
      chatId: chat.id,
      content: '',
      timestamp: Date.now(),
    };

    await this.chatRepositoryService.createMessages([userMessage, assistantMessage]);

    onSend(userMessage);

    // system + хвост истории + текущий userMessage
    const apiMessages = this.buildApiMessages(chat, userMessage, model);

    // отправка запроса к модели
    const { requestId, stream$ } = this.chatSocketService.sendChatCompletion(model, apiMessages);

    // обновляем состояние чата
    this.updateChat(chat.id, { model, state: ChatState.THINKING, currentRequestId: requestId })

    let content = '';

    stream$.subscribe({
      next: (delta: string) => {
        content += delta;
        // this.updateMessageContent(chat.id, assistantMessage.id, content)
      },
      error: (err: any) => {
        // финальный флеш, чтобы не потерять хвост
        //this.updateMessageContent(chat.id, assistantMessage.id, content);
        //this.addMessageMeta(chat.id, assistantMessage.id);
        this.updateChat(chat.id, { model, state: ChatState.ERROR, currentRequestId: null })

        onError(err);
      },
      complete: () => {
        // финальный флеш
        //this.updateMessageContent(chat.id, assistantMessage.id, content);
        //this.addMessageMeta(chat.id, assistantMessage.id);
        this.updateChat(chat.id, { model, state: ChatState.IDLE, currentRequestId: null })

        onFinish({ ...assistantMessage, content });
      },
    });
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
}
