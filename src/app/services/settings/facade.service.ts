import { inject, Injectable } from '@angular/core';
import { ModelOption } from '../../types/model-option';
import { ModelType } from '../../types/model-type';
import { ChatRepositoryService } from '../chat-repository.service';
import { ChatsFacadeService } from '../chats/facade.service';
import { SettingsMutationService } from './mutation.service';
import { SettingsStore } from './settings.store';
import { AVAILABLE_MODEL_LIST } from '../../constants/chat.constants';

@Injectable({ providedIn: 'root' })
export class SettingsFacadeService {
  private readonly chatRepositoryService = inject(ChatRepositoryService);
  private readonly chatsDomain = inject(ChatsFacadeService);
  private readonly settingsMutationService = inject(SettingsMutationService);
  private readonly settingsStore = inject(SettingsStore);

  readonly models: ModelOption[] = AVAILABLE_MODEL_LIST;

  readonly currentModel = this.settingsStore.currentModel;

  private readonly activeChat = this.chatsDomain.activeChat;
  private readonly activeChatId = this.chatsDomain.activeChatId;
  private readonly globalCurrentModel = this.settingsStore.globalCurrentModel;

  async loadCurrentModelFromDB(): Promise<void> {
    const loaded = await this.chatRepositoryService.loadCurrentModel();
    const modelToSet = loaded ? this.normalizeModel(loaded) : this.getDefaultModel();

    this.settingsMutationService.hydrateCurrentModel(modelToSet);
  }

  async updateCurrentModel(model: ModelType): Promise<void> {
    const modelToSet = this.normalizeModel(model);

    this.settingsMutationService.setCurrentModel(modelToSet);

    if (!this.activeChatId()) {
      await this.settingsMutationService.setGlobalCurrentModel(modelToSet);
    }
  }

  async syncCurrentModelForChat(chatId: string | null): Promise<void> {
    if (chatId) {
      const activeChat = this.activeChat();
      const model = activeChat?.model ?? this.globalCurrentModel();

      await this.updateCurrentModel(model);
      return;
    }

    await this.updateCurrentModel(this.globalCurrentModel());
  }

  private isModelAvailable(model: ModelType): boolean {
    return this.models.some((item) => item.id === model);
  }

  private getDefaultModel(): ModelType {
    return this.models[0].id;
  }

  private normalizeModel(model: ModelType): ModelType {
    return this.isModelAvailable(model) ? model : this.getDefaultModel();
  }
}
