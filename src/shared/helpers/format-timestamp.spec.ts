import { formatTimestamp } from './format-timestamp';

describe('formatTimestamp', () => {
  it('форматирует дату как dd.mm.yy hh:mm', () => {
    const ts = new Date(2026, 2, 5, 9, 7).getTime();

    expect(formatTimestamp(ts)).toBe('05.03.26 09:07');
  });

  it('сохраняет двузначный формат дня и месяца', () => {
    const ts = new Date(2026, 10, 11, 12, 30).getTime();

    expect(formatTimestamp(ts)).toBe('11.11.26 12:30');
  });
});
