import { TestBed } from '@angular/core/testing';
import { DEFAULT_CHAT_LIST_LIMIT, ModelType } from '@shared/config';
import { Chat, ChatState, toChatId } from './chat.model';
import { ChatRepository } from './chat.repository';
import { ChatStore } from './chat.store';

describe('ChatStore', () => {
  let store: InstanceType<typeof ChatStore>;
  let chatRepository: jasmine.SpyObj<ChatRepository>;

  beforeEach(() => {
    chatRepository = jasmine.createSpyObj<ChatRepository>('ChatRepository', [
      'getAll',
      'getCount',
      'getById',
    ]);
    chatRepository.getAll.and.resolveTo([]);
    chatRepository.getCount.and.resolveTo(0);
    chatRepository.getById.and.resolveTo(null);

    TestBed.configureTestingModule({
      providers: [{ provide: ChatRepository, useValue: chatRepository }],
    });

    store = TestBed.inject(ChatStore);
  });

  it('имеет начальное состояние по умолчанию', () => {
    expect(store.chats()).toEqual([]);
    expect(store.chatsCount()).toBe(0);
    expect(store.loadedChatsLimit()).toBe(DEFAULT_CHAT_LIST_LIMIT);
    expect(store.activeChatId()).toBeNull();
    expect(store.activeChat()).toBeNull();
    expect(store.hasMoreChats()).toBeFalse();
  });

  it('обновляет activeChat после setActive', () => {
    const firstChat = createChat({ id: 'chat-1', title: 'Первый чат' });
    const secondChat = createChat({ id: 'chat-2', title: 'Второй чат' });
    store.setChats([firstChat, secondChat]);

    store.setActive(secondChat.id);

    expect(store.activeChatId()).toBe(secondChat.id);
    expect(store.activeChat()).toEqual(secondChat);
  });

  it('добавляет новый чат в начало и увеличивает chatsCount', () => {
    const existingChat = createChat({ id: 'chat-1', title: 'Старый чат' });
    const newChat = createChat({ id: 'chat-2', title: 'Новый чат', lastUpdate: 20 });
    store.setChats([existingChat]);
    store.setChatsCount(1);

    store.upsertChat(newChat);

    expect(store.chats().map((chat) => chat.id)).toEqual([newChat.id, existingChat.id]);
    expect(store.chatsCount()).toBe(2);
  });
});

function createChat(params: {
  id: string;
  title?: string;
  state?: ChatState;
  model?: ModelType;
  projectId?: string | null;
  currentRequestId?: string | null;
  lastUpdate?: number;
}): Chat {
  return {
    id: toChatId(params.id),
    title: params.title ?? 'Чат',
    state: params.state ?? ChatState.IDLE,
    model: params.model ?? ModelType.GPT_51,
    projectId: params.projectId ?? null,
    currentRequestId: params.currentRequestId ?? null,
    lastUpdate: params.lastUpdate ?? 10,
  };
}
