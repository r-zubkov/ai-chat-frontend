import { ModelLabelMap } from "../services/chat.service";
import { ModelType } from "../types/model-type";

export function getModelLabelByKey(key: ModelType): string {
  return ModelLabelMap[key] || ''
}