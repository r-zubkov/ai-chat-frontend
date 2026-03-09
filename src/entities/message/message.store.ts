import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import type { ChatId } from '@entities/chat';
import { MessageRepository } from './message.repository';
import { ChatMessage, ChatMessageRole, ChatMessageState, MessageId } from './message.model';

type MessageStoreState = {
  messages: ChatMessage[];
  content: Map<MessageId, string>;
};

const initialState: MessageStoreState = {
  messages: [],
  content: new Map<MessageId, string>(),
};

function pickStreamingContent(
  content: Map<MessageId, string>,
  messages: ChatMessage[],
): Map<MessageId, string> {
  const streamingMessageIds = new Set(
    messages
      .filter(
        (message) =>
          message.role === ChatMessageRole.ASSISTANT &&
          message.state === ChatMessageState.STREAMING,
      )
      .map((message) => message.id),
  );

  const next = new Map<MessageId, string>();

  for (const [id, value] of content.entries()) {
    if (streamingMessageIds.has(id)) {
      next.set(id, value);
    }
  }

  return next;
}

export const MessageStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, messageRepository = inject(MessageRepository)) => {
    let latestLoadToken = 0;

    return {
      async loadByChatId(chatId: ChatId | null): Promise<ChatMessage[]> {
        const token = ++latestLoadToken;

        if (!chatId) {
          if (token === latestLoadToken) {
            patchState(store, { messages: [], content: new Map<MessageId, string>() });
          }

          return [];
        }

        const messages = await messageRepository.getMessagesByChatId(chatId);

        if (token !== latestLoadToken) {
          return messages;
        }

        patchState(store, {
          messages,
          content: pickStreamingContent(store.content(), messages),
        });

        return messages;
      },
      setMessages(messages: ChatMessage[]): void {
        const nextMessages = [...messages];
        patchState(store, {
          messages: nextMessages,
          content: pickStreamingContent(store.content(), nextMessages),
        });
      },
      upsertMessages(messages: ChatMessage[]): void {
        if (!messages.length) {
          return;
        }

        const map = new Map(store.messages().map((message) => [message.id, message]));

        for (const message of messages) {
          map.set(message.id, message);
        }

        const nextMessages = Array.from(map.values());

        patchState(store, {
          messages: nextMessages,
          content: pickStreamingContent(store.content(), nextMessages),
        });
      },
      patchMessage(id: MessageId, patch: Partial<ChatMessage>): void {
        const list = store.messages();
        const index = list.findIndex((message) => message.id === id);

        if (index < 0) {
          return;
        }

        const nextMessages = [...list];
        nextMessages[index] = { ...nextMessages[index], ...patch };

        const nextContent = new Map(store.content());
        if (patch.state !== undefined && patch.state !== ChatMessageState.STREAMING) {
          nextContent.delete(id);
        }

        patchState(store, {
          messages: nextMessages,
          content: pickStreamingContent(nextContent, nextMessages),
        });
      },
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
      clearMessages(): void {
        latestLoadToken += 1;
        patchState(store, {
          messages: [],
          content: new Map<MessageId, string>(),
        });
      },
      clearState(): void {
        latestLoadToken += 1;
        patchState(store, initialState);
      },
    };
  }),
);
