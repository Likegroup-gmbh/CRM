// Aufnehmen und Verwerfen im Reiter Bewerbung.

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { loadBewerbungen } from './bewerbungTab.js';

export async function aufnehmenBewerbung(detail, id) {
  const row = (detail.bewerbungen || []).find((entry) => entry.id === id);
  if (!row) return;
  try {
    await creatorAuswahlService.createItem({
      creator_auswahl_id: detail.listeId,
      name: `${row.vorname || ''} ${row.nachname || ''}`.trim(),
      link_instagram: row.link_instagram,
      link_tiktok: row.link_tiktok,
      management_id: row.management_id,
      ansprechpartner_id: row.ansprechpartner_id,
      sortierung: detail.items.length,
    });
    const { error } = await window.supabase.from('bewerbung').delete().eq('id', id);
    if (error) throw error;
    detail.items = await creatorAuswahlService.getItems(detail.listeId);
    detail.bewerbungen = await loadBewerbungen(detail.listeId);
    detail.activeTab = 'offen';
    await detail.render();
    detail.bindEvents();
    window.toastSystem?.show('In Offen aufgenommen', 'success');
  } catch (error) {
    window.toastSystem?.show(error.message || 'Aufnehmen fehlgeschlagen', 'error');
  }
}

export async function verwerfenBewerbung(detail, id) {
  try {
    const { error } = await window.supabase.from('bewerbung').delete().eq('id', id);
    if (error) throw error;
    detail.bewerbungen = await loadBewerbungen(detail.listeId);
    detail.rerenderTable();
  } catch (error) {
    window.toastSystem?.show(error.message || 'Verwerfen fehlgeschlagen', 'error');
  }
}
