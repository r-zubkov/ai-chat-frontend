import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { Chat } from '../types/chat';
import { ModelType } from '../types/model-type';

interface ChatStoreState {
  chats: Chat[];
  chatsCount: number;
  activeChatId: string | null;
  currentModel: ModelType;
  globalCurrentModel: ModelType;
}

const initialState: ChatStoreState = {
  chats: [],
  chatsCount: 0,
  activeChatId: null,
  currentModel: ModelType.GROK_4_FAST,
  globalCurrentModel: ModelType.GROK_4_FAST,
};

export const ChatStore = signalStore(
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
    setChatsCount(chatsCount: number): void {
      patchState(store, { chatsCount });
    },
    setActiveChatId(activeChatId: string | null): void {
      patchState(store, { activeChatId });
    },
    setCurrentModel(currentModel: ModelType): void {
      patchState(store, { currentModel });
    },
    setGlobalCurrentModel(globalCurrentModel: ModelType): void {
      patchState(store, { globalCurrentModel });
    },
  })),
);
