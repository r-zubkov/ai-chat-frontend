import { inject, Injectable } from '@angular/core';
import { ModelLabelMap } from '../maps/model-label.map';
import { ModelOption } from '../types/model-option';
import { ModelType } from '../types/model-type';
import { ChatRepositoryService } from './chat-repository.service';
import { ChatStore } from './chat.store';

@Injectable({ providedIn: 'root' })
export class ChatModelService {
  private readonly chatStore = inject(ChatStore);
  private readonly chatRepositoryService = inject(ChatRepositoryService);

  readonly models: ModelOption[] = [
    { id: ModelType.GROK_4_FAST, label: ModelLabelMap[ModelType.GROK_4_FAST]! },
    { id: ModelType.DEEPSEEK_32, label: ModelLabelMap[ModelType.DEEPSEEK_32]! },
    {
      id: ModelType.GEMINI_3_FLASH_PREVIEW,
      label: ModelLabelMap[ModelType.GEMINI_3_FLASH_PREVIEW]!,
    },
    { id: ModelType.GPT_51, label: ModelLabelMap[ModelType.GPT_51]! },
  ];

  readonly currentModel = this.chatStore.currentModel;

  private readonly activeChat = this.chatStore.activeChat;
  private readonly activeChatId = this.chatStore.activeChatId;
  private readonly globalCurrentModel = this.chatStore.globalCurrentModel;

  async loadCurrentModelFromDB(): Promise<void> {
    const loaded = await this.chatRepositoryService.loadCurrentModel();
    const modelToSet = loaded ? this.normalizeModel(loaded) : this.getDefaultModel();

    this.chatStore.setCurrentModel(modelToSet);
    this.chatStore.setGlobalCurrentModel(modelToSet);
  }

  async updateCurrentModel(model: ModelType): Promise<void> {
    const modelToSet = this.normalizeModel(model);

    this.chatStore.setCurrentModel(modelToSet);

    if (!this.activeChatId()) {
      this.chatStore.setGlobalCurrentModel(modelToSet);
      await this.chatRepositoryService.saveCurrentModel(modelToSet);
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
