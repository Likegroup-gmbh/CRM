import { afterEach, describe, expect, it } from 'vitest';
import { dateiLinkHtml, ordnerLinkHtml } from '../core/ablage/ablageOrdnerLink.js';
import { DROPBOX_ORDNER, SP_ASSET, SP_DATEI, SP_ORDNER, rolleZuruecksetzen, setRolle } from './ablageOrdnerLinkTestKit.js';

// SharePoint-webUrls öffnen nur Konten im Tenant (AADSTS50020 für Kunden). Wer bekommt was?
describe('Ablage-Links je Rolle', () => {
  afterEach(rolleZuruecksetzen);

  const ordner = (url, kooperationId = 'k1') =>
    ordnerLinkHtml({ url, kooperationId, inhalt: 'Ordner öffnen', klasse: 'table-link', titel: 'Ordner "Videos"' });

  it('Team: direkter Link auf den SharePoint-Ordner', () => {
    setRolle('team');
    document.body.innerHTML = ordner(SP_ORDNER);
    const a = document.querySelector('a.table-link');
    expect(a.getAttribute('href')).toBe(SP_ORDNER);
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('title')).toBe('Ordner "Videos"');
  });

  it('Kunde: Knopf auf den Leselink, keine webUrl im HTML', () => {
    setRolle('kunde');
    const html = ordner(SP_ORDNER);
    expect(html).not.toContain('sharepoint.com');
    document.body.innerHTML = html;
    const b = document.querySelector('button.table-link');
    expect(b.dataset.action).toBe('ablage-ordner-link');
    expect(b.dataset.kooperationId).toBe('k1');
    expect(b.textContent).toBe('Ordner öffnen');
  });

  it('Gast: kein Ordner, ablage-freigabe lehnt Gäste ab', () => {
    setRolle('gast');
    expect(ordner(SP_ORDNER)).toBe('');
    window.isGast = () => false;
    window.guestShare = { token: 't' };
    expect(ordner(SP_ORDNER)).toBe('');
  });

  it('Kunde ohne Kooperation: nichts statt eines toten Knopfs', () => {
    setRolle('kunde');
    expect(ordner(SP_ORDNER, null)).toBe('');
  });

  it('Dropbox-Ordner bleiben für alle direkte Links', () => {
    for (const rolle of ['team', 'kunde', 'gast']) {
      setRolle(rolle);
      document.body.innerHTML = ordner(DROPBOX_ORDNER);
      expect(document.querySelector('a').getAttribute('href')).toBe(DROPBOX_ORDNER);
    }
  });

  it('ohne URL kein HTML', () => {
    setRolle('team');
    expect(ordner(null)).toBe('');
  });

  it('Datei: Team direkt, Kunde und Gast über ablage-link', () => {
    setRolle('team');
    expect(dateiLinkHtml({ asset: SP_ASSET, typ: 'video', inhalt: 'Anzeigen' })).toContain(`href="${SP_DATEI}"`);

    for (const rolle of ['kunde', 'gast']) {
      setRolle(rolle);
      const html = dateiLinkHtml({ asset: SP_ASSET, typ: 'video', inhalt: 'Anzeigen', klasse: 'action-item' });
      expect(html).not.toContain('sharepoint.com');
      document.body.innerHTML = html;
      const b = document.querySelector('button.action-item');
      expect(b.dataset).toMatchObject({ action: 'ablage-datei-link', typ: 'video', id: 'a1', etag: 'e1' });
    }
  });

  it('Datei: Dropbox-Assets und eingefügte Links bleiben direkt', () => {
    setRolle('kunde');
    const dropbox = { id: 'd1', ablage: 'dropbox', file_url: 'https://www.dropbox.com/s/x/a.mp4?dl=0' };
    expect(dateiLinkHtml({ asset: dropbox, typ: 'video', inhalt: 'x' })).toContain('href="https://www.dropbox.com/s/x/a.mp4?dl=0"');
    expect(dateiLinkHtml({ asset: { id: 'd2', file_url: null }, typ: 'video', inhalt: 'x' })).toBe('');
  });
});
