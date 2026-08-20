// Edit-Prompt: neues Campaign-Briefing, Legacy-Extrakt, beides parallel.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { buildEditPrompt, stripToolXml, letzterZeitstempel } = require('../../netlify/functions/skript-edit-background.js');

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
    expect(task).toContain('# ZEITPLAN UND KONTINUITAET');
    expect(task).toContain('Beginne bei 0:00.');
    expect(task).toContain('M:SS–M:SS');
    expect(task).toContain('Stil, Orte und Props konsistent halten');
  });

  it('visuell Hauptteil: Start = letzter Hook-Zeitstempel', () => {
    const { task } = buildEditPrompt(baseCtx({
      skript: { hook_visuell: '0:00–0:03 Close-up Gesicht' }
    }), {
      aktion: 'visuell',
      sektion: 'hauptteil',
      selektion_text: 'Ich nutze das Serum.',
      inhalt: 'Visual zu Hauptteil'
    });

    expect(task).toContain('# ZEITPLAN UND KONTINUITAET');
    expect(task).toContain('Die Sektion davor (Hook) endet bei 0:03.');
    expect(task).toContain('Dein erster Shot MUSS bei 0:03 beginnen');
    expect(task).not.toContain('Beginne bei 0:00.');
  });

  it('visuell CTA: Start = Ende Hauptteil, letzter Shot = Video-Ende', () => {
    const { task } = buildEditPrompt(baseCtx({
      skript: {
        hook_visuell: '0:00–0:03 Close-up',
        hauptteil_visuell: '0:03–0:12 B-Roll Studio',
        video_laenge: '15-30'
      }
    }), {
      aktion: 'visuell',
      sektion: 'cta',
      selektion_text: 'Link in Bio.',
      inhalt: 'Visual zu CTA'
    });

    expect(task).toContain('Die Sektion davor (Hauptteil) endet bei 0:12.');
    expect(task).toContain('Dein erster Shot MUSS bei 0:12 beginnen');
    expect(task).toContain('Der letzte Shot soll bei 0:30 enden');
  });
});

describe('letzterZeitstempel', () => {
  it('nimmt das Maximum aus M:SS-Ranges', () => {
    expect(letzterZeitstempel('0:00–0:03 Close-up\n0:03–0:08 Wide')).toBe('0:08');
  });

  it('versteht deutsche [0–0,5 Sek]-Ranges', () => {
    expect(letzterZeitstempel('[0–0,5 Sek] Ruehren\n[2,5–3 Sek] Garten')).toBe('0:03');
  });

  it('liefert null ohne Zeitstempel', () => {
    expect(letzterZeitstempel('Close-up Gesicht, B-Roll Studio')).toBeNull();
    expect(letzterZeitstempel('')).toBeNull();
    expect(letzterZeitstempel(null)).toBeNull();
  });
});

describe('buildEditPrompt ist_visuell Rewrite', () => {
  it('Visual-Rewrite: Regie-Anweisung, kein Spoken-Wortbudget', () => {
    const { task } = buildEditPrompt(baseCtx({
      skript: {
        hook_visuell: 'Close-up Gesicht',
        hauptteil_visuell: 'B-Roll Studio',
        video_laenge: '15-30'
      }
    }), {
      aktion: 'kuerzen',
      sektion: 'hook',
      ist_visuell: true,
      selektion_text: 'Close-up Gesicht'
    });

    expect(task).toContain('HOOK (was zu sehen ist)');
    expect(task).toContain('Close-up Gesicht');
    expect(task).toContain('stammt aus "Was zu sehen ist"');
    expect(task).toContain('KEINEN Sprechertext');
    expect(task).not.toContain('HARTES WORT-BUDGET');
  });

  it('Spoken-Rewrite ohne Flag bleibt Spoken', () => {
    const { task } = buildEditPrompt(baseCtx({
      skript: { hook_visuell: 'Shot', video_laenge: '15-30' }
    }), {
      aktion: 'kuerzen',
      sektion: 'hook',
      selektion_text: 'Kennst du das?'
    });

    expect(task).toContain('HOOK (was zu sehen ist)');
    expect(task).toContain('Kürze die markierte Stelle deutlich');
    expect(task).not.toContain('stammt aus "Was zu sehen ist"');
    expect(task).toContain('HARTES WORT-BUDGET');
  });
});

describe('stripToolXml', () => {
  it('schneidet </antwort> und parameter-Leak ab, laesst Vorschlag stehen', () => {
    const antwort = 'Visuelle Regie für den Hauptteil – zeigt die Studio-Entdeckung live.</antwort>\n<parameter name="sektion">hauptteil';
    expect(stripToolXml(antwort)).toBe('Visuelle Regie für den Hauptteil – zeigt die Studio-Entdeckung live.');
    expect(stripToolXml('VISUELLE REGIE – HAUPTTEIL\n- POV-Shot')).toBe('VISUELLE REGIE – HAUPTTEIL\n- POV-Shot');
  });
});
