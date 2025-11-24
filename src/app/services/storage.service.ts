import { Injectable } from '@angular/core';
import { Chat } from '../models/chat.model';
import { ModelType } from '../types/model-type';

const CHATS_STORAGE_KEY = 'ai-chat-chats';
const CURRENT_MODEL_STORAGE_KEY = 'ai-chat-current-model';

@Injectable({ providedIn: 'root' })
export class StorageService {
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
