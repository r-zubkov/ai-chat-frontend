import { ModelType } from '@shared/config';
import { ModelLabelMap } from './model-label.map';

export function getModelLabelByKey(key: ModelType): string {
  return ModelLabelMap[key] || '';
}
