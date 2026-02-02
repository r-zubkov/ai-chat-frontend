import { ModelType } from "./model-type";

export enum ChatMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

export enum ChatMessageState {
  STREAMING = 'streaming',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: ChatMessageRole;
  model: ModelType;
  state: ChatMessageState;
  content: string;
  timestamp: number;
  meta: ChatMessageMeta
}

export interface ChatMessageMeta {
  length?: number;
}

