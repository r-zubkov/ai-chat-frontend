import { Injectable } from '@angular/core';
import { Chat } from '../types/chat';
import { ModelType } from '../types/model-type';
import { chatDB } from '../common/chat.db';
import { ChatMessage } from '../types/chat-message';
import { Observable, Subject } from 'rxjs';

const CHATS_STORAGE_KEY = 'ai-chat-chats';
const CURRENT_MODEL_STORAGE_KEY = 'ai-chat-current-model';

export enum RepositoryEventType {
  READING = 'reading',
  CREATING = 'creating',
  UPDATING = 'updating',
  DELETING = 'deleting'
}

@Injectable({ providedIn: 'root' })
export class ChatRepositoryService {
  _projectsUpdated$ = new Subject<RepositoryEventType>();
  _chatsUpdated$ = new Subject<RepositoryEventType>();
  _messagesUpdated$ = new Subject<RepositoryEventType>();
  _settingsUpdated$ = new Subject<RepositoryEventType>();

  async getChats(limit = 50): Promise<Chat[]> {
    return chatDB.chats
      .orderBy('lastUpdate')
      .reverse()
      .limit(limit)
      .toArray();
  }

  async getChatsCount(): Promise<number> {
    return chatDB.chats.count()
  }

  async createChat(chat: Chat): Promise<void> {
    await chatDB.chats.put(chat);
    this._chatsUpdated$.next(RepositoryEventType.CREATING);
  }

  async createChats(chats: Chat[]): Promise<void> {
    await chatDB.chats.bulkPut(chats);
    this._chatsUpdated$.next(RepositoryEventType.CREATING);
  }

  async updateChat(id: string, data: Partial<Chat>): Promise<void> {
    await chatDB.chats.update(id, { ...data });
    this._chatsUpdated$.next(RepositoryEventType.UPDATING);
  }

  async deleteChat(id: string): Promise<void> {
    await chatDB.transaction('rw', chatDB.chats, chatDB.messages, async () => {
      await chatDB.chats.delete(id);
      await chatDB.messages.where('chatId').equals(id).delete();
    });

    this._chatsUpdated$.next(RepositoryEventType.DELETING);
    this._messagesUpdated$.next(RepositoryEventType.DELETING);
  }

  async getMessages(chatId: string): Promise<ChatMessage[]> {
    return chatDB.messages
      .where('chatId')
      .equals(chatId)
      .sortBy('timestamp');
  }
  
  async getMessagesCount(): Promise<number> {
    return chatDB.messages.count()
  }

  async createMessage(message: ChatMessage): Promise<void> {
    await chatDB.messages.put(message);
    this._messagesUpdated$.next(RepositoryEventType.CREATING);
  }

  async createMessages(messages: ChatMessage[]): Promise<void> {
    await chatDB.messages.bulkPut(messages);
    this._messagesUpdated$.next(RepositoryEventType.CREATING);
  }

  async updateMessage(id: string, data: Partial<ChatMessage>): Promise<void> {
    await chatDB.messages.update(id, { ...data });
    this._messagesUpdated$.next(RepositoryEventType.UPDATING);
  }

  async deleteMessage(id: string): Promise<void> {
      await chatDB.messages.where('id').equals(id).delete();
      this._messagesUpdated$.next(RepositoryEventType.DELETING);
  }

  async deleteAllChats(): Promise<void> {
    await chatDB.transaction('rw', chatDB.chats, chatDB.messages, async () => {
      await chatDB.chats.clear();
      await chatDB.messages.clear();
    });

    this._chatsUpdated$.next(RepositoryEventType.DELETING);
    this._messagesUpdated$.next(RepositoryEventType.DELETING);
  }

  async getSetting<T>(key: string): Promise<T | null> {
    const row = await chatDB.settings.get(key);
    return (row?.value as unknown as T) ?? null;
  }

  async setSetting(key: string, value: any): Promise<void> {
    await chatDB.settings.put({ key, value });
  }

  async clearAllData(): Promise<void> {
    await chatDB.transaction('rw', chatDB.chats, chatDB.messages, async () => {
      await chatDB.projects.clear();
      await chatDB.chats.clear();
      await chatDB.messages.clear();
      await chatDB.settings.clear();
    });

    this._projectsUpdated$.next(RepositoryEventType.DELETING);
    this._chatsUpdated$.next(RepositoryEventType.DELETING);
    this._messagesUpdated$.next(RepositoryEventType.DELETING);
    this._settingsUpdated$.next(RepositoryEventType.DELETING);
  }

  get projectsUpdated$(): Observable<RepositoryEventType> {
    return this._projectsUpdated$.asObservable()
  }

  get chatsUpdated$(): Observable<RepositoryEventType> {
    return this._chatsUpdated$.asObservable()
  }

  get messagesUpdated$(): Observable<RepositoryEventType> {
    return this._messagesUpdated$.asObservable()
  } 

  get settingsUpdated$(): Observable<RepositoryEventType> {
    return this._settingsUpdated$.asObservable()
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
