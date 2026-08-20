import { describe, it, expect } from 'vitest';
import { renderItemRow } from '../modules/creator-auswahl/CreatorAuswahlTemplates.js';
import {
  CREATOR_TYP_OPTIONS,
  CREATOR_TYP_SELECT_OPTIONS,
  canonicalizeCreatorTyp
} from '../modules/creator-auswahl/creatorTypeOptions.js';
import { createSourcingIgToolbarConfig } from '../modules/creator-auswahl/sourcingIgToolbarConfig.js';
import {
  applySourcingIgCellState, SOURCING_IG_TOOLBAR
} from '../modules/creator-auswahl/sourcingIgCell.js';

function renderCell(columnClass, item, ctx = {}) {
  const html = renderItemRow({ isKunde: false, hiddenColumns: [], ...ctx }, { id: 'i1', ...item }, 0);
  const doc = new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
  return doc.querySelector(`td.${columnClass}`);
}

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

  it('legt keine Aktions-Buttons mehr in die Zelle', () => {
    const cell = zelle({ link_instagram: IG_URL });

    expect(cell.querySelector('button')).toBeNull();
    expect(cell.querySelector('a')).toBeNull();
  });

  it('rendert unabhaengig vom Link-Zustand denselben Zellenaufbau', () => {
    // Der frueher springende Teil: Extern-Link existierte nur bei gesetzter URL
    // und hat den Input in der Breite verschoben.
    const aufbau = (item) => [...zelle(item).children]
      .map(el => `${el.tagName}.${el.className.replace(/\s*is-[a-z]+/g, '')}`);

    expect(aufbau({ link_instagram: IG_URL })).toEqual(aufbau({}));
  });

  it('faerbt den Status-Punkt nach dem Abruf-Zustand', () => {
    const dot = (item) => zelle(item).querySelector('[data-chip-cell-dot]').className;

    expect(dot({})).toContain('is-empty');
    expect(dot({ link_instagram: IG_URL })).toContain('is-idle');
    expect(dot({ link_instagram: IG_URL, ig_fetched_at: '2026-07-20T10:00:00.000Z' }))
      .toContain('is-fetched');
    expect(dot({ link_instagram: IG_URL, ig_fetch_error: 'Profil nicht gefunden' }))
      .toContain('is-error');
  });

  it('zeigt Kunden weiter nur das anklickbare Icon', () => {
    const cell = renderCell('cp-col-link-ig', { link_instagram: IG_URL }, { isKunde: true });

    expect(cell.querySelector('.chip-cell')).toBeNull();
    expect(cell.querySelector('a.link-icon-btn').getAttribute('href')).toBe(IG_URL);
  });

  it('zieht Chip und Punkt nach einer Eingabe im Feld nach', () => {
    // Ohne das bleibt die Zelle nach dem Einfuegen eines Links optisch leer
    const cell = zelle({});

    applySourcingIgCellState(cell, { id: 'i1', link_instagram: IG_URL });

    expect(cell.querySelector('[data-chip-cell-chip]').hidden).toBe(false);
    expect(cell.querySelector('.chip-cell__label').textContent).toBe('@paulinemary');
    expect(cell.querySelector('[data-chip-cell-dot]').className).toContain('is-idle');
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
