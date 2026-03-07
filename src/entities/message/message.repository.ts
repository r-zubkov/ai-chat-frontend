import { Injectable } from '@angular/core';
import Dexie from 'dexie';
import { Observable, Subject } from 'rxjs';
import { chatDB, MessageRecord } from '@shared/db';
import { RepositoryEventType } from '@shared/config';
import type { ChatId } from '@entities/chat';
import { ChatMessage, MessageId, toMessageId, toSequelId } from './message.model';

@Injectable({ providedIn: 'root' })
export class MessageRepository {
  private readonly messagesUpdated = new Subject<RepositoryEventType>();

  async getMessagesByChatId(chatId: ChatId): Promise<ChatMessage[]> {
    const rows = await chatDB.messages
      .where('[chatId+sequelId]')
      .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
      .toArray();

    return rows.map((row) => this.toDomain(row));
  }

  async createMessage(message: ChatMessage): Promise<void> {
    await chatDB.messages.put(this.toRecord(message));
    this.messagesUpdated.next(RepositoryEventType.CREATING);
  }

  async createMessages(messages: ChatMessage[]): Promise<void> {
    if (!messages.length) {
      return;
    }

    await chatDB.messages.bulkPut(messages.map((message) => this.toRecord(message)));
    this.messagesUpdated.next(RepositoryEventType.CREATING);
  }

  async updateMessage(id: MessageId, data: Partial<ChatMessage>): Promise<void> {
    await chatDB.messages.update(id, data as Partial<MessageRecord>);
    this.messagesUpdated.next(RepositoryEventType.UPDATING);
  }

  async deleteByChatId(chatId: ChatId): Promise<void> {
    await chatDB.messages.where('chatId').equals(chatId).delete();
    this.messagesUpdated.next(RepositoryEventType.DELETING);
  }

  get messagesUpdated$(): Observable<RepositoryEventType> {
    return this.messagesUpdated.asObservable();
  }

  private toDomain(row: MessageRecord): ChatMessage {
    return {
      ...row,
      id: toMessageId(row.id),
      chatId: row.chatId as ChatId,
      sequelId: toSequelId(row.sequelId),
    } as ChatMessage;
  }

  private toRecord(message: ChatMessage): MessageRecord {
    return {
      ...message,
      id: message.id,
      chatId: message.chatId,
      sequelId: message.sequelId,
    };
  }
}
