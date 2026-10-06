// Payload fuer den Add-Item-Drawer.
// Videoreferenz: URL und Umsetzungsvorgabe Pflicht, Beschreibung optional.
// Idee: Beschreibung Pflicht, kein Link, keine Vorgabe.

/**
 * Nur TikTok und Instagram: aus beiden laesst sich Tonspur bzw. Untertitel
 * ziehen, YouTube nicht.
 */
export function isTranscribableUrl(url) {
  const u = (url || '').toLowerCase();
  return u.includes('tiktok.com') || u.includes('instagram.com');
}

/** Plattform aus der URL. Ohne URL null. YouTube bleibt fuer Altdaten erhalten. */
export function detectPlatform(url) {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('instagram.com')) return 'instagram';
  return 'other';
}

export function resolveVideoideeForm({ art, url, beschreibung, umsetzungsvorgabe, kategorie }) {
  const isReferenz = art !== 'idee';
  const cleanUrl = isReferenz ? (url?.trim() || null) : null;
  const cleanBeschreibung = beschreibung?.trim() || null;
  const cleanVorgabe = isReferenz ? (umsetzungsvorgabe?.trim() || null) : null;

  if (isReferenz && !cleanUrl) {
    return { ok: false, error: 'Video-URL fehlt' };
  }
  if (isReferenz && !cleanVorgabe) {
    return { ok: false, error: 'Was sollen wir von diesem Video umsetzen?' };
  }
  if (!isReferenz && !cleanBeschreibung) {
    return { ok: false, error: 'Bitte eine Beschreibung angeben' };
  }

  return {
    ok: true,
    art: isReferenz ? 'videoreferenz' : 'idee',
    url: cleanUrl,
    beschreibung: cleanBeschreibung,
    umsetzungsvorgabe: cleanVorgabe,
    kategorie: kategorie || null
  };
}

export function buildAddItemQueueEntry({ url, kategorie, beschreibung, umsetzungsvorgabe, id, platform }) {
  return {
    id,
    url: url?.trim() || null,
    kategorie: kategorie || null,
    beschreibung: beschreibung?.trim() || null,
    umsetzungsvorgabe: umsetzungsvorgabe?.trim() || null,
    platform,
    status: 'pending',
    error: null
  };
}

export function buildStrategieItemInsert({ strategieId, nextItem, sortierung }) {
  const beschreibung = nextItem.beschreibung || null;
  const hatLink = !!nextItem.url;
  const vorgabe = hatLink ? (String(nextItem.umsetzungsvorgabe || '').trim() || null) : null;
  return {
    strategie_id: strategieId,
    video_link: nextItem.url,
    plattform: hatLink ? nextItem.platform : null,
    sortierung,
    teilbereich: nextItem.kategorie,
    beschreibung,
    beschreibung_quelle: beschreibung ? 'user' : null,
    umsetzungsvorgabe: vorgabe,
    verarbeitung_status: hatLink ? 'pending' : null
  };
}
