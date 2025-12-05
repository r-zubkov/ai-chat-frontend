import { computed, Injectable, signal } from '@angular/core';
import { Chat, ChatMessage } from '../models/chat.model';
import { ModelType } from '../types/model-type';
import { ChatMessageRole } from '../types/chat-message-role';
import { StorageService } from './storage.service';
import { ChatState } from '../types/chat-state';
import { ChatSocketService } from './chat-socket.service';
import { debounceTime, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppService } from './app.service';

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

export const ModelLabelMap = {
  [ModelType.GPT5]: 'GPT 5',
  [ModelType.GPT5_MINI]: 'GPT 5 mini',
  [ModelType.GROK_4_FAST]: 'Grok 4 Fast',
  [ModelType.GEMINI_25_FLASH]: 'Gemini 2.5 Flash',
} 

@Injectable({ providedIn: 'root' })
export class ChatService {
  readonly modelSystemPrompts: Record<string, string> = {
    [ModelType.GPT5]: MODEL_BASE_SYSTEM_PROMT,
    [ModelType.GPT5_MINI]: MODEL_BASE_SYSTEM_PROMT,
    [ModelType.GEMINI_25_FLASH]: MODEL_BASE_SYSTEM_PROMT,
  };

  readonly models = [
    { id: ModelType.GPT5, label: ModelLabelMap[ModelType.GPT5] },
    { id: ModelType.GPT5_MINI, label: ModelLabelMap[ModelType.GPT5_MINI] },
    { id: ModelType.GROK_4_FAST, label: ModelLabelMap[ModelType.GROK_4_FAST] },
    { id: ModelType.GEMINI_25_FLASH, label: ModelLabelMap[ModelType.GEMINI_25_FLASH] }
  ];

  private globalCurrentModel = signal<ModelType>(ModelType.GROK_4_FAST);

  readonly currentModel = signal<ModelType>(ModelType.GROK_4_FAST);

  readonly chats = signal<Chat[]>([]);

  readonly activeChatId = signal<string | null>(null);
  
  readonly activeChat = computed<Chat | null>(() => this.chats().find((chat) => chat.id === this.activeChatId()) || null);
  readonly activeChatView = computed<Chat | null>(() => {
    const chat = this.activeChat();
    if (!chat) return null;

    return {
      ...chat,
      messages: chat.messages.filter(msg => msg.role !== ChatMessageRole.SYSTEM),
    };
  });

  private readonly saveSubject = new Subject<Chat[]>();

  constructor(
    private readonly appServbice: AppService,
    private readonly storage: StorageService,
    private readonly chatSocketService: ChatSocketService
  ) {
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

  private applySystemPrompt(model: ModelType, messages: ChatMessage[]): ChatMessage[] {
    const systemPrompt = this.modelSystemPrompts[model];
    if (!systemPrompt) return messages;

    const systemMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: ChatMessageRole.SYSTEM,
      content: systemPrompt,
      model: model,
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
    return this.applySystemPrompt(model, historyWithLastUserMsg);
  }

  private saveChats(chats: Chat[]): void {
    this.storage.saveChats(chats);
  }

  loadChatsFromLocalStorage(): void {
    const loaded = this.storage.loadChats();

    // TODO: remove fallback later
    loaded.forEach(chat => {
      if (!('lastUpdate' in chat)) {
        (chat as any).lastUpdate = Date.now();
      }

      if (!('currentRequestId' in chat)) {
        (chat as any).currentRequestId = null;
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
    const loaded = this.storage.loadCurrentModal();

    if (loaded) {
      this.currentModel.set(loaded);
      this.globalCurrentModel.set(loaded);
    }
  }

  updateCurrentModel(model: ModelType): void {
    this.currentModel.set(model);

    // for global use
    if (!this.activeChatId()) {
      this.globalCurrentModel.set(model);
      this.storage.saveCurrentModel(this.globalCurrentModel());
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

  private createChat(name: string | null = null): Chat {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');

    const generatedTitle = `${pad(now.getDate())}-${pad(
      now.getMonth() + 1,
    )}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    return {
      id: crypto.randomUUID(),
      title: name || generatedTitle,
      state: ChatState.IDLE,
      model: this.currentModel() as ModelType,
      lastUpdate: Date.now(),
      currentRequestId: null,
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

      // Если чет не сверху — переносим
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
    if (!trimmed || !this.currentModel()) return;

    const currentModel = this.currentModel() as ModelType;

    const chat: Chat = this.activeChat() ?? this.createChat(trimmed);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: ChatMessageRole.USER,
      model: currentModel,
      content: trimmed,
      timestamp: Date.now(),
    };

    // База для UI-истории (БЕЗ system)
    const baseMessages = [...chat.messages, userMessage];

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: ChatMessageRole.ASSISTANT,
      model: currentModel,
      content: '',
      timestamp: Date.now(),
    };

    const messagesWithAssistant = [...baseMessages, assistantMessage];

    // --- ТОЛЬКО для API: system + хвост истории + текущий userMessage
    const apiMessages = this.buildApiMessages(chat, userMessage, currentModel);

    // Запускаем стрим по сокету
    const { requestId, stream$ } = this.chatSocketService.sendChatCompletion(currentModel, apiMessages);

    let updatedChat: Chat = {
      ...chat,
      state: ChatState.THINKING,
      currentRequestId: requestId,
      messages: messagesWithAssistant, // без SYSTEM
    };

    this.updateChat(updatedChat);
    onSend(userMessage);

    stream$.subscribe({
      next: (delta: string) => {
        assistantMessage.content += delta;

        updatedChat = {
          ...updatedChat,
          messages: [
            ...baseMessages,
            {
              ...assistantMessage,
              content: assistantMessage.content,
            },
          ],
        };

        this.updateChat(updatedChat);
      },
      error: (err: any) => {
        this.updateChat({
          ...updatedChat,
          state: ChatState.ERROR,
          currentRequestId: null,
        });

        onError(err);
      },
      complete: () => {
        this.updateChat({
          ...updatedChat,
          state: ChatState.IDLE,
          currentRequestId: null,
        });

        onFinish(assistantMessage);
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
