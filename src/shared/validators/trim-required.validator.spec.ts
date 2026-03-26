import { FormControl } from '@angular/forms';
import { trimRequiredValidator } from './trim-required.validator';

describe('trimRequiredValidator', () => {
  it('возвращает ошибку для null', () => {
    const control = new FormControl<string | null>(null);

    expect(trimRequiredValidator(control)).toEqual({ trimRequired: true });
  });

  it('возвращает ошибку для строки только из пробелов', () => {
    const control = new FormControl('   ');

    expect(trimRequiredValidator(control)).toEqual({ trimRequired: true });
  });

  it('возвращает ошибку для строки только из табов и переносов', () => {
    const control = new FormControl('\n\t');

    expect(trimRequiredValidator(control)).toEqual({ trimRequired: true });
  });

  it('возвращает null для непустого trimmed-значения', () => {
    const control = new FormControl('  test  ');

    expect(trimRequiredValidator(control)).toBeNull();
  });

  it('возвращает null для непустого нестрокового значения', () => {
    const control = new FormControl<number | null>(0);

    expect(trimRequiredValidator(control)).toBeNull();
  });
});
