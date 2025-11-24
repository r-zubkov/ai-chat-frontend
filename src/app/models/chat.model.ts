import { ChatMessageRole } from "../types/chat-message-role";
import { ChatState } from "../types/chat-state";
import { ModelType } from "../types/model-type";

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  model: ModelType;
  content: string;
  timestamp: number;
}

export interface Chat {
  id: string;
  title: string;
  state: ChatState;
  model: ModelType;
  messages: ChatMessage[];
}
