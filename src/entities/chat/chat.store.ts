import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { DEFAULT_CHAT_LIST_LIMIT } from '@shared/config';
import { Chat, ChatId, ChatStoreState } from './chat.model';
import { ChatRepository } from './chat.repository';

const initialState: ChatStoreState = {
  chats: [],
  activeChatId: null,
};

function sortByLastUpdateDesc(chats: Chat[]): Chat[] {
  return [...chats].sort((a, b) => b.lastUpdate - a.lastUpdate);
}

export const ChatStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ chats, activeChatId }) => ({
    activeChat: computed(() => chats().find((chat) => chat.id === activeChatId()) ?? null),
    chatsCount: computed(() => chats().length),
  })),
  withMethods((store, chatRepository = inject(ChatRepository)) => ({
    async loadAll(limit: number = DEFAULT_CHAT_LIST_LIMIT): Promise<void> {
      const chats = await chatRepository.getAll(limit);
      patchState(store, { chats: sortByLastUpdateDesc(chats) });
    },
    setActive(id: ChatId | null): void {
      patchState(store, { activeChatId: id });
    },
    setChats(chats: Chat[]): void {
      patchState(store, { chats: sortByLastUpdateDesc(chats) });
    },
    upsertChat(chat: Chat): void {
      const list = store.chats();
      const index = list.findIndex((item) => item.id === chat.id);

      if (index < 0) {
        patchState(store, { chats: sortByLastUpdateDesc([...list, chat]) });
        return;
      }

      const next = [...list];
      next[index] = chat;
      patchState(store, { chats: sortByLastUpdateDesc(next) });
    },
    removeChat(id: ChatId): void {
      const chats = store.chats().filter((chat) => chat.id !== id);
      const nextActive = store.activeChatId() === id ? null : store.activeChatId();
      patchState(store, { chats, activeChatId: nextActive });
    },
    clearState(): void {
      patchState(store, initialState);
    },
  })),
);
