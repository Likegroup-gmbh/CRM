import { describe, it, expect, beforeEach } from 'vitest';
import { renderGroupedItems } from '../modules/creator-auswahl/castingTableRender.js';
import { CreatorAuswahlAddDrawer } from '../modules/creator-auswahl/CreatorAuswahlAddDrawer.js';
import { AddCreatorToCastingDrawer } from '../modules/creator-auswahl/AddCreatorToCastingDrawer.js';
import { CreatorAuswahlDetail } from '../modules/creator-auswahl/CreatorAuswahlDetail.js';
import {
  NICHT_UMSETZEN_KATEGORIE,
  OHNE_PERSONA_KEY,
  personaDisplayLabel,
  pickFirstPersonaId,
  orderPersonasByIds,
  orderedPersonaGroups,
  reorderSourcingItemsByPersonas,
  updatesForGroupKey
} from '../modules/creator-auswahl/castingPersonaGroups.js';

const PERSONA_A = { id: 'pa', name: 'Persona A' };
const PERSONA_B = { id: 'pb', name: 'Persona B' };
const PERSONAS = [PERSONA_A, PERSONA_B];
const MARCO = { id: 'pm', name: 'Marco', oberbegriff: 'der sportliche Papa' };

function groupedDoc(items, personas = PERSONAS) {
  const html = renderGroupedItems({
    liste: {},
    items,
    personas,
    isKunde: false,
    hiddenColumns: [],
    customManager: null
  });
  return new DOMParser().parseFromString(`<table>${html}</table>`, 'text/html');
}

function headerByLabel(doc, label) {
  return Array.from(doc.querySelectorAll('.kategorie-header-row')).find(
    row => row.querySelector('.kategorie-label')?.textContent.trim() === label
  );
}

describe('orderedPersonaGroups', () => {
  it('haelt Briefing-Reihenfolge und leere Gruppen', () => {
    const groups = orderedPersonaGroups(
      [{ id: 'i1', persona_id: 'pb', name: 'Ben' }],
      PERSONAS
    );
    expect(groups.map(g => g.label)).toEqual(['Persona A', 'Persona B']);
    expect(groups[0].items).toHaveLength(0);
    expect(groups[1].items.map(i => i.id)).toEqual(['i1']);
  });

  it('haengt Orphans, Ohne Persona und Nicht umsetzen ans Ende', () => {
    const groups = orderedPersonaGroups([
      { id: 'o1', persona_id: null },
      { id: 'x1', persona_id: 'px', persona: { name: 'Alt' } },
      { id: 'n1', kategorie: NICHT_UMSETZEN_KATEGORIE, persona_id: 'pa' }
    ], PERSONAS);
    expect(groups.map(g => g.label)).toEqual([
      'Persona A', 'Persona B', 'Alt', 'Ohne Persona', 'Nicht umsetzen'
    ]);
  });

  it('nimmt Oberbegriff · Name als Gruppenlabel', () => {
    const groups = orderedPersonaGroups([], [MARCO]);
    expect(groups.map(g => g.label)).toEqual(['der sportliche Papa · Marco']);
  });

  it('nimmt Oberbegriff auch bei Orphans', () => {
    const groups = orderedPersonaGroups([
      { id: 'x1', persona_id: 'px', persona: { name: 'Marco', oberbegriff: 'der sportliche Papa' } }
    ], []);
    expect(groups[0].label).toBe('der sportliche Papa · Marco');
  });
});

describe('personaDisplayLabel', () => {
  it('faellt ohne Oberbegriff auf den Namen zurueck', () => {
    expect(personaDisplayLabel(PERSONA_A)).toBe('Persona A');
    expect(personaDisplayLabel(MARCO)).toBe('der sportliche Papa · Marco');
  });
});

describe('renderGroupedItems nach Persona', () => {
  it('schreibt Persona-id in data-persona-id der Gruppenheader', () => {
    const doc = groupedDoc([]);
    const header = headerByLabel(doc, 'Persona A');

    expect(header).toBeTruthy();
    expect(header.dataset.personaId).toBe('pa');
    expect(header.dataset.groupKey).toBe('pa');
    expect(header.querySelector('.kategorie-count').textContent).toBe('(0)');
  });

  it('legt Vorschlaege in die getroffene Persona-Gruppe', () => {
    const doc = groupedDoc([
      { id: 'v1', name: 'Jessie', isVorschlag: true, persona_id: 'pb' },
      { id: 'i1', name: 'Anna', persona_id: 'pb' }
    ]);
    const header = headerByLabel(doc, 'Persona B');
    expect(header.querySelector('.kategorie-count').textContent).toBe('(2)');
    const rows = Array.from(doc.querySelectorAll('.item-row'));
    expect(rows.map(r => r.dataset.itemId)).toEqual(['v1', 'i1']);
  });

  it('rendert Orphans unter dem Persona-Namen', () => {
    const doc = groupedDoc([{ id: 'i2', name: 'Ben', persona_id: 'px', persona: { name: 'Forge-Alt' } }]);
    const orphan = headerByLabel(doc, 'Forge-Alt');
    expect(orphan).toBeTruthy();
    expect(orphan.dataset.personaId).toBe('px');
    expect(orphan.querySelector('.kategorie-count').textContent).toBe('(1)');
  });

  it('legt jede Persona-Gruppe in ein eigenes tbody', () => {
    const doc = groupedDoc([
      { id: 'a1', name: 'Anna', persona_id: 'pa' },
      { id: 'b1', name: 'Ben', persona_id: 'pb' }
    ]);
    const tbodys = Array.from(doc.querySelectorAll('tbody.persona-group-tbody'));
    expect(tbodys.map(t => t.dataset.groupKey)).toEqual(['pa', 'pb']);
    expect(tbodys[0].querySelector('.kategorie-header-row')?.dataset.groupKey).toBe('pa');
    expect(tbodys[0].querySelector('.item-row')?.dataset.itemId).toBe('a1');
    expect(tbodys[1].querySelector('.kategorie-header-row')?.dataset.groupKey).toBe('pb');
    expect(tbodys[1].querySelector('.item-row')?.dataset.itemId).toBe('b1');
  });

  it('schreibt Oberbegriff · Name in den Gruppenkopf', () => {
    const doc = groupedDoc([], [MARCO]);
    const header = headerByLabel(doc, 'der sportliche Papa · Marco');
    expect(header).toBeTruthy();
    expect(header.dataset.personaId).toBe('pm');
  });

  it('packt Items ohne Personas in ein einzelnes tbody', () => {
    const doc = groupedDoc([{ id: 'a1', name: 'Anna', persona_id: null }], []);
    const tbodys = Array.from(doc.querySelectorAll('tbody.persona-group-tbody'));
    expect(tbodys).toHaveLength(1);
    expect(tbodys[0].dataset.groupKey).toBe(OHNE_PERSONA_KEY);
    expect(tbodys[0].querySelector('.item-row')?.dataset.itemId).toBe('a1');
    expect(tbodys[0].querySelector('.kategorie-header-row')).toBeNull();
  });
});

describe('reorderSourcingItemsByPersonas', () => {
  it('sortiert nach Briefing-Reihenfolge, Nicht umsetzen zuletzt', () => {
    const reordered = reorderSourcingItemsByPersonas([
      { id: 'n1', kategorie: NICHT_UMSETZEN_KATEGORIE, persona_id: 'pa' },
      { id: 'b1', persona_id: 'pb' },
      { id: 'o1', persona_id: null },
      { id: 'a1', persona_id: 'pa' }
    ], PERSONAS);
    expect(reordered.map(i => i.id)).toEqual(['a1', 'b1', 'o1', 'n1']);
  });
});

describe('pickFirstPersonaId / orderPersonasByIds', () => {
  it('nimmt die erste erlaubte Persona', () => {
    expect(pickFirstPersonaId(['px', 'pb', 'pa'], ['pa', 'pb'])).toBe('pb');
    expect(pickFirstPersonaId(['pa'], [])).toBe('pa');
    expect(pickFirstPersonaId([], ['pa'])).toBeNull();
  });

  it('ordnet geladene Personas nach Briefing-Array', () => {
    const rows = [{ id: 'pb', name: 'B' }, { id: 'pa', name: 'A' }];
    expect(orderPersonasByIds(rows, ['pa', 'pb']).map(p => p.name)).toEqual(['A', 'B']);
  });
});

describe('updatesForGroupKey', () => {
  it('schreibt persona_id und leert kategorie', () => {
    expect(updatesForGroupKey('pa', 'pa')).toEqual({
      persona_id: 'pa',
      kategorie: null,
      nicht_umsetzen: false
    });
    expect(updatesForGroupKey(OHNE_PERSONA_KEY)).toEqual({
      persona_id: null,
      kategorie: null,
      nicht_umsetzen: false
    });
    expect(updatesForGroupKey(NICHT_UMSETZEN_KATEGORIE).kategorie).toBe(NICHT_UMSETZEN_KATEGORIE);
  });
});

describe('Add-Drawer Persona', () => {
  it('macht Persona zum Pflichtfeld und setzt die einzige Option voraus', () => {
    const drawer = new CreatorAuswahlAddDrawer({
      liste: {},
      personas: [PERSONA_A],
      hiddenColumns: []
    });
    const doc = new DOMParser().parseFromString(drawer.renderForm(), 'text/html');
    const select = doc.querySelector('#creator-persona');
    expect(select).toBeTruthy();
    expect(select.required).toBe(true);
    const option = Array.from(select.querySelectorAll('option')).find(el => el.value === 'pa');
    expect(option.selected).toBe(true);
  });

  it('zeigt Oberbegriff · Name in der Persona-Option', () => {
    const drawer = new CreatorAuswahlAddDrawer({
      liste: {},
      personas: [MARCO],
      hiddenColumns: []
    });
    const doc = new DOMParser().parseFromString(drawer.renderForm(), 'text/html');
    const option = Array.from(doc.querySelectorAll('#creator-persona option')).find(el => el.value === 'pm');
    expect(option?.textContent).toBe('der sportliche Papa · Marco');
  });
});

describe('CreatorAuswahlDetail – Bulk-Bar Personas', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('listet Briefing-Personas als option.value', () => {
    const detail = new CreatorAuswahlDetail();
    detail.personas = PERSONAS;
    detail.renderBulkBar();

    const option = Array.from(document.querySelectorAll('#sourcing-bulk-kategorie option'))
      .find(el => el.textContent === 'Persona A');

    expect(option).toBeTruthy();
    expect(option.value).toBe('pa');
    document.getElementById('sourcing-bulk-bar')?.remove();
  });

  it('zeigt Oberbegriff · Name in der Bulk-Option', () => {
    const detail = new CreatorAuswahlDetail();
    detail.personas = [MARCO];
    detail.renderBulkBar();

    const option = Array.from(document.querySelectorAll('#sourcing-bulk-kategorie option'))
      .find(el => el.value === 'pm');

    expect(option?.textContent).toBe('der sportliche Papa · Marco');
    document.getElementById('sourcing-bulk-bar')?.remove();
  });
});

describe('CreatorAuswahlDetail – Pill-Dropdown', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('schreibt Persona-id in data-group-key der Optionen', () => {
    const detail = new CreatorAuswahlDetail();
    detail.personas = PERSONAS;
    detail.items = [{ id: 'i1', persona_id: null }];

    const pill = document.createElement('div');
    pill.className = 'kategorie-pill';
    pill.getBoundingClientRect = () => ({ bottom: 0, left: 0 });
    document.body.appendChild(pill);

    detail.openPillDropdown('i1', pill);

    const option = Array.from(document.querySelectorAll('.kategorie-pill-option'))
      .find(el => el.textContent === 'Persona A');

    expect(option).toBeTruthy();
    expect(option.dataset.groupKey).toBe('pa');
    detail.closePillDropdown();
  });
});

describe('AddCreatorToCastingDrawer', () => {
  it('zeigt nach dem Casting ein Persona-Select', () => {
    document.body.innerHTML = `<div id="add-creator-to-casting-drawer-body"></div>`;
    const drawer = new AddCreatorToCastingDrawer();
    drawer.renderBody([{ value: 'l1', label: 'Forge Casting' }]);
    expect(document.getElementById('add-creator-to-casting-drawer-persona')).toBeTruthy();
    expect(document.getElementById('add-creator-to-casting-drawer-submit').disabled).toBe(true);
  });
});
