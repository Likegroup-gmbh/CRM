// Konsistenz beim Ueberarbeiten: gleicher Kontext wie die Generierung,
// harte Grenzen (DONTS, HART:), Creator-Vorgaben, Setting, Rueckfragen.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  buildEditPrompt, loadEditContext, editParams, VERBINDLICHE_REGELN
} = require('../../netlify/functions/_shared/skript-edit-prompt.js');
const {
  fmtCampaignBriefing, buildKontextText, BRIEFING_MAX
} = require('../../netlify/functions/_shared/skript-context.js');
const { buildPrompt } = require('../../netlify/functions/skript-generate-background.js');

const SKRIPT = {
  id: 's1',
  titel: 'Morgen',
  hook: 'Mama im Auto: Kennst du das?',
  hauptteil: 'Sie greift zum Serum.',
  cta: 'Link in der Bio.',
  video_idee: 'Mutter im Auto vor der Kita',
  location: 'Auto',
  video_laenge: '15-30',
  regieanweisung: 'Handkamera, Beifahrersitz',
  bereich: 'influencer_marketing',
  prompt_kontext: {}
};

function ctx({ skript = {}, briefing = null, kontext = {}, rueckfragen = '', history = [] } = {}) {
  return {
    skript: { ...SKRIPT, ...skript },
    history,
    rueckfragen,
    kontext: { dna: [], master: [], briefing, ...kontext },
    modus: null
  };
}

const FLOW = {
  bereich: 'influencer_marketing',
  aktivierung_name: 'Flow Kampagne',
  aufgabe: 'Serum in der Morgenroutine zeigen',
  creator_merkmale: { alter: '25-35', geschlecht: 'weiblich', standort: 'DACH' },
  beteiligte_personen: 'Creatorin alleine, optional Kind im Hintergrund',
  vorgaben_ausschluesse: 'Keine Konkurrenzprodukte',
  setting: 'Zuhause, Kueche, Tageslicht'
};

const CHAT_GRID = { aktion: 'chat', sektion: 'hauptteil', inhalt: 'Ueberarbeite den Hauptteil' };

// ---------------------------------------------------------------------------
// Briefing-Bloecke
// ---------------------------------------------------------------------------
describe('fmtCampaignBriefing: Creator-Vorgaben, Setting, Ausschluesse', () => {
  it('Flow kurz: weiblich ist HART, beteiligte Personen nicht', () => {
    const text = fmtCampaignBriefing(FLOW);
    expect(text).toContain('# CREATOR-VORGABEN');
    expect(text).toContain('- HART: Creator-Geschlecht (nur die Person vor der Kamera, nicht die Zielgruppe): weiblich');
    expect(text).toContain('- Beteiligte Personen: Creatorin alleine, optional Kind im Hintergrund');
    expect(text).not.toContain('HART: Beteiligte');
    expect(text).toContain('- Alter: 25-35');
    expect(text).not.toContain('HART: Alter');
    expect(text).toContain('Creator-Aufgabe: Serum in der Morgenroutine zeigen');
  });

  it('"nur weiblich" und Grossschreibung sind HART', () => {
    for (const g of ['nur weiblich', 'Weiblich', 'MÄNNLICH', 'divers', ' nur  männlich ']) {
      const text = fmtCampaignBriefing({ ...FLOW, creator_merkmale: { geschlecht: g } });
      expect(text).toContain('- HART: Creator-Geschlecht');
    }
  });

  it('weiche Geschlechtswerte stehen voll im Wortlaut, ohne HART', () => {
    for (const g of ['Vorrangig weiblich', 'keine Vorgabe', '39% weiblich, 61% männlich', 'weiblich und männlich']) {
      const text = fmtCampaignBriefing({ ...FLOW, creator_merkmale: { geschlecht: g } });
      expect(text).toContain(`Creator-Geschlecht (nur die Person vor der Kamera, nicht die Zielgruppe): ${g}`);
      expect(text).not.toContain('HART:');
    }
  });

  it('Flow ueber 6.000 Zeichen: Geschlecht und Ausschluesse bleiben', () => {
    const lang = 'x'.repeat(BRIEFING_MAX);
    const text = fmtCampaignBriefing({ ...FLOW, pflichtinhalte: lang, learnings_text: lang, cta: lang });
    expect(text).toContain('HART: Creator-Geschlecht');
    expect(text).toContain('Keine Konkurrenzprodukte');
    expect(text).toContain('Beteiligte Personen');
  });

  it('Spiegel-Spalte nur wenn creator_merkmale leer, nie beide', () => {
    const nurSpiegel = fmtCampaignBriefing({
      bereich: 'paid_creator_ads',
      aktivierung_name: 'Paid',
      creator_merkmale: { alter: '', geschlecht: '' },
      pa_creator_merkmale: { geschlecht: 'weiblich', sonstiges: 'Kein Dialekt' },
      im_creator_merkmale: { geschlecht: 'männlich' }
    });
    expect(nurSpiegel).toContain('HART: Creator-Geschlecht (nur die Person vor der Kamera, nicht die Zielgruppe): weiblich');
    expect(nurSpiegel).toContain('- Sonstiges: Kein Dialekt');
    expect(nurSpiegel).not.toContain('männlich');
    expect(nurSpiegel).not.toContain('Creator-Merkmale:');

    const beide = fmtCampaignBriefing({
      bereich: 'influencer_marketing',
      creator_merkmale: { geschlecht: 'divers' },
      im_creator_merkmale: { geschlecht: 'weiblich' }
    });
    expect(beide).toContain('Zielgruppe): divers');
    expect(beide).not.toContain('Zielgruppe): weiblich');
  });

  it('Ausschluesse unter # DONTS, auch ohne Dos und Donts', () => {
    const text = fmtCampaignBriefing({ bereich: 'influencer_marketing', vorgaben_ausschluesse: 'Keine Kinder im Bild' });
    expect(text).toContain('# DONTS');
    expect(text).toContain('Ausschluesse aus dem Briefing:\nKeine Kinder im Bild');
    expect(text).not.toContain('# DOS');
  });

  it('Ausschluesse nach den Donts, # DOS danach', () => {
    const text = fmtCampaignBriefing({
      bereich: 'influencer_marketing',
      donts: 'Kein Sales-Pitch',
      dos: 'Produktname nennen',
      vorgaben_ausschluesse: 'Keine Konkurrenz'
    });
    expect(text.indexOf('Kein Sales-Pitch')).toBeLessThan(text.indexOf('Keine Konkurrenz'));
    expect(text.indexOf('Keine Konkurrenz')).toBeLessThan(text.indexOf('# DOS'));
    expect(text).not.toContain('Vorgaben und Ausschluesse:');
  });

  it('Setting nur in im_situationen: eigener Block, nicht doppelt im Body', () => {
    const text = fmtCampaignBriefing({
      bereich: 'influencer_marketing',
      aktivierung_name: 'IM',
      im_situationen: 'Badezimmer, Tageslicht'
    });
    expect(text).toContain('# SETTING (Wunschvorgabe, keine harte Grenze. Gilt, solange die Anweisung keinen anderen Ort nennt.)\nBadezimmer, Tageslicht');
    expect(text.split('Badezimmer, Tageslicht').length).toBe(2);
    expect(text).not.toContain('Situationen / Settings');
  });

  it('setting schlaegt den Spiegel, ueber 1.500 wird am Ende gekuerzt', () => {
    const lang = `ANFANG ${'s'.repeat(2000)} ENDE`;
    const text = fmtCampaignBriefing({ bereich: 'influencer_marketing', setting: lang, im_situationen: 'SPIEGEL' });
    expect(text).toContain('ANFANG');
    expect(text).not.toContain('ENDE');
    expect(text).not.toContain('SPIEGEL');
  });
});

// ---------------------------------------------------------------------------
// Edit-Prompt
// ---------------------------------------------------------------------------
describe('buildEditPrompt: gleicher Kontext wie die Generierung', () => {
  it('Feld-Paritaet: Edit-Task enthaelt den Kontext-Text der Generierung', () => {
    const kontext = {
      unternehmen: { firmenname: 'Glow GmbH', beschreibung: 'Skincare' },
      marke: { markenname: 'Glow' },
      produkt: { name: 'Serum', usp: 'Vitamin C', erlaubte_claims: 'strahlend' },
      produktVarianten: [{ name: '30 ml', merkmal: 'Reisegroesse' }],
      persona: { name: 'Mia', interessen: 'Yoga', kaufmotive: 'Zeitersparnis', einwaende: 'Preis', plattformen: 'TikTok' },
      kampagne: { kampagnenname: 'Summer', ziele: 'Awareness' },
      briefing: FLOW
    };
    const c = ctx({ kontext });
    const { task } = buildEditPrompt(c, CHAT_GRID);
    expect(task).toContain(buildKontextText(c.kontext, editParams(c.skript)));
    for (const s of ['Glow GmbH', 'Vitamin C', 'Reisegroesse', 'Yoga', 'Zeitersparnis', 'Preis', 'TikTok', 'Awareness']) {
      expect(task).toContain(s);
    }
    expect(task).toContain('## Zielgruppen-Persona');
    expect(task).not.toContain('# ZIELGRUPPEN-PERSONA');
  });

  it('Video-Idee und Location kommen aus der Skript-Row', () => {
    const { task } = buildEditPrompt(ctx(), CHAT_GRID);
    expect(task).toContain('<user_vorgabe>\nMutter im Auto vor der Kita\n</user_vorgabe>');
    expect(task).toContain('location: Auto');
  });

  it('volles Briefing statt 4.000er-Limit', () => {
    const lang = 'b'.repeat(4500);
    const { task } = buildEditPrompt(ctx({ briefing: { ...FLOW, pflichtinhalte: lang } }), CHAT_GRID);
    expect(task).toContain(lang);
  });

  it('Videovorlage aus dem Snapshot laeuft durch buildReferenzText', () => {
    const transkript = 't'.repeat(6000);
    const { task } = buildEditPrompt(ctx({
      skript: { prompt_kontext: { referenz_video: { transkript_verwendet: transkript } } }
    }), CHAT_GRID);
    expect(task).toContain('## VIDEOVORLAGE');
    expect(task).toContain(transkript);
  });

  it('Sprache englisch: Sprach-Satz im Task, System ohne "deutsches"', () => {
    const { task, stable } = buildEditPrompt(ctx({ briefing: { ...FLOW, sprachen: ['englisch'] } }), CHAT_GRID);
    expect(task).toContain('Sprache des Skripts: Englisch.');
    expect(task).toContain('# SKRIPT-SPRACHE');
    expect(stable).not.toContain('deutsches Video-Konzept');
  });

  it('ohne Sprachvorgabe: Deutsch, kein SKRIPT-SPRACHE-Block', () => {
    const { task } = buildEditPrompt(ctx({ briefing: FLOW }), CHAT_GRID);
    expect(task).toContain('Sprache des Skripts: Deutsch.');
    expect(task).not.toContain('# SKRIPT-SPRACHE');
  });

  it('Legacy-Extrakt bis BRIEFING_MAX', () => {
    const extrakt = 'e'.repeat(5500);
    const { task } = buildEditPrompt(ctx({ skript: { prompt_kontext: { briefing_extrakt: extrakt } } }), CHAT_GRID);
    expect(task).toContain(extrakt);
  });
});

describe('buildEditPrompt: VERBINDLICHE REGELN in allen Zweigen', () => {
  const faelle = [
    ['neu_schreiben', { aktion: 'neu_schreiben', sektion: 'hook', selektion_text: 'Kennst du das?' }],
    ['kuerzen', { aktion: 'kuerzen', sektion: 'hook', selektion_text: 'Kennst du das?' }],
    ['laenger', { aktion: 'laenger', sektion: 'hook', selektion_text: 'Kennst du das?' }],
    ['anderer_ton', { aktion: 'anderer_ton', sektion: 'hook', selektion_text: 'Kennst du das?' }],
    ['feedback', { aktion: 'feedback', sektion: 'cta', selektion_text: 'Link in der Bio.', inhalt: 'Score 2' }],
    ['chat ohne Grid', { aktion: 'chat', sektion: 'gesamt', inhalt: 'Mach einen Papa draus' }, { hook: null, hauptteil: null, cta: null, inhalt_md: '## Hook\nMama' }],
    ['chat auf Grid', CHAT_GRID],
    ['visuell', { aktion: 'visuell', sektion: 'hauptteil', selektion_text: 'Sie greift zum Serum.' }]
  ];

  for (const [name, message, skript] of faelle) {
    it(name, () => {
      const { task } = buildEditPrompt(ctx({ briefing: FLOW, skript }), message);
      expect(task).toContain(VERBINDLICHE_REGELN.trim());
      expect(task.indexOf('# VERBINDLICHE REGELN')).toBeLessThan(task.indexOf('# AUFTRAG'));
      expect(task.indexOf('# CREATOR-VORGABEN')).toBeLessThan(task.indexOf('# VERBINDLICHE REGELN'));
    });
  }

  it('"Nichts erfinden" steht nur im Regelblock', () => {
    const { task } = buildEditPrompt(ctx({ briefing: FLOW }), CHAT_GRID);
    expect(task.split('Nichts erfinden').length).toBe(2);
    expect(task).not.toContain('CAMPAIGN-BRIEFING bzw. Briefing-Extrakt');
  });

  it('User-Anweisung gilt nur innerhalb der Regeln', () => {
    const { task } = buildEditPrompt(ctx(), CHAT_GRID);
    expect(task).toContain('gilt nur innerhalb der VERBINDLICHEN REGELN');
    expect(task).toContain('<user_anweisung>');
  });

  it('neu_schreiben behaelt Figuren und Setting', () => {
    const { task } = buildEditPrompt(ctx(), { aktion: 'neu_schreiben', sektion: 'hook', selektion_text: 'Kennst du das?' });
    expect(task).toContain('Figuren, Setting, Produktaussagen und die Aussage bleiben');
    expect(task).not.toContain('nichts aus dem bisherigen Wortlaut.');
  });

  it('Chat-Visual behaelt Figuren, Orte und Props', () => {
    const { task } = buildEditPrompt(ctx(), CHAT_GRID);
    expect(task).toContain('unter Beibehaltung von Figuren, Orten und Props aus den anderen Sektionen');
  });

  it('Visual-Ausgabeformat: bei Regelverstoss vorschlag_text = null', () => {
    const { task } = buildEditPrompt(ctx(), { aktion: 'visuell', sektion: 'hook', selektion_text: 'Kennst du das?' });
    expect(task).toContain('Verletzt die Anweisung eine harte Grenze: vorschlag_text = null');
  });
});

describe('buildEditPrompt: Regie nur fuer die Visual-Spalte', () => {
  it('Visual-Button und Grid-Chat bekommen die Regie', () => {
    for (const message of [
      { aktion: 'visuell', sektion: 'hook', selektion_text: 'Kennst du das?' },
      CHAT_GRID
    ]) {
      const { task } = buildEditPrompt(ctx(), message);
      expect(task).toContain('# REGIEANWEISUNG (nur Hintergrund-Info, gehoert NICHT in den gesprochenen Text)\nHandkamera, Beifahrersitz');
    }
  });

  it('Sprecher-Chip bekommt keine Regie', () => {
    const { task } = buildEditPrompt(ctx(), { aktion: 'kuerzen', sektion: 'hook', selektion_text: 'Kennst du das?' });
    expect(task).not.toContain('Handkamera');
  });
});

// ---------------------------------------------------------------------------
// Loader: Rueckfragen ohne Limit, Verlauf ohne tote Status, volles Briefing
// ---------------------------------------------------------------------------
function fakeSupabase(tables) {
  return {
    from(table) {
      const filters = [];
      let limitN = null;
      let orderAsc = true;
      let single = false;
      const q = {
        select() { return q; },
        eq(col, val) { filters.push((r) => r[col] === val); return q; },
        neq(col, val) { filters.push((r) => r[col] !== val); return q; },
        in(col, vals) { filters.push((r) => vals.includes(r[col])); return q; },
        or(expr) {
          if (expr === 'aktion.is.null,aktion.neq.rueckfrage') {
            filters.push((r) => r.aktion == null || r.aktion !== 'rueckfrage');
          }
          return q;
        },
        not(col, op, list) {
          const vals = list.replace(/[()]/g, '').split(',');
          filters.push((r) => !vals.includes(r[col]));
          return q;
        },
        order(col, opts = {}) { orderAsc = opts.ascending !== false; return q; },
        limit(n) { limitN = n; return q; },
        single() { single = true; return q; },
        maybeSingle() { single = true; return q; },
        then(resolve, reject) {
          let rows = (tables[table] || []).filter((r) => filters.every((f) => f(r)));
          rows = [...rows].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
          if (!orderAsc) rows.reverse();
          if (limitN != null) rows = rows.slice(0, limitN);
          const data = single ? rows[0] || null : rows;
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        }
      };
      return q;
    }
  };
}

describe('loadEditContext', () => {
  const ts = (i) => `2026-09-25T10:${String(i).padStart(2, '0')}:00Z`;
  const messages = [
    { id: 'r1', skript_id: 's1', rolle: 'assistant', aktion: 'rueckfrage', inhalt: 'Wie soll der CTA lauten?', status: 'fertig', created_at: ts(0) },
    { id: 'r2', skript_id: 's1', rolle: 'user', aktion: 'rueckfrage', inhalt: 'CTA ist Link in der Bio', status: 'fertig', created_at: ts(1) },
    { id: 'r3', skript_id: 's1', rolle: 'assistant', aktion: 'rueckfrage', inhalt: 'ABGEBROCHEN', status: 'cancelled', created_at: ts(2) }
  ];
  for (let i = 0; i < 13; i++) {
    messages.push({
      id: `e${i}`, skript_id: 's1', rolle: i % 2 ? 'assistant' : 'user', aktion: 'chat',
      inhalt: `Edit ${i}`, status: 'fertig', created_at: ts(10 + i)
    });
  }
  messages.push(
    { id: 'x1', skript_id: 's1', rolle: 'assistant', aktion: 'chat', inhalt: 'KAPUTT', status: 'error', created_at: ts(30) },
    { id: 'x2', skript_id: 's1', rolle: 'assistant', aktion: 'chat', inhalt: 'STORNO', status: 'cancelled', created_at: ts(31) },
    { id: 'now', skript_id: 's1', rolle: 'assistant', aktion: 'chat', sektion: 'cta', inhalt: 'Kuerze den CTA', status: 'running', created_at: ts(40) }
  );

  const supabase = fakeSupabase({
    skripte: [{ ...SKRIPT, briefing_id: 'b1', mit_dna: false }],
    campaign_briefings: [{ id: 'b1', ...FLOW, donts: 'Keine Mama zeigen', dos: 'Produktname nennen' }],
    skript_chat_messages: messages,
    skript_master: []
  });
  const message = messages[messages.length - 1];

  it('Rueckfrage bleibt trotz 13 Edit-Messages, tote Status zaehlen nicht', async () => {
    const c = await loadEditContext(supabase, { ...message, skript_id: 's1' });
    expect(c.rueckfragen).toContain('User: CTA ist Link in der Bio');
    expect(c.rueckfragen).not.toContain('ABGEBROCHEN');
    expect(c.history).toHaveLength(12);
    expect(c.history.some((h) => h.aktion === 'rueckfrage')).toBe(false);
    expect(c.history.some((h) => ['error', 'cancelled', 'running'].includes(h.status))).toBe(false);

    const { task } = buildEditPrompt(c, message);
    expect(task).toContain('# GEKLAERTE RUECKFRAGEN (verbindliche Antworten des Users - haben Vorrang vor widerspruechlichen CRM-Daten, aber nicht vor den harten Grenzen aus dem Briefing)');
    expect(task).toContain('Link in der Bio');
  });

  it('Briefing voll geladen: Donts und Dos im Edit-Prompt', async () => {
    const c = await loadEditContext(supabase, { ...message, skript_id: 's1' });
    expect(c.kontext.briefing.donts).toBe('Keine Mama zeigen');
    const { task } = buildEditPrompt(c, message);
    expect(task).toContain('# DONTS');
    expect(task).toContain('Keine Mama zeigen');
    expect(task).toContain('# DOS');
    expect(task).toContain('HART: Creator-Geschlecht');
  });
});

// ---------------------------------------------------------------------------
// Generierung
// ---------------------------------------------------------------------------
describe('buildPrompt: harte Grenzen und Rueckfragen', () => {
  const base = { dna: [], beispiele: [], antiPatterns: [], briefing: FLOW };

  it('Grenzen-Satz nach dem Kontext, vor den Rueckfragen', () => {
    const { task } = buildPrompt(base, { video_idee: 'Papa im Auto' }, 'User: CTA ist Link in der Bio');
    const satz = task.indexOf('Die harten Grenzen schlagen auch die Video-Idee und jede Rueckfrage.');
    expect(satz).toBeGreaterThan(task.indexOf('# CREATOR-VORGABEN'));
    expect(satz).toBeGreaterThan(task.indexOf('<user_vorgabe>'));
    expect(satz).toBeLessThan(task.indexOf('# GEKLAERTE RUECKFRAGEN'));
    expect(task).toContain('inhalt_md unter ## Abweichungen');
    expect(task).toContain('aber nicht vor den harten Grenzen aus dem Briefing');
    expect(task).toContain('Vorrang vor Briefing-Defaults');
  });

  it('ohne Briefing kein Grenzen-Satz', () => {
    const { task } = buildPrompt({ dna: [], beispiele: [], antiPatterns: [] }, { video_idee: 'x' });
    expect(task).not.toContain('Die harten Grenzen schlagen');
  });
});
