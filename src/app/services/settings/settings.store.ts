import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { ModelType } from '../../types/model-type';

interface SettingsStoreState {
  currentModel: ModelType;
  globalCurrentModel: ModelType;
}

const initialState: SettingsStoreState = {
  currentModel: ModelType.GROK_4_FAST,
  globalCurrentModel: ModelType.GROK_4_FAST,
};

export const SettingsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    setCurrentModel(currentModel: ModelType): void {
      patchState(store, { currentModel });
    },
    setGlobalCurrentModel(globalCurrentModel: ModelType): void {
      patchState(store, { globalCurrentModel });
    },
  })),
);
