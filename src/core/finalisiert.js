// Zentraler Filter: Picker laden nur Finalisierte (is_draft nicht true).
// Briefing/Vertrag: NOT NULL, darum eq false. Auftrag: Altbestand kann NULL sein.

export const FINAL_AUFTRAG_OR_FILTER = 'is_draft.is.null,is_draft.eq.false';

const EQ_FALSE = new Set(['campaign_briefings', 'vertraege']);
const NULL_OR_FALSE = new Set(['auftrag']);

export function isFinalisiert(row) {
  return row?.is_draft !== true;
}

export function isFinalAuftrag(row) {
  return isFinalisiert(row);
}

export function applyFinalisiertFilter(query, table) {
  if (EQ_FALSE.has(table)) return query.eq('is_draft', false);
  if (NULL_OR_FALSE.has(table)) return query.or(FINAL_AUFTRAG_OR_FILTER);
  return query;
}
