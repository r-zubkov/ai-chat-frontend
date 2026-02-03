import Dexie, { Table } from 'dexie';
import { Chat } from '../types/chat';
import { ChatMessage } from '../types/chat-message';
import { Setting } from '../types/setting';
import { Project } from '../types/project';

export class ChatDB extends Dexie {
  projects!: Table<Project, string>;
  chats!: Table<Chat, string>;
  messages!: Table<ChatMessage, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super('ai-chat-db');

    this.version(1).stores({
      projects: 'id, lastUpdate',
      chats: 'id, projectId, lastUpdate',
      messages: 'id, sequelId, chatId, timestamp, [chatId+sequelId]',
      settings: 'key',
    });
  }
}

export const chatDB = new ChatDB();