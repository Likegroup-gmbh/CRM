// Zentraler Filter: Picker laden nur Finalisierte (is_draft nicht true).
// Briefing/Vertrag: NOT NULL, darum eq false. Auftrag: Altbestand kann NULL sein.

export const FINAL_AUFTRAG_OR_FILTER = 'is_draft.is.null,is_draft.eq.false';

const EQ_FALSE = new Set(['vertraege']);
const NULL_OR_FALSE = new Set(['auftrag']);

export function isFinalisiert(row) {
  return row?.is_draft !== true;
}

export function isFinalAuftrag(row) {
  return isFinalisiert(row);
}

/**
 * Briefing-Picker zeigen keine Altbestand-Linien (ohne Briefing-Dokument, ADR 0058).
 * Mit `kampagneId` bleiben die Altbestand-Linien dieser Kampagne waehlbar, damit
 * Kooperationen einer Linie der eigenen Kampagne zugeordnet werden koennen.
 */
export function applyFinalisiertFilter(query, table, { kampagneId = null } = {}) {
  if (table === 'campaign_briefings') {
    const final = query.eq('is_draft', false);
    return kampagneId
      ? final.or(`ist_altbestand.eq.false,kampagne_id.eq.${kampagneId}`)
      : final.eq('ist_altbestand', false);
  }
  if (EQ_FALSE.has(table)) return query.eq('is_draft', false);
  if (NULL_OR_FALSE.has(table)) return query.or(FINAL_AUFTRAG_OR_FILTER);
  return query;
}
