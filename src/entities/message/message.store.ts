import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { computed } from '@angular/core';
import { MessageId } from './message.model';

type MessageStoreState = {
  content: Map<MessageId, string>;
};

const initialState: MessageStoreState = {
  content: new Map<MessageId, string>(),
};

export const MessageStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ content }) => ({
    snapshot: computed(() => content()),
  })),
  withMethods((store) => ({
    set(id: MessageId, message: string): void {
      const next = new Map(store.content());
      next.set(id, message);
      patchState(store, { content: next });
    },
    get(id: MessageId): string {
      return store.content().get(id) ?? '';
    },
    remove(id: MessageId): void {
      const next = new Map(store.content());
      next.delete(id);
      patchState(store, { content: next });
    },
    clear(): void {
      patchState(store, { content: new Map<MessageId, string>() });
    },
  })),
);
