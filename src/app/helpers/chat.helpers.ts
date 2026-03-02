import { Chat, ChatState } from '../types/chat';
import { ChatMessage } from '../types/chat-message';
import { ModelType } from '../types/model-type';
import { truncateAtWord } from './text-utils';

export function generateSequelId(localCounter: number): number {
  return Date.now() * 1000 + localCounter;
}

export function createChatEntity(name: string, model: ModelType): Chat {
  return {
    id: crypto.randomUUID(),
    title: truncateAtWord(name, 120, null),
    state: ChatState.IDLE,
    model,
    projectId: null,
    currentRequestId: null,
    lastUpdate: Date.now(),
  };
}

export function createMessageEntity(msg: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
  return {
    ...msg,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
}
