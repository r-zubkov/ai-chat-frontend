import { truncateAtWord } from './text-utils';

describe('truncateAtWord', () => {
  it('возвращает пустую строку для пустого текста', () => {
    expect(truncateAtWord('', 10)).toBe('');
  });

  it('возвращает пустую строку, если maxLength не положительный', () => {
    expect(truncateAtWord('hello', 0)).toBe('');
  });

  it('возвращает trimmed-текст, если он короче лимита', () => {
    expect(truncateAtWord('  hello world  ', 20, '...')).toBe('hello world');
  });

  it('обрезает по границе слова и добавляет многоточие', () => {
    expect(truncateAtWord('hello world there', 12, '...')).toBe('hello world...');
  });

  it('жестко обрезает, если до лимита нет пробелов', () => {
    expect(truncateAtWord('helloworld', 5, '...')).toBe('hello...');
  });

  it('не добавляет многоточие, когда ellipsis равен null', () => {
    expect(truncateAtWord('hello world', 5, null)).toBe('hello');
  });
});
