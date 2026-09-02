// Edit-Prompt: neues Campaign-Briefing, Legacy-Extrakt, beides parallel.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  buildEditPrompt, stripToolXml, letzterZeitstempel,
  brauchtVisualStil, resolveModusSlug
} = require('../../netlify/functions/skript-edit-background.js');

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
    modus: overrides.modus ?? null
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

    expect(task).toContain('# SPALTE: Was zu sehen ist');
    expect(task).toContain('Nur visuelle Regie anfassen');
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
    expect(task).toContain('5–10');
    expect(task).toContain('B-Roll (ca. 10 Sek.)');
    expect(task).toContain('M:SS–M:SS');
    expect(task).toContain('Text Overlay');
    expect(task).toContain('Produktionsbriefing');
    expect(task).toContain('Stil, Orte und Props konsistent halten');
    expect(task).not.toContain('Jeder Shot MUSS einen Zeitstempel');
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
    expect(task).toContain('Dein erster Block MUSS bei 0:03 beginnen');
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
    expect(task).toContain('Dein erster Block MUSS bei 0:12 beginnen');
    expect(task).toContain('Der letzte Block soll bei 0:30 enden');
  });

  it('visuell mit Modus: REGIE-MODUS-Block', () => {
    const { task } = buildEditPrompt(baseCtx({
      modus: { slug: 'dynamisch', name: 'Dynamisch', inhalt: 'Schnelle Wechsel, mehr Szenen.' }
    }), {
      aktion: 'visuell',
      sektion: 'hook',
      selektion_text: 'Kennst du das?',
      inhalt: 'Visual zu Hook · Dynamisch',
      modus: 'dynamisch'
    });

    expect(task).toContain('# REGIE-MODUS: Dynamisch');
    expect(task).toContain('Schnelle Wechsel, mehr Szenen.');
    expect(task.indexOf('# REGIE-MODUS')).toBeLessThan(task.indexOf('# AUSGABEFORMAT'));
  });

  it('visuell ohne Modus: kein REGIE-MODUS-Block', () => {
    const { task } = buildEditPrompt(baseCtx(), {
      aktion: 'visuell',
      sektion: 'hook',
      selektion_text: 'Kennst du das?',
      inhalt: 'Visual zu Hook'
    });

    expect(task).not.toContain('# REGIE-MODUS');
    expect(task).toContain('# AUSGABEFORMAT');
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

    expect(task).toContain('# SPALTE: Was zu sehen ist');
    expect(task).toContain('Nur visuelle Regie anfassen');
    expect(task).toContain('HOOK (was zu sehen ist)');
    expect(task).toContain('Close-up Gesicht');
    expect(task).toContain('stammt aus "Was zu sehen ist"');
    expect(task).toContain('KEINEN Sprechertext');
    expect(task).toContain('Text Overlay, Visual, B-Roll');
    expect(task).toContain('kein neues Storyboard');
    expect(task).toContain('Zeitmarker und Blöcke stehen lassen');
    expect(task).not.toContain('HARTES WORT-BUDGET');
    expect(task).not.toContain('# ZEITPLAN UND KONTINUITAET');
  });

  it('Spoken-Rewrite ohne Flag bleibt Spoken', () => {
    const { task, stable } = buildEditPrompt(baseCtx({
      skript: { hook_visuell: 'Shot', video_laenge: '15-30' }
    }), {
      aktion: 'kuerzen',
      sektion: 'hook',
      selektion_text: 'Kennst du das?'
    });

    expect(task).toContain('# SPALTE: Was gesagt wird');
    expect(task).toContain('Nur Sprechertext anfassen');
    expect(task).toContain('HOOK (was zu sehen ist)');
    expect(task).toContain('Kürze die markierte Stelle deutlich');
    expect(task).not.toContain('stammt aus "Was zu sehen ist"');
    expect(task).toContain('HARTES WORT-BUDGET');
    expect(stable).not.toContain('# VISUELLER STIL');
    expect(stable).not.toContain('DARF-NICHT');
  });

  it('Visual-Rewrite teilt Stil-Dokument mit dem Button, ohne fremde Skripte', () => {
    const { stable, task } = buildEditPrompt(baseCtx({
      modus: { slug: 'klassisch', name: 'Klassisch', inhalt: 'Ruhige Blöcke, 5–10s.' }
    }), {
      aktion: 'kuerzen',
      sektion: 'hook',
      ist_visuell: true,
      selektion_text: 'Close-up Gesicht'
    });

    expect(stable).toContain('# VISUELLER STIL');
    expect(stable).not.toContain('# ERFOLGREICHE VISUAL-BEISPIELE');
    expect(task).toContain('# REGIE-MODUS: Klassisch');
    expect(task).not.toContain('# ZEITPLAN UND KONTINUITAET');
  });
});

describe('buildEditPrompt Visual-Stil', () => {
  const VISUELL_MSG = {
    aktion: 'visuell',
    sektion: 'hook',
    selektion_text: 'Kennst du das?',
    inhalt: 'Visual zu Hook'
  };

  it('legt Stil-Dokument in den stable-Block', () => {
    const { stable } = buildEditPrompt(baseCtx(), VISUELL_MSG);
    expect(stable).toContain('# VISUELLER STIL');
    expect(stable).toContain('Text Overlay');
    expect(stable).toContain('B-Roll');
    expect(stable).toContain('Anti-Beispiel');
    expect(stable).toContain('Whip-Pan');
  });

  it('legt keine fremden Visual-Skripte in den Prompt', () => {
    const { stable } = buildEditPrompt(baseCtx(), VISUELL_MSG);
    expect(stable).toContain('# VISUELLER STIL');
    expect(stable).not.toContain('# ERFOLGREICHE VISUAL-BEISPIELE');
    expect(stable).not.toContain('HOOK (was zu sehen ist)');
  });

  it('chat ohne Markierung: Spoken-Pfad, kein Visual-Stil', () => {
    const { stable, task } = buildEditPrompt(baseCtx(), MESSAGE);
    expect(task).toContain('# SPALTE: Was gesagt wird');
    expect(stable).not.toContain('# VISUELLER STIL');
    expect(stable).not.toContain('VISUAL-BEISPIELE');
    expect(stable).not.toContain('DARF-NICHT-IM-CHAT');
  });
});

describe('brauchtVisualStil', () => {
  it('trifft Visual-Button und Visual-Spalte, nicht Spoken', () => {
    expect(brauchtVisualStil({ aktion: 'visuell' })).toBe(true);
    expect(brauchtVisualStil({ aktion: 'kuerzen', ist_visuell: true })).toBe(true);
    expect(brauchtVisualStil({ aktion: 'kuerzen' })).toBe(false);
    expect(brauchtVisualStil({ aktion: 'chat' })).toBe(false);
  });
});

function chainQuery(data) {
  const q = {
    select() { return q; },
    in() { return q; },
    eq() { return q; },
    neq() { return q; },
    not() { return q; },
    order() { return q; },
    limit() { return q; },
    then(resolve, reject) { return Promise.resolve({ data }).then(resolve, reject); }
  };
  return q;
}

describe('resolveModusSlug', () => {
  it('nimmt message.modus zuerst', async () => {
    const slug = await resolveModusSlug({ from: () => chainQuery([]) }, {
      aktion: 'kuerzen', ist_visuell: true, modus: 'dynamisch', skript_id: 's1'
    });
    expect(slug).toBe('dynamisch');
  });

  it('faellt auf gleiche Sektion zurueck, sonst letzten Visual-Job', async () => {
    const rows = [
      { modus: 'klassisch', sektion: 'cta' },
      { modus: 'dynamisch', sektion: 'hook' }
    ];
    const supabase = { from: () => chainQuery(rows) };
    const same = await resolveModusSlug(supabase, {
      aktion: 'kuerzen', ist_visuell: true, skript_id: 's1', sektion: 'hook'
    });
    expect(same).toBe('dynamisch');

    const fallback = await resolveModusSlug(supabase, {
      aktion: 'kuerzen', ist_visuell: true, skript_id: 's1', sektion: 'hauptteil'
    });
    expect(fallback).toBe('klassisch');
  });

  it('Spoken ohne modus: null, keine Query noetig', async () => {
    let called = false;
    const supabase = { from: () => { called = true; return chainQuery([]); } };
    expect(await resolveModusSlug(supabase, { aktion: 'kuerzen', skript_id: 's1' })).toBeNull();
    expect(called).toBe(false);
  });
});

describe('stripToolXml', () => {
  it('schneidet </antwort> und parameter-Leak ab, laesst Vorschlag stehen', () => {
    const antwort = 'Visuelle Regie für den Hauptteil – zeigt die Studio-Entdeckung live.</antwort>\n<parameter name="sektion">hauptteil';
    expect(stripToolXml(antwort)).toBe('Visuelle Regie für den Hauptteil – zeigt die Studio-Entdeckung live.');
    expect(stripToolXml('VISUELLE REGIE – HAUPTTEIL\n- POV-Shot')).toBe('VISUELLE REGIE – HAUPTTEIL\n- POV-Shot');
  });
});
