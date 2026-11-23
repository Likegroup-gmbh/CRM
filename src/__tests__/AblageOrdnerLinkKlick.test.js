import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/auth/getAccessToken.js', () => ({ authorizedFetch: vi.fn() }));

import { authorizedFetch } from '../core/auth/getAccessToken.js';
import { _clearAblageLinkCache } from '../core/ablage/ablageLink.js';
import { ablageLinkKlick, dateiLinkHtml, ordnerLinkHtml } from '../core/ablage/ablageOrdnerLink.js';
import {
  SP_ASSET, SP_ORDNER, antwort, fensterAttrappe, klickeIn, rolleZuruecksetzen, setRolle,
} from './ablageOrdnerLinkTestKit.js';

const LESELINK = 'https://netorg12915005.sharepoint.com/:f:/s/Medienablage/anonym';
const DOWNLOAD = 'https://netorg12915005.sharepoint.com/_layouts/15/download.aspx?tempauth=x';

const ordnerKnopf = () => ordnerLinkHtml({ url: SP_ORDNER, kooperationId: 'k1', inhalt: 'Ordner' });

describe('ablageLinkKlick – Leselink holen und öffnen', () => {
  let loesen = () => {};

  beforeEach(() => {
    setRolle('kunde');
    _clearAblageLinkCache();
    authorizedFetch.mockReset();
    window.toastSystem = { show: vi.fn() };
  });

  afterEach(() => {
    loesen();
    vi.restoreAllMocks();
    rolleZuruecksetzen();
    delete window.toastSystem;
    document.body.innerHTML = '';
  });

  it('Ordner: Fenster sofort im Klick, danach der Leselink aus ablage-freigabe', async () => {
    const { win, open } = fensterAttrappe();
    authorizedFetch.mockResolvedValue(antwort({ url: LESELINK }));

    ({ loesen } = klickeIn(ordnerKnopf(), 'button', ablageLinkKlick));

    expect(open).toHaveBeenCalledWith('', '_blank');
    const [url, opts] = authorizedFetch.mock.calls[0];
    expect(url).toBe('/.netlify/functions/ablage-freigabe');
    expect(JSON.parse(opts.body)).toEqual({ aktion: 'erstellen', kooperation_id: 'k1', typ: 'videos' });
    await vi.waitFor(() => expect(win.location).toBe(LESELINK));
    expect(win.opener).toBeNull();
  });

  it('Datei: Download-Link aus ablage-link', async () => {
    const { win } = fensterAttrappe();
    authorizedFetch.mockResolvedValue(antwort({ links: { a1: { url: DOWNLOAD, laeuft_ab: null } }, fehlend: [] }));

    ({ loesen } = klickeIn(dateiLinkHtml({ asset: SP_ASSET, typ: 'video', inhalt: 'Anzeigen' }), 'button', ablageLinkKlick));

    await vi.waitFor(() => expect(win.location).toBe(DOWNLOAD));
    const [url, opts] = authorizedFetch.mock.calls[0];
    expect(url).toBe('/.netlify/functions/ablage-link');
    expect(JSON.parse(opts.body).items).toEqual([{ typ: 'video', id: 'a1' }]);
  });

  it('gesperrte Links: Fenster zu, verständlicher Hinweis', async () => {
    const { win } = fensterAttrappe();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    authorizedFetch.mockResolvedValue(antwort({ error: 'gesperrt', code: 'links_gesperrt' }, 403));

    ({ loesen } = klickeIn(ordnerKnopf(), 'button', ablageLinkKlick));

    await vi.waitFor(() => expect(win.close).toHaveBeenCalled());
    expect(window.toastSystem.show).toHaveBeenCalledWith('SharePoint erlaubt gerade keine Links ohne Anmeldung.', 'error');
  });

  it('Datei ohne Link (fehlend): Fenster zu, allgemeiner Hinweis', async () => {
    const { win } = fensterAttrappe();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    authorizedFetch.mockResolvedValue(antwort({ links: {}, fehlend: ['a1'] }));

    ({ loesen } = klickeIn(dateiLinkHtml({ asset: SP_ASSET, typ: 'video', inhalt: 'Anzeigen' }), 'button', ablageLinkKlick));

    await vi.waitFor(() => expect(win.close).toHaveBeenCalled());
    expect(window.toastSystem.show).toHaveBeenCalledWith('Link konnte nicht geöffnet werden.', 'error');
  });

  it('zweiter Klick während des Ladens fragt nicht noch einmal', async () => {
    const { win } = fensterAttrappe();
    let freigeben;
    authorizedFetch.mockReturnValue(new Promise(r => { freigeben = () => r(antwort({ url: LESELINK })); }));

    let el;
    ({ el, loesen } = klickeIn(ordnerKnopf(), 'button', ablageLinkKlick));
    el.click();

    expect(authorizedFetch).toHaveBeenCalledTimes(1);
    expect(el.getAttribute('aria-busy')).toBe('true');
    freigeben();
    await vi.waitFor(() => expect(win.location).toBe(LESELINK));
    await vi.waitFor(() => expect(el.hasAttribute('aria-busy')).toBe(false));
  });

  it('fremde Klicks lässt die Delegation durch', () => {
    document.body.innerHTML = '<button data-action="play-video">Play</button>';
    const e = { target: document.querySelector('button'), preventDefault: vi.fn(), stopPropagation: vi.fn() };
    expect(ablageLinkKlick(e)).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
});
