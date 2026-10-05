// selection/intent
// Gemeinsame Regeln fuer die Default-Auswahl (Video/Story/Still).

/** Kunden sehen, sobald finale Assets existieren, standardmaessig die Finale. */
export function prefersFinal(table) {
  return table?.isKundeRole?.() === true;
}

/**
 * Direkteinstieg "Finale Version" (Tabellen-Spalte): welche finale Variante
 * vorzuwaehlen ist. `intent` = { final, assetId } (einmalig verbraucht).
 * @returns {object|null} null -> normale Default-Auswahl
 */
export function pickIntentFinal(finals, intent) {
  if (!intent?.final || !finals?.length) return null;
  return finals.find(a => a.id === intent.assetId) || finals[0];
}
