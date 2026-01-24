import { ModelType } from "./model-type";

export enum ChatMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: ChatMessageRole;
  model: ModelType;
  content: string;
  timestamp: number;
  meta?: ChatMessageMeta
}

export interface ChatMessageMeta {
  length: number;
}

