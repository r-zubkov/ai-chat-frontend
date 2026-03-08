import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { DEFAULT_CHAT_LIST_LIMIT } from '@shared/config';
import { Chat, ChatId, ChatStoreState } from './chat.model';
import { ChatRepository } from './chat.repository';

const initialState: ChatStoreState = {
  chats: [],
  chatsCount: 0,
  activeChatId: null,
};

export const ChatStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ chats, activeChatId }) => ({
    activeChat: computed(() => chats().find((chat) => chat.id === activeChatId()) ?? null),
  })),
  withMethods((store, chatRepository = inject(ChatRepository)) => ({
    async loadAll(limit: number = DEFAULT_CHAT_LIST_LIMIT): Promise<void> {
      const [chats, chatsCount] = await Promise.all([
        chatRepository.getAll(limit),
        chatRepository.getCount(),
      ]);
      patchState(store, { chats, chatsCount });
    },
    async loadChatsCount(): Promise<void> {
      const chatsCount = await chatRepository.getCount();
      patchState(store, { chatsCount });
    },
    setActive(id: ChatId | null): void {
      patchState(store, { activeChatId: id });
    },
    setChats(chats: Chat[]): void {
      patchState(store, { chats });
    },
    setChatsCount(chatsCount: number): void {
      patchState(store, { chatsCount });
    },
    upsertChat(chat: Chat): void {
      const list = store.chats();
      const index = list.findIndex((item) => item.id === chat.id);

      if (index < 0) {
        patchState(store, {
          chats: [chat, ...list],
          chatsCount: store.chatsCount() + 1,
        });
        return;
      }

      const prev = list[index];
      const chats =
        prev.lastUpdate === chat.lastUpdate
          ? list.map((item, idx) => (idx === index ? chat : item))
          : [chat, ...list.filter((item) => item.id !== chat.id)];

      patchState(store, { chats });
    },
    removeChat(id: ChatId): void {
      const chats = store.chats().filter((chat) => chat.id !== id);
      const nextActive = store.activeChatId() === id ? null : store.activeChatId();
      patchState(store, {
        chats,
        chatsCount: Math.max(store.chatsCount() - 1, 0),
        activeChatId: nextActive,
      });
    },
    clearState(): void {
      patchState(store, initialState);
    },
  })),
);
