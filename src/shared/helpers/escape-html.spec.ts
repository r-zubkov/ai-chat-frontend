import { escapeHtml } from './escape-html';

describe('escapeHtml', () => {
  it('экранирует специальные HTML-символы', () => {
    expect(escapeHtml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&#39;');
  });

  it('не изменяет строку без специальных символов', () => {
    expect(escapeHtml('const value = 1;')).toBe('const value = 1;');
  });
});
