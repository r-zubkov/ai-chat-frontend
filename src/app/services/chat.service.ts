import { computed, Injectable, signal } from '@angular/core';
import { Chat, ChatState } from '../types/chat';
import { ModelType } from '../types/model-type';
import { ChatRepositoryService } from './chat-repository.service';
import { ChatSocketService } from './chat-socket.service';
import { debounceTime, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppService } from './app.service';
import { truncateAtWord } from '../helpers/text-utils';
import { ModelLabelMap } from '../maps/model-label.map';
import { ChatMessage, ChatMessageMeta, ChatMessageRole } from '../types/chat-message';
import { DexieEventType } from '../common/chat.db';

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
    this.subscribeToSaveSubject()
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
      chatId,
      timestamp: Date.now(),
    };

    return [systemMessage, ...messages];
  }

  private buildApiMessages(
    chat: Chat,
    userMessage: ChatMessage,
    model: ModelType,
  ): ChatMessage[] {
    // Берём хвост N сообщений (хронологический порядок сохраняется)
    const historyTail = chat.messages.slice(-API_HISTORY_LIMIT);

    // Добавляем текущий userMessage в конец
    const historyWithLastUserMsg = [...historyTail, userMessage];

    // добавить SYSTEM в начало, не мутируя исходный массив
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
      if (event === DexieEventType.CREATING || event === DexieEventType.DELETING) {
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

  private createChat(name: string): Chat {
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

  updateChat(chat: Chat): void {
    const chats = [...this.chats()];
    const index = chats.findIndex((c) => c.id === chat.id);

    const updatedChat: Chat = {
      ...chat,
      lastUpdate: Date.now(),
    };

    if (index === -1) {
      chats.unshift(updatedChat);
    } else {
      chats[index] = updatedChat;

      // Если чат не сверху — переносим
      if (index !== 0) {
        chats.splice(index, 1); // удалить
        chats.unshift(updatedChat); // перенести в начало
      }
    }

    this.chats.set(chats);

    // Ставим активный чат если ещё не выбран
    if (!this.activeChatId()) {
      this.activeChatId.set(updatedChat.id);
    }

    // Небольшой дебаунс на сохранение
    this.saveSubject.next(chats);
  }

  updateChatTitle(chatId: string, title: string): void {
    const trimmed = title.trim();
    if (!trimmed) return;

    const chats = this.chats();
    const index = chats.findIndex(c => c.id === chatId);
    if (index === -1) return;

    const chat = chats[index];
    if (chat.title === trimmed) return; // ничего не менялось

    const updatedChat: Chat = {
      ...chat,
      title: trimmed,
    };

    const nextChats = [...chats];
    nextChats[index] = updatedChat;

    this.chats.set(nextChats);
    this.saveSubject.next(nextChats);
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

  private updateChatRequestState(
    chatId: string,
    state: ChatState,
    requestId: string | null
  ): void {
    const chats = [...this.chats()];
    const idx = chats.findIndex(c => c.id === chatId);
    if (idx === -1) return;

    const chat = chats[idx];
    chats[idx] = {
      ...chat,
      lastUpdate: Date.now(),
      state,
      currentRequestId: requestId,
    };

    this.chats.set(chats);
    this.saveSubject.next(chats);
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

  deleteChat(chatId: string): void {
    const chats = [...this.chats()];
    const index = chats.findIndex(c => c.id === chatId);

    if (index === -1) {
      return; // ничего удалять
    }

    const currentRequestId = chats[index]?.currentRequestId
    if (currentRequestId) this.stopRequest(currentRequestId)

    chats.splice(index, 1);
    this.chats.set(chats);
    this.saveChats(chats);

    // если удаляли активный чат — сбрасываем activeChatId
    if (this.activeChatId() === chatId) {
      this.activeChatId.set(null);
    }
  }

  deleteAllChats(): void {
    this.stopAllRequests()

    this.chats.set([]); 
    this.saveChats([]);

    this.navigateToChat(null)
  }

  sendMessage(
    text: string,
    onSend: (msg: ChatMessage) => void,
    onFinish: (msg: ChatMessage) => void,
    onError: (err: any) => void,
  ): void {
    const trimmed = text.trim();
    const model = this.currentModel();
    if (!trimmed || !model) return;

    const currentModel = model as ModelType;

    const chat = this.activeChat() ?? this.createChat(trimmed);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: ChatMessageRole.USER,
      model: currentModel,
      chatId: chat.id,
      content: trimmed,
      meta: this.buildMessageMeta(trimmed),
      timestamp: Date.now(),
    };

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: ChatMessageRole.ASSISTANT,
      model: currentModel,
      chatId: chat.id,
      content: '',
      timestamp: Date.now(),
    };

    // кладём user + assistant (пустой) и ставим THINKING
    this.updateChat({
      ...chat,
      state: ChatState.THINKING,
      currentRequestId: null, // пока не знаем requestId
      model: currentModel,
      messages: [...chat.messages, userMessage, assistantMessage],
    });

    onSend(userMessage);

    // system + хвост истории + текущий userMessage
    const apiMessages = this.buildApiMessages(chat, userMessage, currentModel);

    const { requestId, stream$ } = this.chatSocketService.sendChatCompletion(currentModel, apiMessages);

    // ставим requestId
    this.updateChatRequestState(chat.id, ChatState.THINKING, requestId);

    let content = '';

    stream$.subscribe({
      next: (delta: string) => {
        content += delta;
        this.updateMessageContent(chat.id, assistantMessage.id, content)
      },
      error: (err: any) => {
        // финальный флеш, чтобы не потерять хвост
        this.updateMessageContent(chat.id, assistantMessage.id, content);
        this.addMessageMeta(chat.id, assistantMessage.id);
        this.updateChatRequestState(chat.id, ChatState.ERROR, null);

        onError(err);
      },
      complete: () => {
        // финальный флеш
        this.updateMessageContent(chat.id, assistantMessage.id, content);
        this.addMessageMeta(chat.id, assistantMessage.id);
        this.updateChatRequestState(chat.id, ChatState.IDLE, null);

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
