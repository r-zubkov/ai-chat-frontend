import { Pipe, PipeTransform } from '@angular/core';
import { ModelType } from '@shared/config';
import { getModelLabelByKey } from './get-model-label-by-key';

@Pipe({
  name: 'modelLabel',
  standalone: true,
  pure: true,
})
export class ModelLabelPipe implements PipeTransform {
  transform(key: ModelType | null | undefined): string {
    if (!key) return '';
    return getModelLabelByKey(key);
  }
}
