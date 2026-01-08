import { ModelLabelMap } from "../maps/model-label.map";
import { ModelType } from "../types/model-type";

export function getModelLabelByKey(key: ModelType): string {
  return ModelLabelMap[key] || ''
}