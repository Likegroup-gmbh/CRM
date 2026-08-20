// Edit-Prompt: neues Campaign-Briefing, Legacy-Extrakt, beides parallel.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { buildEditPrompt } = require('../../netlify/functions/skript-edit-background.js');

function baseCtx(overrides = {}) {
  return {
    skript: {
      titel: 'Glow',
      hook: 'Kennst du das?',
      hauptteil: 'Ich nutze das Serum.',
      cta: 'Link in Bio.',
      video_idee: 'Morgenroutine',
      prompt_kontext: {},
      ...(overrides.skript || {})
    },
    history: [],
    dna: [],
    briefing: overrides.briefing ?? null,
    kickoff: overrides.kickoff ?? null,
    feedback: []
  };
}

const MESSAGE = { aktion: 'chat', sektion: 'cta', inhalt: 'CTA klarer machen' };

const CAMPAIGN = {
  bereich: 'influencer_marketing',
  aktivierung_name: 'Summer Glow',
  im_umsetzung: 'Serum in die Morgenroutine',
  im_ziel_url: 'https://shop.example/glow',
  im_code: 'GLOW20'
};

describe('buildEditPrompt Briefing-Pfade', () => {
  it('(a) neues briefing_id-Leitplanken via fmtCampaignBriefing', () => {
    const { task } = buildEditPrompt(baseCtx({ briefing: CAMPAIGN }), MESSAGE);
    expect(task).toContain('# CAMPAIGN-BRIEFING');
    expect(task).toContain('Summer Glow');
    expect(task).toContain('https://shop.example/glow');
    expect(task).toContain('GLOW20');
    expect(task).toContain('CAMPAIGN-BRIEFING bzw. Briefing-Extrakt');
    expect(task).not.toContain('PDF-BRIEFING');
    expect(task).not.toContain('BRIEFING-EXTRAKT');
  });

  it('(b) Legacy-Extrakt ohne briefing_id', () => {
    const { task } = buildEditPrompt(baseCtx({
      skript: { prompt_kontext: { briefing_extrakt: 'Alte PDF-Fakten: Rabatt 20%.' } }
    }), MESSAGE);
    expect(task).toContain('# BRIEFING-EXTRAKT');
    expect(task).toContain('Alte PDF-Fakten: Rabatt 20%.');
    expect(task).not.toContain('# CAMPAIGN-BRIEFING');
  });

  it('(c) beides gleichzeitig: Campaign-Briefing UND Legacy-Extrakt', () => {
    const { task } = buildEditPrompt(baseCtx({
      briefing: CAMPAIGN,
      skript: { prompt_kontext: { briefing_extrakt: 'Alte PDF-Fakten: Rabatt 20%.' } }
    }), MESSAGE);
    expect(task).toContain('# CAMPAIGN-BRIEFING');
    expect(task).toContain('Summer Glow');
    expect(task).toContain('# BRIEFING-EXTRAKT');
    expect(task).toContain('Alte PDF-Fakten: Rabatt 20%.');
    expect(task.indexOf('CAMPAIGN-BRIEFING')).toBeLessThan(task.indexOf('BRIEFING-EXTRAKT'));
  });
});

describe('buildEditPrompt aktion visuell', () => {
  it('Prompt-Zweig visuell: nur Visual-Text, kein gesprochener Text', () => {
    const { task } = buildEditPrompt(baseCtx(), {
      aktion: 'visuell',
      sektion: 'hook',
      selektion_text: 'Kennst du das?',
      inhalt: 'Visual zu Hook'
    });

    expect(task).toContain('Aktion: Visual');
    expect(task).toContain('Sektion: HOOK');
    expect(task).toContain('Markierte Stelle:\n"""Kennst du das?"""');
    expect(task).toContain('VISUELLE REGIE');
    expect(task).toContain('KEINEN zweiten Sprechertext');
    expect(task).toContain('Der gesprochene Text bleibt unverändert');
    expect(task).toContain('vorschlag_text = visuelle Regie fuer "Was zu sehen ist"');
    expect(task).toContain('KEIN gesprochener Text, keine Sprecher-Anweisungen');
  });
});
