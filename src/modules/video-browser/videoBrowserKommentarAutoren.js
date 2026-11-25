// videoBrowserKommentarAutoren.js
// Wer hinter Kunden-Feedback steht. Das Team trägt Feedback der Kundenseite oft selbst ein (Telefon,
// Mail), gespeichert ist dann der Name des Mitarbeiters. Angezeigt wird der Ansprechpartner der
// Kampagne. Die Rolle des Autors steht auf der Kommentarzeile (author_rolle, per Trigger), weil
// Kunden fremde benutzer-Zeilen nicht lesen dürfen.

const TEAM_ROLLEN = new Set(['admin', 'mitarbeiter']);

const vomTeam = (c) => c.feedback_typ === 'kunde' && TEAM_ROLLEN.has(c.author_rolle);

const nameOf = (ap) => [ap?.vorname, ap?.nachname].filter(Boolean).join(' ').trim();

/**
 * Ansprechpartner der Kampagne, nur wenn das Team Kunden-Feedback eingetragen hat.
 * Mehrere Ansprechpartner stehen mit Komma nebeneinander. Fehler = gespeicherte Namen.
 * @param {{ client: object, kampagneId: string, kommentare: object[] }} input
 * @returns {Promise<string>}
 */
export async function loadKundenName({ client, kampagneId, kommentare }) {
  if (!client || !kampagneId || !(kommentare || []).some(vomTeam)) return '';
  try {
    const { data, error } = await client
      .from('ansprechpartner_kampagne')
      .select('ansprechpartner:ansprechpartner_id(vorname, nachname)')
      .eq('kampagne_id', kampagneId);
    if (error) throw error;
    return [...new Set((data || []).map(r => nameOf(r.ansprechpartner)).filter(Boolean))].sort().join(', ');
  } catch (err) {
    console.warn('VideoBrowser: Ansprechpartner der Kampagne nicht lesbar', err?.message || err);
    return '';
  }
}

/** Angezeigter Name eines Kommentars: Kunden-Feedback, das das Team eingetragen hat, zeigt den Ansprechpartner. */
export function autorName(c, kundenName = '') {
  return kundenName && vomTeam(c) ? kundenName : (c.author_name || 'Unbekannt');
}
