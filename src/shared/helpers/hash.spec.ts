import { buildTextHash } from './hash';

describe('buildTextHash', () => {
  it('возвращает детерминированный хэш для одинакового ввода', () => {
    const text = 'same input';

    expect(buildTextHash(text)).toBe(buildTextHash(text));
  });

  it('возвращает 0 для пустой строки', () => {
    expect(buildTextHash('')).toBe('0');
  });

  it('возвращает разные хэши для разного ввода', () => {
    expect(buildTextHash('abc')).not.toBe(buildTextHash('abd'));
  });
});
