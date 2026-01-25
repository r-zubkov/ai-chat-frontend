import Dexie, { Table } from 'dexie';
import { Chat } from '../types/chat';
import { ChatMessage } from '../types/chat-message';
import { Setting } from '../types/setting';
import { Subject } from 'rxjs';
import { Project } from '../types/project';

export enum DexieEventType {
  CREATING = 'creating',
  UPDATING = 'updating',
  DELETING = 'deleting'
}

export class ChatDB extends Dexie {
  projects!: Table<Project, string>;
  chats!: Table<Chat, string>;
  messages!: Table<ChatMessage, string>;
  settings!: Table<Setting, string>;

  projectsUpdated$ = new Subject<DexieEventType>();
  chatsUpdated$ = new Subject<DexieEventType>();
  messagesUpdated$ = new Subject<DexieEventType>();
  settingsUpdated$ = new Subject<DexieEventType>();

  constructor() {
    super('ai-chat-db');

    this.version(1).stores({
      projects: 'id, lastUpdate',
      chats: 'id, projectId, lastUpdate',
      messages: 'id, chatId, timestamp',
      settings: 'key',
    });

    this.projects.hook('creating', () => {
      this.projectsUpdated$.next(DexieEventType.CREATING);
    });
    this.projects.hook('updating', () => {
      this.projectsUpdated$.next(DexieEventType.UPDATING);
    });
    this.projects.hook('deleting', () => {
      this.projectsUpdated$.next(DexieEventType.DELETING);
    });

    this.chats.hook('creating', () => {
      this.chatsUpdated$.next(DexieEventType.CREATING);
    });
    this.chats.hook('updating', () => {
      this.chatsUpdated$.next(DexieEventType.UPDATING);
    });
    this.chats.hook('deleting', () => {
      this.chatsUpdated$.next(DexieEventType.DELETING);
    });

    this.messages.hook('creating', () => {
      this.messagesUpdated$.next(DexieEventType.CREATING);
    });
    this.messages.hook('updating', () => {
      this.messagesUpdated$.next(DexieEventType.UPDATING);
    });
    this.messages.hook('deleting', () => {
      this.messagesUpdated$.next(DexieEventType.DELETING);
    });
    
    this.settings.hook('creating', () => {
      this.settingsUpdated$.next(DexieEventType.CREATING);
    });
    this.settings.hook('updating', () => {
      this.settingsUpdated$.next(DexieEventType.UPDATING);
    });
    this.settings.hook('deleting', () => {
      this.settingsUpdated$.next(DexieEventType.DELETING);
    });
  }
}

export const chatDB = new ChatDB();