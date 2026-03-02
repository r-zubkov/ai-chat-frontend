import { ModelType } from './model-type';

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
  readonly id: string;
  chatId: string;
  sequelId: number;
  role: ChatMessageRole;
  model: ModelType;
  state: ChatMessageState;
  content: string;
  timestamp: number;
}
