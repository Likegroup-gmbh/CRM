// videoBrowserLive.js
// Live-Aktualisierung des Video-Browsers über den gemeinsamen Kampagnen-Channel: neue,
// geänderte oder gelöschte Medien (auch aus SharePoint) und Änderungen an Videos laden den
// Baum neu. vb.reload() rendert im Patch-Modus, eine laufende Wiedergabe bleibt stehen.

import { acquireKampagneChannel } from '../kampagne/kampagneRealtimeChannel.js';

// Ein Upload oder SharePoint-Abgleich meldet Datei fuer Datei; jeder Reload laedt den ganzen
// Baum. Gesammelt wird bis 2,5 s Ruhe, laengstens 10 s nach der ersten Meldung.
export const LIVE_RELOAD_MS = 2500;
export const LIVE_RELOAD_MAX_MS = 10000;

/** Während einer Bearbeitung wird nicht neu gezeichnet; der Reload wartet. */
function bearbeitet(vb) {
  if (vb.renaming || vb.renamingFile || vb.captionEdit || vb.tagField) return true;
  const active = document.activeElement;
  return !!active && !!vb.root?.contains(active)
    && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable);
}

// kooperation_videos ist nicht nach Kampagne gefiltert; der Stand hat Produktion/Linie nicht
function betrifft(vb, table, payload) {
  if (table !== 'kooperation_medien_stand' && table !== 'kooperation_videos') return false;
  const koopId = payload?.new?.kooperation_id || payload?.old?.kooperation_id;
  return !!koopId && (vb.raw?.kooperationen || []).some(k => k.id === koopId);
}

/** @param {object} vb VideoBrowser nach mount (root gebaut) */
export function bindLiveUpdates(vb) {
  const kampagneId = vb.detail?.kampagneId;
  if (!kampagneId || !vb.root) return;

  let timer = null;
  let ersteMeldung = null;
  let laeuft = false;
  let nochmal = false;

  const planen = () => {
    const jetzt = Date.now();
    ersteMeldung ??= jetzt;
    clearTimeout(timer);
    timer = setTimeout(laden, Math.min(LIVE_RELOAD_MS, ersteMeldung + LIVE_RELOAD_MAX_MS - jetzt));
  };

  async function laden() {
    timer = null;
    ersteMeldung = null;
    if (vb.destroyed) return;
    if (bearbeitet(vb)) {
      planen();
      return;
    }
    if (laeuft) {
      nochmal = true;
      return;
    }
    laeuft = true;
    try {
      await vb.reload();
    } catch (err) {
      console.warn('Video-Browser: Live-Aktualisierung fehlgeschlagen:', err);
    } finally {
      laeuft = false;
      if (nochmal && !vb.destroyed) {
        nochmal = false;
        planen();
      }
    }
  }

  const release = acquireKampagneChannel(kampagneId, {
    onChange: (table, payload) => {
      if (betrifft(vb, table, payload)) planen();
    },
    onResync: planen
  });

  vb.cleanups.push(() => {
    clearTimeout(timer);
    timer = null;
    release();
  });
}
