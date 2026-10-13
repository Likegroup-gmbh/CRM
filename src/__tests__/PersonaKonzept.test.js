import { describe, it, expect, beforeEach } from 'vitest';
import {
  STRATEGIE_PERSONA_OFFEN,
  briefingEinzigePersonaId,
  briefingPersonaIds,
  buildStrategiePersonaUpdates,
  getStrategiePersona,
  isStrategiePersona,
  loadStrategiePersonas,
  personaLabel,
  strategiePersonaOptions
} from '../modules/strategie/strategiePersonaOptions.js';
import { STRATEGIE_FIXED_COLUMNS, buildColumnContext, isFixedColumnVisible, setFixedColumnVisibility } from '../modules/strategie/strategieColumns.js';
import { renderItemRow, renderItemsTable } from '../modules/strategie/StrategieDetailRenderer.js';
import { buildStrategieItemInsert, resolveVideoideeForm } from '../modules/strategie/addItemPayload.js';
import { personaIdFuerSkript, resolveSkriptCreatePayload } from '../modules/skripte/skriptCreateKontext.js';
import { VORSCHLAG_EDIT_FIELDS } from '../modules/strategie/videoideeVorschlag.js';
import { PermissionSystem } from '../core/PermissionSystem.js';

const PERSONAS = new Map([
  ['p1', { id: 'p1', name: 'Marco', oberbegriff: 'Sportler' }],
  ['p2', { id: 'p2', name: 'Mia', oberbegriff: null }]
]);
const BRIEFING = { bereich: 'owned_social', persona_ids: ['p2', 'p1'] };

function detailStub(overrides = {}) {
  const strategie = overrides.strategie || { briefing: BRIEFING };
  const items = overrides.items || [];
  return {
    isKunde: false,
    canEdit: true,
    hiddenColumns: [],
    customColumns: null,
    items,
    strategie,
    personaById: PERSONAS,
    personaOptions: item => strategiePersonaOptions(strategie.briefing, PERSONAS, item),
    columnContext: () => buildColumnContext(strategie, items),
    getTeilbereicheFromStrategie: () => ['A'],
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
  delete window.permissionSystem;
});

describe('Persona-Optionen', () => {
  it('labelt "Oberbegriff (Name)", sonst nur den Namen', () => {
    expect(personaLabel(PERSONAS.get('p1'))).toBe('Sportler (Marco)');
    expect(personaLabel(PERSONAS.get('p2'))).toBe('Mia');
    expect(personaLabel(null)).toBe('Unbenannt');
  });

  it('bietet "Keine Persona" und die Briefing-Personas, sortiert', () => {
    const options = strategiePersonaOptions(BRIEFING, PERSONAS);
    expect(options.map(o => o.value)).toEqual([STRATEGIE_PERSONA_OFFEN, 'p2', 'p1']);
    expect(options[0].label).toBe('Keine Persona');
  });

  it('behält eine gesetzte Persona, die nicht mehr im Briefing steht', () => {
    const options = strategiePersonaOptions({ persona_ids: ['p1'] }, PERSONAS, { persona_id: 'p2' });
    expect(options.map(o => o.value)).toContain('p2');
  });

  it('lässt unbekannte Personas (nicht lesbar) weg', () => {
    const options = strategiePersonaOptions({ persona_ids: ['p1', 'fremd'] }, PERSONAS);
    expect(options.map(o => o.value)).toEqual([STRATEGIE_PERSONA_OFFEN, 'p1']);
  });

  it('prüft Auswahl und speichert leer als null', () => {
    const options = strategiePersonaOptions(BRIEFING, PERSONAS);
    expect(isStrategiePersona('p1', options)).toBe(true);
    expect(isStrategiePersona('offen', options)).toBe(true);
    expect(isStrategiePersona('quatsch', options)).toBe(false);
    expect(buildStrategiePersonaUpdates('p1')).toEqual({ persona_id: 'p1' });
    expect(buildStrategiePersonaUpdates('offen')).toEqual({ persona_id: null });
    expect(getStrategiePersona({})).toBe('');
    expect(getStrategiePersona({ persona_id: 'p1' })).toBe('p1');
  });

  it('liest Briefing-Personas ohne Leere und Doppelte, Vorbelegung nur bei genau einer', () => {
    expect(briefingPersonaIds({ persona_ids: ['p1', null, 'p1', 'p2'] })).toEqual(['p1', 'p2']);
    expect(briefingPersonaIds(null)).toEqual([]);
    expect(briefingEinzigePersonaId({ persona_ids: ['p1'] })).toBe('p1');
    expect(briefingEinzigePersonaId(BRIEFING)).toBeNull();
  });
});

describe('Laden der Personas', () => {
  it('lädt Briefing-Personas und gesetzte Personas in eine Map', async () => {
    let angefragt = null;
    const client = {
      from: () => ({
        select: () => ({
          in: (_feld, ids) => {
            angefragt = ids;
            return Promise.resolve({ data: ids.map(id => PERSONAS.get(id)).filter(Boolean), error: null });
          }
        })
      })
    };
    const map = await loadStrategiePersonas(client, { briefing: { persona_ids: ['p1'] } }, [{ persona_id: 'p2' }]);
    expect([...angefragt].sort()).toEqual(['p1', 'p2']);
    expect(map.get('p2').name).toBe('Mia');
  });

  it('fragt ohne Personas nicht an und liefert bei Fehler eine leere Map', async () => {
    const client = { from: () => { throw new Error('nicht aufrufen'); } };
    expect((await loadStrategiePersonas(client, { briefing: { persona_ids: [] } }, [])).size).toBe(0);

    const fehler = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: null, error: { message: 'x' } }) }) }) };
    expect((await loadStrategiePersonas(fehler, { briefing: BRIEFING }, [])).size).toBe(0);
  });
});

describe('Persona-Spalte: Sichtbarkeit und Reihenfolge', () => {
  it('ist immer sichtbar, auch ohne Briefing-Personas, und lässt sich ausblenden', () => {
    const ohne = buildColumnContext({ briefing: { persona_ids: [] } }, []);
    expect(isFixedColumnVisible([], 'persona', ohne)).toBe(true);
    expect(setFixedColumnVisibility([], 'persona', false, ohne)).toEqual(['fixed:persona']);
    expect(isFixedColumnVisible(['fixed:persona'], 'persona', ohne)).toBe(false);
  });

  it('steht zwischen Produkt und Funnel-Stufe', () => {
    const keys = STRATEGIE_FIXED_COLUMNS.map(c => c.key);
    expect(keys.slice(0, 4)).toEqual(['creator', 'produkt', 'persona', 'funnel']);
  });
});

describe('Persona-Spalte in der Tabelle', () => {
  it('rendert fürs Team ein Select mit dem aktuellen Wert', () => {
    const doc = renderRow({ persona_id: 'p1' });
    const select = doc.querySelector('td.col-persona .table-select');
    expect(select.dataset.field).toBe('strategie_persona');
    expect(select.dataset.value).toBe('p1');
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('Sportler (Marco)');
    expect(select.querySelector('[data-value="offen"]').textContent).toContain('Keine Persona');
  });

  it('zeigt leer den Platzhalter', () => {
    const select = renderRow({}).querySelector('td.col-persona .table-select');
    expect(select.dataset.value).toBe('');
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('–');
  });

  it('sperrt die Persona ohne Edit-Recht (Investor) und zeigt nur den Namen', () => {
    const doc = renderRow({ persona_id: 'p1' }, { canEdit: false });
    expect(doc.querySelector('td.col-persona .table-select')).toBeNull();
    expect(doc.querySelector('td.col-persona').textContent.trim()).toBe('Sportler (Marco)');
  });

  it('der Renderer fragt die Feld-Capability', () => {
    window.permissionSystem = { canEditField: (entity, field) => field !== 'strategie_persona' };
    expect(renderRow({ persona_id: 'p1' }).querySelector('td.col-persona .table-select')).toBeNull();
  });

  it('versteckt die Spalte vor dem Kunden', () => {
    const detail = detailStub({ isKunde: true, items: [{ id: 'i1', teilbereich: 'A', persona_id: 'p1' }] });
    const doc = new DOMParser().parseFromString(renderItemsTable(detail), 'text/html');
    expect([...doc.querySelectorAll('thead th')].map(th => th.textContent.trim())).not.toContain('Persona');
  });

  it('zeigt die Spalte mit Briefing-Personas und zählt sie im colspan', () => {
    const detail = detailStub({ items: [{ id: 'i1', teilbereich: 'A' }] });
    const doc = new DOMParser().parseFromString(renderItemsTable(detail), 'text/html');
    const header = [...doc.querySelectorAll('thead th')].map(th => th.textContent.trim());
    expect(header).toContain('Persona');
    expect(Number(doc.querySelector('.category-header-cell').getAttribute('colspan'))).toBe(header.length);
  });

  it('zeigt die Spalte auch ohne Briefing-Personas, in der Reihenfolge Creator, Produkt, Persona, Funnel', () => {
    const detail = detailStub({
      strategie: { briefing: { bereich: 'paid_creator_ads', persona_ids: [] } },
      items: [{ id: 'i1', teilbereich: 'A' }]
    });
    const doc = new DOMParser().parseFromString(renderItemsTable(detail), 'text/html');
    const header = [...doc.querySelectorAll('thead th')].map(th => th.textContent.trim());
    const i = header.indexOf('Persona');
    expect(i).toBeGreaterThan(-1);
    expect(header.slice(i - 2, i + 2)).toEqual(['Creator', 'Produkt', 'Persona', 'Funnel-Stufe']);
  });
});

describe('Berechtigung strategie_persona', () => {
  it('Team darf, Kunde und Investor nicht', () => {
    const ps = new PermissionSystem();
    ps.setUserPermissions({ id: 'u', rolle: 'mitarbeiter', zugriffsrechte: null });
    expect(ps.canEditField('strategie', 'strategie_persona')).toBe(true);
    ps.setUserPermissions({ id: 'u', rolle: 'kunde', zugriffsrechte: null });
    expect(ps.canEditField('strategie', 'strategie_persona')).toBe(false);
    ps.setUserPermissions({ id: 'u', rolle: 'investor', zugriffsrechte: null });
    expect(ps.canEditField('strategie', 'strategie_persona')).toBe(false);
  });
});

describe('Anlegen einer Videoidee', () => {
  it('gibt die Persona aus dem Drawer in den Insert', () => {
    const resolved = resolveVideoideeForm({ art: 'idee', beschreibung: 'Text', personaId: 'p1' });
    expect(resolved.personaId).toBe('p1');
    const insert = buildStrategieItemInsert({
      strategieId: 's1',
      nextItem: { url: null, beschreibung: 'Text', kategorie: null, personaId: resolved.personaId },
      sortierung: 0
    });
    expect(insert.persona_id).toBe('p1');
  });

  it('lässt fehlende Persona leer', () => {
    expect(resolveVideoideeForm({ art: 'idee', beschreibung: 'Text', personaId: '' }).personaId).toBeNull();
    expect(buildStrategieItemInsert({ strategieId: 's1', nextItem: { beschreibung: 'T' }, sortierung: 0 }).persona_id).toBeUndefined();
  });

  it('gibt das Produkt aus dem Drawer als produkt_id in den Insert', () => {
    const resolved = resolveVideoideeForm({ art: 'idee', beschreibung: 'Text', produktId: 'pr1' });
    expect(resolved.produktId).toBe('pr1');
    const insert = buildStrategieItemInsert({
      strategieId: 's1',
      nextItem: { url: null, beschreibung: 'Text', kategorie: null, produktId: resolved.produktId },
      sortierung: 0
    });
    expect(insert.produkt_id).toBe('pr1');
  });

  it('lässt fehlendes Produkt leer', () => {
    expect(resolveVideoideeForm({ art: 'idee', beschreibung: 'Text', produktId: '' }).produktId).toBeNull();
    expect(buildStrategieItemInsert({ strategieId: 's1', nextItem: { beschreibung: 'T' }, sortierung: 0 }).produkt_id).toBeUndefined();
  });

  it('erlaubt die Persona an einem Videoidee-Vorschlag', () => {
    expect(VORSCHLAG_EDIT_FIELDS).toContain('persona_id');
  });
});

describe('Skript: Konzept schlägt Casting', () => {
  const item = (overrides = {}) => ({
    id: 'si-1',
    beschreibung: 'Idee',
    casting_eintrag: { id: 'ce-1', persona_id: 'p-casting' },
    strategie: { id: 'st-1' },
    ...overrides
  });

  it('nimmt die Persona der Videoidee vor der des Castings', () => {
    expect(resolveSkriptCreatePayload(item({ persona_id: 'p-konzept' })).persona_id).toBe('p-konzept');
    expect(personaIdFuerSkript(item({ persona_id: 'p-konzept' }))).toBe('p-konzept');
  });

  it('fällt bei leerer Persona auf das Casting zurück', () => {
    expect(resolveSkriptCreatePayload(item()).persona_id).toBe('p-casting');
    expect(resolveSkriptCreatePayload(item({ persona_id: null })).persona_id).toBe('p-casting');
  });

  it('bleibt ohne beides leer', () => {
    expect(resolveSkriptCreatePayload(item({ casting_eintrag: null })).persona_id).toBeNull();
    expect(personaIdFuerSkript(null)).toBeNull();
  });
});
