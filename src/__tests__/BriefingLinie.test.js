import { describe, it, expect, beforeEach } from 'vitest';
import { castingPresetFromBriefing } from '../modules/produktion/castingPresetFromBriefing.js';
import { ensureBriefingLine } from '../modules/produktion/ProduktionService.js';
import { sourcingConfig } from '../core/form/config/SourcingFormConfig.js';
import { renderWorkflowCreateChrome } from '../modules/kampagne/KampagneWorkflowCreate.js';
import { IG_REELS_SPALTEN } from '../modules/creator-auswahl/sourcingSpaltenPreset.js';

function memoryDb() {
  const rows = {
    produktion: [],
    creator_auswahl: [],
    strategie: [],
    campaign_briefing_produkt: []
  };
  let seq = 1;

  function match(table, filters) {
    return rows[table].filter(row => filters.every(([col, val]) => row[col] === val));
  }

  function from(table) {
    const state = { filters: [], op: 'select', insertRow: null, patch: null };
    const query = {
      select: () => query,
      eq: (col, val) => {
        state.filters.push([col, val]);
        return query;
      },
      insert: (row) => {
        state.op = 'insert';
        state.insertRow = row;
        return query;
      },
      update: (patch) => {
        state.op = 'update';
        state.patch = patch;
        return query;
      },
      delete: () => {
        state.op = 'delete';
        return query;
      },
      maybeSingle: async () => ({ data: match(table, state.filters)[0] || null, error: null }),
      single: async () => {
        if (state.op === 'insert') {
          const row = {
            id: `${table}-${seq++}`,
            strategie_id: null,
            creator_auswahl_id: null,
            hidden_columns: [],
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
        return Promise.resolve({
          data: state.op === 'select' ? match(table, state.filters) : [],
          error: null
        }).then(resolve, reject);
      }
    };
    return query;
  }

  return { from, rows };
}

const influencer = {
  id: 'brief-1',
  is_draft: false,
  aktivierung_name: 'Serum September',
  bereich: 'influencer_marketing',
  publish_channels: { instagram: ['feed_post'], youtube: ['short'] },
  tkp: 40,
  unternehmen_id: 'u1',
  marke_id: 'm1',
  produkt_id: 'serum'
};

describe('castingPresetFromBriefing', () => {
  it('macht aus Paid und Organic eine leere UGC-Liste', () => {
    expect(castingPresetFromBriefing({
      bereich: 'paid_creator_ads',
      publish_channels: { instagram: ['reel'] },
      tkp: 40
    })).toEqual({ liste_typ: 'ugc', plattformen: null, ig_formate: null, tkp: null });

    expect(castingPresetFromBriefing({ bereich: 'owned_social' }).liste_typ).toBe('ugc');
  });

  it('ignoriert Feed, Carousel und YouTube und fällt auf Reel + Story zurück', () => {
    expect(castingPresetFromBriefing(influencer)).toEqual({
      liste_typ: 'influencer',
      plattformen: 'instagram',
      ig_formate: 'reel,story',
      tkp: 40
    });
  });

  it('fällt auf Instagram + TikTok zurück, wenn keins von beiden gewählt ist', () => {
    expect(castingPresetFromBriefing({
      bereich: 'influencer_marketing',
      publish_channels: { youtube: ['short'] }
    })).toMatchObject({
      plattformen: 'instagram,tiktok',
      ig_formate: 'reel,story'
    });
  });

  it('übernimmt Reel ohne Story und TikTok ohne Instagram', () => {
    expect(castingPresetFromBriefing({
      bereich: 'influencer_marketing',
      publish_channels: { tiktok: ['video'], instagram: ['reel'] },
      tkp: null
    })).toEqual({
      liste_typ: 'influencer',
      plattformen: 'instagram,tiktok',
      ig_formate: 'reel',
      tkp: 25
    });
  });

  it('lässt das Format leer, wenn nur TikTok gewählt ist', () => {
    expect(castingPresetFromBriefing({
      bereich: 'influencer_marketing',
      publish_channels: { tiktok: ['video'] }
    })).toMatchObject({
      plattformen: 'tiktok',
      ig_formate: null,
      tkp: 25
    });
  });
});

describe('ensureBriefingLine', () => {
  let db;

  beforeEach(() => {
    db = memoryDb();
    window.supabase = { from: db.from };
    window.currentUser = { id: 'user-1' };
  });

  it('legt beim Finalisieren Produktion, Casting und Konzept an und verknüpft sie', async () => {
    const produktion = await ensureBriefingLine({
      briefing: influencer,
      kampagneId: 'kamp-1',
      produktId: 'serum'
    });

    expect(produktion.id).toBeTruthy();
    expect(db.rows.produktion).toHaveLength(1);
    expect(db.rows.creator_auswahl).toHaveLength(1);
    expect(db.rows.strategie).toHaveLength(1);
    expect(db.rows.creator_auswahl[0].name).toBe('Serum September Casting');
    expect(db.rows.strategie[0].name).toBe('Serum September Konzept');
    expect(db.rows.creator_auswahl[0].liste_typ).toBe('influencer');
    expect(db.rows.creator_auswahl[0].strategie_id).toBe(db.rows.strategie[0].id);
    expect(db.rows.strategie[0].creator_auswahl_id).toBe(db.rows.creator_auswahl[0].id);
    expect(db.rows.campaign_briefing_produkt).toEqual([
      expect.objectContaining({ briefing_id: 'brief-1', produkt_id: 'serum' })
    ]);
  });

  it('legt beim zweiten Speichern nichts Zweites an und schreibt die Liste fort', async () => {
    await ensureBriefingLine({ briefing: influencer, kampagneId: 'kamp-1', produktId: 'serum' });
    db.rows.creator_auswahl[0].hidden_columns.push('cp-col-mail');

    await ensureBriefingLine({
      briefing: {
        ...influencer,
        aktivierung_name: 'Serum Oktober',
        publish_channels: { instagram: ['reel', 'story'], tiktok: ['video'] },
        tkp: 12
      },
      kampagneId: 'kamp-1',
      produktId: 'serum'
    });

    expect(db.rows.produktion).toHaveLength(1);
    expect(db.rows.creator_auswahl).toHaveLength(1);
    expect(db.rows.strategie).toHaveLength(1);
    expect(db.rows.produktion[0].name).toBe('Serum Oktober');
    expect(db.rows.creator_auswahl[0].name).toBe('Serum Oktober Casting');
    expect(db.rows.creator_auswahl[0].tkp).toBe(12);
    expect(db.rows.creator_auswahl[0].plattformen).toBe('instagram,tiktok');
    expect(db.rows.creator_auswahl[0].hidden_columns).toContain('cp-col-mail');
    expect(db.rows.creator_auswahl[0].hidden_columns).not.toEqual(expect.arrayContaining(IG_REELS_SPALTEN));
  });

  it('legt ein fehlendes Casting nach, ohne ein zweites Konzept', async () => {
    await ensureBriefingLine({ briefing: influencer, kampagneId: 'kamp-1', produktId: 'serum' });
    const konzeptId = db.rows.strategie[0].id;
    db.rows.creator_auswahl.length = 0;
    db.rows.strategie[0].creator_auswahl_id = null;

    await ensureBriefingLine({ briefing: influencer, kampagneId: 'kamp-1', produktId: 'serum' });

    expect(db.rows.creator_auswahl).toHaveLength(1);
    expect(db.rows.strategie).toHaveLength(1);
    expect(db.rows.strategie[0].id).toBe(konzeptId);
    expect(db.rows.creator_auswahl[0].strategie_id).toBe(konzeptId);
  });

  it('legt die Linie ohne Produkt an, wenn das Produkt noch nicht existiert', async () => {
    const produktion = await ensureBriefingLine({
      briefing: { ...influencer, produkt_id: null },
      kampagneId: 'kamp-1',
      produktId: null
    });

    expect(produktion.id).toBeTruthy();
    expect(db.rows.produktion[0].produkt_id).toBeUndefined();
    expect(db.rows.creator_auswahl).toHaveLength(1);
    expect(db.rows.strategie).toHaveLength(1);
    expect(db.rows.campaign_briefing_produkt).toHaveLength(0);
  });

  it('legt bei einem Entwurf nichts an', async () => {
    const result = await ensureBriefingLine({
      briefing: { ...influencer, is_draft: true },
      kampagneId: 'kamp-1',
      produktId: 'serum'
    });
    expect(result).toBeNull();
    expect(db.rows.produktion).toHaveLength(0);
  });
});

describe('Create-Wege', () => {
  it('fragt Art der Liste, Plattform, Format und TKP im Casting-Formular nicht mehr', () => {
    const names = sourcingConfig.fields.map(field => field.name);
    expect(names).not.toEqual(expect.arrayContaining(['liste_typ', 'plattformen', 'ig_formate', 'tkp']));
  });

  it('zeigt auf der Produktion keinen Button zum Casting oder Konzept', () => {
    expect(renderWorkflowCreateChrome('casting', {})).not.toContain('Casting anlegen');
    expect(renderWorkflowCreateChrome('casting', {})).toContain('kampagne-casting-tools');
    expect(renderWorkflowCreateChrome('konzepte', {})).not.toContain('Konzept anlegen');
    expect(renderWorkflowCreateChrome('konzepte', {})).toContain('kampagne-konzept-tools');
  });
});
