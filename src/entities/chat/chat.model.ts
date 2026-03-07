import { ModelType } from '@shared/config';

export type ChatId = string & { readonly __brand: 'ChatId' };

export function toChatId(raw: string): ChatId {
  return raw as ChatId;
}

export enum ChatState {
  IDLE = 'idle',
  THINKING = 'thinking',
  ERROR = 'error',
}

export interface Chat {
  readonly id: ChatId;
  title: string;
  state: ChatState;
  model: ModelType;
  projectId: string | null;
  currentRequestId: string | null;
  lastUpdate: number;
}

export interface ChatStoreState {
  chats: Chat[];
  activeChatId: ChatId | null;
}
