// Payload fuer den Add-Item-Drawer: Beschreibung darf neben einer Video-URL
// stehen. Leer = die KI darf spaeter fuellen.

export function buildAddItemQueueEntry({ url, kategorie, beschreibung, id, platform }) {
  return {
    id,
    url: url?.trim() || null,
    kategorie: kategorie || null,
    beschreibung: beschreibung?.trim() || null,
    platform,
    status: 'pending',
    error: null
  };
}

export function buildStrategieItemInsert({ strategieId, nextItem, sortierung }) {
  const beschreibung = nextItem.beschreibung || null;
  return {
    strategie_id: strategieId,
    video_link: nextItem.url,
    plattform: nextItem.url ? nextItem.platform : null,
    sortierung,
    teilbereich: nextItem.kategorie,
    beschreibung,
    beschreibung_quelle: beschreibung ? 'user' : null,
    verarbeitung_status: nextItem.url ? 'pending' : null
  };
}
