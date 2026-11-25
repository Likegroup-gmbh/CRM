import { describe, it, expect } from 'vitest';
import {
  buildMonth,
  buildWeek,
  dayLabel,
  formatDateLocal,
  getWeekStart,
  isInPeriod,
  parseDateOnly
} from '../core/calendarDates.js';

const iso = (d) => formatDateLocal(d);

describe('calendarDates', () => {
  it('liest YYYY-MM-DD als lokalen Tag, ohne UTC-Versatz', () => {
    const d = parseDateOnly('2026-11-01');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 1, 0]);
    expect(parseDateOnly('2026-11-01T23:30:00')?.getDate()).toBe(1);
    expect(parseDateOnly('')).toBeNull();
    expect(parseDateOnly('kein Datum')).toBeNull();
  });

  it('beginnt die Woche am Montag, auch für einen Sonntag', () => {
    expect(iso(getWeekStart(new Date(2026, 10, 18, 15, 30)))).toBe('2026-11-16');
    expect(iso(getWeekStart(new Date(2026, 10, 22)))).toBe('2026-11-16');
    expect(iso(getWeekStart(new Date(2026, 10, 16)))).toBe('2026-11-16');
  });

  it('legt Events der Woche auf ihren Tag, auch montags früh', () => {
    const events = [
      { id: 'a', date: '2026-11-16' },
      { id: 'b', date: '2026-11-22' },
      { id: 'c', date: '2026-11-23' }
    ];
    const week = buildWeek(new Date(2026, 10, 18, 12), events, new Date(2026, 10, 18));
    expect(week.map(d => d.iso)).toEqual([
      '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'
    ]);
    expect(week[0].events.map(e => e.id)).toEqual(['a']);
    expect(week[6].events.map(e => e.id)).toEqual(['b']);
    expect(week[2].isToday).toBe(true);
  });

  it('baut den Monat mit Füll-Tagen, die keine Events tragen', () => {
    const events = [
      { id: 'okt', date: '2026-10-31' },
      { id: 'nov', date: '2026-11-01' },
      { id: 'dez', date: '2026-12-01' }
    ];
    const weeks = buildMonth(new Date(2026, 10, 18), events, new Date(2026, 10, 18));
    expect(weeks).toHaveLength(6);
    expect(weeks.every(w => w.length === 7)).toBe(true);
    expect(weeks[0][0].iso).toBe('2026-10-26');
    expect(weeks[0][5]).toMatchObject({ iso: '2026-10-31', isCurrentMonth: false, events: [] });
    expect(weeks[0][6].events.map(e => e.id)).toEqual(['nov']);
    expect(weeks[5][1]).toMatchObject({ iso: '2026-12-01', isCurrentMonth: false, events: [] });
  });

  it('endet ohne leere Folgewoche, wenn der Monat am Sonntag endet', () => {
    const weeks = buildMonth(new Date(2027, 1, 10), [], new Date(2027, 1, 10));
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0].iso).toBe('2027-02-01');
    expect(weeks[3][6].iso).toBe('2027-02-28');
  });

  it('prüft, ob ein Tag im gezeigten Zeitraum liegt', () => {
    const anchor = new Date(2026, 10, 18);
    expect(isInPeriod(new Date(2026, 10, 22), anchor, 'week')).toBe(true);
    expect(isInPeriod(new Date(2026, 10, 23), anchor, 'week')).toBe(false);
    expect(isInPeriod(new Date(2026, 10, 30), anchor, 'month')).toBe(true);
    expect(isInPeriod(new Date(2026, 11, 1), anchor, 'month')).toBe(false);
  });

  it('beschriftet Tagesspalten mit Wochentag und Tag', () => {
    expect(dayLabel(new Date(2026, 10, 1))).toBe('SO 01');
  });
});
