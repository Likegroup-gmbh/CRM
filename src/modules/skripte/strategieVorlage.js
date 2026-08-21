// strategieVorlage.js
// Pure Mapping: Strategie-Item -> Generator-Felder / Referenz-Payload.
// Transkript bleibt in der Videovorlage (HOW), Beschreibung fuellt die Idee (WHAT).

export function applyStrategieItem(item, { idee = '', previousIdeeFromItem = '' } = {}) {
  const current = idee || '';
  const prev = previousIdeeFromItem || '';
  const sameAsPrevious = current.trim() === prev.trim();
  const shouldPrefill = !current.trim() || sameAsPrevious;

  if (!item) {
    return {
      idee: shouldPrefill ? '' : current,
      ideeFromItem: '',
      transkript: '',
      beschreibung: '',
      caption: '',
      url: '',
      platform: null,
      itemId: null,
      hasVorlage: false
    };
  }

  const beschreibung = (item.beschreibung || '').trim();
  const transkript = (item.transkript || '').trim();

  return {
    idee: shouldPrefill ? beschreibung : current,
    ideeFromItem: shouldPrefill ? beschreibung : prev,
    transkript,
    beschreibung,
    caption: (item.caption || '').trim(),
    url: item.video_link || '',
    platform: item.plattform || null,
    itemId: item.id,
    hasVorlage: Boolean(transkript)
  };
}

/**
 * Referenz-Payload aus einem Strategie-Item. Ohne Item oder ohne Transkript
 * kommt null (Vorlage ist optional; reine Ideen fuellen nur die Video-Idee).
 */
export function buildReferenzVideoPayload({
  strategieItemId,
  url,
  transkript,
  beschreibung,
  caption,
  platform
} = {}) {
  const itemId = (strategieItemId || '').trim();
  const cleanTranskript = (transkript || '').trim();
  if (!itemId || !cleanTranskript) return null;

  return {
    quelle: 'strategie_item',
    strategie_item_id: itemId,
    url: (url || '').trim() || null,
    transkript_verwendet: cleanTranskript,
    beschreibung: (beschreibung || '').trim() || null,
    caption: (caption || '').trim() || null,
    platform: platform || null
  };
}
