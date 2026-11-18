// bereichAbleiten.js
// Die Spalte campaign_briefings.bereich kennt genau einen Typ (NOT NULL, CHECK), die Frage
// „Wie wird der Content verwendet?“ ist mehrfach wählbar. Der Typ wird daher aus den Häkchen
// abgeleitet, statt im Formular extra abgefragt zu werden.

// Reihenfolge = Vorrang, wenn mehrere Häkchen gesetzt sind und der bisherige Typ nicht dabei ist.
export const NUTZUNG_ZU_BEREICH = [
  { feld: 'nutzung_paid_media', bereich: 'paid_creator_ads' },
  { feld: 'nutzung_creator_kanal', bereich: 'influencer_marketing' },
  { feld: 'nutzung_markenkanal', bereich: 'owned_social' }
];

export const NUTZUNG_FELDER = NUTZUNG_ZU_BEREICH.map(n => n.feld);
const STANDARD_BEREICH = 'owned_social';

/** Ist mindestens ein „Wie wird der Content verwendet?“-Häkchen gesetzt? */
export function hatNutzung(daten) {
  return NUTZUNG_FELDER.some(feld => daten?.[feld] === true);
}

/**
 * Typ aus den Nutzungs-Häkchen. Der bisherige Typ bleibt, solange sein Häkchen gesetzt ist
 * (kein Umspringen beim Bearbeiten). Ohne Häkchen gilt der bisherige Typ, sonst Owned Media.
 * @param {object} daten Felder nutzung_* (boolean)
 * @param {string|null} aktuell bisheriger bereich
 */
export function leiteBereichAb(daten, aktuell = null) {
  const gesetzt = NUTZUNG_ZU_BEREICH.filter(n => daten?.[n.feld] === true);
  if (gesetzt.some(n => n.bereich === aktuell)) return aktuell;
  if (gesetzt.length) return gesetzt[0].bereich;
  return NUTZUNG_ZU_BEREICH.some(n => n.bereich === aktuell) ? aktuell : STANDARD_BEREICH;
}

/** Ältere Briefings ohne Nutzungs-Häkchen: das Häkchen des gespeicherten Typs vorbelegen. */
export function nutzungAusBereich(daten, bereich) {
  if (hatNutzung(daten)) return {};
  const hit = NUTZUNG_ZU_BEREICH.find(n => n.bereich === bereich);
  return hit ? { [hit.feld]: true } : {};
}
