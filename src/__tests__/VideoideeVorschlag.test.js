import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { renderItemRow, renderItemsTable, reorderStrategieItemsByKategorien } from '../modules/strategie/StrategieDetailRenderer.js';
import {
  isVideoideeVorschlag,
  beschreibungErstzeile,
  splitVideoideeVorschlaege,
  VIDEOIDEE_VORSCHLAG_ERROR
} from '../modules/strategie/videoideeVorschlag.js';
import { truncateText, buildFreigegebeneVideoideePickerOptions } from '../modules/strategie/strategieItemPicker.js';
import { strategieService } from '../modules/strategie/StrategieService.js';
import { VideoideeVorschlagService, JOB_START_WATCHDOG_MS } from '../modules/strategie/VideoideeVorschlagService.js';

const require = createRequire(import.meta.url);
const {
  formatBeschreibung,
  validateIdeen,
  erstzeile,
  ANZAHL,
  buildPrompt,
  buildVorschlagInsert,
  normalizeIdeenJson,
  leerFehler,
  ideenDiagnose
} = require('../../netlify/functions/_shared/strategie-idee.js');
const { parseToolInput } = require('../../netlify/functions/_shared/anthropic.js');

const VOLL = { pain_point: 'x', hook: 'h', kernbotschaft: 'k', ablauf: 'a' };

function detailStub(overrides = {}) {
  return {
    isKunde: false,
    canEdit: true,
    hiddenColumns: [],
    customColumns: null,
    items: [],
    getTeilbereicheFromStrategie: () => [],
    ...overrides
  };
}

function renderRow(item, detailOverrides = {}) {
  const html = renderItemRow(detailStub(detailOverrides), { id: 'i1', ...item }, 0);
  return new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
}

beforeEach(() => {
  window.isGastReadonly = () => false;
  window.isKunde = () => false;
  window.ActionsDropdown = { getHeroIcon: () => '' };
});

describe('beschreibungErstzeile / formatBeschreibung', () => {
  it('nimmt die erste Zeile als Titel', () => {
    expect(beschreibungErstzeile('Morgens ohne Kaffee\n\nPain Point: Müde')).toBe('Morgens ohne Kaffee');
    expect(erstzeile('Morgens ohne Kaffee\nHook: x')).toBe('Morgens ohne Kaffee');
  });

  it('baut den Beschreibungsblock ohne Markdown', () => {
    const text = formatBeschreibung({
      titel: 'Morgens ohne Kaffee',
      pain_point: 'Kein Kick',
      hook: 'Ich bin 11 und fertig',
      kernbotschaft: 'Protein zum Frühstück',
      ablauf: 'Aufwachen, Mix, Trinken'
    });
    expect(text.startsWith('Morgens ohne Kaffee')).toBe(true);
    expect(text).toContain('Pain Point: Kein Kick');
    expect(text).toContain('Hook: Ich bin 11 und fertig');
    expect(text).toContain('Kernbotschaft: Protein zum Frühstück');
    expect(text).toContain('Ablauf: Aufwachen, Mix, Trinken');
  });
});

describe('validateIdeen', () => {
  it('cappt auf ANZAHL, wirft Duplikate zum Ausschluss raus', () => {
    const json = {
      ideen: [
        { titel: 'Schon da', pain_point: 'x', hook: 'h', kernbotschaft: 'k', ablauf: 'a' },
        { titel: 'Neu A', pain_point: 'x', hook: 'h', kernbotschaft: 'k', ablauf: 'a' },
        { titel: 'Neu B', pain_point: 'x', hook: 'h', kernbotschaft: 'k', ablauf: 'a' },
        { titel: '', pain_point: 'x', hook: 'h', kernbotschaft: 'k', ablauf: 'a' }
      ]
    };
    const { ideen, verworfen } = validateIdeen(json, { ausschluss: ['Schon da'], anzahl: ANZAHL });
    expect(ideen.map((i) => i.titel)).toEqual(['Neu A', 'Neu B']);
    expect(verworfen.some((v) => v.grund === 'ausschluss')).toBe(true);
    expect(verworfen.some((v) => v.grund === 'ohne_titel')).toBe(true);
    expect(ideen[0].beschreibung).toContain('Neu A');
  });

  it('schreibt Ideen ohne Link mit plattform null, nicht idea', () => {
    const row = buildVorschlagInsert({
      strategieId: 's1',
      idee: { beschreibung: 'Titel\nPain Point: x' },
      sortierung: 0,
      createdBy: 'u1'
    });
    expect(row.plattform).toBeNull();
    expect(row.video_link).toBeNull();
    expect(row.ist_vorschlag).toBe(true);
    expect(row.beschreibung_quelle).toBe('ki');
    expect(row.created_by).toBe('u1');
  });

  it('baut den Prompt mit Ausschluss und ohne Produkte', () => {
    const { stable, task } = buildPrompt({
      briefing: { bereich: 'influencer_marketing', aktivierung_name: 'Meggle Always-on' },
      produkte: [],
      personas: [],
      ausschluss: ['Alte Idee']
    });
    expect(stable).toContain('Creative Angle');
    expect(task).toContain('Alte Idee');
    expect(task).toContain('keine Produkte');
  });

  it('nimmt ideas/title statt ideen/titel', () => {
    const { ideen } = validateIdeen({
      ideas: [{ title: 'Squat zeigt den Bund', ...VOLL }]
    });
    expect(ideen.map((i) => i.titel)).toEqual(['Squat zeigt den Bund']);
  });

  it('nimmt Titel-Alias und JSON-String plus Tool-Wrapper', () => {
    const payload = {
      videoideen_abgeben: {
        ideen: [{ Titel: 'Aus dem String', ...VOLL }]
      }
    };
    const { ideen: fromString } = validateIdeen(JSON.stringify(payload));
    expect(fromString.map((i) => i.titel)).toEqual(['Aus dem String']);

    const { ideen: fromWrap } = validateIdeen(payload);
    expect(fromWrap.map((i) => i.titel)).toEqual(['Aus dem String']);
  });

  it('laesst leeres ideen-Array leer', () => {
    const { ideen, verworfen } = validateIdeen({ ideen: [] });
    expect(ideen).toEqual([]);
    expect(verworfen).toEqual([]);
    expect(leerFehler({ verworfen: [] })).toContain('leeres Array');
  });

  it('benennt ohne-Titel und Ausschluss im Fehler', () => {
    expect(leerFehler({ verworfen: [{ grund: 'ohne_titel' }] })).toContain('ohne Titel');
    expect(leerFehler({ verworfen: [{ grund: 'ausschluss', titel: 'X' }] })).toContain('alles Ausschluss');
  });
});

describe('normalizeIdeenJson / parseToolInput', () => {
  it('zieht ein Array oben und videoideen-Key', () => {
    expect(normalizeIdeenJson([{ titel: 'A' }])).toEqual([{ titel: 'A' }]);
    expect(normalizeIdeenJson({ videoideen: [{ titel: 'B' }] })).toEqual([{ titel: 'B' }]);
  });

  it('parst tool_use.input als JSON-String, sonst null', () => {
    expect(parseToolInput('{"ideen":[]}')).toEqual({ ideen: [] });
    expect(parseToolInput({ ideen: [] })).toEqual({ ideen: [] });
    expect(parseToolInput('kein json')).toBeNull();
    expect(parseToolInput('')).toBeNull();
  });

  it('packt Diagnose mit Keys und stop_reason', () => {
    const d = ideenDiagnose({ ideas: [] }, { verworfen: [{ grund: 'ohne_titel' }] }, { stop_reason: 'max_tokens' });
    expect(d.json_keys).toEqual(['ideas']);
    expect(d.stop_reason).toBe('max_tokens');
    expect(d.verworfen[0].grund).toBe('ohne_titel');
  });
});

describe('splitVideoideeVorschlaege', () => {
  it('trennt Flag-Zeilen von normalen Ideen', () => {
    const { vorschlaege, rest } = splitVideoideeVorschlaege([
      { id: 'a', ist_vorschlag: true },
      { id: 'b' },
      { id: 'c', ist_vorschlag: false }
    ]);
    expect(vorschlaege.map((i) => i.id)).toEqual(['a']);
    expect(rest.map((i) => i.id)).toEqual(['b', 'c']);
    expect(isVideoideeVorschlag({ ist_vorschlag: true })).toBe(true);
  });
});

describe('KI-Vorschlag als Tabellenzeile', () => {
  it('markiert die Zeile und bietet nur Uebernehmen/Verwerfen', () => {
    const doc = renderRow({
      ist_vorschlag: true,
      beschreibung: 'Titel\n\nPain Point: x'
    });
    const tr = doc.querySelector('tr.item-row');

    expect(tr.classList.contains('item-row--vorschlag')).toBe(true);
    expect(tr.classList.contains('draggable')).toBe(false);
    expect(tr.getAttribute('data-vorschlag-id')).toBe('i1');
    expect(doc.querySelector('[data-entity-type="videoidee_vorschlag"]')).not.toBeNull();
    expect(doc.querySelector('[data-action="uebernehmen-vorschlag"]').textContent).toContain('Übernehmen');
    expect(doc.querySelector('[data-action="verwerfen-vorschlag"]').textContent).toContain('Verwerfen');
    expect(doc.querySelector('[data-action="delete-item"]')).toBeNull();
    expect(doc.querySelector('[data-action="add-to-video"]')).toBeNull();
    expect(doc.querySelector('[data-action="toggle-skript-freigabe"]')).toBeNull();
    expect(doc.querySelector('.creator-connect-btn')).toBeNull();
    expect(doc.querySelector('.drag-handle')).toBeNull();
    expect(doc.querySelector('textarea[data-field="beschreibung"]')).not.toBeNull();
    expect(doc.querySelector('textarea[data-field="transkript"]').hasAttribute('readonly')).toBe(true);
  });

  it('laesst normale Ideen unmarkiert', () => {
    const doc = renderRow({ beschreibung: 'Normale Idee' });
    expect(doc.querySelector('tr.item-row').classList.contains('item-row--vorschlag')).toBe(false);
    expect(doc.querySelector('[data-action="delete-item"]')).not.toBeNull();
  });
});

describe('renderItemsTable – KI-Vorschläge oben', () => {
  it('setzt Flag-Zeilen in die synthetische Gruppe, Rest nach Kategorie', () => {
    const html = renderItemsTable(detailStub({
      items: [
        { id: 'n1', teilbereich: 'Hooks', beschreibung: 'Echt' },
        { id: 'v1', ist_vorschlag: true, beschreibung: 'KI' }
      ],
      getTeilbereicheFromStrategie: () => ['Hooks']
    }));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const gruppen = [...doc.querySelectorAll('.category-name')].map((el) => el.textContent.trim());
    expect(gruppen[0]).toBe('KI-Vorschläge');
    expect(gruppen).toContain('Hooks');
    expect(doc.querySelector('[data-vorschlag-group="true"]')).not.toBeNull();
    expect(doc.querySelector('tr.item-row--vorschlag')).not.toBeNull();
  });
});

describe('reorderStrategieItemsByKategorien mit Vorschlaegen', () => {
  it('behaelt Vorschlaege vorne', () => {
    const items = [
      { id: 'v1', ist_vorschlag: true, teilbereich: null },
      { id: 'a1', teilbereich: 'A' },
      { id: 'b1', teilbereich: 'B' }
    ];
    const reordered = reorderStrategieItemsByKategorien(items, ['B', 'A']);
    expect(reordered.map((i) => i.id)).toEqual(['v1', 'b1', 'a1']);
  });
});

describe('Picker', () => {
  it('nutzt die Erstzeile als Label', () => {
    expect(truncateText('Titelzeile\n\nPain Point: lang')).toBe('Titelzeile');
  });

  it('laesst Videoidee-Vorschlaege nicht in den Skript-Picker', () => {
    const opts = buildFreigegebeneVideoideePickerOptions([
      {
        id: 'ok',
        beschreibung: 'Freigegeben',
        skript_freigabe: true,
        nicht_umsetzen: false,
        ist_vorschlag: false,
        strategie: { name: 'K1' }
      },
      {
        id: 'v',
        beschreibung: 'Noch Vorschlag',
        skript_freigabe: true,
        nicht_umsetzen: false,
        ist_vorschlag: true,
        strategie: { name: 'K1' }
      }
    ]);
    expect(opts.map((o) => o.value)).toEqual(['ok']);
  });
});

describe('StrategieService Gates', () => {
  afterEach(() => {
    delete window.supabase;
    window.isKunde = () => false;
  });

  function thenable(result) {
    const q = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(result),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
    };
    return q;
  }

  it('blendet Vorschlaege fuer Kunden aus', async () => {
    window.isKunde = () => true;
    const q = thenable({ data: [], error: null });
    window.supabase = { from: vi.fn(() => q) };
    await strategieService.getStrategieItems('s1');
    expect(q.eq).toHaveBeenCalledWith('ist_vorschlag', false);
  });

  it('blockt Skript-Freigabe am Vorschlag', async () => {
    const q = thenable({
      data: { id: 'i1', creator_auswahl_item_id: 'c1', nicht_umsetzen: false, ist_vorschlag: true },
      error: null
    });
    window.supabase = { from: vi.fn(() => q) };
    await expect(strategieService.setSkriptFreigabe('i1', true))
      .rejects.toThrow(VIDEOIDEE_VORSCHLAG_ERROR);
  });

  it('blockt Casting-Zuordnung am Vorschlag', async () => {
    const q = thenable({
      data: { id: 'i1', strategie_id: 's1', creator_auswahl_item_id: null, ist_vorschlag: true },
      error: null
    });
    window.supabase = { from: vi.fn(() => q) };
    await expect(strategieService.assignCastingItem('i1', 'eintrag'))
      .rejects.toThrow(VIDEOIDEE_VORSCHLAG_ERROR);
  });
});

describe('VideoideeVorschlagService.starteJob', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete window.supabase;
  });

  it('bricht ab, wenn der Job pending bleibt und nie startet', async () => {
    vi.useFakeTimers();
    const jobs = {
      insert() { return this; },
      select() { return this; },
      eq() { return this; },
      single: vi.fn().mockResolvedValue({ data: { id: 'job-1' }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { status: 'pending', progress_step: null, progress_steps: [], result: null, error_message: null },
        error: null
      })
    };
    window.supabase = {
      from: vi.fn(() => jobs),
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok', user: { id: 'u1' } } } }) }
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 202, ok: true }));

    const pending = expect(VideoideeVorschlagService.starteJob({ strategieId: 's1' }))
      .rejects.toThrow('Die Generierung ist nicht angelaufen');
    await vi.advanceTimersByTimeAsync(JOB_START_WATCHDOG_MS + 2000);
    await pending;
  });
});
