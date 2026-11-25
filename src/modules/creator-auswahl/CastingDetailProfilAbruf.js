// CastingDetailProfilAbruf.js
// Profilabruf aus Link-Zelle, Hover-Toolbar, Drawer und Schnelleingabe: Instagram ueber Meta
// (fetchInstagramStats, mit Budget), TikTok ueber Apify (src/core/tiktok/tiktokProfil.js).
// Das Geruest drumherum ist fuer beide gleich: Link vorher speichern, Ladezustand, Leiste
// festhalten, Zeile neu zeichnen, Erfolg kurz gruen, Fehler an die Zeile.
// (Prototype-Mixin von CreatorAuswahlDetail)

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { refreshCastingDrawer } from './castingDetailDrawer.js';
import { hoverToolbar } from '../../core/hoverToolbar/HoverToolbar.js';
import { setChipCellLoading } from '../../core/components/chipCell.js';
import { tiktokProfilAbrufen } from '../../core/tiktok/tiktokProfil.js';
import { enqueueIgFetch } from './igFetchBudget.js';
import { findProfilZelle } from './sourcingProfilZelle.js';
import { linkZiel, profilPlattform } from './sourcingProfilPlattformen.js';
import { PROFIL_ABRUF_AKTION } from './sourcingProfilToolbar.js';

const FLASH_MS = 2000;

const standText = (wert) => (wert ? new Date(wert).toLocaleDateString('de-DE') : null);

function poolToast(name, poolFetchedAt) {
  const stand = standText(poolFetchedAt);
  window.toastSystem?.show(
    `Aus dem Creator-Pool übernommen${stand ? ` (Stand ${stand})` : ''} – nochmal klicken für frische ${name}-Daten`,
    'info'
  );
}

/** Der 30er-Schnitt ist der belastbarste Wert; reicht es dafuer nicht, greift der 12er. */
function viewsToast(name, views, zuWenige) {
  window.toastSystem?.show(
    views != null
      ? `${name}-Daten aktualisiert (${Number(views).toLocaleString('de-DE')} Views im Schnitt)`
      : `${name}-Daten aktualisiert – ${zuWenige}`,
    views != null ? 'success' : 'info'
  );
}

/**
 * Gemeinsames Geruest. Die itemId kommt als Argument, weil der Button der Leiste an
 * document.body haengt - von dort findet closest() keine Zeile mehr.
 *
 * Erster Klick fragt den Creator-Pool. Steht die Zeile danach im Refresh-Zustand, erzwingt der
 * naechste Klick einen echten Abruf (force).
 *
 * @param {(item: object, force: boolean) => Promise<object|null>} abrufen liefert die neue Zeile,
 *   null heisst: Seite inzwischen verlassen
 * @returns {Promise<object|null>} Ergebnis von abrufen
 */
async function profilAbruf(detail, plattform, itemId, button, abrufen) {
  if (button.disabled) return null;
  const p = profilPlattform(plattform);
  const item = detail.items.find(i => i.id === itemId);
  if (!item) return null;

  // Erst das Feld neben dem Button (Zelle, Drawer), sonst die Tabellenzeile (Button der Leiste)
  const feldSel = `input[data-field="${p.linkFeld}"]`;
  const input = button.parentElement?.closest('.chip-cell, .casting-detail-link')?.querySelector(feldSel)
    || detail._q(`${feldSel}[data-item-id="${itemId}"]`);
  const link = (input ? input.value : item[p.linkFeld] || '').trim();
  // Die Leiste oeffnet ohne Link gar nicht; kommt hier keiner an, ist die Zeile inzwischen weg
  if (!link) return null;

  // Noch nicht gespeicherte Eingabe zuerst persistieren, sonst liest die Function den alten Wert.
  // Ein Link der anderen Plattform zieht dabei um und wird dort abgerufen.
  const ziel = linkZiel(p.linkFeld, link);
  if (link !== item[p.linkFeld] || ziel.feld !== p.linkFeld) {
    let feld;
    try {
      feld = await detail._speichereLink(itemId, p.linkFeld, link, input);
    } catch (error) {
      console.error(`Fehler beim Speichern des ${p.name}-Links:`, error);
      window.toastSystem?.show(`${p.name}-Link konnte nicht gespeichert werden`, 'error');
      return null;
    }
    if (feld !== p.linkFeld) return feld ? detail._profilAbrufStarten(itemId, ziel.plattform) : null;
  }

  const force = !!item[p.standFeld] && !item[p.fehlerFeld];
  const zelle = () => findProfilZelle(itemId, plattform);
  const ladenEnde = () => {
    button.disabled = false;
    button.classList.remove('is-loading');
    setChipCellLoading(zelle(), false);
    hoverToolbar.unpin();
  };

  button.disabled = true;
  button.classList.remove('is-error', 'is-success', 'is-refresh');
  button.classList.add('is-loading');
  // Der Abruf dauert; die Leiste muss offen bleiben, auch wenn der Zeiger sie verlaesst
  hoverToolbar.pin();
  setChipCellLoading(zelle(), true);

  try {
    const ergebnis = await abrufen(item, force);
    if (!ergebnis || detail._tornDown) {
      ladenEnde();
      return null;
    }
    Object.assign(item, ergebnis.item);
    detail.refreshItemRow(itemId);
    refreshCastingDrawer(detail, itemId);
    // Die Zeile ist per outerHTML ersetzt, rebind() verankert die Leiste an der neuen Zelle
    hoverToolbar.rebind();
    detail._flashProfilAbruf(itemId, plattform);
    return ergebnis;
  } catch (error) {
    console.error(`Fehler beim ${p.name}-Abruf:`, error);
    // Bei toter Session hat authorizedFetch schon Hinweis und Logout uebernommen
    if (error.sessionDead) {
      ladenEnde();
      return null;
    }
    item[p.fehlerFeld] = error.message;
    detail.refreshItemRow(itemId);
    // Die Leiste zeigt danach "Erneut versuchen" plus den Fehlertext als Zeile
    hoverToolbar.rebind();
    hoverToolbar.unpin();
    window.toastSystem?.show(error.hint || error.message, error.retryable ? 'info' : 'error');
    return null;
  }
}

function logIgDebug(debug, source) {
  console.group(`[IG-CPM] @${debug.username || 'unknown'} (${debug.source || source})`);
  console.log('Regeln', debug.rules);
  if (debug.skipped?.length) console.table(debug.skipped);
  else console.log('Skipped (zu frisch / manuell ausgeschlossen): keine');
  for (const [fenster, liste] of [['12er', debug.included_12], ['30er', debug.included_30]]) {
    if (liste?.length) {
      console.log(`Included ${fenster} (${liste.length} Reels im Schnitt)`);
      console.table(liste);
    } else console.log(`Included ${fenster}: keine`);
  }
  if (debug.outliers?.window_12?.length) console.table(debug.outliers.window_12);
  if (debug.outliers?.window_30?.length) console.table(debug.outliers.window_30);
  console.log('Fenster / Preis', debug.summary);
  if (debug.pool_fetched_at) console.log('Pool-Stand', debug.pool_fetched_at);
  if (debug.image_error) console.warn('Profilbild', debug.image_error);
  console.groupEnd();
}

function logTiktokStats(username, source, stats = {}) {
  console.groupCollapsed(`[TT-Preis] @${username || 'unknown'} (${source})`);
  if (stats.videos?.length) console.table(stats.videos);
  if (stats.skipped_videos?.length) console.table(stats.skipped_videos);
  console.log('Fenster', {
    used_12: stats.used_12?.length ?? 0,
    used_30: stats.used_30?.length ?? 0,
    zu_frisch: stats.skipped_too_recent,
    werbung: stats.skipped_ads,
    angepinnt: stats.skipped_pinned,
    engagement: stats.engagement_rate,
  });
  console.groupEnd();
}

/** Instagram: Profil, Follower und CPM-Werte ueber Meta, gedrosselt durch das Abruf-Budget. */
export async function handleInstagramFetch(itemId, button) {
  const ergebnis = await profilAbruf(this, 'instagram', itemId, button, (item, force) => (
    enqueueIgFetch((usage) => creatorAuswahlService.fetchInstagramStats(item.id, { force, usage }))
  ));
  if (!ergebnis) return;
  const { item: updated, source, poolFetchedAt, debug, rateLimited } = ergebnis;
  if (debug) logIgDebug(debug, source);

  if (rateLimited) {
    window.toastSystem?.show('Meta-Rate-Limit erreicht – vorhandene Zahlen aus dem Pool übernommen.', 'info');
  } else if (source === 'pool') {
    poolToast('Instagram', poolFetchedAt);
  } else {
    viewsToast('Instagram', updated.ig_views_30 ?? updated.ig_views_12, 'zu wenige Reels für eine CPM-Berechnung');
  }
  this.warnBeiDoppeltemCreator(this.items.find(i => i.id === itemId) || updated);
}

/**
 * TikTok: Follower, Engagement und Views-Schnitte ueber Apify. Ein frischer Lauf dauert bis zu
 * einer Minute; die Function speichert selbst, auch wenn die Seite inzwischen zu ist.
 */
export async function handleTiktokFetch(itemId, button) {
  const ergebnis = await profilAbruf(this, 'tiktok', itemId, button, async (item, force) => {
    const r = await tiktokProfilAbrufen({
      itemId: item.id,
      force,
      beimWarten: () => window.toastSystem?.show('TikTok-Abruf läuft, das dauert bis zu einer Minute', 'info'),
    });
    return r && { ...r, item: r.item || {} };
  });
  if (!ergebnis) return;
  const { item: updated, source, poolFetchedAt, username } = ergebnis;
  logTiktokStats(username, source, updated.tt_stats);

  if (source === 'pool') poolToast('TikTok', poolFetchedAt);
  else viewsToast('TikTok', updated.tt_views_30 ?? updated.tt_views_12, 'zu wenige Videos für eine Preisberechnung');
}

/**
 * Abruf ohne geklickten Button (Schnelleingabe, umgezogener Link): ueber den Button der Zeile,
 * damit Ladezustand und Flash dort erscheinen. Ist die Link-Spalte ausgeblendet, fehlt er;
 * abgerufen wird trotzdem.
 */
export function _profilAbrufStarten(itemId, plattform) {
  const button = this._q(`.profil-abruf-btn[data-profil-abruf="${plattform}"][data-item-id="${itemId}"]`)
    || document.createElement('button');
  return this[profilPlattform(plattform).handler](itemId, button);
}

/**
 * Kurz gruen quittieren. Der Button aus dem Klick ist nach dem Zeilen-Neuaufbau ein toter
 * Knoten - der Flash muss den treffen, den rebind() gerade neu gerendert hat. Das unpin()
 * haengt hinten dran, damit die Leiste den Flash ueberdauert.
 */
export function _flashProfilAbruf(itemId, plattform) {
  const button = this._q(`.profil-abruf-btn[data-profil-abruf="${plattform}"][data-item-id="${itemId}"]`)
    || document.querySelector(`.hover-toolbar [data-hover-action="${PROFIL_ABRUF_AKTION}"]`);
  if (!button) {
    hoverToolbar.unpin();
    return;
  }

  button.classList.add('is-success');
  setTimeout(() => {
    button.classList.remove('is-success');
    hoverToolbar.unpin();
  }, FLASH_MS);
}

export const castingDetailProfilAbrufMethods = {
  handleInstagramFetch,
  handleTiktokFetch,
  _profilAbrufStarten,
  _flashProfilAbruf
};
