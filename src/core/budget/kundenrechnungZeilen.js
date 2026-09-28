// kundenrechnungZeilen.js
// Eine Zeile je Teilrechnung, sonst der Auftrag selbst. Dieselbe Aufteilung
// wie die Kundenrechnungs-Liste, damit Kachelsumme und Dashboard dieselben
// Beträge sehen.

import { isFinalAuftrag } from '../finalisiert.js';

const TR_FIELDS = [
  're_nr', 'externe_po', 'nettobetrag', 'ust_betrag', 'bruttobetrag',
  'rechnung_gestellt', 'rechnung_gestellt_am', 're_faelligkeit',
  'erwarteter_monat_zahlungseingang',
  'ueberwiesen', 'ueberwiesen_am'
];

function applyTeilrechnungFields(row, tr) {
  for (const field of TR_FIELDS) {
    if (tr[field] !== undefined) row[field] = tr[field];
  }
  return row;
}

export function kundenrechnungZeilen(auftraege, teilrechnungen) {
  const trByAuftrag = new Map();
  for (const tr of (teilrechnungen || [])) {
    if (!trByAuftrag.has(tr.auftrag_id)) trByAuftrag.set(tr.auftrag_id, []);
    trByAuftrag.get(tr.auftrag_id).push(tr);
  }

  const rows = [];
  for (const auftrag of (auftraege || []).filter(isFinalAuftrag)) {
    const trs = trByAuftrag.get(auftrag.id);
    if (trs?.length) {
      const total = trs.length;
      for (const tr of trs) {
        const row = applyTeilrechnungFields({ ...auftrag }, tr);
        row.teilrechnung_id = tr.id;
        row._teilrechnung = { position: tr.position, total, label: `${tr.position} von ${total}` };
        rows.push(row);
      }
    } else {
      rows.push({
        ...auftrag,
        teilrechnung_id: null,
        _teilrechnung: { position: 1, total: 1, label: '1 von 1' }
      });
    }
  }
  return rows;
}

export { TR_FIELDS };
