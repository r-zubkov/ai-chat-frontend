import { inject, Injectable } from '@angular/core';
import { ModelType } from '../../types/model-type';
import { ChatRepositoryService } from '../chat-repository.service';
import { SettingsStore } from './settings.store';

@Injectable({ providedIn: 'root' })
export class SettingsMutationService {
  private readonly settingsStore = inject(SettingsStore);
  private readonly chatRepositoryService = inject(ChatRepositoryService);

  setCurrentModel(model: ModelType): void {
    this.settingsStore.setCurrentModel(model);
  }

  hydrateCurrentModel(model: ModelType): void {
    this.settingsStore.setCurrentModel(model);
    this.settingsStore.setGlobalCurrentModel(model);
  }

  async setGlobalCurrentModel(model: ModelType): Promise<void> {
    this.settingsStore.setGlobalCurrentModel(model);
    await this.chatRepositoryService.saveCurrentModel(model);
  }
}
