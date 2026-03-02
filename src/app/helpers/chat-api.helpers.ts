import { API_HISTORY_LIMIT } from '../constants/chat.constants';
import { ChatMessage, ChatMessageRole, ChatMessageState } from '../types/chat-message';
import { ModelType } from '../types/model-type';

export function applySystemPrompt(
  model: ModelType,
  messages: ChatMessage[],
  modelSystemPrompts: Partial<Record<ModelType, string>>,
): ChatMessage[] {
  const systemPrompt = modelSystemPrompts[model];
  if (!systemPrompt) return messages;

  const systemMessage: ChatMessage = {
    id: '',
    sequelId: 0,
    chatId: '',
    role: ChatMessageRole.SYSTEM,
    content: systemPrompt,
    model,
    state: ChatMessageState.COMPLETED,
    timestamp: 0,
  };

  return [systemMessage, ...messages];
}

export function buildApiMessages(
  messageHistory: ChatMessage[],
  userMessage: ChatMessage,
  model: ModelType,
  modelSystemPrompts: Partial<Record<ModelType, string>>,
): ChatMessage[] {
  const historyTail = messageHistory.slice(-API_HISTORY_LIMIT);
  const historyWithLastUserMsg = [...historyTail, userMessage];

  return applySystemPrompt(model, historyWithLastUserMsg, modelSystemPrompts);
}
