import { inject, Injectable } from '@angular/core';
import { Chat } from '../types/chat';
import { ModelType } from '../types/model-type';
import { ChatRepositoryService, RepositoryEventType } from './chat-repository.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppService } from './app.service';
import { ChatMessage } from '../types/chat-message';
import { SendMessageEvent } from '../types/send-message-event';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ChatStore } from './chat.store';
import { ChatConversationService } from './chat-conversation.service';
import { ChatPersistenceService } from './chat-persistence.service';
import { ChatModelService } from './chat-model.service';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly chatStore = inject(ChatStore);
  private readonly router = inject(Router);
  private readonly appService = inject(AppService);
  private readonly chatRepositoryService = inject(ChatRepositoryService);
  private readonly chatConversationService = inject(ChatConversationService);
  private readonly chatPersistenceService = inject(ChatPersistenceService);
  private readonly chatModelService = inject(ChatModelService);

  readonly models = this.chatModelService.models;

  readonly chats = this.chatStore.chats;
  readonly chatsCount = this.chatStore.chatsCount;
  readonly activeChatId = this.chatStore.activeChatId;
  readonly activeChat = this.chatStore.activeChat;
  readonly currentModel = this.chatModelService.currentModel;

  private readonly chatsLimitStep: number = 50;
  private chatsLimit: number = this.chatsLimitStep;

  constructor() {
    this.watchChatsUpdate();
  }

  /* Chats */

  getChats(limit: number): Promise<Chat[]> {
    return this.chatRepositoryService.getChats(limit);
  }

  getChatsCount(): Promise<number> {
    return this.chatRepositoryService.getChatsCount();
  }

  updateChat(
    chatId: string,
    chatUpdateData: Partial<Omit<Chat, 'id'>>,
    triggerLastUpdate: boolean = true,
  ): Promise<void> {
    return this.chatPersistenceService.updateChat(chatId, chatUpdateData, triggerLastUpdate);
  }

  deleteChat(chatId: string): Promise<void> {
    return this.chatPersistenceService.deleteChat(chatId);
  }

  async deleteAllChats(): Promise<void> {
    this.stopAllRequests();

    await this.chatPersistenceService.deleteAllChats();
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

  /* Messages */

  async getActiveChatMessages(): Promise<ChatMessage[]> {
    return this.chatRepositoryService.getMessages(this.activeChatId() || '');
  }

  /* Chat model interactions */

  loadCurrentModelFromDB(): Promise<void> {
    return this.chatModelService.loadCurrentModelFromDB();
  }

  updateCurrentModel(model: ModelType): Promise<void> {
    return this.chatModelService.updateCurrentModel(model);
  }

  /* Chat navigation */

  initializeChat(chatId: string | null): void {
    this.chatStore.setActiveChatId(chatId);
    void this.chatModelService.syncCurrentModelForChat(chatId);

    if (this.appService.isMobile()) {
      this.appService.sidebarOpen.set(false);
    }
  }

  navigateToChat(chatId: string | null): void {
    this.router.navigate(['/chats', chatId || 'new']);
  }

  /* Message sending / socket operations */

  sendMessage(text: string, messageHistory: ChatMessage[]): Observable<SendMessageEvent> {
    return this.chatConversationService.sendMessage(text, messageHistory);
  }

  stopRequest(requestId: string): void {
    this.chatConversationService.stopRequest(requestId);
  }

  stopAllRequests(): void {
    this.chatConversationService.stopAllRequests();
  }

  /* IndexedDB update streams */

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
    this.chatConversationService.destroy();
  }
}
