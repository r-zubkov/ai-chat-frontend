import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { ModelType } from '../../types/model-type';
import { AVAILABLE_MODEL_LIST } from '../../constants/chat.constants';

interface SettingsStoreState {
  currentModel: ModelType;
  globalCurrentModel: ModelType;
}

const initialState: SettingsStoreState = {
  currentModel: AVAILABLE_MODEL_LIST[0].id,
  globalCurrentModel: AVAILABLE_MODEL_LIST[0].id,
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
