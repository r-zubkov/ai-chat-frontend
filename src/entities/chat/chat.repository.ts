import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { chatDB, ChatRecord } from '@shared/db';
import { DEFAULT_CHAT_LIST_LIMIT, RepositoryEventType } from '@shared/config';
import { Chat, ChatId, toChatId } from './chat.model';

@Injectable({ providedIn: 'root' })
export class ChatRepository {
  private readonly chatsUpdated = new Subject<RepositoryEventType>();

  async getAll(limit: number = DEFAULT_CHAT_LIST_LIMIT): Promise<Chat[]> {
    const rows = await chatDB.chats.orderBy('lastUpdate').reverse().limit(limit).toArray();
    return rows.map((row) => this.toDomain(row));
  }

  async getById(id: ChatId): Promise<Chat | null> {
    const row = await chatDB.chats.get(id);
    return row ? this.toDomain(row) : null;
  }

  async getCount(): Promise<number> {
    return chatDB.chats.count();
  }

  async create(chat: Chat): Promise<void> {
    await chatDB.chats.put(this.toRecord(chat));
    this.chatsUpdated.next(RepositoryEventType.CREATING);
  }

  async update(id: ChatId, data: Partial<Omit<Chat, 'id'>>): Promise<void> {
    await chatDB.chats.update(id, data as Partial<ChatRecord>);
    this.chatsUpdated.next(RepositoryEventType.UPDATING);
  }

  async delete(id: ChatId): Promise<void> {
    await chatDB.transaction('rw', chatDB.chats, chatDB.messages, async () => {
      await chatDB.chats.delete(id);
      await chatDB.messages.where('chatId').equals(id).delete();
    });

    this.chatsUpdated.next(RepositoryEventType.DELETING);
  }

  async clear(): Promise<void> {
    await chatDB.transaction('rw', chatDB.chats, chatDB.messages, async () => {
      await chatDB.chats.clear();
      await chatDB.messages.clear();
    });

    this.chatsUpdated.next(RepositoryEventType.DELETING);
  }

  get chatsUpdated$(): Observable<RepositoryEventType> {
    return this.chatsUpdated.asObservable();
  }

  private toDomain(row: ChatRecord): Chat {
    return {
      ...row,
      id: toChatId(row.id),
    } as Chat;
  }

  private toRecord(chat: Chat): ChatRecord {
    return {
      ...chat,
      id: chat.id,
    };
  }
}
