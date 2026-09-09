// BriefingLinkGuard.js
// Gemeinsame Briefing-Pflicht fuer Casting (creator_auswahl) und Konzept
// (strategie). Step 1: nur die Verknuepfung, keine Briefing-Inhalte.
//
// Regeln:
// - Create: briefing_id Pflicht, Briefing muss finalisiert sein
//   (is_draft = false), Unternehmen muss matchen, gesetzte Marke muss matchen.
// - Update: gesetzter Link ist eingefroren (kein Wechsel, kein Leeren).
//   Altbestand ohne Link (NULL) darf genau einmal gesetzt werden.

/**
 * Validiert das Briefing fuer einen Create. Wirft bei Verstoss.
 * @param {Object} data - { briefing_id, unternehmen_id, marke_id }
 * @param {string} entityLabel - z.B. 'Casting-Liste' / 'Konzept' (fuer Fehlertexte)
 */
export async function assertBriefingForCreate(data, entityLabel) {
  const briefingId = data?.briefing_id;
  if (!briefingId) {
    throw new Error(`Bitte ein Briefing auswählen — ohne Briefing kann kein ${entityLabel} angelegt werden.`);
  }

  const { data: briefing, error } = await window.supabase
    .from('campaign_briefings')
    .select('id, unternehmen_id, marke_id, is_draft')
    .eq('id', briefingId)
    .single();

  if (error || !briefing) {
    throw new Error('Das ausgewählte Briefing wurde nicht gefunden.');
  }
  if (briefing.is_draft) {
    throw new Error('Das Briefing ist noch ein Entwurf — bitte zuerst finalisieren.');
  }
  if (data.unternehmen_id && briefing.unternehmen_id !== data.unternehmen_id) {
    throw new Error('Das Briefing gehört zu einem anderen Unternehmen.');
  }
  if (data.marke_id && briefing.marke_id !== data.marke_id) {
    throw new Error('Das Briefing gehört zu einer anderen Marke.');
  }
}

/**
 * Erzwingt den Lock eines gesetzten Briefing-Links beim Update.
 * Liest den Ist-Stand selbst. Wirft bei Verstoss.
 * @param {string} table - 'creator_auswahl' | 'strategie'
 * @param {string} id - Datensatz-ID
 * @param {Object} updates - geplante Updates (briefing_id optional)
 */
export async function assertBriefingLinkLock(table, id, updates) {
  const hasKey = Object.prototype.hasOwnProperty.call(updates || {}, 'briefing_id');

  const { data: current, error } = await window.supabase
    .from(table)
    .select('briefing_id')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Fehler beim Lesen des Briefing-Links:', error);
    throw error;
  }

  const existing = current?.briefing_id || null;
  const incoming = hasKey ? (updates.briefing_id || null) : undefined;

  if (existing) {
    // Gesetzt: weder wechseln noch leeren.
    if (hasKey && incoming !== existing) {
      throw new Error('Das verknüpfte Briefing kann nicht geändert oder entfernt werden.');
    }
    // Nicht angefasst oder identisch: nicht mitschreiben.
    delete updates.briefing_id;
    return;
  }

  // Altbestand ohne Link: einmal setzen erlaubt, leer lassen auch.
  if (hasKey && !incoming) {
    delete updates.briefing_id;
  }
}
