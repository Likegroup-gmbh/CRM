import { describe, it, expect } from 'vitest';
import { renderCell, renderZeile } from './sourcingZelleKit.js';
import {
  CREATOR_TYP_OPTIONS,
  CREATOR_TYP_SELECT_OPTIONS,
  canonicalizeCreatorTyp
} from '../modules/creator-auswahl/creatorTypeOptions.js';
import { createSourcingProfilToolbarConfig } from '../modules/creator-auswahl/sourcingProfilToolbar.js';
import { applyProfilZelleState } from '../modules/creator-auswahl/sourcingProfilZelle.js';
import { PROFIL_PLATTFORMEN } from '../modules/creator-auswahl/sourcingProfilPlattformen.js';

const SOURCING_IG_TOOLBAR = PROFIL_PLATTFORMEN.instagram.toolbar;
const createSourcingIgToolbarConfig = (detail) => createSourcingProfilToolbarConfig(detail, 'instagram');


describe('Sourcing – Follower-Zellen', () => {
  it('haelt den Rohwert im Input und die Kurzform im Overlay', () => {
    const cell = renderCell('cp-col-follower-ig', { follower_instagram: 1391836 });

    expect(cell.querySelector('.cell-number__input').value).toBe('1391836');
    expect(cell.querySelector('.cell-number__display').textContent.trim()).toBe('1,39M');
  });

  it('zeigt den exakten Wert als Tooltip', () => {
    const cell = renderCell('cp-col-follower-tt', { follower_tiktok: 21569 });
    const display = cell.querySelector('.cell-number__display');

    expect(display.textContent.trim()).toBe('21,6K');
    expect(display.title).toBe('21.569');
  });

  it('kuerzt Tausender mit einer Nachkommastelle', () => {
    const cell = renderCell('cp-col-follower-ig', { follower_instagram: 5547 });

    expect(cell.querySelector('.cell-number__display').textContent.trim()).toBe('5,5K');
  });

  it('nutzt kein Textarea mehr, das die Spalte aufblaeht', () => {
    const cell = renderCell('cp-col-follower-ig', { follower_instagram: 5547 });

    expect(cell.querySelector('textarea')).toBeNull();
    expect(cell.querySelector('input[data-field="follower_instagram"]')).not.toBeNull();
  });

  it('zeigt bei leerem Wert einen Strich und einen leeren Input', () => {
    const cell = renderCell('cp-col-follower-ig', {});

    expect(cell.querySelector('.cell-number__input').value).toBe('');
    expect(cell.querySelector('.cell-number__display').textContent.trim()).toBe('–');
  });

  it('rendert fuer Kunden nur die formatierte Anzeige ohne Eingabefeld', () => {
    const cell = renderCell('cp-col-follower-ig', { follower_instagram: 1391836 }, { isKunde: true });

    expect(cell.querySelector('input')).toBeNull();
    expect(cell.querySelector('.cell-number__static').textContent.trim()).toBe('1,39M');
    expect(cell.querySelector('.cell-number__static').title).toBe('1.391.836');
  });
});

const IG_URL = 'https://www.instagram.com/paulinemary/';

describe('Sourcing – IG-Zelle', () => {
  const zelle = (item) => renderCell('cp-col-link-ig', item).querySelector('.chip-cell');

  it('meldet die Zelle bei der Hover-Toolbar an', () => {
    const cell = zelle({ link_instagram: IG_URL });

    expect(cell.dataset.hoverToolbar).toBe(SOURCING_IG_TOOLBAR);
    expect(cell.dataset.id).toBe('i1');
  });

  it('haelt die Roh-URL im Input und zeigt den Handle als Chip', () => {
    const cell = zelle({ link_instagram: IG_URL });

    expect(cell.querySelector('input[data-field="link_instagram"]').value).toBe(IG_URL);
    expect(cell.querySelector('.chip-cell__label').textContent).toBe('@paulinemary');
  });

  it('laesst den Handle aus dem Abruf vor dem aus der URL gehen', () => {
    // creator_auswahl_items hat keine Username-Spalte; der bestaetigte Handle
    // steckt in ig_stats und ist verlaesslicher als der Pfad einer getippten URL.
    const cell = zelle({
      link_instagram: 'https://www.instagram.com/altername/',
      ig_stats: { username: 'echtername' }
    });

    expect(cell.querySelector('.chip-cell__label').textContent).toBe('@echtername');
  });

  it('legt den Abruf-Button in die Zelle, keinen Extern-Link', () => {
    const cell = zelle({ link_instagram: IG_URL });

    expect(cell.querySelector('[data-profil-abruf="instagram"]')).not.toBeNull();
    expect(cell.querySelector('a')).toBeNull();
  });

  it('zeigt nach dem Abruf den Hover-Text zum Frisch-Abrufen', () => {
    const btn = zelle({
      link_instagram: IG_URL,
      ig_fetched_at: '2026-07-20T10:00:00.000Z'
    }).querySelector('[data-profil-abruf="instagram"]');

    expect(btn.getAttribute('aria-label')).toBe('Instagram-Daten frisch abrufen');
    expect(btn.title).toContain('frisch bei Instagram abrufen');
    expect(btn.classList.contains('is-refresh')).toBe(true);
  });

  it('rendert unabhaengig vom Link-Zustand denselben Zellenaufbau', () => {
    // Der frueher springende Teil: Extern-Link existierte nur bei gesetzter URL
    // und hat den Input in der Breite verschoben.
    const aufbau = (item) => [...zelle(item).children]
      .map(el => `${el.tagName}.${el.className.replace(/\s*is-[a-z]+/g, '')}`);

    expect(aufbau({ link_instagram: IG_URL })).toEqual(aufbau({}));
  });

  it('faerbt den Abruf-Button nach dem Zustand', () => {
    const cls = (item) => zelle(item).querySelector('[data-profil-abruf="instagram"]').className;

    expect(cls({})).toContain('is-empty');
    expect(cls({ link_instagram: IG_URL })).not.toContain('is-refresh');
    expect(cls({ link_instagram: IG_URL, ig_fetched_at: '2026-07-20T10:00:00.000Z' }))
      .toContain('is-refresh');
    expect(cls({ link_instagram: IG_URL, ig_fetch_error: 'Profil nicht gefunden' }))
      .toContain('is-error');
  });

  it('zeigt Kunden den Handle als anklickbaren Link, das Icon setzt die Zeile', () => {
    const cell = renderCell('cp-col-link-ig', { link_instagram: IG_URL }, { isKunde: true });

    expect(cell.querySelector('.chip-cell')).toBeNull();
    const link = cell.querySelector('a.chip-cell__chip--static');
    expect(link.getAttribute('href')).toBe(IG_URL);
    expect(link.querySelector('svg')).toBeNull();
    expect(link.textContent).toBe('@paulinemary');
  });

  it('zieht Chip und Punkt nach einer Eingabe im Feld nach', () => {
    // Ohne das bleibt die Zelle nach dem Einfuegen eines Links optisch leer
    const cell = zelle({});

    applyProfilZelleState(cell, { id: 'i1', link_instagram: IG_URL }, 'instagram');

    expect(cell.querySelector('[data-chip-cell-chip]').hidden).toBe(false);
    expect(cell.querySelector('.chip-cell__label').textContent).toBe('@paulinemary');
    expect(cell.querySelector('[data-profil-abruf="instagram"]').hidden).toBe(false);
    expect(cell.querySelector('[data-profil-abruf="instagram"]').classList.contains('is-empty')).toBe(false);
  });
});

describe('Sourcing – IG-Toolbar-Config', () => {
  const detail = { items: [{ id: 'i1', link_instagram: IG_URL }], handleInstagramFetch: () => {} };
  const config = createSourcingIgToolbarConfig(detail);

  function contextFor(item) {
    const cell = renderCell('cp-col-link-ig', item).querySelector('.chip-cell');
    detail.items = [{ id: 'i1', ...item }];
    return config.resolveContext(cell);
  }

  it('oeffnet nur mit Link', () => {
    expect(config.canOpen(contextFor({ link_instagram: IG_URL }))).toBe(true);
    expect(config.canOpen(contextFor({}))).toBe(false);
  });

  it('nimmt einen noch nicht gespeicherten Link aus dem Input', () => {
    const cell = renderCell('cp-col-link-ig', {}).querySelector('.chip-cell');
    cell.querySelector('input[data-field="link_instagram"]').value = IG_URL;
    detail.items = [{ id: 'i1' }];

    expect(config.resolveContext(cell).url).toBe(IG_URL);
  });

  it('beschriftet die Hauptaktion nach dem Abruf-Zustand', () => {
    const label = (item) => config.actions[0].label(contextFor(item));

    expect(label({ link_instagram: IG_URL })).toBe('Instagram-Daten abrufen');
    expect(label({ link_instagram: IG_URL, ig_fetched_at: '2026-07-20T10:00:00.000Z' }))
      .toBe('Frisch abrufen');
    expect(label({ link_instagram: IG_URL, ig_fetch_error: 'Profil nicht gefunden' }))
      .toBe('Erneut versuchen');
  });

  it('macht den Abruf-Fehler als Zeile sichtbar statt nur im Tooltip', () => {
    const ctx = contextFor({ link_instagram: IG_URL, ig_fetch_error: 'Profil nicht gefunden' });

    expect(config.rows[0](ctx)).toEqual({ kind: 'error', text: 'Profil nicht gefunden' });
    expect(config.rows[1](ctx)).toBeFalsy();
  });

  it('gibt dem Handler die Item-ID mit, weil die Leiste ausserhalb der Zeile sitzt', () => {
    const aufrufe = [];
    const cfg = createSourcingIgToolbarConfig({
      items: [{ id: 'i1', link_instagram: IG_URL }],
      handleInstagramFetch: (id, btn) => aufrufe.push([id, btn])
    });
    const button = { tagName: 'BUTTON' };

    cfg.actions[0].onClick({ id: 'i1' }, button);
    expect(aufrufe).toEqual([['i1', button]]);
  });
});

const TT_URL = 'https://www.tiktok.com/@lea.m';

describe('Sourcing – TikTok-Zelle und -Toolbar', () => {
  const zelle = (item) => renderCell('cp-col-link-tt', item).querySelector('.chip-cell');
  const button = (item) => zelle(item).querySelector('[data-profil-abruf="tiktok"]');

  it('nutzt dieselbe Chip-Zelle mit eigenem Feld, eigener Toolbar und Abruf-Button', () => {
    const cell = zelle({ link_tiktok: TT_URL });

    expect(cell.dataset.hoverToolbar).toBe(PROFIL_PLATTFORMEN.tiktok.toolbar);
    expect(cell.querySelector('input[data-field="link_tiktok"]').value).toBe(TT_URL);
    expect(cell.querySelector('.chip-cell__label').textContent).toBe('@lea.m');
    expect(button({ link_tiktok: TT_URL }).dataset.itemId).toBe('i1');
    expect(button({}).hidden).toBe(true);
  });

  it('nimmt den Handle aus dem letzten Abruf und zeigt dessen Zustand', () => {
    expect(zelle({ link_tiktok: TT_URL, tt_stats: { username: 'echt' } }).querySelector('.chip-cell__label').textContent).toBe('@echt');

    const frisch = button({ link_tiktok: TT_URL, tt_fetched_at: '2026-11-20T10:00:00.000Z' });
    expect(frisch.classList.contains('is-refresh')).toBe(true);
    expect(frisch.getAttribute('aria-label')).toBe('TikTok-Daten frisch abrufen');
    expect(button({ link_tiktok: TT_URL, tt_fetch_error: 'Profil ist privat' }).title).toBe('Abruf fehlgeschlagen: Profil ist privat');
    // Instagram-Zustand faerbt die TikTok-Zelle nicht
    expect(button({ link_tiktok: TT_URL, ig_fetch_error: 'x' }).className).not.toContain('is-error');
  });

  it('leitet die Toolbar-Aktion an handleTiktokFetch und öffnet das TikTok-Profil', () => {
    const aufrufe = [];
    const detail = { items: [{ id: 'i1', link_tiktok: TT_URL }], handleTiktokFetch: (id) => aufrufe.push(id) };
    const config = createSourcingProfilToolbarConfig(detail, 'tiktok');
    const ctx = config.resolveContext(zelle({ link_tiktok: TT_URL }));

    expect(config.actions[0].label(ctx)).toBe('TikTok-Daten abrufen');
    expect(config.actions[1].href(ctx)).toBe(TT_URL);
    config.actions[0].onClick(ctx, {});
    expect(aufrufe).toEqual(['i1']);
  });
});

describe('Sourcing – Creator Art als TableSelect', () => {
  it('bietet alle Creator-Arten plus eine Leer-Option', () => {
    expect(CREATOR_TYP_SELECT_OPTIONS).toHaveLength(CREATOR_TYP_OPTIONS.length + 1);
    expect(CREATOR_TYP_SELECT_OPTIONS[0]).toEqual({ value: '', label: '–' });
  });

  it('rendert ein TableSelect statt eines nativen Selects', () => {
    const cell = renderCell('cp-col-typ', { typ: 'Influencer' });

    expect(cell.querySelector('select')).toBeNull();
    expect(cell.querySelector('.table-select').dataset.field).toBe('creator_typ');
  });

  it('markiert die aktuelle Creator Art', () => {
    const select = renderCell('cp-col-typ', { typ: 'Influencer' }).querySelector('.table-select');

    expect(select.dataset.value).toBe('Influencer');
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('Influencer');
    expect(select.querySelector('.table-select__item.is-active').dataset.value).toBe('Influencer');
  });

  it('faellt ohne Wert auf die Leer-Option zurueck', () => {
    const select = renderCell('cp-col-typ', {}).querySelector('.table-select');

    expect(select.dataset.value).toBe('');
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('–');
  });

  it('sperrt das Select fuer Gaeste im Readonly-Modus', () => {
    const select = renderCell('cp-col-typ', { typ: 'Model' }, { gastReadonly: true }).querySelector('.table-select');

    expect(select.querySelector('button.table-select__trigger')).toBeNull();
    expect(select.querySelector('.table-select__trigger--disabled')).not.toBeNull();
  });

  it('zeigt Kunden nur den Text', () => {
    const cell = renderCell('cp-col-typ', { typ: 'Model' }, { isKunde: true });

    expect(cell.querySelector('.table-select')).toBeNull();
    expect(cell.querySelector('.cell-text-readonly').textContent.trim()).toBe('Model');
  });
});

describe('Sourcing – Creator Art kanonisieren', () => {
  it('laesst kanonische Werte unveraendert', () => {
    for (const typ of CREATOR_TYP_OPTIONS) {
      expect(canonicalizeCreatorTyp(typ)).toBe(typ);
    }
  });

  it('mappt Legacy-Typen aus dem Kampagnenarten-Merge', () => {
    expect(canonicalizeCreatorTyp('UGC Pro Paid')).toBe('UGC Paid');
    expect(canonicalizeCreatorTyp('UGC Video Paid')).toBe('UGC Paid');
    expect(canonicalizeCreatorTyp('UGC Pro Organic')).toBe('UGC Organic');
    expect(canonicalizeCreatorTyp('UGC Video Organic')).toBe('UGC Organic');
    expect(canonicalizeCreatorTyp('UGC')).toBe('UGC Organic');
    expect(canonicalizeCreatorTyp('IGC')).toBe('UGC Organic');
  });

  it('normalisiert Leerzeichen und Leerwerte', () => {
    expect(canonicalizeCreatorTyp('  Influencer  ')).toBe('Influencer');
    expect(canonicalizeCreatorTyp('')).toBeNull();
    expect(canonicalizeCreatorTyp(null)).toBeNull();
    expect(canonicalizeCreatorTyp(undefined)).toBeNull();
  });

  it('laesst unbekannte Werte zur Validierung durch', () => {
    expect(canonicalizeCreatorTyp('Foo')).toBe('Foo');
  });
});
