import { inject, Injectable } from '@angular/core';
import { ChatId, ChatStore } from '@entities/chat';
import { ModelType, SettingsStore } from '@entities/settings';
import { AVAILABLE_MODELS } from '@shared/config';

@Injectable({ providedIn: 'root' })
export class SelectModelService {
  private readonly chatStore = inject(ChatStore);
  private readonly settingsStore = inject(SettingsStore);

  readonly models = AVAILABLE_MODELS;

  async selectModel(model: ModelType): Promise<void> {
    const modelToSet = this.normalizeModel(model);

    this.settingsStore.setCurrentModel(modelToSet);

    if (!this.chatStore.activeChatId()) {
      await this.settingsStore.persistGlobalModel(modelToSet);
    }
  }

  syncCurrentModelForChat(chatId: ChatId | null): void {
    if (chatId) {
      const activeChat = this.chatStore.activeChat();
      const model = activeChat?.model ?? this.settingsStore.globalCurrentModel();
      this.settingsStore.setCurrentModel(model);
      return;
    }

    this.settingsStore.setCurrentModel(this.settingsStore.globalCurrentModel());
  }

  private normalizeModel(model: ModelType): ModelType {
    const isAvailable = this.models.some((item) => item.id === model);
    return isAvailable ? model : this.models[0].id;
  }
}
