import { ChatMessage } from './chat-message';

export enum SendMessageEventType {
  SENT = 'sent',
  FINISHED = 'finished',
}

export type SendMessageEvent =
  | {
    type: SendMessageEventType.SENT;
    chatId: string;
    userMessage: ChatMessage;
  }
  | {
    type: SendMessageEventType.FINISHED;
    chatId: string;
    assistantMessage: ChatMessage;
  };
