// calendarDates.js
// Datumsrechnung der Kalenderansichten (Kampagnen-Kalender, Kalender im Videos-Tab).
// Alles in lokaler Zeit: ein `YYYY-MM-DD` ist ein Kalendertag, kein UTC-Zeitpunkt.

export const WEEKDAY_LABELS = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'];
const DAY_NAMES = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA'];

/** Tag ohne Uhrzeit aus Date, `YYYY-MM-DD` oder ISO-String. `null`, wenn nichts Lesbares drinsteht. */
export function parseDateOnly(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** `YYYY-MM-DD` in lokaler Zeit. */
export function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Montag der Woche, 00:00. */
export function getWeekStart(date) {
  const d = parseDateOnly(date);
  const day = d.getDay();
  return addDays(d, day === 0 ? -6 : 1 - day);
}

export function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export const isSameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

/** Liegt `date` im Zeitraum (Woche bzw. Monat), den `anchor` in der Ansicht `view` zeigt? */
export function isInPeriod(date, anchor, view) {
  if (!date || !anchor) return false;
  if (view === 'month') return isSameMonth(date, anchor);
  return formatDateLocal(getWeekStart(date)) === formatDateLocal(getWeekStart(anchor));
}

/** Events je Tag (`YYYY-MM-DD`), Reihenfolge wie übergeben. Events ohne lesbares Datum fallen weg. */
export function groupByDay(events) {
  const map = new Map();
  for (const ev of events || []) {
    const d = parseDateOnly(ev.date);
    if (!d) continue;
    const key = formatDateLocal(d);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ev);
  }
  return map;
}

function dayCell(date, byDay, todayIso, isCurrentMonth = true) {
  const iso = formatDateLocal(date);
  return {
    date,
    iso,
    // Füll-Tage des Vor- und Folgemonats bleiben leer
    events: isCurrentMonth ? (byDay.get(iso) || []) : [],
    isToday: iso === todayIso,
    isCurrentMonth
  };
}

/** Sieben Tage ab Montag der Woche von `anchor`. */
export function buildWeek(anchor, events, today = new Date()) {
  const byDay = groupByDay(events);
  const start = getWeekStart(anchor);
  const todayIso = formatDateLocal(today);
  return Array.from({ length: 7 }, (_, i) => dayCell(addDays(start, i), byDay, todayIso));
}

/** Wochen (je sieben Tage, ab Montag) des Monats von `anchor`, mit Füll-Tagen davor und danach. */
export function buildMonth(anchor, events, today = new Date()) {
  const byDay = groupByDay(events);
  const first = getMonthStart(anchor);
  const todayIso = formatDateLocal(today);
  const weeks = [];
  let cursor = getWeekStart(first);
  do {
    const week = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(cursor, i);
      return dayCell(date, byDay, todayIso, isSameMonth(date, first));
    });
    weeks.push(week);
    cursor = addDays(cursor, 7);
  } while (isSameMonth(cursor, first));
  return weeks;
}

/** "MO 16" für den Kopf einer Tagesspalte. */
export function dayLabel(date) {
  return `${DAY_NAMES[date.getDay()]} ${String(date.getDate()).padStart(2, '0')}`;
}

export function formatWeekTitle(anchor) {
  const start = getWeekStart(anchor);
  const end = addDays(start, 6);
  const startStr = start.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  const endStr = end.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

export function formatMonthTitle(anchor) {
  return getMonthStart(anchor).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}
