import { inject, Injectable } from '@angular/core';
import { Chat } from '../types/chat';
import { ModelType } from '../types/model-type';
import { RepositoryEventType } from '../types/repository-event-type';
import { ChatRepositoryService } from './chat-repository.service';
import { ChatMessage } from '../types/chat-message';
import { SendMessageEvent } from '../types/send-message-event';
import { Observable } from 'rxjs';
import { ChatConversationService } from './chat-conversation.service';
import { ChatsFacadeService } from './chats/facade.service';
import { SettingsFacadeService } from './settings/facade.service';

@Injectable({ providedIn: 'root' })
export class ChatFacadeService {
  private readonly chatsDomain = inject(ChatsFacadeService);
  private readonly settingsDomain = inject(SettingsFacadeService);
  private readonly chatRepositoryService = inject(ChatRepositoryService);
  private readonly chatConversationService = inject(ChatConversationService);

  readonly models = this.settingsDomain.models;

  readonly chats = this.chatsDomain.chats;
  readonly chatsCount = this.chatsDomain.chatsCount;
  readonly activeChatId = this.chatsDomain.activeChatId;
  readonly activeChat = this.chatsDomain.activeChat;
  readonly currentModel = this.settingsDomain.currentModel;

  /* Chats */

  getChats(limit: number): Promise<Chat[]> {
    return this.chatsDomain.getChats(limit);
  }

  getChatsCount(): Promise<number> {
    return this.chatsDomain.getChatsCount();
  }

  updateChat(
    chatId: string,
    chatUpdateData: Partial<Omit<Chat, 'id'>>,
    triggerLastUpdate: boolean = true,
  ): Promise<void> {
    return this.chatsDomain.updateChat(chatId, chatUpdateData, triggerLastUpdate);
  }

  deleteChat(chatId: string): Promise<void> {
    return this.chatsDomain.deleteChat(chatId);
  }

  async deleteAllChats(): Promise<void> {
    this.stopAllRequests();

    await this.chatsDomain.deleteAllChats();
  }

  loadChatsFromDB(): Promise<void> {
    return this.chatsDomain.loadChatsFromDB();
  }

  loadChatsCountFromDB(): Promise<void> {
    return this.chatsDomain.loadChatsCountFromDB();
  }

  /* Messages */

  async getActiveChatMessages(): Promise<ChatMessage[]> {
    return this.chatRepositoryService.getMessages(this.activeChatId() || '');
  }

  /* Chat model interactions */

  loadCurrentModelFromDB(): Promise<void> {
    return this.settingsDomain.loadCurrentModelFromDB();
  }

  updateCurrentModel(model: ModelType): Promise<void> {
    return this.settingsDomain.updateCurrentModel(model);
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
