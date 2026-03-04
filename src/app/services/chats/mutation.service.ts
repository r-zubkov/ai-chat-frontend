import { inject, Injectable } from '@angular/core';
import { Chat } from '../../types/chat';
import { ChatMessage } from '../../types/chat-message';
import { ChatRepositoryService } from '../chat-repository.service';
import { ChatsStore } from './chats.store';

@Injectable({ providedIn: 'root' })
export class ChatMutationService {
  private readonly chatRepositoryService = inject(ChatRepositoryService);
  private readonly chatsStore = inject(ChatsStore);

  private readonly chatsLimit = 50;

  async createChat(chat: Chat): Promise<void> {
    await this.chatRepositoryService.createChat(chat);
    await this.reloadChatsSnapshot();
  }

  async updateChat(
    chatId: string,
    chatUpdateData: Partial<Omit<Chat, 'id'>>,
    triggerLastUpdate: boolean = true,
  ): Promise<void> {
    const dataToUpdate: Partial<Omit<Chat, 'id'>> = { ...chatUpdateData };
    if (triggerLastUpdate) {
      dataToUpdate.lastUpdate = Date.now();
    }

    await this.chatRepositoryService.updateChat(chatId, dataToUpdate);

    const patched = this.chatsStore.patchChat(chatId, dataToUpdate);
    if (!patched) {
      await this.reloadChatsSnapshot();
    }
  }

  async deleteChat(chatId: string): Promise<void> {
    await this.chatRepositoryService.deleteChat(chatId);
    await this.reloadChatsSnapshot();
  }

  async deleteAllChats(): Promise<void> {
    await this.chatRepositoryService.deleteAllChats();
    await this.reloadChatsSnapshot();
  }

  createMessages(messages: ChatMessage[]): Promise<void> {
    return this.chatRepositoryService.createMessages(messages);
  }

  updateMessage(messageId: string, data: Partial<ChatMessage>): Promise<void> {
    return this.chatRepositoryService.updateMessage(messageId, data);
  }

  private async reloadChatsSnapshot(limit: number = this.chatsLimit): Promise<void> {
    const [chats, chatsCount] = await Promise.all([
      this.chatRepositoryService.getChats(limit),
      this.chatRepositoryService.getChatsCount(),
    ]);

    this.chatsStore.setChats(chats);
    this.chatsStore.setChatsCount(chatsCount);
  }
}
