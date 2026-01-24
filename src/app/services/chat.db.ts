import Dexie, { Table } from 'dexie';
import { Chat } from '../types/chat';
import { ChatMessage } from '../types/chat-message';

export interface SettingEntity {
  key: string;
  value: any;
}

export class ChatDB extends Dexie {
  chats!: Table<Chat, string>;
  messages!: Table<ChatMessage, string>;

  constructor() {
    super('ai-chat-db');

    this.version(1).stores({
      chats: 'id, lastUpdate, projectId',
      messages: 'id, chatId, timestamp',
      settings: 'key',
    });
  }
}

export const chatDB = new ChatDB();