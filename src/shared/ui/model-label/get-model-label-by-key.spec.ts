import { ModelType } from '@shared/config';
import { getModelLabelByKey } from './get-model-label-by-key';

describe('getModelLabelByKey', () => {
  it('возвращает лейбл для известного ключа модели', () => {
    expect(getModelLabelByKey(ModelType.GPT_51)).toBe('GPT 5.1');
  });

  it('возвращает пустую строку для неизвестного ключа модели', () => {
    expect(getModelLabelByKey('unknown-model' as ModelType)).toBe('');
  });
});
