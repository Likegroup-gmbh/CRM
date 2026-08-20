// Tests fuer fmtCampaignBriefing + Einbettung in buildKontextText / buildPrompt.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  fmtCampaignBriefing,
  briefingSkriptSprache,
  buildKontextText,
  BRIEFING_MAX
} = require('../../netlify/functions/_shared/skript-context.js');
const { buildPrompt } = require('../../netlify/functions/skript-generate-background.js');

const IM_BRIEFING = {
  bereich: 'influencer_marketing',
  aktivierung_name: 'Summer Glow 2026',
  ansatz: 'kampagne',
  kampagne_thema: 'Launch der Glow-Serie',
  kampagnentypen: ['produktlaunch', 'saisonal'],
  creator_rolle: 'Authentische Anwendung zeigen',
  maerkte: ['deutschland'],
  sprachen: ['deutsch'],
  im_funnel_stufen: ['lower'],
  im_kpis: [{ kpi: 'reichweite', zielwert: '2 Mio' }, { kpi: 'cpm', zielwert: '8 EUR' }],
  im_umsetzung: 'Produkt morgens in die Routine einbauen',
  im_situationen: 'Badezimmer, Tageslicht',
  im_ziel_url: 'https://shop.example/glow',
  im_code: 'GLOW20',
  im_keine_benchmarks: false,
  im_channels: { instagram: ['reel', 'story'], tiktok: ['video'], weitere: '' },
  pa_umsetzung: 'DARF NICHT IM IM-BRIEFING STEHEN',
  os_umsetzung: 'DARF AUCH NICHT DRIN STEHEN'
};

describe('fmtCampaignBriefing', () => {
  it('formatiert Master + aktives Modul, laesst leere Felder weg', () => {
    const text = fmtCampaignBriefing(IM_BRIEFING);
    expect(text).toContain('# CAMPAIGN-BRIEFING');
    expect(text).toContain('Aktivierung: Summer Glow 2026');
    expect(text).toContain('Ansatz: Kampagne');
    expect(text).toContain('Kampagnentypen: Produktlaunch, Saisonaler Anlass');
    expect(text).toContain('Konkrete Umsetzung: Produkt morgens in die Routine einbauen');
    expect(text).toContain('Ziel-URL / Deep Link: https://shop.example/glow');
    expect(text).toContain('Code: GLOW20');
    expect(text).toContain('Ziele / Benchmarks: Reichweite: 2 Mio; CPM / TKP: 8 EUR');
    expect(text).toContain('instagram: reel, story');
    expect(text).not.toContain('Keine Benchmarks definiert');
    expect(text).not.toContain('Always-on-Thema');
  });

  it('isoliert das aktive Modul (keine pa_/os_-Felder bei IM)', () => {
    const text = fmtCampaignBriefing(IM_BRIEFING);
    expect(text).not.toContain('DARF NICHT');
    expect(text).not.toContain('DARF AUCH NICHT');
  });

  it('formatiert Paid-Modul statt IM', () => {
    const text = fmtCampaignBriefing({
      bereich: 'paid_creator_ads',
      aktivierung_name: 'Paid Push',
      pa_ziel_url: 'https://ads.example',
      pa_videolaengen: ['15s', '30s'],
      im_code: 'SOLL-FEHLEN'
    });
    expect(text).toContain('Paid Push');
    expect(text).toContain('Ziel-URL / Deep Link: https://ads.example');
    expect(text).toContain('15 Sek., 30 Sek.');
    expect(text).not.toContain('SOLL-FEHLEN');
  });

  it('liefert leer ohne Briefing oder ohne befuellte Felder', () => {
    expect(fmtCampaignBriefing(null)).toBe('');
    expect(fmtCampaignBriefing({ bereich: 'owned_social' })).toContain('Owned Social');
    expect(fmtCampaignBriefing({})).toBe('');
  });

  it('kuerzt auf BRIEFING_MAX und behaelt Prio-1 zuerst', () => {
    const lang = 'x'.repeat(4000);
    const text = fmtCampaignBriefing({
      bereich: 'influencer_marketing',
      aktivierung_name: 'Kurzname',
      im_umsetzung: 'Muss bleiben',
      im_ziel_url: 'https://cta.example',
      im_learnings_text: lang,
      im_ideen_text: lang
    }, { max: 800 });
    expect(text.length).toBeLessThanOrEqual(800);
    expect(text).toContain('Kurzname');
    expect(text).toContain('Muss bleiben');
    expect(text).toContain('https://cta.example');
  });

  it('Default-Budget ist BRIEFING_MAX', () => {
    expect(BRIEFING_MAX).toBe(6000);
  });
});

describe('briefingSkriptSprache', () => {
  it('ist null bei fehlend oder nur Deutsch', () => {
    expect(briefingSkriptSprache(null)).toBeNull();
    expect(briefingSkriptSprache({ sprachen: ['deutsch'] })).toBeNull();
    expect(briefingSkriptSprache({ sprachen: [] })).toBeNull();
  });

  it('liefert Labels wenn nicht nur Deutsch', () => {
    expect(briefingSkriptSprache({ sprachen: ['englisch'] })).toBe('Englisch');
    expect(briefingSkriptSprache({ sprachen: ['deutsch', 'englisch'] })).toBe('Deutsch, Englisch');
  });
});

describe('buildKontextText mit Campaign-Briefing', () => {
  it('setzt Briefing-Sektion VOR den Video-Vorgaben', () => {
    const text = buildKontextText(
      { dna: [], briefing: IM_BRIEFING },
      { video_idee: 'Morgenroutine', funnel_stufe: 'bottom' }
    );
    expect(text).toContain('# CAMPAIGN-BRIEFING');
    expect(text.indexOf('CAMPAIGN-BRIEFING')).toBeLessThan(text.indexOf('Vorgaben fuer dieses Video'));
    expect(text).toContain('Morgenroutine');
  });

  it('ohne Briefing keine Sektion (Legacy/ohne Auswahl)', () => {
    const text = buildKontextText({ dna: [] }, { video_idee: 'x' });
    expect(text).not.toContain('CAMPAIGN-BRIEFING');
  });
});

describe('buildPrompt Vorrang + Sprache + Anti-Erfindung', () => {
  it('nennt CAMPAIGN-BRIEFING statt PDF und setzt Vorrang-Regel', () => {
    const { task } = buildPrompt({ dna: [], beispiele: [], antiPatterns: [], briefing: IM_BRIEFING }, {
      video_idee: 'Glow Routine',
      video_laenge: '30-45',
      funnel_stufe: 'bottom'
    });
    expect(task).toContain('CAMPAIGN-BRIEFING');
    expect(task).not.toContain('PDF-BRIEFING');
    expect(task).toContain('Vorrang vor Briefing-Defaults');
    expect(task).toContain('im CAMPAIGN-BRIEFING');
  });

  it('ohne Briefing keine Vorrang-/Briefing-Regel', () => {
    const { task } = buildPrompt({ dna: [], beispiele: [], antiPatterns: [] }, { video_idee: 'x' });
    expect(task).not.toContain('CAMPAIGN-BRIEFING');
    expect(task).not.toContain('Vorrang vor Briefing-Defaults');
    expect(task).toContain('auf Deutsch');
  });

  it('setzt Skript-Sprache wenn Briefing nicht nur Deutsch ist', () => {
    const { task } = buildPrompt({
      dna: [], beispiele: [], antiPatterns: [],
      briefing: { ...IM_BRIEFING, sprachen: ['englisch'] }
    }, { video_idee: 'Glow' });
    expect(task).toContain('auf Englisch');
    expect(task).toContain('SKRIPT-SPRACHE');
  });
});
