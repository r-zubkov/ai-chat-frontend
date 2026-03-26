import { TestBed } from '@angular/core/testing';
import { toChatId } from '@entities/chat';
import { ModelType } from '@shared/config';
import {
  ChatMessage,
  ChatMessageRole,
  ChatMessageState,
  toMessageId,
  toSequelId,
} from './message.model';
import { MessageRepository } from './message.repository';
import { MessageStore } from './message.store';

describe('MessageStore', () => {
  let store: InstanceType<typeof MessageStore>;
  let messageRepository: jasmine.SpyObj<MessageRepository>;

  beforeEach(() => {
    messageRepository = jasmine.createSpyObj<MessageRepository>('MessageRepository', [
      'getMessagesByChatId',
    ]);
    messageRepository.getMessagesByChatId.and.resolveTo([]);

    TestBed.configureTestingModule({
      providers: [{ provide: MessageRepository, useValue: messageRepository }],
    });

    store = TestBed.inject(MessageStore);
  });

  it('имеет пустое состояние по умолчанию', () => {
    expect(store.messages()).toEqual([]);
    expect(store.content().size).toBe(0);
    expect(store.get(toMessageId('unknown'))).toBe('');
  });

  it('позволяет записывать и удалять контент сообщения', () => {
    const messageId = toMessageId('msg-1');

    store.set(messageId, 'Часть ответа');

    expect(store.get(messageId)).toBe('Часть ответа');

    store.remove(messageId);

    expect(store.get(messageId)).toBe('');
  });

  it('удаляет контент, когда сообщение выходит из streaming-состояния', () => {
    const messageId = toMessageId('msg-1');
    store.setMessages([
      createMessage({
        id: 'msg-1',
        role: ChatMessageRole.ASSISTANT,
        state: ChatMessageState.STREAMING,
      }),
    ]);
    store.set(messageId, 'stream chunk');

    store.patchMessage(messageId, { state: ChatMessageState.COMPLETED });

    expect(store.get(messageId)).toBe('');
    expect(store.messages()[0]?.state).toBe(ChatMessageState.COMPLETED);
  });
});

function createMessage(params: {
  id: string;
  role: ChatMessageRole;
  state: ChatMessageState;
  chatId?: string;
  sequelId?: number;
  model?: ModelType;
  content?: string;
  timestamp?: number;
}): ChatMessage {
  return {
    id: toMessageId(params.id),
    chatId: toChatId(params.chatId ?? 'chat-1'),
    sequelId: toSequelId(params.sequelId ?? 1),
    role: params.role,
    model: params.model ?? ModelType.GPT_51,
    state: params.state,
    content: params.content ?? '',
    timestamp: params.timestamp ?? 1,
  };
}
