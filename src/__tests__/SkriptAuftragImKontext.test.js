// ADR 0056: Edit-Auftrag ist ein Delta auf den Kontext. Offener Vorschlag als Basis.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { buildEditPrompt } = require('../../netlify/functions/skript-edit-background.js');
const {
  AUFTRAG_IM_KONTEXT, ANSCHLUSS_REGEL, offeneVorschlaege, offenerVorschlagBlock
} = require('../../netlify/functions/_shared/skript-edit-prompt.js');
const { fmtCampaignBriefing } = require('../../netlify/functions/_shared/skript-context/briefing-felder.js');
const { buildKontextText } = require('../../netlify/functions/_shared/skript-context.js');

const T = (min) => `2026-10-13T13:${String(min).padStart(2, '0')}:00Z`;

function ctx(overrides = {}) {
  return {
    skript: {
      titel: 'PeriMenopause',
      hook: 'Kennst du das? Plötzlich ist alles anders.',
      hauptteil: 'Ich schlafe schlecht.',
      cta: 'Link in Bio.',
      prompt_kontext: {},
      ...(overrides.skript || {})
    },
    history: overrides.history || [],
    kontext: { master: [], briefing: null, ...(overrides.kontext || {}) },
    modus: null
  };
}

const CHAT = { aktion: 'chat', sektion: 'gesamt', inhalt: 'Erster Satz ist gut, die Frage am Ende sollte lauten: Erkennst du dich wieder?' };

// Verlauf aus Skript 1091321a, 13:25–13:26
const FALL_2 = [
  { rolle: 'assistant', aktion: 'chat', sektion: 'hook', status: 'vorschlag', created_at: T(25),
    inhalt: 'So verstehe ich dein Feedback: …', vorschlag_text: 'Nachts um drei hellwach. Vier Veränderungen.' },
  { rolle: 'user', aktion: 'chat', sektion: 'gesamt', status: 'fertig', created_at: T(26),
    inhalt: 'Schreib die hook eher in richtung: Diese 4 Veränderungen erleben die meisten frauen' },
  { rolle: 'assistant', aktion: 'chat', sektion: 'hook', status: 'vorschlag', created_at: T(27),
    inhalt: 'So verstehe ich dein Feedback: …',
    vorschlag_text: 'Diese 4 Veränderungen erleben die meisten Frauen in der Perimenopause. Kennst du sie auch?' }
];

describe('Grundsatz im Stable-Prompt', () => {
  it('Auftrag im Kontext steht im cachebaren Block, nicht im Task', () => {
    const { stable, task } = buildEditPrompt(ctx(), CHAT);
    expect(stable).toContain(AUFTRAG_IM_KONTEXT);
    expect(stable).toContain('Rolle der Zelle');
    expect(stable).toContain('Nie still streichen');
    expect(task).not.toContain('# AUFTRAG IM KONTEXT');
  });

  it('Anti-Paraphrase betrifft den Wortlaut, nicht Funktion und Kernbegriffe', () => {
    const { stable } = buildEditPrompt(ctx(), CHAT);
    expect(stable).toContain('Das gilt fuer den Wortlaut, nicht fuer Funktion und Kernbegriffe');
    expect(stable).toContain('Was der User gutheisst, bleibt woertlich');
  });

  it('Anschluss-Regel bei Grid-Edits, nicht bei Neuer Geschichte', () => {
    expect(buildEditPrompt(ctx(), CHAT).task).toContain(ANSCHLUSS_REGEL);
    expect(buildEditPrompt(ctx(), { aktion: 'neue_geschichte', sektion: 'hook' }).task).not.toContain(ANSCHLUSS_REGEL);
    expect(ANSCHLUSS_REGEL).toContain('aus Nachbarzellen nicht in die geaenderte Zelle holen');
  });

  it('antwort nennt Basis und Abweichungen', () => {
    const { task } = buildEditPrompt(ctx(), CHAT);
    expect(task).toContain('„Abweichung: …“');
    expect(task).toContain('auf Basis deines letzten Vorschlags');
  });
});

describe('Freier Chat = Button-Semantik', () => {
  it('„neu formulieren“ im Chat behaelt Funktion, Figuren und Aussage', () => {
    const { task } = buildEditPrompt(ctx(), { aktion: 'chat', sektion: 'hook', inhalt: 'formulier den Hook neu' });
    expect(task).toContain('heisst dasselbe wie die Aktion Neu formulieren');
    expect(task).toContain('Andere Situation oder andere Geschichte nur, wenn die Anweisung das ausdruecklich verlangt');
    expect(task).not.toContain('keine Variante des letzten Vorschlags');
  });
});

describe('Kernidee und Abgrenzung im Kontext', () => {
  it('Videoidee ist die Kernidee', () => {
    const text = buildKontextText({ briefing: null }, { video_idee: 'Leber nach dem Wochenende' });
    expect(text).toContain('## Kernidee dieses Videos');
    expect(text).toContain('<user_vorgabe>\nLeber nach dem Wochenende\n</user_vorgabe>');
  });

  it('Umsetzungsideen sind fuer Skripte Abgrenzung, sonst das alte Label', () => {
    const briefing = {
      bereich: 'paid_creator_ads', aktivierung_name: 'Leber', aufgabe: 'Leber im Alltag', umsetzungsideen: ['Video A: Etiketten-Check']
    };
    expect(fmtCampaignBriefing(briefing, { fuerSkript: true })).toContain('Andere Videos des Konzepts (Abgrenzung');
    expect(fmtCampaignBriefing(briefing)).toContain('Vorhandene Umsetzungsideen');
  });
});

describe('Offener Vorschlag als Basis (Fall 2)', () => {
  it('„Erster Satz ist gut …“ baut auf dem offenen Vorschlag auf, nicht auf dem Dokument', () => {
    const { task } = buildEditPrompt(ctx({ history: FALL_2 }), CHAT);
    expect(task).toContain('# OFFENER VORSCHLAG');
    expect(task).toContain('HOOK:\nDiese 4 Veränderungen erleben die meisten Frauen in der Perimenopause. Kennst du sie auch?');
    expect(task).toContain('Was der User daran gutheisst');
    expect(task).toContain('Steht unten ein OFFENER VORSCHLAG, ist er die Basis');
    expect(task.indexOf('# OFFENER VORSCHLAG')).toBeGreaterThan(task.indexOf('# AKTUELLES SKRIPT'));
  });

  it('nur der neueste Vorschlag der Zelle ist offen', () => {
    const offen = offeneVorschlaege(FALL_2);
    expect(offen).toHaveLength(1);
    expect(offen[0].vorschlag_text).toContain('Kennst du sie auch?');
    expect(offenerVorschlagBlock(FALL_2, CHAT)).not.toContain('Nachts um drei');
  });

  it('abgelehnter neuerer Vorschlag ersetzt nichts', () => {
    const history = [...FALL_2, {
      rolle: 'assistant', aktion: 'chat', sektion: 'hook', status: 'abgelehnt', created_at: T(28), vorschlag_text: 'Kennst du diese vier?'
    }];
    expect(offeneVorschlaege(history).map((r) => r.created_at)).toEqual([T(27)]);
  });

  it('spaeter angenommen: veraltet', () => {
    const history = [FALL_2[2], {
      rolle: 'assistant', aktion: 'chat', sektion: 'hook', status: 'angenommen',
      created_at: T(20), updated_at: T(28), vorschlag_text: 'Anderer Hook'
    }];
    expect(offeneVorschlaege(history)).toEqual([]);
  });

  it('verschiedene markierte Stellen derselben Zelle bleiben beide offen', () => {
    const history = [
      { rolle: 'assistant', aktion: 'chat', sektion: 'hook', status: 'vorschlag', selektion_text: 'Kennst du das?', vorschlag_text: 'A', created_at: T(1) },
      { rolle: 'assistant', aktion: 'chat', sektion: 'hook', status: 'vorschlag', selektion_text: 'Plötzlich ist alles anders.', vorschlag_text: 'B', created_at: T(2) }
    ];
    expect(offeneVorschlaege(history)).toHaveLength(2);
  });

  it('Bundle zaehlt pro Zelle; andere Zielzelle zeigt ihn nicht', () => {
    const history = [{
      rolle: 'assistant', aktion: 'chat', sektion: 'gesamt', status: 'vorschlag', created_at: T(1),
      aenderungen: [{ sektion: 'cta', spalte: 'gesprochen', vorschlag_text: 'Neuer CTA' }]
    }];
    expect(offenerVorschlagBlock(history, { aktion: 'chat', sektion: 'cta' })).toContain('CTA:\nNeuer CTA');
    expect(offenerVorschlagBlock(history, { aktion: 'chat', sektion: 'hook' })).toBe('');
  });

  it('ohne offenen Vorschlag kein Block; Visual-Button nie', () => {
    expect(buildEditPrompt(ctx(), CHAT).task).not.toContain('# OFFENER VORSCHLAG');
    expect(offenerVorschlagBlock(FALL_2, { aktion: 'visuell', sektion: 'hook' })).toBe('');
  });

  it('Verlauf zeigt den Stand abgelehnter und angenommener Vorschlaege', () => {
    const { messages } = buildEditPrompt(ctx({
      history: [
        { rolle: 'user', inhalt: 'Hook neu' },
        { rolle: 'assistant', inhalt: 'Hier.', vorschlag_text: 'Alt', status: 'angenommen' }
      ]
    }), CHAT);
    expect(messages[1].content).toContain('Vorschlag (angenommen):\nAlt');
  });
});
