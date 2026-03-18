import { toChatId } from '@entities/chat';
import {
  ChatMessage,
  ChatMessageRole,
  ChatMessageState,
  toMessageId,
  toSequelId,
} from '@entities/message';
import { HISTORY_LIMIT, ModelType } from '@shared/config';
import { applySystemPrompt, buildApiMessages } from './chat-api.helpers';

describe('chat-api.helpers', () => {
  it('добавляет системный промпт в начало, если он задан для модели', () => {
    const messages = [{ role: ChatMessageRole.USER, content: 'Привет' }];
    const prompts = { [ModelType.GPT_51]: 'Системный промпт' };

    const result = applySystemPrompt(ModelType.GPT_51, messages, prompts);

    expect(result[0]).toEqual({
      role: ChatMessageRole.SYSTEM,
      content: 'Системный промпт',
    });
    expect(result[1]).toEqual(messages[0]);
  });

  it('возвращает исходный список сообщений без изменений, если промпт не задан', () => {
    const messages = [{ role: ChatMessageRole.USER, content: 'Привет' }];
    const prompts = {};

    const result = applySystemPrompt(ModelType.GPT_51, messages, prompts);

    expect(result).toBe(messages);
  });

  it('формирует сообщения для API с учетом лимита истории, фильтрации ошибок и системного промпта', () => {
    const history = Array.from({ length: HISTORY_LIMIT + 2 }, (_, index) =>
      createHistoryMessage({
        id: `history-${index}`,
        sequelId: index,
        role: index % 2 === 0 ? ChatMessageRole.USER : ChatMessageRole.ASSISTANT,
        state: index === HISTORY_LIMIT ? ChatMessageState.ERROR : ChatMessageState.COMPLETED,
        content: `Сообщение ${index}`,
      }),
    );

    const userMessage = createHistoryMessage({
      id: 'current-user',
      sequelId: 999,
      role: ChatMessageRole.USER,
      state: ChatMessageState.COMPLETED,
      content: 'Текущий вопрос',
    });

    const result = buildApiMessages(history, userMessage, ModelType.GPT_51, {
      [ModelType.GPT_51]: 'Системный промпт',
    });

    expect(result[0]).toEqual({
      role: ChatMessageRole.SYSTEM,
      content: 'Системный промпт',
    });
    expect(result[result.length - 1]).toEqual({
      role: ChatMessageRole.USER,
      content: 'Текущий вопрос',
    });
    expect(result.some((item) => item.content === `Сообщение ${HISTORY_LIMIT}`)).toBeFalse();
    expect(result.some((item) => item.content === 'Сообщение 0')).toBeFalse();
  });
});

function createHistoryMessage(params: {
  id: string;
  sequelId: number;
  role: ChatMessageRole;
  state: ChatMessageState;
  content: string;
}): ChatMessage {
  return {
    id: toMessageId(params.id),
    chatId: toChatId('chat-1'),
    sequelId: toSequelId(params.sequelId),
    role: params.role,
    model: ModelType.GPT_51,
    state: params.state,
    content: params.content,
    timestamp: 1,
  };
}
