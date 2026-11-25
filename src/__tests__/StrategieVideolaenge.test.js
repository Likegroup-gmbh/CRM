import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getStrategieVideolaenge,
  formatStrategieVideolaenge,
  buildStrategieVideolaengeUpdates
} from '../modules/strategie/strategieVideolaenge.js';
import { renderItemRow, renderItemsTable, renderVideolaengeControl } from '../modules/strategie/StrategieDetailRenderer.js';
import { STRATEGIE_FIXED_COLUMNS, isFixedColumnVisible } from '../modules/strategie/strategieColumns.js';
import { handleVideolaengeChange, bindVideolaengeInputs } from '../modules/strategie/StrategieDetailTableEvents.js';
import { closeVideolaengePopover, VIDEOLAENGE_POPOVER_ID } from '../modules/strategie/StrategieVideolaengePopover.js';
import { sekundenSpanneWert } from '../core/components/SekundenSpanne.js';
import { strategieService } from '../modules/strategie/StrategieService.js';
import { resolveVideoideeForm, buildAddItemQueueEntry, buildStrategieItemInsert } from '../modules/strategie/addItemPayload.js';
import { resolveSkriptCreatePayload } from '../modules/skripte/skriptCreateKontext.js';
import { VORSCHLAG_EDIT_FIELDS } from '../modules/strategie/videoideeVorschlag.js';
import { PermissionSystem } from '../core/PermissionSystem.js';

function detailStub(overrides = {}) {
  return {
    isKunde: false,
    canEdit: true,
    hiddenColumns: [],
    customColumns: null,
    items: [],
    getTeilbereicheFromStrategie: () => ['A'],
    rerenderItemsTable: vi.fn(),
    ...overrides
  };
}

function renderRow(item, detailOverrides = {}) {
  const html = renderItemRow(detailStub(detailOverrides), { id: 'i1', ...item }, 0);
  return new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
}

beforeEach(() => {
  window.isGastReadonly = () => false;
  window.ActionsDropdown = { getHeroIcon: () => '' };
});

afterEach(() => {
  vi.restoreAllMocks();
  delete window.permissionSystem;
});

describe('Dauer: Lesen und Anzeigen', () => {
  it('liest das Intervall vom Item, ungueltige Werte zaehlen als leer', () => {
    expect(getStrategieVideolaenge({ videolaenge_von: 15, videolaenge_bis: 20 })).toEqual({ von: 15, bis: 20 });
    expect(getStrategieVideolaenge({ videolaenge_von: 15, videolaenge_bis: null })).toBeNull();
    expect(getStrategieVideolaenge({})).toBeNull();
    expect(getStrategieVideolaenge(null)).toBeNull();
  });

  it('formatiert fuer die Anzeige', () => {
    expect(formatStrategieVideolaenge({ videolaenge_von: 15, videolaenge_bis: 20 })).toBe('15–20 Sek.');
    expect(formatStrategieVideolaenge({ videolaenge_von: 8, videolaenge_bis: 8 })).toBe('8 Sek.');
    expect(formatStrategieVideolaenge({})).toBe('');
  });
});

describe('buildStrategieVideolaengeUpdates', () => {
  it('schreibt beide Felder oder leert beide', () => {
    expect(buildStrategieVideolaengeUpdates({ von: 15, bis: 20 })).toEqual({ videolaenge_von: 15, videolaenge_bis: 20 });
    expect(buildStrategieVideolaengeUpdates(null)).toEqual({ videolaenge_von: null, videolaenge_bis: null });
    expect(buildStrategieVideolaengeUpdates({ von: 'x', bis: 3 })).toEqual({ videolaenge_von: null, videolaenge_bis: null });
  });
});

describe('Spalte "Dauer"', () => {
  it('steht direkt nach der Funnel-Stufe und ist standardmaessig sichtbar', () => {
    const keys = STRATEGIE_FIXED_COLUMNS.map(c => c.key);
    expect(keys.indexOf('dauer')).toBe(keys.indexOf('funnel') + 1);
    expect(isFixedColumnVisible([], 'dauer')).toBe(true);
  });

  it('zeigt im Team einen Button mit dem Wert, der den Slider oeffnet', () => {
    const doc = renderRow({ videolaenge_von: 15, videolaenge_bis: 20 });
    const trigger = doc.querySelector('td.col-dauer button[data-videolaenge-trigger]');
    expect(trigger).toBeTruthy();
    expect(trigger.textContent.trim()).toBe('15–20 Sek.');
    expect(trigger.dataset.itemId).toBe('i1');
    expect(doc.querySelector('td.col-dauer input')).toBeNull();
  });

  it('zeigt ohne Wert einen Platzhalter am Button', () => {
    const doc = renderRow({});
    const trigger = doc.querySelector('td.col-dauer [data-videolaenge-trigger]');
    expect(trigger.classList.contains('is-empty')).toBe(true);
    expect(trigger.textContent.trim()).toBe('Dauer wählen');
  });

  it('rendert im Drawer den Slider wie im Briefing, mit Griffen und Zahlenfeldern', () => {
    const html = renderVideolaengeControl(detailStub(), { id: 'i1', videolaenge_von: 15, videolaenge_bis: 20 }, { variant: 'drawer' });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const root = doc.querySelector('[data-sekunden-spanne]');
    expect(root.dataset.von).toBe('15');
    expect(root.dataset.bis).toBe('20');
    expect(root.dataset.itemId).toBe('i1');
    expect(root.querySelector('[data-handle="von"]')).toBeTruthy();
    expect(root.querySelector('[data-handle="bis"]')).toBeTruthy();
    expect(root.querySelector('[data-sek="von"]').value).toBe('15');
    expect(root.querySelector('[data-sek="bis"]').value).toBe('20');
    expect(root.querySelector('.sek-spanne').classList.contains('is-empty')).toBe(false);
  });

  it('rendert den Drawer-Slider ohne Wert als leer', () => {
    const html = renderVideolaengeControl(detailStub(), { id: 'i1' }, { variant: 'drawer' });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('.sek-spanne').classList.contains('is-empty')).toBe(true);
    expect(doc.querySelector('[data-sekunden-spanne]').dataset.von).toBe('');
  });

  it('zeigt dem Kunden auch im Drawer keinen Slider', () => {
    const html = renderVideolaengeControl(detailStub({ isKunde: true }), { id: 'i1', videolaenge_von: 5, videolaenge_bis: 9 }, { variant: 'drawer' });
    expect(html).not.toContain('data-sekunden-spanne');
    expect(html).toContain('5–9 Sek.');
  });

  it('zeigt dem Kunden nur Text, leer als Gedankenstrich', () => {
    const mit = renderRow({ videolaenge_von: 15, videolaenge_bis: 20 }, { isKunde: true });
    expect(mit.querySelector('td.col-dauer button')).toBeNull();
    expect(mit.querySelector('td.col-dauer').textContent.trim()).toBe('15–20 Sek.');

    const ohne = renderRow({}, { isKunde: true });
    expect(ohne.querySelector('td.col-dauer').textContent.trim()).toBe('–');
  });

  it('zeigt ohne Edit-Recht nur Text', () => {
    const doc = renderRow({ videolaenge_von: 8, videolaenge_bis: 8 }, { canEdit: false });
    expect(doc.querySelector('td.col-dauer button')).toBeNull();
    expect(doc.querySelector('td.col-dauer').textContent.trim()).toBe('8 Sek.');
  });

  it('wird ohne Feld-Recht strategie_videolaenge nicht editierbar', () => {
    window.permissionSystem = { canEditField: (entity, field) => field !== 'strategie_videolaenge' };
    const doc = renderRow({ videolaenge_von: 8, videolaenge_bis: 12 });
    expect(doc.querySelector('td.col-dauer button')).toBeNull();
  });

  it('ist fuer Kunden per Feld-Denylist gesperrt', () => {
    const ps = new PermissionSystem();
    ps.currentUser = { rolle: 'kunde' };
    expect(ps.canEditField('strategie', 'strategie_videolaenge')).toBe(false);
  });

  it('blendet Header und Zelle mit fixed:dauer aus', () => {
    const items = [{ id: 'i1', beschreibung: 'x', videolaenge_von: 5, videolaenge_bis: 6 }];
    const an = new DOMParser().parseFromString(renderItemsTable(detailStub({ items })), 'text/html');
    expect(an.querySelector('th.col-dauer')).toBeTruthy();

    const aus = new DOMParser().parseFromString(
      renderItemsTable(detailStub({ items, hiddenColumns: ['fixed:dauer'] })),
      'text/html'
    );
    expect(aus.querySelector('th.col-dauer')).toBeNull();
    expect(aus.querySelector('td.col-dauer')).toBeNull();
  });

  it('laesst die Textspalten ausser Beschreibung standardmaessig weg, Colspan stimmt', () => {
    const items = [{ id: 'i1', video_link: 'https://tiktok.com/x', beschreibung: 'x' }];
    const doc = new DOMParser().parseFromString(renderItemsTable(detailStub({ items })), 'text/html');
    expect(doc.querySelector('th.col-beschreibung')).toBeTruthy();
    for (const key of ['umsetzungsvorgabe', 'kundenadaption', 'transkript', 'caption', 'anmerkung']) {
      expect(doc.querySelector(`th.col-${key}`)).toBeNull();
    }
    const spalten = doc.querySelectorAll('thead th').length;
    expect(Number(doc.querySelector('.category-header-cell').getAttribute('colspan'))).toBe(spalten);
  });
});

describe('handleVideolaengeChange', () => {
  function setup(item = { id: 'i1', videolaenge_von: 15, videolaenge_bis: 20 }) {
    const detail = detailStub({ items: [item] });
    const update = vi.spyOn(strategieService, 'updateStrategieItem').mockResolvedValue({});
    return { detail, item, update };
  }

  it('speichert ein neues Intervall und rendert neu', async () => {
    const { detail, item, update } = setup();
    const ok = await handleVideolaengeChange(detail, 'i1', { von: 30, bis: 45 });
    expect(ok).toBe(true);
    expect(update).toHaveBeenCalledWith('i1', { videolaenge_von: 30, videolaenge_bis: 45 });
    expect(item.videolaenge_von).toBe(30);
    expect(item.videolaenge_bis).toBe(45);
    expect(detail.rerenderItemsTable).toHaveBeenCalled();
  });

  it('leert mit null', async () => {
    const { detail, item, update } = setup();
    await handleVideolaengeChange(detail, 'i1', null);
    expect(update).toHaveBeenCalledWith('i1', { videolaenge_von: null, videolaenge_bis: null });
    expect(item.videolaenge_von).toBeNull();
  });

  it('schreibt nichts bei unveraendertem Wert', async () => {
    const { detail, update } = setup();
    expect(await handleVideolaengeChange(detail, 'i1', { von: 15, bis: 20 })).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('laesst bei Speicherfehler das Item unveraendert', async () => {
    const { detail, item, update } = setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    update.mockRejectedValue(new Error('db'));
    expect(await handleVideolaengeChange(detail, 'i1', { von: 30, bis: 30 })).toBe(false);
    expect(item.videolaenge_von).toBe(15);
  });

  it('tut fuer Kunden nichts', async () => {
    const { detail, update } = setup();
    detail.isKunde = true;
    expect(await handleVideolaengeChange(detail, 'i1', { von: 30, bis: 30 })).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('ist am Videoidee-Vorschlag erlaubt', () => {
    expect(VORSCHLAG_EDIT_FIELDS).toContain('videolaenge_von');
    expect(VORSCHLAG_EDIT_FIELDS).toContain('videolaenge_bis');
  });
});

describe('Dauer-Popover in der Tabelle', () => {
  const gemountet = [];

  afterEach(() => {
    // Die Klick-Handler haengen am document: nach jedem Test abbauen.
    while (gemountet.length) gemountet.pop()._tableEventListeners.forEach(cleanup => cleanup());
    closeVideolaengePopover();
    document.body.innerHTML = '';
  });

  function mount(item = { id: 'i1', videolaenge_von: 15, videolaenge_bis: 20 }) {
    const detail = detailStub({
      items: [item],
      _tableEventListeners: new Set(),
      _getRoot: () => document.body
    });
    document.body.innerHTML = `<table class="strategie-items-table"><tbody><tr class="item-row">
      <td class="col-dauer">${renderVideolaengeControl(detail, item)}</td></tr></tbody></table>`;
    bindVideolaengeInputs(detail);
    gemountet.push(detail);
    return { detail, item, trigger: document.querySelector('[data-videolaenge-trigger]') };
  }

  it('oeffnet den Slider mit dem aktuellen Wert und schliesst beim zweiten Klick', () => {
    const { trigger } = mount();
    trigger.click();
    const popover = document.getElementById(VIDEOLAENGE_POPOVER_ID);
    expect(popover).toBeTruthy();
    expect(sekundenSpanneWert(popover.querySelector('[data-sekunden-spanne]'))).toEqual({ von: 15, bis: 20 });

    trigger.click();
    expect(document.getElementById(VIDEOLAENGE_POPOVER_ID)).toBeNull();
  });

  it('speichert, wenn eine Zahl im Slider festgelegt wird', async () => {
    const { item, trigger } = mount();
    const update = vi.spyOn(strategieService, 'updateStrategieItem').mockResolvedValue({});
    trigger.click();
    const popover = document.getElementById(VIDEOLAENGE_POPOVER_ID);
    const bis = popover.querySelector('[data-sek="bis"]');
    bis.value = '45';
    bis.dispatchEvent(new Event('blur'));
    await vi.waitFor(() => expect(update).toHaveBeenCalledWith('i1', { videolaenge_von: 15, videolaenge_bis: 45 }));
    expect(item.videolaenge_bis).toBe(45);
  });

  it('leert mit "Leeren"', async () => {
    const { item, trigger } = mount();
    const update = vi.spyOn(strategieService, 'updateStrategieItem').mockResolvedValue({});
    trigger.click();
    document.querySelector(`#${VIDEOLAENGE_POPOVER_ID} [data-leeren]`).click();
    await vi.waitFor(() => expect(update).toHaveBeenCalledWith('i1', { videolaenge_von: null, videolaenge_bis: null }));
    expect(item.videolaenge_von).toBeNull();
  });

  it('schliesst mit Escape und bei Klick daneben', () => {
    const { trigger } = mount();
    trigger.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById(VIDEOLAENGE_POPOVER_ID)).toBeNull();

    trigger.click();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(document.getElementById(VIDEOLAENGE_POPOVER_ID)).toBeNull();
  });
});

describe('Add-Item-Payload mit Dauer', () => {
  const basis = { art: 'idee', beschreibung: 'Text' };

  it('reicht das Intervall aus dem Slider durch, leer bleibt null', () => {
    expect(resolveVideoideeForm({ ...basis, videolaenge: { von: 15, bis: 20 } }).videolaenge).toEqual({ von: 15, bis: 20 });
    expect(resolveVideoideeForm({ ...basis, videolaenge: null }).videolaenge).toBeNull();
    expect(resolveVideoideeForm(basis).videolaenge).toBeNull();
  });

  it('verwirft ein ungueltiges Intervall', () => {
    expect(resolveVideoideeForm({ ...basis, videolaenge: { von: 'x', bis: 3 } }).videolaenge).toBeNull();
  });

  it('schreibt die Dauer in den Insert, leer laesst die Spalten weg', () => {
    const mit = buildAddItemQueueEntry({ id: 'q1', beschreibung: 'T', videolaenge: { von: 6, bis: 10 } });
    expect(buildStrategieItemInsert({ strategieId: 's1', nextItem: mit, sortierung: 0 }))
      .toMatchObject({ videolaenge_von: 6, videolaenge_bis: 10 });

    const ohne = buildAddItemQueueEntry({ id: 'q2', beschreibung: 'T', videolaenge: null });
    const insert = buildStrategieItemInsert({ strategieId: 's1', nextItem: ohne, sortierung: 0 });
    expect('videolaenge_von' in insert).toBe(false);
    expect('videolaenge_bis' in insert).toBe(false);
  });

  it('ignoriert ein ungueltiges Intervall in der Queue', () => {
    const entry = buildAddItemQueueEntry({ id: 'q3', beschreibung: 'T', videolaenge: { von: 'x', bis: 2 } });
    expect(entry.videolaenge).toBeNull();
  });
});

describe('Skript-Payload: Dauer der Videoidee schlaegt das Briefing', () => {
  const item = (extra = {}) => ({
    id: 'si-1',
    beschreibung: 'Glow Routine',
    strategie: {
      unternehmen_id: 'u1',
      briefing: { id: 'br', bereich: 'owned_social', videolaenge_von: 30, videolaenge_bis: 60 }
    },
    ...extra
  });

  it('nimmt die Dauer vom Item als Skript-Schluessel', () => {
    expect(resolveSkriptCreatePayload(item({ videolaenge_von: 6, videolaenge_bis: 10 })).video_laenge).toBe('6-10');
  });

  it('laesst sie ohne Dauer leer, damit SkripteService aus dem Briefing fuellt', () => {
    expect(resolveSkriptCreatePayload(item()).video_laenge).toBeNull();
    expect(resolveSkriptCreatePayload(null).video_laenge).toBeNull();
  });
});
