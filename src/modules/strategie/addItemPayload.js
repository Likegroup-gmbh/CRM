// Payload fuer den Add-Item-Drawer.
// Videoreferenz: URL und Umsetzungsvorgabe Pflicht, Kurzbeschreibung optional.
// Idee: Kurzbeschreibung Pflicht, kein Link, keine Vorgabe.
// Der Parameter heisst weiter `beschreibung`, gespeichert wird er als `kurzbeschreibung`.
// Funnel-Stufe, Persona und Dauer sind optional und kommen aus dem Drawer (Vorbelegung aus dem Briefing).

import { FUNNEL_WERTE } from './strategieFunnelOptions.js';
import { buildStrategieVideolaengeUpdates } from './strategieVideolaenge.js';
import { intervallOderNull } from '../briefing/videolaenge.js';

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

/** Nur bekannte Stufen (upper, mid, lower), sonst null = keine Vorgabe. */
function cleanFunnel(value) {
  return FUNNEL_WERTE.includes(value) ? value : null;
}

/** Persona-ID aus dem Drawer: nur ein gesetzter Wert, sonst null = keine Vorgabe. */
function cleanPersona(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Produkt-ID aus dem Drawer (Briefing-Produkt): nur ein gesetzter Wert, sonst null. */
function cleanProdukt(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Intervall { von, bis } aus der Queue, sonst null = keine Vorgabe. */
function cleanVideolaenge(value) {
  return value ? intervallOderNull(value.von, value.bis) : null;
}

export function resolveVideoideeForm({ art, url, beschreibung, umsetzungsvorgabe, kategorie, funnelStufe, personaId, produktId, videolaenge }) {
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
    return { ok: false, error: 'Bitte eine Kurzbeschreibung angeben' };
  }

  return {
    ok: true,
    art: isReferenz ? 'videoreferenz' : 'idee',
    url: cleanUrl,
    beschreibung: cleanBeschreibung,
    umsetzungsvorgabe: cleanVorgabe,
    kategorie: kategorie || null,
    funnelStufe: cleanFunnel(funnelStufe),
    personaId: cleanPersona(personaId),
    produktId: cleanProdukt(produktId),
    videolaenge: cleanVideolaenge(videolaenge)
  };
}

export function buildAddItemQueueEntry({ url, kategorie, beschreibung, umsetzungsvorgabe, id, platform, funnelStufe, personaId, produktId, produktName, videolaenge }) {
  return {
    id,
    url: url?.trim() || null,
    kategorie: kategorie || null,
    funnelStufe: cleanFunnel(funnelStufe),
    personaId: cleanPersona(personaId),
    produktId: cleanProdukt(produktId),
    produktName: produktName || null,
    videolaenge: cleanVideolaenge(videolaenge),
    beschreibung: beschreibung?.trim() || null,
    umsetzungsvorgabe: umsetzungsvorgabe?.trim() || null,
    platform,
    status: 'pending',
    error: null
  };
}

export function buildStrategieItemInsert({ strategieId, nextItem, sortierung }) {
  // Der Text aus dem Drawer ist die Kurzbeschreibung (Tabellenspalte). Die strukturierte
  // Beschreibung (beschreibung / beschreibung_struktur) fuellt bei Videoreferenzen die KI, sonst das Team.
  const kurzbeschreibung = nextItem.beschreibung || null;
  const hatLink = !!nextItem.url;
  const vorgabe = hatLink ? (String(nextItem.umsetzungsvorgabe || '').trim() || null) : null;
  const dauer = cleanVideolaenge(nextItem.videolaenge);
  return {
    strategie_id: strategieId,
    video_link: nextItem.url,
    plattform: hatLink ? nextItem.platform : null,
    sortierung,
    teilbereich: nextItem.kategorie,
    kurzbeschreibung,
    umsetzungsvorgabe: vorgabe,
    ...(cleanFunnel(nextItem.funnelStufe) ? { funnel_stufe: cleanFunnel(nextItem.funnelStufe) } : {}),
    ...(cleanPersona(nextItem.personaId) ? { persona_id: cleanPersona(nextItem.personaId) } : {}),
    ...(cleanProdukt(nextItem.produktId) ? { produkt_id: cleanProdukt(nextItem.produktId) } : {}),
    ...(dauer ? buildStrategieVideolaengeUpdates(dauer) : {}),
    verarbeitung_status: hatLink ? 'pending' : null
  };
}