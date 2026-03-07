import { Chat, ChatState, toChatId } from '@entities/chat';
import { ChatMessage, SequelId, toMessageId, toSequelId } from '@entities/message';
import { ModelType } from '@entities/settings';
import { truncateAtWord } from '@shared/helpers';

export function generateSequelId(localCounter: number): SequelId {
  return toSequelId(Date.now() * 1000 + localCounter);
}

export function createChatEntity(name: string, model: ModelType): Chat {
  return {
    id: toChatId(crypto.randomUUID()),
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
    id: toMessageId(crypto.randomUUID()),
    timestamp: Date.now(),
  };
}
