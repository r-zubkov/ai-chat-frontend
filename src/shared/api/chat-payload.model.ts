export type ChatRequestRole = 'assistant' | 'user' | 'system';

export interface ChatRequestMessage {
  role: ChatRequestRole;
  content: string;
}

export interface ChatRequestPayload {
  requestId: string;
  model: string;
  messages: ChatRequestMessage[];
}

export interface ChatChunkPayload {
  requestId: string;
  delta: string;
}

export interface ChatDonePayload {
  requestId: string;
  aborted?: boolean;
}

export interface ChatErrorPayload {
  requestId: string;
  error: string;
}
