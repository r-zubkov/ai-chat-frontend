import { ModelType } from "./model-type";

export enum ChatState {
  IDLE = 'idle',
  THINKING = 'thinking',
  ERROR = 'error'
}

export interface Chat {
  id: string;
  title: string;
  state: ChatState;
  model: ModelType;
  projectId: string | null;
  currentRequestId: string | null;
  lastUpdate: number;
}
