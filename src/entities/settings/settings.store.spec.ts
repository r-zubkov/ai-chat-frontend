import { TestBed } from '@angular/core/testing';
import { AVAILABLE_MODELS, ModelType } from '@shared/config';
import { SettingKey } from './settings.model';
import { SettingsRepository } from './settings.repository';
import { SettingsStore } from './settings.store';

describe('SettingsStore', () => {
  let store: InstanceType<typeof SettingsStore>;
  let settingsRepository: jasmine.SpyObj<SettingsRepository>;

  beforeEach(() => {
    settingsRepository = jasmine.createSpyObj<SettingsRepository>('SettingsRepository', [
      'getSetting',
      'setSetting',
    ]);
    settingsRepository.getSetting.and.resolveTo(null);
    settingsRepository.setSetting.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [{ provide: SettingsRepository, useValue: settingsRepository }],
    });

    store = TestBed.inject(SettingsStore);
  });

  it('имеет модель по умолчанию в initial state', () => {
    const defaultModel = AVAILABLE_MODELS[0].id;

    expect(store.currentModel()).toBe(defaultModel);
    expect(store.globalCurrentModel()).toBe(defaultModel);
  });

  it('setCurrentModel меняет только currentModel', () => {
    store.setGlobalCurrentModel(ModelType.GPT_51);

    store.setCurrentModel(ModelType.DEEPSEEK_32);

    expect(store.currentModel()).toBe(ModelType.DEEPSEEK_32);
    expect(store.globalCurrentModel()).toBe(ModelType.GPT_51);
  });

  it('persistGlobalModel сохраняет модель в репозитории', async () => {
    await store.persistGlobalModel(ModelType.GEMINI_3_FLASH_PREVIEW);

    expect(store.globalCurrentModel()).toBe(ModelType.GEMINI_3_FLASH_PREVIEW);
    expect(settingsRepository.setSetting).toHaveBeenCalledWith(
      SettingKey.CURRENT_MODEL,
      ModelType.GEMINI_3_FLASH_PREVIEW,
    );
  });
});
