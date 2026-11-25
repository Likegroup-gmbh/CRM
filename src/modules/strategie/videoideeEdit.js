// videoideeEdit.js
// Speichert Link, Umsetzungsvorgabe und Kategorie einer Videoidee, auf Wunsch auch die
// Kurzbeschreibung. Die strukturierte Beschreibung (Drawer-Tabelle) bleibt unberuehrt.
// Kennt den Drawer nicht; der Aufrufer reicht ein flaches Objekt herein.

import { strategieService } from './StrategieService.js';
import { detectPlatform, isTranscribableUrl, resolveVideoideeForm } from './addItemPayload.js';

/**
 * @param {object} detail StrategieDetail (items, strategieId)
 * @param {string} itemId
 * @param {{ art?: string, video_link?: string, kurzbeschreibung?: string, umsetzungsvorgabe?: string, teilbereich?: string }} data
 *   kurzbeschreibung: nur gesetzt, wenn sie mitgespeichert werden soll. Fuer die Idee-Pflicht gilt
 *   sonst die vorhandene Kurzbeschreibung oder Beschreibung des Items.
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function persistVideoideeEdit(detail, itemId, data) {
  const item = detail.items.find((entry) => String(entry.id) === String(itemId));
  const schreibtKurz = data.kurzbeschreibung !== undefined;
  const resolved = resolveVideoideeForm({
    art: data.art || (data.video_link?.trim() ? 'videoreferenz' : 'idee'),
    url: data.video_link,
    beschreibung: schreibtKurz ? data.kurzbeschreibung : (item?.kurzbeschreibung || item?.beschreibung),
    umsetzungsvorgabe: data.umsetzungsvorgabe,
    kategorie: data.teilbereich || null
  });
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const videoUrl = resolved.url;
  const urlGeaendert = (videoUrl || null) !== (item?.video_link || null);

  if (videoUrl && urlGeaendert && !isTranscribableUrl(videoUrl)) {
    return { ok: false, error: 'Nur TikTok- und Instagram-Links sind erlaubt' };
  }

  const updates = {
    video_link: videoUrl,
    teilbereich: resolved.kategorie,
    umsetzungsvorgabe: resolved.umsetzungsvorgabe,
    plattform: detectPlatform(videoUrl)
  };
  if (schreibtKurz) updates.kurzbeschreibung = resolved.beschreibung;

  if (urlGeaendert) {
    if (item?.beschreibung_struktur) updates.beschreibung_struktur = null;
    if (item?.hook_gesperrt) updates.hook_gesperrt = false;
    updates.transkript = null;
    updates.transkript_quelle = null;
    updates.caption = null;
    updates.verarbeitung_fehler = null;
    updates.verarbeitung_step = null;
    updates.verarbeitung_status = videoUrl ? 'pending' : null;
    updates.screenshot_url = null;
    await strategieService.deleteScreenshot(item?.screenshot_url);
    if (item?.video_link && videoUrl) {
      updates.kundenadaption = null;
      updates.kundenadaption_quelle = null;
    }
  }

  await strategieService.updateStrategieItem(itemId, updates);
  if (item) Object.assign(item, updates);

  if (urlGeaendert && videoUrl) {
    try {
      await strategieService.enqueueItemProcessing(detail.strategieId, itemId);
    } catch (error) {
      console.warn('Verarbeitung konnte nicht gestartet werden:', error);
    }
  }

  return { ok: true };
}
