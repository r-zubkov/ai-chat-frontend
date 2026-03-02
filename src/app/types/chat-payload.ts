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
