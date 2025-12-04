interface ChatChunkPayload {
  requestId: string;
  delta: string;
}

interface ChatDonePayload {
  requestId: string;
  aborted?: boolean;
}

interface ChatErrorPayload {
  requestId: string;
  error: string;
}