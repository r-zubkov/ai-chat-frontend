import { inject, Injectable } from '@angular/core';
import { Chat } from '../types/chat';
import { ChatMessage } from '../types/chat-message';
import { ChatRepositoryService } from './chat-repository.service';

@Injectable({ providedIn: 'root' })
export class ChatPersistenceService {
  private readonly chatRepositoryService = inject(ChatRepositoryService);

  createChat(chat: Chat): Promise<void> {
    return this.chatRepositoryService.createChat(chat);
  }

  updateChat(
    chatId: string,
    chatUpdateData: Partial<Omit<Chat, 'id'>>,
    triggerLastUpdate: boolean = true,
  ): Promise<void> {
    const dataToUpdate: Partial<Omit<Chat, 'id'>> = { ...chatUpdateData };
    if (triggerLastUpdate) {
      dataToUpdate.lastUpdate = Date.now();
    }

    return this.chatRepositoryService.updateChat(chatId, dataToUpdate);
  }

  deleteChat(chatId: string): Promise<void> {
    return this.chatRepositoryService.deleteChat(chatId);
  }

  deleteAllChats(): Promise<void> {
    return this.chatRepositoryService.deleteAllChats();
  }

  createMessages(messages: ChatMessage[]): Promise<void> {
    return this.chatRepositoryService.createMessages(messages);
  }

  updateMessage(messageId: string, data: Partial<ChatMessage>): Promise<void> {
    return this.chatRepositoryService.updateMessage(messageId, data);
  }
}
