// creatorRows.js
// Gemeinsames Laden aller Creator fuer Picker. Eine einzelne PostgREST-Anfrage
// liefert hoechstens 1.000 Zeilen; alphabetisch nach Vorname fehlen dann genau
// die hinteren Namen.

import { fetchAllRows } from './fetchAllRows.js';

export function creatorDisplayName(creator) {
  return `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim();
}

export function compareCreators(a, b, primary = 'vorname') {
  const secondary = primary === 'nachname' ? 'vorname' : 'nachname';
  const byPrimary = String(a?.[primary] || '').localeCompare(String(b?.[primary] || ''), 'de', { sensitivity: 'base' });
  if (byPrimary !== 0) return byPrimary;
  return String(a?.[secondary] || '').localeCompare(String(b?.[secondary] || ''), 'de', { sensitivity: 'base' });
}

export async function loadAllCreators(supabase, { select = 'id, vorname, nachname, instagram', refine, sortBy = 'vorname' } = {}) {
  const rows = await fetchAllRows(supabase, 'creator', select, 1000, refine);
  rows.sort((a, b) => compareCreators(a, b, sortBy));
  return rows;
}
