import { ModelType } from '@shared/config';
import { ModelLabelPipe } from './model-label.pipe';

describe('ModelLabelPipe', () => {
  const pipe = new ModelLabelPipe();

  it('возвращает лейбл для известного ключа модели', () => {
    expect(pipe.transform(ModelType.GEMINI_3_FLASH_PREVIEW)).toBe('Gemini 3 Flash');
  });

  it('возвращает пустую строку для null и undefined', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
