// videoBrowserAblage.js
// SharePoint-Medienablage im Videos-Tab: Leselinks ohne Anmeldung, 365 Tage gültig – auf den
// Videos-Ordner einer Kooperation bzw. aller Kooperationen eines Creators (Team und Kunden) und
// auf den ganzen Produktions-Ordner mit Rohmaterial (nur Team, ADR 0071) – sowie die "Weiteren
// Ordner", die das Team im Finder neben der festen Struktur anlegt (nur intern). Alle Funktionen
// bekommen den Controller (`vb`).

import { authorizedFetch } from '../../core/auth/getAccessToken.js';
import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml as esc } from '../../core/format.js';
import { formatBytes, formatDatum, plural } from './videoBrowserLogic.js';
import { empty, iconButton } from './videoBrowserRenderParts.js';

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

const hatDateien = (koop) => !!koop?.rows?.some(r => r.folders.some(f => f.items.length));

/**
 * Hat die Kooperation einen SharePoint-Ordner? Sicher, sobald eine Datei dort liegt. Ohne Dateien legt
 * der Abgleich das Gerüst an; fehlt es noch, antwortet ablage-freigabe 409.
 */
export const liegtInSharepoint = (koop) => hatSharepoint(koop) || !hatDateien(koop);

/** Gäste (Share-Links) bekommen keinen eigenen Ordner-Link. */
const istGast = () => !!(window.isGast?.() || window.guestShare);

/* ---- Ordner-Link ---- */

export function ordnerLinkButton(koop) {
  if (istGast() || !liegtInSharepoint(koop)) return '';
  return `<button type="button" class="mdc-btn mdc-btn--secondary" data-vb-ordnerlink="${esc(koop.id)}">${icon('link')}<span>Ordner-Link (1 Jahr)</span></button>`;
}

/**
 * Ordner-Link im Kopf eines Creators im Showcase. Einen Creator-Ordner gibt es in SharePoint nicht
 * (Kampagne/Produktion/Kooperation): bei mehreren Kooperationen kopiert der Knopf je eine Zeile.
 */
export function creatorLinkButton(koops, name) {
  const ziele = istGast() ? [] : koops.filter(liegtInSharepoint);
  if (!ziele.length) return '';
  const n = ziele.length;
  const titel = n > 1
    ? `${n} Ordner-Links kopieren (1 Jahr): je Kooperation von ${name} der Videos-Ordner, ohne Rohmaterial`
    : `Ordner-Link kopieren (1 Jahr): Videos-Ordner von ${name}, ohne Rohmaterial`;
  return `<button type="button" class="vb-sc-group__link" data-vb-creatorlink="${esc(ziele.map(k => k.id).join(' '))}" title="${esc(titel)}" aria-label="${esc(titel)}">${icon('link')}<span>${n > 1 ? `${n} Ordner-Links` : 'Ordner-Link'}</span></button>`;
}

const PRODUKTION_TITEL = 'Produktions-Link (1 Jahr): ganzer Ordner mit allen Creatorn, Feedbackschleifen und Rohmaterial';

/**
 * Link auf den ganzen Produktions-Ordner: nur Team, sobald eine Kooperation der Produktion in SharePoint liegt.
 * Als Icon in der Spalte "Kooperationen", mit `text` als Knopf in der Showcase-Leiste.
 */
export function produktionLinkButton(ctx, { text = false } = {}) {
  if (!ctx.team || istGast() || !ctx.produktionId || !ctx.tree?.kooperationen.some(liegtInSharepoint)) return '';
  const attr = `data-vb-produktionlink="${esc(ctx.produktionId)}"`;
  if (!text) return iconButton('link', PRODUKTION_TITEL, attr);
  return `<button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm vb-sc-bar__link" ${attr} title="${esc(PRODUKTION_TITEL)}">${icon('link')}<span>Produktions-Link</span></button>`;
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
    // Das Prompt-Feld ist einzeilig
    window.prompt('Link kopieren:', url.replace(/\n/g, '  '));
    return false;
  }
}

/** Der Server nimmt einen aktiven Link wieder, statt einen neuen anzulegen. */
const freigabe = (bezug) => post(FREIGABE, { aktion: 'erstellen', ...bezug });

const linkTitel = (koop) => [koop.name, koop.linieName || koop.kooperationName].filter(Boolean).join(' – ');

/**
 * Je Kooperation ein Link. Bei mehreren steht vor jedem Creator und Linie, die Gültigkeit ist die
 * kürzeste. Scheitern einzelne, kommen die übrigen trotzdem (`anzahl` von `gesamt`).
 */
async function creatorLinks(koops) {
  const res = await Promise.allSettled(koops.map(k => freigabe({ kooperation_id: k.id })));
  const links = res.flatMap((r, i) => (r.status === 'fulfilled' && r.value?.url ? [{ koop: koops[i], ...r.value }] : []));
  if (!links.length) throw res.find(r => r.status === 'rejected')?.reason || new Error('Kein Link erhalten');
  return {
    url: koops.length === 1 ? links[0].url : links.map(l => `${linkTitel(l.koop)}: ${l.url}`).join('\n'),
    laeuft_ab_at: links.map(l => l.laeuft_ab_at).filter(Boolean).sort()[0] || null,
    anzahl: links.length,
    gesamt: koops.length
  };
}

/**
 * Leselink(s) holen und kopieren. `holen` läuft noch im Klick (Safari-Clipboard) und liefert
 * `{ url, laeuft_ab_at, anzahl?, gesamt? }`.
 */
async function linkErstellen(vb, button, holen, texte) {
  if (!button || button.disabled) return;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  const anfrage = holen();
  const imKlick = kopierenImKlick(anfrage);
  try {
    const { url, laeuft_ab_at: ablauf, anzahl = 1, gesamt = anzahl } = await anfrage;
    if (!url) throw new Error('Kein Link erhalten');
    const kopiert = await kopieren(url, imKlick);
    if (vb.destroyed) return;
    const bis = formatDatum(ablauf);
    const was = gesamt > 1 ? `${anzahl < gesamt ? `${anzahl} von ${gesamt}` : anzahl} Links` : 'Link';
    vb.toast(anzahl < gesamt ? 'warning' : 'success', `${was} ${kopiert ? 'kopiert' : 'erstellt'}${bis ? ` – gültig bis ${bis}` : ''}`);
  } catch (err) {
    console.error(`VideoBrowser: ${texte.name} fehlgeschlagen`, err);
    if (vb.destroyed) return;
    vb.toast('error', err.code === 'nicht_sharepoint'
      ? texte.ohneOrdner
      : err.code === 'links_gesperrt'
        ? 'SharePoint erlaubt gerade keine Links ohne Anmeldung.'
        : `${texte.name} konnte nicht erstellt werden.`);
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

/** Leselink auf den Videos-Ordner der Kooperation. */
export function ordnerLinkErstellen(vb, button) {
  const kooperationId = button?.dataset.vbOrdnerlink;
  if (!kooperationId) return Promise.resolve();
  return linkErstellen(vb, button, () => freigabe({ kooperation_id: kooperationId }), {
    name: 'Ordner-Link',
    ohneOrdner: 'Für diese Kooperation gibt es noch keinen SharePoint-Ordner.'
  });
}

/** Leselinks auf die Videos-Ordner aller Kooperationen eines Creators (Kopf im Showcase). */
export function creatorLinkErstellen(vb, button) {
  const ids = new Set((button?.dataset.vbCreatorlink || '').split(' ').filter(Boolean));
  const koops = (vb.tree?.kooperationen || []).filter(k => ids.has(k.id));
  if (!koops.length) return Promise.resolve();
  return linkErstellen(vb, button, () => creatorLinks(koops), {
    name: 'Ordner-Link',
    ohneOrdner: 'Für diesen Creator gibt es noch keinen SharePoint-Ordner.'
  });
}

/** Leselink auf den Produktions-Ordner (alle Kooperationen der Produktion). */
export function produktionLinkErstellen(vb, button) {
  const produktionId = button?.dataset.vbProduktionlink;
  if (!produktionId) return Promise.resolve();
  return linkErstellen(vb, button, () => freigabe({ produktion_id: produktionId }), {
    name: 'Produktions-Link',
    ohneOrdner: 'Für diese Produktion gibt es noch keinen SharePoint-Ordner.'
  });
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
