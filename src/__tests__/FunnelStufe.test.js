import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import {
  STRATEGIE_FUNNEL_OPTIONS,
  buildStrategieFunnelUpdates,
  briefingEinzigeFunnelStufe,
  briefingFunnelStufen,
  funnelAbweichungsHinweis,
  funnelFuerSkript,
  funnelSpalteStandardSichtbar,
  getStrategieFunnel,
  isStrategieFunnel,
  renderFunnelBadge
} from '../modules/strategie/strategieFunnelOptions.js';
import { buildColumnContext, isFixedColumnVisible, setFixedColumnVisibility } from '../modules/strategie/strategieColumns.js';
import { renderItemRow, renderItemsTable } from '../modules/strategie/StrategieDetailRenderer.js';
import { buildStrategieItemInsert, resolveVideoideeForm } from '../modules/strategie/addItemPayload.js';
import { funnelWarnung, resolveSkriptCreatePayload } from '../modules/skripte/skriptCreateKontext.js';
import { PermissionSystem } from '../core/PermissionSystem.js';

const require = createRequire(import.meta.url);
const {
  briefingFunnelStufen: serverStufen,
  konzeptTool,
  validateIdeen,
  buildPrompt,
  buildVorschlagInsert
} = require('../../netlify/functions/_shared/strategie-idee.js');
const { fmtCampaignBriefing } = require('../../netlify/functions/_shared/skript-context/briefing-felder.js');
const { buildKontextText } = require('../../netlify/functions/_shared/skript-context.js');

const PAID = (stufen) => ({ bereich: 'paid_creator_ads', pa_funnel_stufen: stufen });

function detailStub(overrides = {}) {
  return {
    isKunde: false,
    canEdit: true,
    hiddenColumns: [],
    customColumns: null,
    items: [],
    strategie: { briefing: PAID(['mid']) },
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

describe('Funnel-Optionen', () => {
  it('kennt Upper, Mid, Lower und "Keine Stufe"', () => {
    expect(STRATEGIE_FUNNEL_OPTIONS.map(o => o.value)).toEqual(['offen', 'upper', 'mid', 'lower']);
    expect(isStrategieFunnel('upper')).toBe(true);
    expect(isStrategieFunnel('offen')).toBe(true);
    expect(isStrategieFunnel('top')).toBe(false);
  });

  it('leert die Stufe mit "Keine Stufe" und speichert sonst den Wert', () => {
    expect(buildStrategieFunnelUpdates('mid')).toEqual({ funnel_stufe: 'mid' });
    expect(buildStrategieFunnelUpdates('offen')).toEqual({ funnel_stufe: null });
    expect(buildStrategieFunnelUpdates('quatsch')).toEqual({ funnel_stufe: null });
  });

  it('zeigt leer als Platzhalter-Wert, nie als "offen"', () => {
    expect(getStrategieFunnel({})).toBe('');
    expect(getStrategieFunnel({ funnel_stufe: 'lower' })).toBe('lower');
    expect(getStrategieFunnel({ funnel_stufe: 'top' })).toBe('');
  });

  it('uebersetzt fuers Skript upper/mid/lower nach top/mid/bottom', () => {
    expect(funnelFuerSkript('upper')).toBe('top');
    expect(funnelFuerSkript('mid')).toBe('mid');
    expect(funnelFuerSkript('lower')).toBe('bottom');
    expect(funnelFuerSkript(null)).toBeNull();
  });

  it('rendert den Badge im Tag-Stil, leer als Gedankenstrich', () => {
    expect(renderFunnelBadge('upper')).toContain('status-badge');
    expect(renderFunnelBadge('upper')).toContain('Upper Funnel');
    expect(renderFunnelBadge(null)).toBe('–');
  });
});

describe('Briefing-Stufen', () => {
  it('liest die Stufen nach Bereich, ohne Doppelte und Unbekannte', () => {
    expect(briefingFunnelStufen(PAID(['upper', 'mid', 'mid', 'quatsch']))).toEqual(['upper', 'mid']);
    expect(briefingFunnelStufen({ bereich: 'owned_social', pa_funnel_stufen: ['upper'] })).toEqual([]);
    expect(briefingFunnelStufen(null)).toEqual([]);
  });

  it('faellt bei Paid auf die Quellspalte funnel_stufen zurueck', () => {
    expect(briefingFunnelStufen({ bereich: 'paid_creator_ads', funnel_stufen: ['lower'] })).toEqual(['lower']);
  });

  it('liefert die Vorbelegung nur bei genau einer Stufe', () => {
    expect(briefingEinzigeFunnelStufe(PAID(['mid']))).toBe('mid');
    expect(briefingEinzigeFunnelStufe(PAID(['mid', 'lower']))).toBeNull();
    expect(briefingEinzigeFunnelStufe(PAID([]))).toBeNull();
  });

  it('Server und Client lesen dieselben Stufen', () => {
    const briefing = PAID(['lower', 'upper']);
    expect(serverStufen(briefing)).toEqual(briefingFunnelStufen(briefing));
  });
});

describe('Spaltendefault der Funnel-Stufe', () => {
  it('ist in Paid-Linien sichtbar, sonst aus', () => {
    const paid = { briefing: PAID([]) };
    const organic = { briefing: { bereich: 'owned_social' } };
    expect(isFixedColumnVisible([], 'funnel', buildColumnContext(paid, []))).toBe(true);
    expect(isFixedColumnVisible([], 'funnel', buildColumnContext(organic, []))).toBe(false);
    expect(isFixedColumnVisible([], 'funnel')).toBe(false);
  });

  it('ist auch ohne Briefing-Zugriff sichtbar, sobald eine Zeile eine Stufe hat', () => {
    expect(funnelSpalteStandardSichtbar(null, [{ funnel_stufe: 'mid' }])).toBe(true);
    expect(funnelSpalteStandardSichtbar(null, [{ funnel_stufe: null }])).toBe(false);
  });

  it('laesst sich in Organic zuschalten und in Paid ausblenden', () => {
    const organic = buildColumnContext({ briefing: { bereich: 'owned_social' } }, []);
    const an = setFixedColumnVisibility([], 'funnel', true, organic);
    expect(an).toEqual(['show:fixed:funnel']);
    expect(isFixedColumnVisible(an, 'funnel', organic)).toBe(true);

    const paid = buildColumnContext({ briefing: PAID([]) }, []);
    const aus = setFixedColumnVisibility([], 'funnel', false, paid);
    expect(aus).toEqual(['fixed:funnel']);
    expect(isFixedColumnVisible(aus, 'funnel', paid)).toBe(false);
  });

  it('beruehrt die anderen festen Spalten nicht', () => {
    expect(isFixedColumnVisible([], 'prio')).toBe(true);
    expect(setFixedColumnVisibility([], 'prio', false)).toEqual(['fixed:prio']);
  });
});

describe('Funnel-Spalte in der Tabelle', () => {
  it('rendert fuers Team ein Select mit dem aktuellen Wert', () => {
    const doc = renderRow({ funnel_stufe: 'lower' });
    const select = doc.querySelector('td.col-funnel .table-select');
    expect(select.dataset.field).toBe('strategie_funnel');
    expect(select.dataset.value).toBe('lower');
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('Lower Funnel');
  });

  it('zeigt leer den Platzhalter, mit der Option "Keine Stufe" zum Leeren', () => {
    const doc = renderRow({});
    const select = doc.querySelector('td.col-funnel .table-select');
    expect(select.dataset.value).toBe('');
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('–');
    expect(select.querySelector('[data-value="offen"]').textContent).toContain('Keine Stufe');
  });

  it('zeigt dem Kunden nur den Badge, ohne Select', () => {
    const doc = renderRow({ funnel_stufe: 'mid' }, { isKunde: true });
    const zelle = doc.querySelector('td.col-funnel');
    expect(zelle.querySelector('.table-select')).toBeNull();
    expect(zelle.querySelector('.status-badge').textContent).toBe('Mid Funnel');
  });

  it('zeigt dem Kunden leer einen Gedankenstrich', () => {
    const doc = renderRow({}, { isKunde: true });
    expect(doc.querySelector('td.col-funnel').textContent.trim()).toBe('–');
  });

  it('sperrt die Stufe ohne Edit-Recht (Investor) wie den Kunden', () => {
    const doc = renderRow({ funnel_stufe: 'upper' }, { canEdit: false });
    expect(doc.querySelector('td.col-funnel .table-select')).toBeNull();
    expect(doc.querySelector('td.col-funnel .status-badge')).toBeTruthy();
  });

  it('laesst ein Team die Stufe eines Videoidee-Vorschlags setzen', () => {
    const doc = renderRow({ ist_vorschlag: true, funnel_stufe: 'mid' });
    expect(doc.querySelector('td.col-funnel button.table-select__trigger')).not.toBeNull();
  });

  it('blendet die Spalte in Organic-Linien aus, solange keine Zeile eine Stufe hat', () => {
    const detail = detailStub({
      strategie: { briefing: { bereich: 'owned_social' } },
      items: [{ id: 'i1', teilbereich: 'A' }]
    });
    const doc = new DOMParser().parseFromString(renderItemsTable(detail), 'text/html');
    expect([...doc.querySelectorAll('thead th')].map(th => th.textContent.trim())).not.toContain('Funnel-Stufe');
  });

  it('zeigt die Spalte in Paid-Linien und zaehlt sie im colspan', () => {
    const detail = detailStub({ items: [{ id: 'i1', teilbereich: 'A' }] });
    const doc = new DOMParser().parseFromString(renderItemsTable(detail), 'text/html');
    const header = [...doc.querySelectorAll('thead th')].map(th => th.textContent.trim());
    expect(header).toContain('Funnel-Stufe');
    expect(Number(doc.querySelector('.category-header-cell').getAttribute('colspan'))).toBe(header.length);
  });
});

describe('Berechtigung strategie_funnel', () => {
  it('Team darf, Kunde und Investor nicht', () => {
    const ps = new PermissionSystem();
    ps.setUserPermissions({ id: 'u', rolle: 'mitarbeiter', zugriffsrechte: null });
    expect(ps.canEditField('strategie', 'strategie_funnel')).toBe(true);
    ps.setUserPermissions({ id: 'u', rolle: 'kunde', zugriffsrechte: null });
    expect(ps.canEditField('strategie', 'strategie_funnel')).toBe(false);
    expect(ps.canEditField('strategie', 'strategie_prio')).toBe(true);
    ps.setUserPermissions({ id: 'u', rolle: 'investor', zugriffsrechte: null });
    expect(ps.canEditField('strategie', 'strategie_funnel')).toBe(false);
  });

  it('der Renderer fragt die Feld-Capability', () => {
    window.permissionSystem = { canEditField: (entity, field) => field !== 'strategie_funnel' };
    const doc = renderRow({ funnel_stufe: 'mid' });
    expect(doc.querySelector('td.col-funnel .table-select')).toBeNull();
    expect(doc.querySelector('td.col-funnel .status-badge')).toBeTruthy();
  });
});

describe('Anlegen einer Videoidee', () => {
  it('gibt die Stufe aus dem Drawer in den Insert', () => {
    const resolved = resolveVideoideeForm({ art: 'idee', beschreibung: 'Text', funnelStufe: 'mid' });
    expect(resolved.funnelStufe).toBe('mid');
    const insert = buildStrategieItemInsert({
      strategieId: 's1',
      nextItem: { url: null, beschreibung: 'Text', kategorie: null, funnelStufe: resolved.funnelStufe },
      sortierung: 0
    });
    expect(insert.funnel_stufe).toBe('mid');
  });

  it('laesst unbekannte oder fehlende Stufen leer', () => {
    expect(resolveVideoideeForm({ art: 'idee', beschreibung: 'Text', funnelStufe: 'top' }).funnelStufe).toBeNull();
    expect(buildStrategieItemInsert({ strategieId: 's1', nextItem: { beschreibung: 'T' }, sortierung: 0 }).funnel_stufe).toBeUndefined();
  });
});

describe('Skript-Anlage: Konzept schlaegt Briefing', () => {
  const item = (overrides = {}) => ({
    id: 'si-1',
    beschreibung: 'Idee',
    strategie: { briefing: { id: 'br', bereich: 'paid_creator_ads', pa_funnel_stufen: ['upper'] } },
    ...overrides
  });

  it('kopiert die Stufe der Videoidee im Skript-Vokabular', () => {
    expect(resolveSkriptCreatePayload(item({ funnel_stufe: 'lower' })).funnel_stufe).toBe('bottom');
  });

  it('liest bei leerer Stufe das Briefing nicht', () => {
    expect(resolveSkriptCreatePayload(item()).funnel_stufe).toBeNull();
  });

  it('warnt bei Paid ohne Stufe, sonst nicht', () => {
    expect(funnelWarnung(item())).toContain('keine Funnel-Stufe');
    expect(funnelWarnung(item({ funnel_stufe: 'mid' }))).toBe('');
    expect(funnelWarnung(item({ strategie: { briefing: { bereich: 'owned_social' } } }))).toBe('');
    expect(funnelWarnung(null)).toBe('');
  });
});

describe('Hinweis bei Abweichung im Skript-Editor', () => {
  it('schweigt, solange Konzept und Skript uebereinstimmen', () => {
    expect(funnelAbweichungsHinweis({ funnel_stufe: 'mid', strategie_item: { funnel_stufe: 'mid' } })).toBe('');
    expect(funnelAbweichungsHinweis({ funnel_stufe: null, strategie_item: { funnel_stufe: null } })).toBe('');
  });

  it('nennt beide Stufen bei einer Abweichung', () => {
    const text = funnelAbweichungsHinweis({ funnel_stufe: 'top', strategie_item: { funnel_stufe: 'lower' } });
    expect(text).toContain('Lower Funnel');
    expect(text).toContain('Upper Funnel');
  });

  it('meldet auch eine im Konzept geleerte Stufe', () => {
    expect(funnelAbweichungsHinweis({ funnel_stufe: 'mid', strategie_item: { funnel_stufe: null } }))
      .toContain('keine Stufe');
  });

  it('weist bei Paid mit Videolänge darauf hin, dass sie zur damaligen Stufe gehört', () => {
    const text = funnelAbweichungsHinweis({
      bereich: 'paid_creator_ads', video_laenge: '6-10', funnel_stufe: 'top', strategie_item: { funnel_stufe: 'lower' }
    });
    expect(text).toContain('Videolänge');
    expect(funnelAbweichungsHinweis({
      bereich: 'owned_social', video_laenge: '6-10', funnel_stufe: 'top', strategie_item: { funnel_stufe: 'lower' }
    })).not.toContain('Videolänge');
  });

  it('schweigt ohne geladenes Konzept', () => {
    expect(funnelAbweichungsHinweis({ funnel_stufe: 'mid' })).toBe('');
    expect(funnelAbweichungsHinweis({ funnel_stufe: 'mid', strategie_item: { id: 'x' } })).toBe('');
  });
});

describe('Prompt ohne Briefing-Funnel', () => {
  const BRIEFING = {
    bereich: 'paid_creator_ads',
    aktivierung_name: 'Sommer',
    pa_funnel_stufen: ['upper', 'mid'],
    pa_umsetzung: 'Produkt zeigen'
  };

  it('fmtCampaignBriefing zeigt die Stufen standardmaessig, mit ohneFunnel nicht', () => {
    expect(fmtCampaignBriefing(BRIEFING)).toContain('Funnel-Stufe');
    const ohne = fmtCampaignBriefing(BRIEFING, { ohneFunnel: true });
    expect(ohne).not.toContain('Funnel-Stufe');
    expect(ohne).toContain('Produkt zeigen');
  });

  it('der Skript-Kontext nimmt die Stufe nur aus den Vorgaben fuer das Video', () => {
    const mitKonzept = buildKontextText({ briefing: BRIEFING }, { video_idee: 'x', funnel_stufe: 'bottom' });
    expect(mitKonzept).not.toContain('Upper Funnel – Awareness\n');
    expect(mitKonzept).not.toMatch(/- Funnel-Stufe:/);
    expect(mitKonzept).toContain('Lower Funnel – Conversion (bottom)');

    const leer = buildKontextText({ briefing: BRIEFING }, { video_idee: 'x', funnel_stufe: null });
    expect(leer).not.toMatch(/Funnel/);
  });
});

describe('Liky-Vorschlaege mit Funnel-Stufe', () => {
  const idee = (titel, funnel_stufe) => ({
    titel, pain_point: 'p', hook: 'h', kernbotschaft: 'k', ablauf: 'a', funnel_stufe
  });

  it('das Tool kennt die Stufe nur mit Briefing-Stufen, als Enum', () => {
    const ohne = konzeptTool(3).input_schema.properties.ideen.items;
    expect(ohne.properties.funnel_stufe).toBeUndefined();

    const mit = konzeptTool(3, ['mid', 'lower']).input_schema.properties.ideen.items;
    expect(mit.properties.funnel_stufe.enum).toEqual(['mid', 'lower']);
    expect(mit.required).toContain('funnel_stufe');
  });

  it('der Prompt verlangt bei mehreren Stufen eine Verteilung', () => {
    const { task } = buildPrompt({ briefing: PAID(['mid', 'lower']), produkte: [], personas: [], ausschluss: [], anzahl: 4 });
    expect(task).toContain('Funnel-Stufen im Briefing');
    expect(task).toContain('jede Stufe kommt vor');
  });

  it('der Prompt setzt bei einer Stufe diese fuer alle Ideen', () => {
    const { task } = buildPrompt({ briefing: PAID(['mid']), produkte: [], personas: [], ausschluss: [], anzahl: 2 });
    expect(task).toContain('Setze funnel_stufe bei jeder Idee auf mid');
  });

  it('der Prompt schweigt ohne Briefing-Stufen', () => {
    const { task } = buildPrompt({ briefing: { bereich: 'owned_social' }, produkte: [], personas: [], ausschluss: [], anzahl: 2 });
    expect(task).not.toContain('Funnel-Stufe');
  });

  it('validateIdeen behaelt nur Stufen aus dem Briefing', () => {
    const { ideen } = validateIdeen({
      ideen: [idee('A', 'mid'), idee('B', 'upper'), idee('C', 'quatsch')]
    }, { stufen: ['mid', 'lower'] });
    expect(ideen.map(i => i.funnel_stufe)).toEqual(['mid', null, null]);
  });

  it('bei genau einer Briefing-Stufe gilt sie auch ohne Angabe', () => {
    const { ideen } = validateIdeen({ ideen: [idee('A', undefined)] }, { stufen: ['lower'] });
    expect(ideen[0].funnel_stufe).toBe('lower');
  });

  it('ohne Briefing-Stufen bleibt die Stufe leer', () => {
    const { ideen } = validateIdeen({ ideen: [idee('A', 'mid')] });
    expect(ideen[0].funnel_stufe).toBeNull();
  });

  it('der Insert traegt die Stufe nur, wenn sie gesetzt ist', () => {
    const mit = buildVorschlagInsert({ strategieId: 's', idee: { beschreibung: 'T', funnel_stufe: 'mid' }, sortierung: 0, createdBy: null });
    expect(mit.funnel_stufe).toBe('mid');
    const ohne = buildVorschlagInsert({ strategieId: 's', idee: { beschreibung: 'T', funnel_stufe: null }, sortierung: 0, createdBy: null });
    expect('funnel_stufe' in ohne).toBe(false);
  });
});
