import { ModelLabelMap } from '../maps/model-label.map';
import { ModelOption } from '../types/model-option';
import { ModelType } from '../types/model-type';

export const AVAILABLE_MODEL_LIST: ModelOption[] = [
  { id: ModelType.GROK_4_FAST, label: ModelLabelMap[ModelType.GROK_4_FAST]! },
  { id: ModelType.DEEPSEEK_32, label: ModelLabelMap[ModelType.DEEPSEEK_32]! },
  {
    id: ModelType.GEMINI_3_FLASH_PREVIEW,
    label: ModelLabelMap[ModelType.GEMINI_3_FLASH_PREVIEW]!,
  },
  { id: ModelType.GPT_51, label: ModelLabelMap[ModelType.GPT_51]! },
];

export const API_HISTORY_LIMIT: number = 6;

export const MODEL_BASE_SYSTEM_PROMT: string = `
  Стиль:
  - Короткие абзацы, буллет-пойнты.
  - Markdown по умолчанию.
  - Иногда уместный эмодзи в начале абзаца.
  - Тон: спокойный, уверенный, без канцелярита.
  - Если есть код — отдельный блок с короткими комментариями.
  - Если задачу можно сделать по шагам — пронумеруй шаги.
`;

export const PERSIST_INTERVAL_MS: number = 5000;
