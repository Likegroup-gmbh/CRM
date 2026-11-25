// audienceSituationGate.js
// Reine Regeln fuer Audience Situations (ADR 0016). Spiegel in
// netlify/functions/_shared/audience-situation.js — dort leben Prompt,
// Validate und das Attach fuer die Functions.

export function istKiBereit(rows) {
  if (!Array.isArray(rows) || !rows.length) return true;
  return rows.every(r => r.quelle === 'migration');
}

export function quelleNachEdit(bestehend, next) {
  if (!bestehend || bestehend.quelle !== 'migration') return 'manual';
  const sameName = String(bestehend.name || '').trim() === String(next.name || '').trim();
  const sameDesc = String(bestehend.beschreibung || '').trim() === String(next.beschreibung || '').trim();
  return sameName && sameDesc ? 'migration' : 'manual';
}
