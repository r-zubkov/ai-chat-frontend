import { ModelType } from '@shared/config';
import type { ModelOption } from '@shared/config';

export { ModelType };
export type { ModelOption };

export enum SettingKey {
  CURRENT_MODEL = 'current-model',
}

export type SettingValue = ModelType;

export interface SettingsMap {
  [SettingKey.CURRENT_MODEL]: ModelType;
}

export type Setting = {
  [K in SettingKey]: {
    key: K;
    value: SettingsMap[K];
  };
}[SettingKey];
