export enum ModelType {
  GPT_5 = 'gpt-5',
  GPT_5_MINI = 'gpt-5-mini',
  GPT_5_NANO = 'gpt-5-nano',
  GPT_51 = 'gpt-51',
  GPT_52 = 'gpt-52',
  GROK_4_FAST = 'grok-4-fast',
  GROK_CODE_FAST = 'grok-code-fast',
  GEMINI_2_FLASH = 'gemini-2-flash',
  GEMINI_2_FLASH_LIGHT = 'gemini-2-flash-light',
  GEMINI_25_FLASH = 'gemini-25-flash',
  GEMINI_25_FLASH_LIGHT = 'gemini-25-flash-light',
  GEMINI_3_FLASH_PREVIEW = 'gemini-3-flash-preview',
  DEEPSEEK_32 = 'deepseek-32',
}

export type ModelOption = { id: ModelType; label: string };

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: ModelType.GROK_4_FAST, label: 'Grok 4 Fast' },
  { id: ModelType.DEEPSEEK_32, label: 'DeepSeek V3.2' },
  { id: ModelType.GEMINI_3_FLASH_PREVIEW, label: 'Gemini 3 Flash' },
  { id: ModelType.GPT_51, label: 'GPT 5.1' },
];

export const HISTORY_LIMIT: number = 6;

export const SYSTEM_PROMPT: string = `
  Стиль:
  - Короткие абзацы, буллет-пойнты.
  - Markdown по умолчанию.
  - Иногда уместный эмодзи в начале абзаца.
  - Тон: спокойный, уверенный, без канцелярита.
  - Если есть код — отдельный блок с короткими комментариями.
  - Если задачу можно сделать по шагам — пронумеруй шаги.
`;

export const STREAM_PERSIST_INTERVAL: number = 5000;
