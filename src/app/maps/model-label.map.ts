import { ModelType } from '../types/model-type';

export const ModelLabelMap: Partial<Record<ModelType, string>> = {
  [ModelType.GPT_5]: 'GPT 5',
  [ModelType.GPT_5_MINI]: 'GPT 5 mini',
  [ModelType.GPT_5_NANO]: 'GPT 5 nano',
  [ModelType.GPT_51]: 'GPT 5.1',
  [ModelType.GPT_52]: 'GPT 5.2',
  [ModelType.GROK_4_FAST]: 'Grok 4 Fast',
  [ModelType.GROK_CODE_FAST]: 'Grok Code Fast',
  [ModelType.GEMINI_2_FLASH]: 'Gemini 2 Flash',
  [ModelType.GEMINI_2_FLASH_LIGHT]: 'Gemini 2 Flash Light',
  [ModelType.GEMINI_25_FLASH]: 'Gemini 2.5 Flash',
  [ModelType.GEMINI_25_FLASH_LIGHT]: 'Gemini 2.5 Flash Light',
  [ModelType.GEMINI_3_FLASH_PREVIEW]: 'Gemini 3 Flash',
  [ModelType.DEEPSEEK_32]: 'DeepSeek V3.2',
};
