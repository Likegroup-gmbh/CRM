import { describe, it, expect, beforeEach, vi } from 'vitest';
import { duplicateBriefing, duplicateBriefingMitHinweis, listKopierQuellen } from '../modules/briefing/duplicateBriefing.js';
import { freierTitel, kopieTitel } from '../modules/produktion/produktionNames.js';
import { ActionConfigs } from '../core/actions/ActionConfig.js';
import { GLOBAL_ACTIONS } from '../core/ActionsDropdownHandlers.js';

function memoryDb() {
  const rows = {
    produktion: [],
    campaign_briefings: [],
    creator_auswahl: [],
    strategie: [],
    skripte: [],
    kooperationen: [],
    kundenbriefings: [],
    campaign_briefing_produkt: []
  };
  let seq = 1;

  // Embed-Filter wie `produktion.kampagne_id`: Wert aus der verknüpften Produktion lesen
  function readCol(row, col) {
    if (!col.includes('.')) return row[col];
    const [relation, field] = col.split('.');
    const related = relation === 'produktion' ? rows.produktion.find(p => p.id === row.produktion_id) : null;
    return related?.[field];
  }

  function matchesFilter(row, col, val) {
    if (val && typeof val === 'object' && val.op === 'ilike') {
      const pattern = String(val.val).replace(/\\([\\%_])/g, '$1').replace(/^%|%$/g, '').toLowerCase();
      return String(readCol(row, col) || '').toLowerCase().includes(pattern);
    }
    if (col.includes('.')) return readCol(row, col) === val;
    if (val && typeof val === 'object' && val.op === 'is') {
      const isNull = row[col] == null;
      const matches = val.val === null ? isNull : !isNull;
      return val.not ? !matches : matches;
    }
    if (val && typeof val === 'object' && val.op === 'neq') return row[col] !== val.val;
    return row[col] === val;
  }

  const match = (table, filters) =>
    (rows[table] || []).filter(row => filters.every(([col, val]) => matchesFilter(row, col, val)));

  function from(table) {
    const state = { filters: [], op: 'select', insertRow: null, patch: null };
    const query = {
      select: () => query,
      eq: (col, val) => { state.filters.push([col, val]); return query; },
      not: (col, op, val) => { state.filters.push([col, { op, val, not: true }]); return query; },
      is: (col, val) => { state.filters.push([col, { op: 'is', val }]); return query; },
      neq: (col, val) => { state.filters.push([col, { op: 'neq', val }]); return query; },
      limit: () => query,
      order: () => query,
      ilike: (col, pattern) => { state.filters.push([col, { op: 'ilike', val: pattern }]); return query; },
      insert: (row) => { state.op = 'insert'; state.insertRow = row; return query; },
      update: (patch) => { state.op = 'update'; state.patch = patch; return query; },
      delete: () => { state.op = 'delete'; return query; },
      maybeSingle: async () => ({ data: match(table, state.filters)[0] || null, error: null }),
      single: async () => {
        if (state.op === 'insert') {
          const row = {
            id: `${table}-${seq++}`,
            strategie_id: null,
            creator_auswahl_id: null,
            hidden_columns: [],
            created_at: 'jetzt',
            updated_at: 'jetzt',
            ...state.insertRow
          };
          rows[table].push(row);
          return { data: row, error: null };
        }
        return { data: match(table, state.filters)[0] || null, error: null };
      },
      then: (resolve, reject) => {
        if (state.op === 'insert') {
          const list = Array.isArray(state.insertRow) ? state.insertRow : [state.insertRow];
          for (const row of list) {
            rows[table].push({
              id: `${table}-${seq++}`,
              strategie_id: null,
              creator_auswahl_id: null,
              hidden_columns: [],
              ...row
            });
          }
        } else if (state.op === 'update') {
          for (const row of match(table, state.filters)) Object.assign(row, state.patch);
        } else if (state.op === 'delete') {
          rows[table] = rows[table].filter(row => !state.filters.every(([col, val]) => row[col] === val));
        }
        let selected = state.op === 'select' ? match(table, state.filters) : [];
        if (table === 'campaign_briefings') {
          selected = selected.map(row => ({
            ...row,
            produktion: rows.produktion.find(p => p.id === row.produktion_id) || null
          }));
        }
        return Promise.resolve({ data: selected, count: selected.length, error: null }).then(resolve, reject);
      }
    };
    return query;
  }

  return { from, rows };
}

const quelle = {
  id: 'brief-1',
  produktion_id: 'prod-1',
  kampagne_id: 'kamp-1',
  unternehmen_id: 'u1',
  marke_id: 'm1',
  assignee_id: 'mitarbeiter-1',
  bereich: 'influencer_marketing',
  is_draft: false,
  aktivierung_name: 'Serum September',
  beschreibung: 'Neues Serum',
  persona_ids: ['p1', 'p2'],
  produkt_id: 'serum',
  tkp: 40,
  videolaenge_von: 15,
  videolaenge_bis: 20,
  created_at: 'gestern',
  updated_at: 'gestern'
};

describe('kopieTitel', () => {
  it('hängt „Kopie“ an den Titel', () => {
    expect(kopieTitel('Serum September')).toBe('Serum September – Kopie');
  });

  it('zählt hoch, wenn der Titel schon belegt ist', () => {
    const vorhanden = ['Serum September', 'Serum September – Kopie'];
    expect(kopieTitel('Serum September', vorhanden)).toBe('Serum September – Kopie 2');
    expect(kopieTitel('Serum September', [...vorhanden, 'Serum September – Kopie 2']))
      .toBe('Serum September – Kopie 3');
  });

  it('stapelt bei einer Kopie der Kopie nicht', () => {
    expect(kopieTitel('Serum September – Kopie', ['Serum September – Kopie']))
      .toBe('Serum September – Kopie 2');
    expect(kopieTitel('Serum September – Kopie 2', ['Serum September – Kopie', 'Serum September – Kopie 2']))
      .toBe('Serum September – Kopie 3');
  });

  it('vergleicht ohne Groß-/Kleinschreibung und Leerraum', () => {
    expect(kopieTitel('Serum', ['  serum – kopie '])).toBe('Serum – Kopie 2');
  });

  it('kommt mit leerem Titel und leerer Liste zurecht', () => {
    expect(kopieTitel(null, null)).toBe('Kopie');
  });
});

describe('duplicateBriefing', () => {
  let db;

  beforeEach(() => {
    db = memoryDb();
    db.rows.produktion.push({ id: 'prod-1', kampagne_id: 'kamp-1', name: 'Serum September' });
    db.rows.campaign_briefings.push({ ...quelle });
    db.rows.campaign_briefing_produkt.push(
      { briefing_id: 'brief-1', produkt_id: 'serum' },
      { briefing_id: 'brief-1', produkt_id: 'creme' }
    );
    db.rows.kundenbriefings.push({ id: 'kb-1', briefing_id: 'brief-1' });
    window.supabase = { from: db.from };
    window.currentUser = { id: 'user-1' };
  });

  it('legt eine neue Zeile in derselben Produktion und Kampagne an', async () => {
    const kopie = await duplicateBriefing('brief-1');

    expect(db.rows.campaign_briefings).toHaveLength(2);
    expect(kopie.id).not.toBe('brief-1');
    expect(kopie).toMatchObject({
      produktion_id: 'prod-1',
      kampagne_id: 'kamp-1',
      aktivierung_name: 'Serum September – Kopie',
      unternehmen_id: 'u1',
      marke_id: 'm1',
      assignee_id: 'mitarbeiter-1',
      bereich: 'influencer_marketing',
      beschreibung: 'Neues Serum',
      persona_ids: ['p1', 'p2'],
      tkp: 40,
      videolaenge_von: 15,
      videolaenge_bis: 20,
      is_draft: false
    });
    expect(kopie.created_at).not.toBe('gestern');
    expect(db.rows.campaign_briefings[0]).toMatchObject({ id: 'brief-1', aktivierung_name: 'Serum September' });
  });

  it('verknüpft dieselben Produkte, ohne Produkte zu kopieren', async () => {
    const kopie = await duplicateBriefing('brief-1');

    const links = db.rows.campaign_briefing_produkt.filter(r => r.briefing_id === kopie.id);
    expect(links.map(r => r.produkt_id).sort()).toEqual(['creme', 'serum']);
    expect(db.rows.campaign_briefing_produkt.filter(r => r.briefing_id === 'brief-1')).toHaveLength(2);
  });

  it('nimmt Liky-Daten, Casting, Konzept und Skripte der Quelle nicht mit', async () => {
    db.rows.creator_auswahl.push({ id: 'alt-casting', briefing_id: 'brief-1', produktion_id: 'prod-1', hidden_columns: [] });
    db.rows.strategie.push({ id: 'alt-konzept', briefing_id: 'brief-1', produktion_id: 'prod-1' });
    db.rows.skripte.push({ id: 'skript-1', briefing_id: 'brief-1' });

    const kopie = await duplicateBriefing('brief-1');

    expect(db.rows.kundenbriefings.map(r => r.briefing_id)).toEqual(['brief-1']);
    expect(db.rows.skripte.map(r => r.briefing_id)).toEqual(['brief-1']);
    expect(db.rows.creator_auswahl.find(r => r.id === 'alt-casting').briefing_id).toBe('brief-1');
    expect(db.rows.strategie.find(r => r.id === 'alt-konzept').briefing_id).toBe('brief-1');

    // Die Kopie hat eigenes, leeres Casting und Konzept
    const casting = db.rows.creator_auswahl.filter(r => r.briefing_id === kopie.id);
    const konzept = db.rows.strategie.filter(r => r.briefing_id === kopie.id);
    expect(casting).toHaveLength(1);
    expect(konzept).toHaveLength(1);
    expect(casting[0].id).not.toBe('alt-casting');
    expect(casting[0].name).toBe('Serum September – Kopie Casting');
    expect(konzept[0].name).toBe('Serum September – Kopie Konzept');
  });

  it('startet für ein finalisiertes Briefing die Linie mit Casting und Konzept', async () => {
    const kopie = await duplicateBriefing('brief-1');

    const casting = db.rows.creator_auswahl.filter(r => r.briefing_id === kopie.id);
    const konzept = db.rows.strategie.filter(r => r.briefing_id === kopie.id);
    expect(casting).toHaveLength(1);
    expect(konzept).toHaveLength(1);
    expect(casting[0].strategie_id).toBe(konzept[0].id);
    // Der Produktionsname bleibt, weil schon ein finalisiertes Briefing existiert
    expect(db.rows.produktion[0].name).toBe('Serum September');
  });

  it('lässt einen Entwurf einen Entwurf bleiben, ohne Casting und Konzept', async () => {
    db.rows.campaign_briefings[0].is_draft = true;

    const kopie = await duplicateBriefing('brief-1');

    expect(kopie.is_draft).toBe(true);
    expect(db.rows.creator_auswahl).toHaveLength(0);
    expect(db.rows.strategie).toHaveLength(0);
    expect(db.rows.campaign_briefing_produkt.filter(r => r.briefing_id === kopie.id)).toHaveLength(2);
  });

  it('zählt den Titel bei weiteren Kopien hoch', async () => {
    const erste = await duplicateBriefing('brief-1');
    const zweite = await duplicateBriefing('brief-1');
    const dritte = await duplicateBriefing(erste.id);

    expect(erste.aktivierung_name).toBe('Serum September – Kopie');
    expect(zweite.aktivierung_name).toBe('Serum September – Kopie 2');
    expect(dritte.aktivierung_name).toBe('Serum September – Kopie 3');
  });

  it('nimmt die Kampagne aus der Produktion, wenn das Briefing keine trägt', async () => {
    db.rows.campaign_briefings[0].kampagne_id = null;

    const kopie = await duplicateBriefing('brief-1');

    expect(kopie.kampagne_id).toBe('kamp-1');
  });

  it('lehnt ein Briefing ohne Produktion ab', async () => {
    db.rows.campaign_briefings[0].produktion_id = null;

    await expect(duplicateBriefing('brief-1')).rejects.toThrow('Produktion');
    expect(db.rows.campaign_briefings).toHaveLength(1);
  });

  it('lehnt ein unbekanntes Briefing ab', async () => {
    await expect(duplicateBriefing('gibt-es-nicht')).rejects.toThrow('Briefing nicht gefunden');
  });

  it('räumt die halbe Kopie auf, wenn ein Schritt danach scheitert', async () => {
    db.rows.campaign_briefing_produkt.push({ briefing_id: 'brief-1', produkt_id: 'serum' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.supabase = {
      from: (table) => {
        const query = db.from(table);
        if (table === 'campaign_briefing_produkt') {
          query.insert = () => ({
            then: (resolve, reject) => Promise.resolve({ data: null, error: new Error('Verknüpfung kaputt') }).then(resolve, reject)
          });
        }
        return query;
      }
    };

    await expect(duplicateBriefing('brief-1')).rejects.toThrow('Verknüpfung kaputt');

    expect(db.rows.campaign_briefings.map(r => r.id)).toEqual(['brief-1']);
    expect(db.rows.creator_auswahl).toHaveLength(0);
    expect(db.rows.strategie).toHaveLength(0);
  });

  describe('in eine andere Produktion', () => {
    beforeEach(() => {
      db.rows.produktion.push(
        { id: 'prod-2', kampagne_id: 'kamp-1', name: 'Serum – Produktion 2' },
        { id: 'prod-fremd', kampagne_id: 'kamp-2', name: 'Fremde Produktion' }
      );
    });

    it('legt die Kopie in der Ziel-Produktion derselben Kampagne an', async () => {
      const kopie = await duplicateBriefing('brief-1', { produktionId: 'prod-2' });

      expect(kopie).toMatchObject({ produktion_id: 'prod-2', kampagne_id: 'kamp-1' });
      expect(db.rows.campaign_briefings.find(r => r.id === 'brief-1').produktion_id).toBe('prod-1');
      expect(db.rows.creator_auswahl.filter(r => r.briefing_id === kopie.id)[0].produktion_id).toBe('prod-2');
      expect(db.rows.strategie.filter(r => r.briefing_id === kopie.id)[0].produktion_id).toBe('prod-2');
    });

    it('prüft Titelkollisionen gegen die Briefings der Ziel-Produktion', async () => {
      db.rows.campaign_briefings.push({ ...quelle, id: 'brief-x', produktion_id: 'prod-2', aktivierung_name: 'Serum September – Kopie' });

      const kopie = await duplicateBriefing('brief-1', { produktionId: 'prod-2' });

      expect(kopie.aktivierung_name).toBe('Serum September – Kopie 2');
    });

    it('lehnt eine Produktion aus einer anderen Kampagne ab', async () => {
      await expect(duplicateBriefing('brief-1', { produktionId: 'prod-fremd' }))
        .rejects.toThrow('anderen Kampagne');
      expect(db.rows.campaign_briefings).toHaveLength(1);
    });

    it('lehnt eine unbekannte Produktion ab', async () => {
      await expect(duplicateBriefing('brief-1', { produktionId: 'gibt-es-nicht' }))
        .rejects.toThrow('Produktion nicht gefunden');
      expect(db.rows.campaign_briefings).toHaveLength(1);
    });
  });

  describe('mit Wunschtitel', () => {
    it('übernimmt den Titel ohne „Kopie“', async () => {
      const kopie = await duplicateBriefing('brief-1', { titel: 'Serum September – Winter' });
      expect(kopie.aktivierung_name).toBe('Serum September – Winter');
    });

    it('zählt hoch, wenn der Wunschtitel in der Produktion schon vergeben ist', async () => {
      db.rows.campaign_briefings.push({ ...quelle, id: 'brief-x', aktivierung_name: 'Serum September – Winter' });

      const kopie = await duplicateBriefing('brief-1', { titel: 'Serum September – Winter' });

      expect(kopie.aktivierung_name).toBe('Serum September – Winter 2');
    });

    it('fällt bei leerem Titel auf „– Kopie“ zurück', async () => {
      const kopie = await duplicateBriefing('brief-1', { titel: '   ' });
      expect(kopie.aktivierung_name).toBe('Serum September – Kopie');
    });
  });
});

describe('freierTitel', () => {
  it('lässt einen freien Titel unverändert', () => {
    expect(freierTitel('Serum – Winter', ['Serum – Herbst'])).toBe('Serum – Winter');
  });

  it('zählt ab 2 hoch, ohne Groß-/Kleinschreibung und Leerraum', () => {
    expect(freierTitel('Serum', [' serum '])).toBe('Serum 2');
    expect(freierTitel('Serum', ['Serum', 'Serum 2'])).toBe('Serum 3');
  });
});

describe('listKopierQuellen', () => {
  beforeEach(() => {
    const db = memoryDb();
    db.rows.produktion.push(
      { id: 'prod-1', kampagne_id: 'kamp-1', name: 'Serum – Produktion 1' },
      { id: 'prod-2', kampagne_id: 'kamp-1', name: 'Creme' },
      { id: 'prod-fremd', kampagne_id: 'kamp-2', name: 'Fremd' }
    );
    db.rows.campaign_briefings.push(
      { id: 'b1', produktion_id: 'prod-1', aktivierung_name: 'Serum Nano', is_draft: false },
      { id: 'b2', produktion_id: 'prod-2', aktivierung_name: 'Creme UGC', is_draft: true },
      { id: 'b3', produktion_id: 'prod-fremd', aktivierung_name: 'Serum Fremd', is_draft: false }
    );
    window.supabase = { from: db.from };
  });

  it('liefert Briefings aller Produktionen der Kampagne, aber keine fremden', async () => {
    const treffer = await listKopierQuellen('kamp-1');
    expect(treffer.map(t => t.id).sort()).toEqual(['b1', 'b2']);
  });

  it('filtert nach Suchbegriff', async () => {
    const treffer = await listKopierQuellen('kamp-1', 'creme');
    expect(treffer.map(t => t.id)).toEqual(['b2']);
  });

  it('zeigt Produktion und Entwurf als Zusatz', async () => {
    const treffer = await listKopierQuellen('kamp-1');
    expect(treffer.find(t => t.id === 'b1')).toMatchObject({ label: 'Serum Nano', sub: 'Serum – Produktion 1' });
    expect(treffer.find(t => t.id === 'b2')).toMatchObject({ label: 'Creme UGC', sub: 'Creme · Entwurf' });
  });

  it('liefert ohne Kampagne nichts', async () => {
    expect(await listKopierQuellen(null)).toEqual([]);
  });
});

describe('duplicateBriefingMitHinweis', () => {
  let db;

  beforeEach(() => {
    db = memoryDb();
    db.rows.produktion.push({ id: 'prod-1', kampagne_id: 'kamp-1', name: 'Serum September' });
    db.rows.campaign_briefings.push({ ...quelle });
    window.supabase = { from: db.from };
    window.toastSystem = { show: vi.fn() };
  });

  it('meldet Erfolg und feuert entityUpdated für die Briefing-Liste', async () => {
    const events = [];
    const listener = (e) => events.push(e.detail);
    window.addEventListener('entityUpdated', listener);

    const kopie = await duplicateBriefingMitHinweis('brief-1');
    window.removeEventListener('entityUpdated', listener);

    expect(kopie.aktivierung_name).toBe('Serum September – Kopie');
    expect(window.toastSystem.show).toHaveBeenCalledWith(expect.stringContaining('Serum September – Kopie'), 'success');
    expect(events).toEqual([{ entity: 'briefing', action: 'created', id: kopie.id }]);
  });

  it('meldet den Fehler und gibt null zurück', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db.rows.campaign_briefings[0].produktion_id = null;

    expect(await duplicateBriefingMitHinweis('brief-1')).toBeNull();
    expect(window.toastSystem.show).toHaveBeenCalledWith(expect.stringContaining('Produktion'), 'error');
  });
});

describe('Aktion „Duplizieren“', () => {
  it('steht im Briefing-Zeilenmenü für Admin und Mitarbeiter, nicht für Kunden', () => {
    const aktion = ActionConfigs.briefing.actions.find(a => a.id === 'briefing-duplizieren');
    expect(aktion).toMatchObject({ label: 'Duplizieren', roles: ['admin', 'mitarbeiter'] });
    expect(ActionConfigs.briefing.kundenActions).not.toContain('briefing-duplizieren');
  });

  it('ist dem Router als globale Aktion bekannt', () => {
    expect(GLOBAL_ACTIONS.has('briefing-duplizieren')).toBe(true);
  });
});
