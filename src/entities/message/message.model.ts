import type { ChatId } from '@entities/chat';
import { ModelType } from '@shared/config';

export type MessageId = string & { readonly __brand: 'MessageId' };
export type SequelId = number & { readonly __brand: 'SequelId' };

export function toMessageId(raw: string): MessageId {
  return raw as MessageId;
}

export function toSequelId(raw: number): SequelId {
  return raw as SequelId;
}

export enum ChatMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

export enum ChatMessageState {
  STREAMING = 'streaming',
  COMPLETED = 'completed',
  ERROR = 'error',
}

export interface ChatMessage {
  readonly id: MessageId;
  chatId: ChatId;
  sequelId: SequelId;
  role: ChatMessageRole;
  model: ModelType;
  state: ChatMessageState;
  content: string;
  timestamp: number;
}
