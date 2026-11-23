// Gemeinsame Bausteine der AblageOrdnerLink*-Tests: Rollen, URLs, Fenster-Attrappe.
import { vi } from 'vitest';

export const SP_ORDNER = 'https://netorg12915005.sharepoint.com/sites/Medienablage/Shared%20Documents/Kunde/K1/Videos';
export const SP_DATEI = 'https://netorg12915005.sharepoint.com/sites/Medienablage/Shared%20Documents/Kunde/K1/Videos/a1.mp4';
export const DROPBOX_ORDNER = 'https://www.dropbox.com/scl/fo/abc/xyz?rlkey=k&dl=0';

export const SP_ASSET = { id: 'a1', ablage: 'sharepoint', etag: 'e1', file_path: '/Kunde/K1/Videos/a1.mp4', file_url: SP_DATEI };

/** Rolle über die globalen Helfer setzen wie in der App: 'team' | 'kunde' | 'gast'. */
export function setRolle(rolle) {
  window.isInternal = () => rolle === 'team';
  window.isKunde = () => rolle !== 'team';
  window.isAdmin = () => false;
  window.isGast = () => rolle === 'gast';
  window.guestShare = undefined;
}

export function rolleZuruecksetzen() {
  delete window.isInternal;
  delete window.isKunde;
  delete window.isAdmin;
  delete window.isGast;
  delete window.guestShare;
}

/** Antwort für das gemockte authorizedFetch. */
export const antwort = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

/** window.open('', '_blank') liefert diese Attrappe. */
export function fensterAttrappe() {
  const win = { opener: 'eltern', location: null, close: vi.fn() };
  const open = vi.spyOn(window, 'open').mockReturnValue(win);
  return { win, open };
}

/** HTML in den Body, Klick auf selector; handler hängt am Body wie die Delegation in der App. */
export function klickeIn(html, selector, handler) {
  document.body.innerHTML = html;
  document.body.addEventListener('click', handler);
  const el = document.querySelector(selector);
  el.click();
  return { el, loesen: () => document.body.removeEventListener('click', handler) };
}
