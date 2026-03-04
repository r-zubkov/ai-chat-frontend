import { inject, Injectable } from '@angular/core';
import { Chat } from '../../types/chat';
import { ChatMutationService } from './mutation.service';
import { ChatRepositoryService } from '../chat-repository.service';
import { ChatsStore } from './chats.store';

@Injectable({ providedIn: 'root' })
export class ChatsFacadeService {
  private readonly chatsStore = inject(ChatsStore);
  private readonly chatRepositoryService = inject(ChatRepositoryService);
  private readonly chatMutationService = inject(ChatMutationService);

  readonly chats = this.chatsStore.chats;
  readonly chatsCount = this.chatsStore.chatsCount;
  readonly activeChatId = this.chatsStore.activeChatId;
  readonly activeChat = this.chatsStore.activeChat;

  private readonly chatsLimitStep: number = 50;
  private chatsLimit: number = this.chatsLimitStep;

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
    return this.chatMutationService.updateChat(chatId, chatUpdateData, triggerLastUpdate);
  }

  deleteChat(chatId: string): Promise<void> {
    return this.chatMutationService.deleteChat(chatId);
  }

  deleteAllChats(): Promise<void> {
    return this.chatMutationService.deleteAllChats();
  }

  async loadChatsFromDB(): Promise<void> {
    const chats = await this.getChats(this.chatsLimit);
    this.chatsStore.setChats(chats);
  }

  async loadChatsCountFromDB(): Promise<void> {
    const count = await this.getChatsCount();
    this.chatsStore.setChatsCount(count);
  }
}
