import { inject, Injectable } from '@angular/core';
import { Chat } from '../../types/chat';
import { ChatMutationService } from '../chat-mutation.service';
import { ChatRepositoryService } from '../chat-repository.service';
import { ChatStore } from '../chat.store';

@Injectable({ providedIn: 'root' })
export class ChatsFacadeService {
  private readonly chatStore = inject(ChatStore);
  private readonly chatRepositoryService = inject(ChatRepositoryService);
  private readonly chatMutationService = inject(ChatMutationService);

  readonly chats = this.chatStore.chats;
  readonly chatsCount = this.chatStore.chatsCount;
  readonly activeChatId = this.chatStore.activeChatId;
  readonly activeChat = this.chatStore.activeChat;

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
    this.chatStore.setChats(chats);
  }

  async loadChatsCountFromDB(): Promise<void> {
    const count = await this.getChatsCount();
    this.chatStore.setChatsCount(count);
  }
}
