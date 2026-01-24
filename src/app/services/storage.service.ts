import { Injectable } from '@angular/core';
import { Chat } from '../types/chat';
import { ModelType } from '../types/model-type';
import { chatDB } from './chat.db';
import { ChatMessage } from '../types/chat-message';

const CHATS_STORAGE_KEY = 'ai-chat-chats';
const CURRENT_MODEL_STORAGE_KEY = 'ai-chat-current-model';

@Injectable({ providedIn: 'root' })
export class StorageService {

  async getChats(limit = 50, offset = 0): Promise<Chat[]> {
    return chatDB.chats
      .orderBy('lastUpdate')
      .reverse()
      .offset(offset)
      .limit(limit)
      .toArray();
  }

  async createChat(chat: Chat): Promise<void> {
    await chatDB.chats.put(chat);
  }

  async updateChat(id: string, data: Partial<Chat>): Promise<void> {
    await chatDB.chats.update(id, { ...data });
  }

  async deleteChat(id: string): Promise<void> {
    await chatDB.transaction('rw', chatDB.chats, chatDB.messages, async () => {
      await chatDB.chats.delete(id);
      await chatDB.messages.where('chatId').equals(id).delete();
    });
  }

  async getMessages(chatId: string): Promise<ChatMessage[]> {
    return chatDB.messages
      .where('chatId')
      .equals(chatId)
      .sortBy('timestamp');
  }

  async crateMessage(message: ChatMessage): Promise<void> {
    await chatDB.messages.put(message);
  }

  async updateMessage(id: string, data: Partial<ChatMessage>): Promise<void> {
    await chatDB.messages.update(id, { ...data });
  }

  async deleteMessage(id: string): Promise<void> {
      await chatDB.messages.where('id').equals(id).delete();
  }

  async deleteAll(): Promise<void> {
    await chatDB.transaction('rw', chatDB.chats, chatDB.messages, async () => {
      await chatDB.chats.clear();
      await chatDB.messages.clear();
    });
  }

  loadChats(): Chat[] {
    try {
      const raw = localStorage.getItem(CHATS_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as Chat[];
    } catch {
      return [];
    }
  }

  saveChats(chats: Chat[]): void {
    localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats));
  }

  loadCurrentModal(): ModelType | null {
    try {
      const raw = localStorage.getItem(CURRENT_MODEL_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as ModelType;
    } catch {
      return null;
    }
  }

  saveCurrentModel(model: ModelType): void {
    localStorage.setItem(CURRENT_MODEL_STORAGE_KEY, JSON.stringify(model));
  }
}
