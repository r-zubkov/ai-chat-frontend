import { ValidationErrors, ValidatorFn } from '@angular/forms';

export const trimRequiredValidator: ValidatorFn = (control): ValidationErrors | null =>
  String(control.value ?? '').trim().length > 0 ? null : { trimRequired: true };
