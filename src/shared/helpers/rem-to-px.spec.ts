import { remToPx } from './rem-to-px';

describe('remToPx', () => {
  let previousFontSize: string;

  beforeEach(() => {
    previousFontSize = document.documentElement.style.fontSize;
  });

  afterEach(() => {
    document.documentElement.style.fontSize = previousFontSize;
  });

  it('конвертирует rem в пиксели на основе текущего root font-size', () => {
    document.documentElement.style.fontSize = '10px';

    expect(remToPx(1.5)).toBe(15);
  });

  it('возвращает 0 для нулевого значения rem', () => {
    document.documentElement.style.fontSize = '16px';

    expect(remToPx(0)).toBe(0);
  });
});
