import { Injectable } from '@angular/core';
import { Chat } from '../types/chat';
import { ModelType } from '../types/model-type';
import { chatDB } from '../common/chat.db';
import { ChatMessage } from '../types/chat-message';
import { Observable, Subject } from 'rxjs';
import Dexie from 'dexie';
import { AppSettingKey, AppSettingsMap } from '../types/setting';
import { RepositoryEventType } from '../types/repository-event-type';

@Injectable({ providedIn: 'root' })
export class ChatRepositoryService {
  _projectsUpdated$ = new Subject<RepositoryEventType>();
  _chatsUpdated$ = new Subject<RepositoryEventType>();
  _messagesUpdated$ = new Subject<RepositoryEventType>();
  _settingsUpdated$ = new Subject<RepositoryEventType>();

  async getChats(limit = 50): Promise<Chat[]> {
    return chatDB.chats.orderBy('lastUpdate').reverse().limit(limit).toArray();
  }

  async getChatsCount(): Promise<number> {
    return chatDB.chats.count();
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
      .where('[chatId+sequelId]')
      .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
      .toArray();
  }

  async getMessagesCount(): Promise<number> {
    return chatDB.messages.count();
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

  async getSetting<K extends AppSettingKey>(key: K): Promise<AppSettingsMap[K] | null> {
    const row = await chatDB.settings.get(key);
    return (row?.value as AppSettingsMap[K]) ?? null;
  }

  async setSetting<K extends AppSettingKey>(key: K, value: AppSettingsMap[K]): Promise<void> {
    await chatDB.settings.put({ key, value });
  }

  async loadCurrentModel(): Promise<ModelType | null> {
    return await this.getSetting(AppSettingKey.CURRENT_MODEL);
  }

  async saveCurrentModel(model: ModelType): Promise<void> {
    await this.setSetting(AppSettingKey.CURRENT_MODEL, model);
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
    return this._projectsUpdated$.asObservable();
  }

  get chatsUpdated$(): Observable<RepositoryEventType> {
    return this._chatsUpdated$.asObservable();
  }

  get messagesUpdated$(): Observable<RepositoryEventType> {
    return this._messagesUpdated$.asObservable();
  }

  get settingsUpdated$(): Observable<RepositoryEventType> {
    return this._settingsUpdated$.asObservable();
  }
}
