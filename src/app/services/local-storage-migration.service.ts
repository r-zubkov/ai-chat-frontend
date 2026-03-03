import { Injectable } from '@angular/core';
import { chatDB } from '../common/chat.db';
import { Chat, ChatState } from '../types/chat';
import { ChatMessage, ChatMessageRole, ChatMessageState } from '../types/chat-message';
import { ModelType } from '../types/model-type';
import { AppSettingKey } from '../types/setting';

const CHATS_STORAGE_KEY = 'ai-chat-chats';
const CURRENT_MODEL_STORAGE_KEY = 'ai-chat-current-model';

type LegacyChatMessage = {
  id: unknown;
  role: unknown;
  model: unknown;
  content: unknown;
  timestamp: unknown;
};

type LegacyChat = {
  id: unknown;
  title: unknown;
  state: unknown;
  model: unknown;
  lastUpdate: unknown;
  messages?: unknown;
};

type ParsedStorageValue = {
  ok: boolean;
  value: unknown | null;
};

type MigrationSourceStats = {
  sourceChatsCount: number;
  sourceMessagesCount: number;
  hasCurrentModelSource: boolean;
};

type MappedLegacyData = {
  chats: Chat[];
  messages: ChatMessage[];
  skippedChatsCount: number;
  skippedMessagesCount: number;
};

@Injectable({ providedIn: 'root' })
export class LocalStorageMigrationService {
  private readonly knownModels = new Set<string>(Object.values(ModelType));

  async migrateIfNeeded(): Promise<void> {
    const chatsRaw = localStorage.getItem(CHATS_STORAGE_KEY);
    const currentModelRaw = localStorage.getItem(CURRENT_MODEL_STORAGE_KEY);

    if (chatsRaw === null && currentModelRaw === null) {
      return;
    }

    const historyCountsBefore = await this.getDexieHistoryCounts();
    if (historyCountsBefore.chatsCount > 0 || historyCountsBefore.messagesCount > 0) {
      console.info('[migration] skip: Dexie already has chats or messages, removing legacy keys', {
        dbChatsCountBefore: historyCountsBefore.chatsCount,
        dbMessagesCountBefore: historyCountsBefore.messagesCount,
      });
      this.clearLegacyStorage();
      return;
    }

    const parsedChats = this.parseStorageValue(chatsRaw);
    const parsedCurrentModel = this.parseStorageValue(currentModelRaw);
    if (!parsedChats.ok || !parsedCurrentModel.ok) {
      console.warn('[migration] parse error: keeping legacy keys to avoid data loss');
      return;
    }

    const sourceStats = this.getSourceStats(
      parsedChats.value,
      currentModelRaw,
      parsedCurrentModel.value,
    );

    console.info('[migration] source snapshot', {
      sourceChatsCount: sourceStats.sourceChatsCount,
      sourceMessagesCount: sourceStats.sourceMessagesCount,
      hasCurrentModelSource: sourceStats.hasCurrentModelSource,
    });

    const mappedData = this.mapLegacyChats(parsedChats.value);
    const mappedChatsCount = mappedData.chats.length;
    const mappedMessagesCount = mappedData.messages.length;

    const modelFromLegacy = this.getModelFromLegacyPayload(
      currentModelRaw,
      parsedCurrentModel.value,
    );

    console.info('[migration] mapping strategy', {
      chatIteration: 'reverse-full-pass-no-limit',
      messageIteration: 'reverse-full-pass-no-limit',
    });

    console.info('[migration] prepared payload', {
      mappedChatsCount,
      mappedMessagesCount,
      skippedChatsCount: mappedData.skippedChatsCount,
      skippedMessagesCount: mappedData.skippedMessagesCount,
      hasCurrentModel: modelFromLegacy !== null,
    });

    if (
      mappedChatsCount < sourceStats.sourceChatsCount ||
      mappedMessagesCount < sourceStats.sourceMessagesCount
    ) {
      console.warn(
        '[migration] source contains skipped records (invalid IDs are skipped by design)',
        {
          sourceChatsCount: sourceStats.sourceChatsCount,
          sourceMessagesCount: sourceStats.sourceMessagesCount,
          mappedChatsCount,
          mappedMessagesCount,
          skippedChatsCount: mappedData.skippedChatsCount,
          skippedMessagesCount: mappedData.skippedMessagesCount,
        },
      );
    }

    const hasNonEmptySource = this.hasNonEmptyLegacySource(
      chatsRaw,
      currentModelRaw,
      parsedChats.value,
      parsedCurrentModel.value,
    );

    if (!mappedChatsCount && !mappedMessagesCount && modelFromLegacy === null) {
      if (hasNonEmptySource) {
        console.warn('[migration] no valid records mapped: keeping legacy keys');
      } else {
        console.info('[migration] nothing to migrate: keeping legacy keys');
      }
      return;
    }

    let migratedCurrentModel = false;

    await chatDB.transaction('rw', chatDB.chats, chatDB.messages, chatDB.settings, async () => {
      if (mappedChatsCount) {
        await chatDB.chats.bulkPut(mappedData.chats);
      }

      if (mappedMessagesCount) {
        await chatDB.messages.bulkPut(mappedData.messages);
      }

      if (modelFromLegacy !== null) {
        const existingModel = await chatDB.settings.get(AppSettingKey.CURRENT_MODEL);
        if (!existingModel) {
          await chatDB.settings.put({
            key: AppSettingKey.CURRENT_MODEL,
            value: modelFromLegacy,
          });
          migratedCurrentModel = true;
        }
      }
    });

    const wroteAny = mappedChatsCount > 0 || mappedMessagesCount > 0 || migratedCurrentModel;
    if (!wroteAny) {
      console.warn('[migration] no writes performed: keeping legacy keys');
      return;
    }

    const historyCountsAfter = await this.getDexieHistoryCounts();

    console.info('[migration] post-check', {
      dbChatsCountAfter: historyCountsAfter.chatsCount,
      dbMessagesCountAfter: historyCountsAfter.messagesCount,
      mappedChatsCount,
      mappedMessagesCount,
      migratedCurrentModel,
    });

    if (
      historyCountsAfter.chatsCount !== mappedChatsCount ||
      historyCountsAfter.messagesCount !== mappedMessagesCount
    ) {
      console.warn('[migration] post-check mismatch: database counts differ from mapped counts', {
        dbChatsCountAfter: historyCountsAfter.chatsCount,
        dbMessagesCountAfter: historyCountsAfter.messagesCount,
        mappedChatsCount,
        mappedMessagesCount,
      });
    }

    console.info('[migration] completed', {
      mappedChatsCount,
      mappedMessagesCount,
      skippedChatsCount: mappedData.skippedChatsCount,
      skippedMessagesCount: mappedData.skippedMessagesCount,
      migratedCurrentModel,
    });

    this.clearLegacyStorage();
  }

  private async getDexieHistoryCounts(): Promise<{ chatsCount: number; messagesCount: number }> {
    const [chatsCount, messagesCount] = await Promise.all([
      chatDB.chats.count(),
      chatDB.messages.count(),
    ]);

    return { chatsCount, messagesCount };
  }

  private parseStorageValue(raw: string | null): ParsedStorageValue {
    if (raw === null) {
      return { ok: true, value: null };
    }

    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch {
      return { ok: false, value: null };
    }
  }

  private getSourceStats(
    parsedChats: unknown,
    currentModelRaw: string | null,
    parsedCurrentModel: unknown | null,
  ): MigrationSourceStats {
    if (!Array.isArray(parsedChats)) {
      return {
        sourceChatsCount: 0,
        sourceMessagesCount: 0,
        hasCurrentModelSource: currentModelRaw !== null && parsedCurrentModel !== null,
      };
    }

    let sourceMessagesCount = 0;

    for (const rawChat of parsedChats) {
      if (!rawChat || typeof rawChat !== 'object') {
        continue;
      }

      const messages = (rawChat as LegacyChat).messages;
      if (Array.isArray(messages)) {
        sourceMessagesCount += messages.length;
      }
    }

    return {
      sourceChatsCount: parsedChats.length,
      sourceMessagesCount,
      hasCurrentModelSource: currentModelRaw !== null && parsedCurrentModel !== null,
    };
  }

  private mapLegacyChats(rawValue: unknown): MappedLegacyData {
    if (!Array.isArray(rawValue)) {
      return {
        chats: [],
        messages: [],
        skippedChatsCount: 0,
        skippedMessagesCount: 0,
      };
    }

    const chats: Chat[] = [];
    const messages: ChatMessage[] = [];
    let skippedChatsCount = 0;
    let skippedMessagesCount = 0;

    // Full pass over all chats from end to start without any limit.
    for (let chatIndex = rawValue.length - 1; chatIndex >= 0; chatIndex -= 1) {
      const rawChat = rawValue[chatIndex] as LegacyChat;
      const rawMessages = Array.isArray(rawChat?.messages) ? rawChat.messages : [];
      const chatId = this.readString(rawChat?.id);
      if (!chatId) {
        skippedChatsCount += 1;
        skippedMessagesCount += rawMessages.length;
        continue;
      }

      const chatModel = this.normalizeModelType(rawChat.model, ModelType.GROK_4_FAST);
      const chat: Chat = {
        id: chatId,
        title: this.readString(rawChat.title) ?? '',
        state: this.normalizeChatState(rawChat.state),
        model: chatModel,
        projectId: null,
        currentRequestId: null,
        lastUpdate: this.normalizeTimestamp(rawChat.lastUpdate),
      };
      chats.push(chat);

      let sequelId = 0;

      // Full pass over all messages from end to start without any limit.
      for (let messageIndex = rawMessages.length - 1; messageIndex >= 0; messageIndex -= 1) {
        const rawMessage = rawMessages[messageIndex] as LegacyChatMessage;
        const messageId = this.readString(rawMessage?.id);
        if (!messageId) {
          skippedMessagesCount += 1;
          continue;
        }

        messages.push({
          id: messageId,
          chatId,
          sequelId,
          role: this.normalizeMessageRole(rawMessage.role),
          model: this.normalizeModelType(rawMessage.model, chatModel),
          state: ChatMessageState.COMPLETED,
          content: this.readString(rawMessage.content) ?? '',
          timestamp: this.normalizeTimestamp(rawMessage.timestamp),
        });

        sequelId += 1;
      }
    }

    return {
      chats,
      messages,
      skippedChatsCount,
      skippedMessagesCount,
    };
  }

  private getModelFromLegacyPayload(raw: string | null, parsed: unknown | null): ModelType | null {
    if (raw === null || parsed === null) {
      return null;
    }

    return this.normalizeModelType(parsed, ModelType.GROK_4_FAST);
  }

  private hasNonEmptyLegacySource(
    chatsRaw: string | null,
    currentModelRaw: string | null,
    parsedChats: unknown,
    parsedCurrentModel: unknown | null,
  ): boolean {
    const hasChatsSource =
      chatsRaw !== null &&
      ((Array.isArray(parsedChats) && parsedChats.length > 0) ||
        (!Array.isArray(parsedChats) && parsedChats !== null));

    const hasCurrentModelSource = currentModelRaw !== null && parsedCurrentModel !== null;

    return hasChatsSource || hasCurrentModelSource;
  }

  private normalizeModelType(value: unknown, fallback: ModelType): ModelType {
    if (value === 'gpt5') {
      return ModelType.GPT_5;
    }

    if (value === 'gpt5-mini') {
      return ModelType.GPT_5_MINI;
    }

    if (typeof value !== 'string') {
      return fallback;
    }

    return this.knownModels.has(value) ? (value as ModelType) : fallback;
  }

  private normalizeChatState(value: unknown): ChatState {
    if (value === ChatState.ERROR) {
      return ChatState.ERROR;
    }

    if (value === ChatState.IDLE || value === ChatState.THINKING) {
      return ChatState.IDLE;
    }

    return ChatState.IDLE;
  }

  private normalizeMessageRole(value: unknown): ChatMessageRole {
    if (value === ChatMessageRole.ASSISTANT) {
      return ChatMessageRole.ASSISTANT;
    }

    if (value === ChatMessageRole.SYSTEM) {
      return ChatMessageRole.SYSTEM;
    }

    return ChatMessageRole.USER;
  }

  private normalizeTimestamp(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }

    if (typeof value === 'string') {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) {
        return numeric;
      }
    }

    return Date.now();
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private clearLegacyStorage(): void {
    localStorage.removeItem(CHATS_STORAGE_KEY);
    localStorage.removeItem(CURRENT_MODEL_STORAGE_KEY);
  }
}
