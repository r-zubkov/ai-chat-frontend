import { inject, Injectable } from '@angular/core';
import { Chat } from '../types/chat';
import { ModelType } from '../types/model-type';
import { ChatRepositoryService, RepositoryEventType } from './chat-repository.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppService } from './app.service';
import { ModelLabelMap } from '../maps/model-label.map';
import { ChatMessage } from '../types/chat-message';
import { SendMessageEvent } from '../types/send-message-event';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ChatStore } from './chat.store';
import { ChatMessagingService } from './chat-messaging.service';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly chatStore = inject(ChatStore);
  private readonly router = inject(Router);
  private readonly appService = inject(AppService);
  private readonly chatRepositoryService = inject(ChatRepositoryService);
  private readonly chatMessagingService = inject(ChatMessagingService);

  readonly models: Array<{ id: ModelType; label: string }> = [
    { id: ModelType.GROK_4_FAST, label: ModelLabelMap[ModelType.GROK_4_FAST]! },
    { id: ModelType.DEEPSEEK_32, label: ModelLabelMap[ModelType.DEEPSEEK_32]! },
    {
      id: ModelType.GEMINI_3_FLASH_PREVIEW,
      label: ModelLabelMap[ModelType.GEMINI_3_FLASH_PREVIEW]!,
    },
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

  constructor() {
    this.watchChatsUpdate();
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
    triggerLastUpdate: boolean = true,
  ): Promise<void> {
    const dataToUpdate: Partial<Omit<Chat, 'id'>> = { ...chatUpdateData };
    if (triggerLastUpdate) dataToUpdate.lastUpdate = Date.now();

    await this.chatRepositoryService.updateChat(chatId, { ...dataToUpdate });
  }

  async deleteChat(chatId: string): Promise<void> {
    await this.chatRepositoryService.deleteChat(chatId);
  }

  async deleteAllChats(): Promise<void> {
    this.stopAllRequests();

    await this.chatRepositoryService.deleteAllChats();
  }

  async loadChatsFromDB(): Promise<void> {
    const chats = await this.getChats(this.chatsLimit);
    this.chatStore.setChats(chats);
  }

  async loadChatsCountFromDB(): Promise<void> {
    const count = await this.getChatsCount();
    this.chatStore.setChatsCount(count);
  }

  private watchChatsUpdate(): void {
    this.chatsUpdated$.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event === RepositoryEventType.CREATING || event === RepositoryEventType.DELETING) {
        this.loadChatsCountFromDB();
      }
      this.loadChatsFromDB();
    });
  }

  /* Сообщения */

  async getActiveChatMessages(): Promise<ChatMessage[]> {
    return this.chatRepositoryService.getMessages(this.activeChatId() || '');
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
    return this.models.some((model) => model.id === modelId);
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
    this.router.navigate(['/chats', chatId || 'new']);
  }

  /* Отправка сообщений / работа с сокетами */

  sendMessage(text: string, messageHistory: ChatMessage[]): Observable<SendMessageEvent> {
    return this.chatMessagingService.sendMessage(text, messageHistory);
  }

  stopRequest(requestId: string): void {
    this.chatMessagingService.stopRequest(requestId);
  }

  stopAllRequests(): void {
    this.chatMessagingService.stopAllRequests();
  }

  /* Обновление данных из indexed db */

  get projectsUpdated$(): Observable<RepositoryEventType> {
    return this.chatRepositoryService.projectsUpdated$;
  }

  get chatsUpdated$(): Observable<RepositoryEventType> {
    return this.chatRepositoryService.chatsUpdated$;
  }

  get messagesUpdated$(): Observable<RepositoryEventType> {
    return this.chatRepositoryService.messagesUpdated$;
  }

  get settingsUpdated$(): Observable<RepositoryEventType> {
    return this.chatRepositoryService.settingsUpdated$;
  }

  destroy(): void {
    this.chatMessagingService.destroy();
  }
}
