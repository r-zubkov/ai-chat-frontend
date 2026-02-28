import { ModelType } from './model-type';

export enum AppSettingKey {
  CURRENT_MODEL = 'current-model',
}

export interface AppSettingsMap {
  [AppSettingKey.CURRENT_MODEL]: ModelType;
}

export type Setting = {
  [K in AppSettingKey]: {
    key: K;
    value: AppSettingsMap[K];
  };
}[AppSettingKey];
