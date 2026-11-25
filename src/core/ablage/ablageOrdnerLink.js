// ablageOrdnerLink.js
// Links auf die Medienablage. Eine SharePoint-webUrl öffnet nur ein Konto im Tenant, also das
// Team (Kunden bekommen nach rechte.js nie direkte Rechte, sonst AADSTS50020). Alle anderen
// bekommen einen Knopf: Ordner über ablage-freigabe (Leselink ohne Anmeldung auf den
// Videos-Ordner der Kooperation bzw. den Ordner einer Upload-Spalte), Dateien über ablage-link.
// Gäste lehnt ablage-freigabe ab, für sie gibt es keinen Ordner-Knopf.

import { ablagePost } from './ablageApi.js';
import { ablageLink, istSharePoint } from './ablageLink.js';
import { istSharePointUrl } from './dokumentAblage.js';
import { escapeHtml } from '../format.js';

const ORDNER = 'ablage-ordner-link';
const DATEI = 'ablage-datei-link';

const istTeam = () => !!window.isInternal?.();
const istGast = () => !!(window.isGast?.() || window.guestShare);

/** True, wenn der aktuelle Nutzer die URL nicht direkt öffnen kann. */
export function brauchtLeselink(url) {
  return istSharePointUrl(url) && !istTeam();
}

function attribute(klasse, titel) {
  return `${klasse ? ` class="${escapeHtml(klasse)}"` : ''}${titel ? ` title="${escapeHtml(titel)}"` : ''}`;
}

const direktLink = (url, attr, inhalt) =>
  `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"${attr}>${inhalt}</a>`;

/**
 * Ordner-Link: `<a href>` für alte Links und fürs Team, für Kunden ein Knopf auf den Leselink,
 * für Gäste nichts. Mit `spalte` gilt der Leselink dem Ordner der Upload-Spalte statt dem
 * Videos-Ordner der Kooperation.
 * @param {{ url: string|null, kooperationId?: string|null, spalte?: { customColumnId: string, entityId: string },
 *   inhalt: string, klasse?: string, titel?: string }} o  inhalt ist fertiges HTML (Icon oder escapter Text)
 */
export function ordnerLinkHtml({ url, kooperationId = null, spalte = null, inhalt, klasse = '', titel = '' }) {
  if (!url) return '';
  const attr = attribute(klasse, titel);
  if (!brauchtLeselink(url)) return direktLink(url, attr, inhalt);
  if (istGast()) return '';
  if (spalte?.customColumnId && spalte?.entityId) {
    return `<button type="button"${attr} data-action="${ORDNER}" data-custom-column-id="${escapeHtml(spalte.customColumnId)}" data-entity-id="${escapeHtml(spalte.entityId)}">${inhalt}</button>`;
  }
  if (!kooperationId) return '';
  return `<button type="button"${attr} data-action="${ORDNER}" data-kooperation-id="${escapeHtml(kooperationId)}">${inhalt}</button>`;
}

/**
 * Datei-Link: `<a href=file_url>` für Altbestand und fürs Team, sonst ein Knopf auf den
 * Download-Link aus ablage-link.
 * @param {{ asset: object, typ: 'video'|'story'|'still'|'spalte', inhalt: string, klasse?: string, titel?: string }} o
 */
export function dateiLinkHtml({ asset, typ, inhalt, klasse = '', titel = '' }) {
  const attr = attribute(klasse, titel);
  if (istSharePoint(asset) && asset.id && !istTeam()) {
    return `<button type="button"${attr} data-action="${DATEI}" data-typ="${escapeHtml(typ)}" data-id="${escapeHtml(asset.id)}" data-etag="${escapeHtml(asset.etag || '')}">${inhalt}</button>`;
  }
  return asset?.file_url ? direktLink(asset.file_url, attr, inhalt) : '';
}

/**
 * Fenster synchron im Klick öffnen (Popup-Blocker), die URL kommt danach.
 * @param {() => Promise<string|null>} holeUrl
 */
export async function imNeuenFenster(holeUrl) {
  const win = window.open('', '_blank');
  try {
    const url = await holeUrl();
    if (!url) throw new Error('Kein Link erhalten');
    if (win) {
      win.opener = null;
      win.location = url;
    } else {
      window.open(url, '_blank', 'noopener');
    }
  } catch (err) {
    win?.close();
    console.error('❌ Link konnte nicht geöffnet werden', err);
    window.toastSystem?.show?.(err?.code === 'links_gesperrt'
      ? 'SharePoint erlaubt gerade keine Links ohne Anmeldung.'
      : 'Link konnte nicht geöffnet werden.', 'error');
  }
}

/** Leselink auf den Videos-Ordner der Kooperation (der Server nimmt einen aktiven wieder). */
export async function ordnerLeselink(kooperationId) {
  const data = await ablagePost('ablage-freigabe', { aktion: 'erstellen', kooperation_id: kooperationId, typ: 'videos' });
  return data.url || null;
}

/** Leselink auf den Ordner einer Upload-Spalte (Zelle: Kooperation oder Video). */
export async function spalteLeselink(customColumnId, entityId) {
  const data = await ablagePost('ablage-freigabe', { aktion: 'erstellen', custom_column_id: customColumnId, entity_id: entityId });
  return data.url || null;
}

function urlFuer(button) {
  const { action, kooperationId, customColumnId, entityId, typ, id, etag } = button.dataset;
  if (action === ORDNER && customColumnId && entityId) return () => spalteLeselink(customColumnId, entityId);
  if (action === ORDNER) return kooperationId ? () => ordnerLeselink(kooperationId) : null;
  if (!typ || !id) return null;
  return () => ablageLink({ typ, id, etag: etag || null }).then(link => link?.url || null);
}

/** Klick-Delegation: true, wenn der Klick einem Ablage-Knopf galt. */
export function ablageLinkKlick(e) {
  const button = e?.target?.closest?.(`[data-action="${ORDNER}"], [data-action="${DATEI}"]`);
  if (!button) return false;
  e.preventDefault();
  e.stopPropagation();
  const holeUrl = urlFuer(button);
  if (!holeUrl || button.getAttribute('aria-busy') === 'true') return true;
  button.setAttribute('aria-busy', 'true');
  void imNeuenFenster(holeUrl).finally(() => button.removeAttribute('aria-busy'));
  return true;
}
