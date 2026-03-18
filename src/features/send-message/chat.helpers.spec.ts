import { ChatState, toChatId } from '@entities/chat';
import { ChatMessageRole, ChatMessageState, toSequelId } from '@entities/message';
import { ModelType } from '@entities/settings';
import { createChatEntity, createMessageEntity, generateSequelId } from './chat.helpers';

describe('chat.helpers', () => {
  it('генерирует sequelId на основе времени и локального счетчика', () => {
    spyOn(Date, 'now').and.returnValue(123);

    const sequelId = generateSequelId(7);

    expect(sequelId).toBe(toSequelId(123007));
  });

  it('создает сущность чата с базовыми полями по умолчанию', () => {
    spyOn(Date, 'now').and.returnValue(1_000);
    const longName = `  ${'слово '.repeat(30)}  `;

    const chat = createChatEntity(longName, ModelType.GPT_51);

    expect(chat.id).toBeTruthy();
    expect(chat.title.length).toBeLessThanOrEqual(120);
    expect(chat.title.endsWith('…')).toBeFalse();
    expect(chat.state).toBe(ChatState.IDLE);
    expect(chat.projectId).toBeNull();
    expect(chat.currentRequestId).toBeNull();
    expect(chat.model).toBe(ModelType.GPT_51);
    expect(chat.lastUpdate).toBe(1_000);
  });

  it('создает сущность сообщения с id и timestamp', () => {
    spyOn(Date, 'now').and.returnValue(2_000);

    const message = createMessageEntity({
      chatId: toChatId('chat-1'),
      sequelId: toSequelId(10),
      role: ChatMessageRole.USER,
      model: ModelType.GPT_51,
      state: ChatMessageState.COMPLETED,
      content: 'Текст сообщения',
    });

    expect(message.id).toBeTruthy();
    expect(message.timestamp).toBe(2_000);
    expect(message.chatId).toBe(toChatId('chat-1'));
    expect(message.content).toBe('Текст сообщения');
  });
});
