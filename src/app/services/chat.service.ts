import { computed, Injectable, signal } from '@angular/core';
import { Chat, ChatMessage } from '../models/chat.model';
import { ModelType } from '../types/model-type';
import { ChatMessageRole } from '../types/chat-message-role';
import { StorageService } from './storage.service';
import { ChatState } from '../types/chat-state';
import { ChatSocketService } from './chat-socket.service';
import { debounceTime, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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

  readonly currentModel = signal<string>(ModelType.GROK_4_FAST);

  readonly chats = signal<Chat[]>([]);
  readonly activeChatId = signal<string | null>(null);
  readonly activeChat = computed(() => this.chats().find((c) => c.id === this.activeChatId()) || null);

  private currentRequestId: string | null = null;

  private readonly saveSubject = new Subject<Chat[]>();

  constructor(
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

  private applySystemPrompt(model: string, messages: ChatMessage[]): ChatMessage[] {
    const systemPrompt = this.modelSystemPrompts[model];
    if (!systemPrompt) {
      return messages;
    }

    const [first, ...rest] = messages;
    if (first?.role === 'system') {
      return messages; // Если уже есть системное сообщение
    }

    const systemMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: ChatMessageRole.SYSTEM,
      content: systemPrompt,
      model: this.currentModel() as ModelType,
      timestamp: Date.now(),
    };

    return [systemMessage, ...messages];
  }

  private saveChats(chats: Chat[]): void {
    this.storage.saveChats(chats);
  }

  loadChatsFromLocalStorage(): void {
    const loaded = this.storage.loadChats();
    this.chats.set(loaded);
  }

  loadCurrentModelFromLocalStorage(): void {
    const loaded = this.storage.loadCurrentModal();
    if (loaded) this.currentModel.set(loaded);
  }

  updateCurrentModel(model: ModelType): void {
    this.currentModel.set(model)
    this.storage.saveCurrentModel(model)
  }

  createChat(name: string | null = null): Chat {
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
      messages: [],
    };
  }

  updateChat(chat: Chat): void {
    const chats = [...this.chats()];
    const index = chats.findIndex((c) => c.id === chat.id);

    if (index === -1) {
      chats.unshift(chat);
    } else {  
      chats[index] = chat;
    }

    this.chats.set(chats);
    // set active chat id only from new chat state
    if (!this.activeChatId()) this.activeChatId.set(chat.id);
    // small debounce time
    this.saveSubject.next(chats);
  }

  deleteChat(chatId: string): void {
    const chats = [...this.chats()];
    const index = chats.findIndex(c => c.id === chatId);

    if (index === -1) {
      return; // ничего удалять
    }

    chats.splice(index, 1);
    this.chats.set(chats);
    this.saveChats(chats);

    // если удаляли активный чат — сбрасываем activeChatId
    if (this.activeChatId() === chatId) {
      this.activeChatId.set(null);
    }
  }

  deleteAllChats(): void {
    this.chats.set([]);
    this.saveChats([]);
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

    const messagesWithUser = [...chat.messages, userMessage];
    const messagesWithSystem = this.applySystemPrompt(
      this.currentModel(),
      messagesWithUser,
    );

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: ChatMessageRole.ASSISTANT,
      model: currentModel,
      content: '',
      timestamp: Date.now(),
    };

    const messagesWithAssistant = [...messagesWithSystem, assistantMessage];

    let updatedChat: Chat = {
      ...chat,
      state: ChatState.THINKING,
      messages: messagesWithAssistant,
    };

    this.updateChat(updatedChat);
    onSend(userMessage);

    // --- Запускаем стрим по сокету ---
    const { requestId, stream$ } = this.chatSocketService
      .sendChatCompletion(currentModel, messagesWithSystem);

    this.currentRequestId = requestId;

    stream$.subscribe({
      next: (delta: string) => {
        assistantMessage.content += delta;

        updatedChat = {
          ...updatedChat,
          messages: [
            ...messagesWithSystem,
            {
              ...assistantMessage,
              content: assistantMessage.content,
            },
          ],
        };

        this.updateChat(updatedChat);
      },
      error: (err: any) => {
        this.currentRequestId = null;

        this.updateChat({
          ...updatedChat,
          state: ChatState.ERROR,
        });

        onError(err);
      },
      complete: () => {
        this.currentRequestId = null;

        this.updateChat({
          ...updatedChat,
          state: ChatState.IDLE,
        });

        onFinish(assistantMessage);
      },
    });
  }

  stopCurrentRequest(): void {
    if (this.currentRequestId) {
      this.chatSocketService.abortRequest(this.currentRequestId);
    }
  }
}
