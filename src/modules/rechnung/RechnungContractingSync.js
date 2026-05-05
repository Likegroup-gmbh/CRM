// Auto-Sync zwischen rechnung und contracting_position
// Wenn eine Rechnung erstellt/aktualisiert wird, wird der Status der zugehoerigen Position synchronisiert.

export async function syncPositionFromRechnung(positionId, rechnungStatus, { rechnungNr = null, bezahltAm = null } = {}) {
  if (!positionId || !window.supabase) return;

  const update = {};

  switch (rechnungStatus) {
    case 'Bezahlt':
      update.status = 'bezahlt';
      update.bezahlt_am = bezahltAm || new Date().toISOString().split('T')[0];
      break;
    case 'An Qonto gesendet':
    case 'Offen':
    case 'Rückfrage':
      update.status = 'gestellt';
      break;
    default:
      update.status = 'gestellt';
  }

  if (rechnungNr) {
    update.rechnung_nr = rechnungNr;
  }

  const { error } = await window.supabase
    .from('contracting_position')
    .update(update)
    .eq('id', positionId);

  if (error) {
    console.error('❌ Sync contracting_position fehlgeschlagen:', error.message);
  }
}
