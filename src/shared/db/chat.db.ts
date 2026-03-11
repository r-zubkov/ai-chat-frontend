import Dexie, { Table } from 'dexie';

export interface ProjectRecord {
  id: string;
  name: string;
  lastUpdate: number;
}

export interface ChatRecord {
  id: string;
  title: string;
  state: string;
  model: string;
  projectId: string | null;
  currentRequestId: string | null;
  lastUpdate: number;
}

export interface MessageRecord {
  id: string;
  chatId: string;
  sequelId: number;
  role: string;
  model: string;
  state: string;
  content: string;
  timestamp: number;
}

export interface SettingRecord {
  key: string;
  value: string;
}

export class ChatDb extends Dexie {
  projects!: Table<ProjectRecord, string>;
  chats!: Table<ChatRecord, string>;
  messages!: Table<MessageRecord, string>;
  settings!: Table<SettingRecord, string>;

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

export const chatDB = new ChatDb();
