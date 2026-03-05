import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { Chat } from '../../types/chat';

interface ChatStoreState {
  chats: Chat[];
  chatsCount: number;
  activeChatId: string | null;
}

const initialState: ChatStoreState = {
  chats: [],
  chatsCount: 0,
  activeChatId: null,
};

export const ChatsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    activeChat: computed<Chat | null>(() => {
      return store.chats().find((chat) => chat.id === store.activeChatId()) ?? null;
    }),
  })),
  withMethods((store) => ({
    setChats(chats: Chat[]): void {
      patchState(store, { chats });
    },
    patchChat(chatId: string, data: Partial<Omit<Chat, 'id'>>): boolean {
      const chats = store.chats();
      const targetIndex = chats.findIndex((chat) => chat.id === chatId);
      if (targetIndex < 0) return false;

      const updatedChats = [...chats];
      updatedChats[targetIndex] = { ...updatedChats[targetIndex], ...data };

      if (data.lastUpdate !== undefined) {
        updatedChats.sort((a, b) => b.lastUpdate - a.lastUpdate);
      }

      patchState(store, { chats: updatedChats });
      return true;
    },
    setChatsCount(chatsCount: number): void {
      patchState(store, { chatsCount });
    },
    setActiveChatId(activeChatId: string | null): void {
      patchState(store, { activeChatId });
    },
  })),
);
