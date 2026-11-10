// videoBrowserAblage.js
// SharePoint-Medienablage im Videos-Tab: Leselink auf den Videos-Ordner einer Kooperation
// (Team und Kunden, 30 Tage gültig, ohne Anmeldung) und die "Weiteren Ordner", die das Team
// im Finder neben der festen Struktur anlegt (nur intern). Alle Funktionen bekommen den
// Controller (`vb`).

import { authorizedFetch } from '../../core/auth/getAccessToken.js';
import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml as esc } from '../../core/format.js';
import { formatBytes, formatDatum, plural } from './videoBrowserLogic.js';
import { empty } from './videoBrowserRenderParts.js';

const FREIGABE = '/.netlify/functions/ablage-freigabe';
const LINK = '/.netlify/functions/ablage-link';

async function post(path, body) {
  const res = await authorizedFetch(path, { method: 'POST', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `Fehler (${res.status})`);
    err.code = data?.code || null;
    throw err;
  }
  return data;
}

/** Liegt mindestens eine Datei der Kooperation auf SharePoint? */
export function hatSharepoint(koop) {
  return !!koop?.rows?.some(r => r.folders.some(f => f.items.some(i => i.asset?.ablage === 'sharepoint')));
}

/** Gäste (Share-Links) bekommen keinen eigenen Ordner-Link. */
const istGast = () => !!(window.isGast?.() || window.guestShare);

/* ---- Ordner-Link ---- */

export function ordnerLinkButton(koop) {
  if (istGast() || !hatSharepoint(koop)) return '';
  return `<button type="button" class="mdc-btn mdc-btn--secondary" data-vb-ordnerlink="${esc(koop.id)}">${icon('link')}<span>Ordner-Link (30 Tage)</span></button>`;
}

/**
 * In die Zwischenablage; ohne Clipboard-Recht zeigt ein Prompt den Link zum Kopieren.
 * Safari verlangt den Clipboard-Aufruf noch im Klick: ClipboardItem nimmt dafuer das Promise der URL.
 */
function kopierenImKlick(anfrage) {
  if (typeof window.ClipboardItem !== 'function' || !navigator.clipboard?.write) return null;
  try {
    const blob = anfrage.then((d) => {
      if (!d?.url) throw new Error('Kein Link erhalten');
      return new Blob([d.url], { type: 'text/plain' });
    });
    blob.catch(() => {});
    return navigator.clipboard.write([new window.ClipboardItem({ 'text/plain': blob })]).then(() => true, () => false);
  } catch {
    return null;
  }
}

async function kopieren(url, imKlick) {
  if (imKlick && await imKlick) return true;
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    window.prompt('Link kopieren:', url);
    return false;
  }
}

/** Leselink auf den Videos-Ordner der Kooperation holen (der Server nimmt einen aktiven wieder) und kopieren. */
export async function ordnerLinkErstellen(vb, button) {
  if (!button || button.disabled) return;
  const kooperationId = button.dataset.vbOrdnerlink;
  if (!kooperationId) return;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  const anfrage = post(FREIGABE, { aktion: 'erstellen', kooperation_id: kooperationId });
  const imKlick = kopierenImKlick(anfrage);
  try {
    const { url, laeuft_ab_at: ablauf } = await anfrage;
    if (!url) throw new Error('Kein Link erhalten');
    const kopiert = await kopieren(url, imKlick);
    if (vb.destroyed) return;
    const bis = formatDatum(ablauf);
    vb.toast('success', `${kopiert ? 'Link kopiert' : 'Link erstellt'}${bis ? ` – gültig bis ${bis}` : ''}`);
  } catch (err) {
    console.error('VideoBrowser: Ordner-Link fehlgeschlagen', err);
    if (vb.destroyed) return;
    vb.toast('error', err.code === 'nicht_sharepoint'
      ? 'Für diese Kooperation gibt es noch keinen SharePoint-Ordner.'
      : err.code === 'links_gesperrt'
        ? 'SharePoint erlaubt gerade keine Links ohne Anmeldung.'
        : 'Ordner-Link konnte nicht erstellt werden.');
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

/* ---- Weitere Ordner (nur intern) ---- */

/** Platzhalter im Kooperations-Detail; ladeFreieOrdner füllt ihn nach dem Rendern. */
export function freieOrdnerSlot(ctx, koop) {
  if (!ctx.team || !hatSharepoint(koop)) return '';
  return `<div class="vb-block" data-vb-freie="${esc(koop.id)}" hidden></div>`;
}

function dateiZeile(d) {
  const meta = [formatBytes(d.groesse), formatDatum(d.geaendert_at)].filter(Boolean).join(' · ');
  return `
    <li>
      <button type="button" class="vb-row vb-row--detail" data-vb-freie-datei="${esc(d.item_id)}" title="${esc(d.name)}">
        <span class="vb-row__lead"><span class="vb-icon-slot">${icon('document')}</span></span>
        <span class="vb-row__text">
          <span class="vb-row__title"><span class="vb-row__name">${esc(d.name)}</span></span>
          <span class="vb-row__meta">${esc(meta)}</span>
        </span>
        <span class="vb-row__chevron" aria-hidden="true">${icon('arrow-top-right-on-square')}</span>
      </button>
    </li>`;
}

function freieOrdnerHtml(ordner) {
  const dateien = ordner.reduce((sum, o) => sum + (o.dateien?.length || 0), 0);
  const gruppen = ordner.map(o => `
    <li class="vb-freie__ordner">
      <div class="vb-group__head" title="${esc(o.pfad || o.name)}"><span>${esc(o.name)}</span><span class="vb-group__count">${o.dateien?.length || 0}</span></div>
      ${o.dateien?.length ? `<ul class="vb-list">${o.dateien.map(dateiZeile).join('')}</ul>` : empty('Leer.')}
    </li>`).join('');
  return `
    <details class="vb-freie">
      <summary class="vb-freie__summary">${icon('folder')}<span>Weitere Ordner</span><span class="vb-group__count">${esc(`${plural(ordner.length, 'Ordner', 'Ordner')} · ${plural(dateien, 'Datei', 'Dateien')}`)}</span></summary>
      <ul class="vb-freie__liste">${gruppen}</ul>
    </details>`;
}

/**
 * Weitere Ordner der gerade gezeigten Kooperation laden und einblenden. Je Kooperation einmal pro
 * Controller; ein Fehler bleibt still und wird beim nächsten Öffnen erneut versucht.
 */
export function ladeFreieOrdner(vb) {
  const slot = vb.detailInner?.querySelector('[data-vb-freie]');
  if (!slot) return Promise.resolve();
  const kooperationId = slot.dataset.vbFreie;
  vb._freieOrdner = vb._freieOrdner || new Map();
  let laden = vb._freieOrdner.get(kooperationId);
  if (!laden) {
    laden = post(LINK, { frei: { kooperation_id: kooperationId } })
      .then(data => (Array.isArray(data?.ordner) ? data.ordner : []))
      .catch((err) => {
        console.warn('VideoBrowser: Weitere Ordner nicht geladen', err);
        vb._freieOrdner?.delete(kooperationId);
        return [];
      });
    vb._freieOrdner.set(kooperationId, laden);
  }
  return laden.then((ordner) => {
    if (vb.destroyed || !slot.isConnected || !ordner.length) return;
    slot.innerHTML = freieOrdnerHtml(ordner);
    slot.hidden = false;
  });
}

/** Datei aus einem weiteren Ordner öffnen. Das Fenster geht synchron auf (Popup-Blocker), die URL kommt danach. */
export async function freieDateiOeffnen(vb, button) {
  if (!button || button.getAttribute('aria-busy') === 'true') return;
  const itemId = button.dataset.vbFreieDatei;
  if (!itemId) return;
  const win = window.open('', '_blank');
  button.setAttribute('aria-busy', 'true');
  try {
    const { url } = await post(LINK, { frei_datei: { item_id: itemId } });
    if (!url) throw new Error('Keine URL erhalten');
    if (win) {
      win.opener = null;
      win.location = url;
    } else {
      window.open(url, '_blank', 'noopener');
    }
  } catch (err) {
    win?.close();
    console.error('VideoBrowser: Datei aus weiterem Ordner nicht geöffnet', err);
    if (!vb.destroyed) vb.toast('error', 'Datei konnte nicht geöffnet werden.');
  } finally {
    button.removeAttribute('aria-busy');
  }
}
