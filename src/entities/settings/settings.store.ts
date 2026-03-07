import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { AVAILABLE_MODELS, ModelType } from '@shared/config';
import { SettingsRepository } from './settings.repository';
import { SettingKey } from './settings.model';

type SettingsStoreState = {
  currentModel: ModelType;
  globalCurrentModel: ModelType;
};

const getDefaultModel = (): ModelType => AVAILABLE_MODELS[0].id;

export const SettingsStore = signalStore(
  { providedIn: 'root' },
  withState<SettingsStoreState>({
    currentModel: getDefaultModel(),
    globalCurrentModel: getDefaultModel(),
  }),
  withMethods((store, repo = inject(SettingsRepository)) => ({
    async loadSettings(): Promise<void> {
      const loaded = await repo.getSetting(SettingKey.CURRENT_MODEL);
      const fallback = getDefaultModel();
      const model = loaded ?? fallback;

      patchState(store, {
        currentModel: model,
        globalCurrentModel: model,
      });
    },
    setCurrentModel(model: ModelType): void {
      patchState(store, { currentModel: model });
    },
    setGlobalCurrentModel(model: ModelType): void {
      patchState(store, { globalCurrentModel: model });
    },
    async persistGlobalModel(model: ModelType): Promise<void> {
      patchState(store, { globalCurrentModel: model });
      await repo.setSetting(SettingKey.CURRENT_MODEL, model);
    },
  })),
);
