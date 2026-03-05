import { inject, Injectable } from '@angular/core';
import { ModelLabelMap } from '../../maps/model-label.map';
import { ModelOption } from '../../types/model-option';
import { ModelType } from '../../types/model-type';
import { ChatRepositoryService } from '../chat-repository.service';
import { ChatsFacadeService } from '../chats/facade.service';
import { SettingsMutationService } from './mutation.service';
import { SettingsStore } from './settings.store';

@Injectable({ providedIn: 'root' })
export class SettingsFacadeService {
  private readonly chatRepositoryService = inject(ChatRepositoryService);
  private readonly chatsDomain = inject(ChatsFacadeService);
  private readonly settingsMutationService = inject(SettingsMutationService);
  private readonly settingsStore = inject(SettingsStore);

  readonly models: ModelOption[] = [
    { id: ModelType.GROK_4_FAST, label: ModelLabelMap[ModelType.GROK_4_FAST]! },
    { id: ModelType.DEEPSEEK_32, label: ModelLabelMap[ModelType.DEEPSEEK_32]! },
    {
      id: ModelType.GEMINI_3_FLASH_PREVIEW,
      label: ModelLabelMap[ModelType.GEMINI_3_FLASH_PREVIEW]!,
    },
    { id: ModelType.GPT_51, label: ModelLabelMap[ModelType.GPT_51]! },
  ];

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
