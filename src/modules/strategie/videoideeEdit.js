// videoideeEdit.js
// Speichert Link, Beschreibung, Umsetzungsvorgabe und Kategorie einer Videoidee.
// Kennt den Drawer nicht; der Aufrufer reicht ein flaches Objekt herein.

import { strategieService } from './StrategieService.js';
import { detectPlatform, isTranscribableUrl, resolveVideoideeForm } from './addItemPayload.js';

/**
 * @param {object} detail StrategieDetail (items, strategieId)
 * @param {string} itemId
 * @param {{ art?: string, video_link?: string, beschreibung?: string, umsetzungsvorgabe?: string, teilbereich?: string }} data
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function persistVideoideeEdit(detail, itemId, data) {
  const item = detail.items.find((entry) => String(entry.id) === String(itemId));
  const resolved = resolveVideoideeForm({
    art: data.art || (data.video_link?.trim() ? 'videoreferenz' : 'idee'),
    url: data.video_link,
    beschreibung: data.beschreibung,
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
    beschreibung: resolved.beschreibung,
    umsetzungsvorgabe: resolved.umsetzungsvorgabe,
    plattform: detectPlatform(videoUrl)
  };

  if (resolved.beschreibung !== (item?.beschreibung || null)) {
    updates.beschreibung_quelle = resolved.beschreibung ? 'user' : null;
  }

  if (urlGeaendert) {
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
