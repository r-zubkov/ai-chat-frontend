import { getCssValue } from './get-css-value';

describe('getCssValue', () => {
  let previousRootVar: string;

  beforeEach(() => {
    previousRootVar = document.documentElement.style.getPropertyValue('--spec-root-var');
  });

  afterEach(() => {
    if (previousRootVar) {
      document.documentElement.style.setProperty('--spec-root-var', previousRootVar);
      return;
    }

    document.documentElement.style.removeProperty('--spec-root-var');
  });

  it('читает CSS-переменную у documentElement по умолчанию', () => {
    document.documentElement.style.setProperty('--spec-root-var', '768px');

    expect(getCssValue('--spec-root-var')).toBe('768px');
  });

  it('читает значение у переданного элемента', () => {
    const element = document.createElement('div');
    element.style.setProperty('--spec-root-var', '24px');
    document.body.appendChild(element);

    expect(getCssValue('--spec-root-var', element)).toBe('24px');

    element.remove();
  });
});
