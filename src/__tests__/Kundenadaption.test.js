import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { strategieItemsSelect } from '../modules/strategie/StrategieService.js';

const require = createRequire(import.meta.url);
const {
  kundenadaptionBlocker,
  kundenadaptionAusTool,
  buildKundenadaptionPrompt
} = require('../../netlify/functions/_shared/kundenadaption.js');

const referenz = {
  video_link: 'https://tiktok.com/x',
  umsetzungsvorgabe: 'Nur die Hook',
  transkript: 'Hook und Rest',
  kundenadaption: null
};

describe('kundenadaptionBlocker', () => {
  it('laesst eine Videoreferenz mit Vorgabe und Transkript durch', () => {
    expect(kundenadaptionBlocker(referenz)).toBeNull();
  });

  it('blockt Idee, fehlende Vorgabe und fehlendes Material', () => {
    expect(kundenadaptionBlocker({ ...referenz, video_link: null })).toBe('Nur eine Videoreferenz');
    expect(kundenadaptionBlocker({ ...referenz, umsetzungsvorgabe: '  ' })).toBe('Umsetzungsvorgabe fehlt');
    expect(kundenadaptionBlocker({ ...referenz, transkript: '' })).toBe('Transkript, Caption oder Beschreibung fehlt');
  });

  it('laesst Caption oder Beschreibung ohne Transkript durch', () => {
    expect(kundenadaptionBlocker({ ...referenz, transkript: '', caption: 'lecker' })).toBeNull();
    expect(kundenadaptionBlocker({ ...referenz, transkript: '', beschreibung: 'Sandwich-Video' })).toBeNull();
  });
});

describe('kundenadaptionAusTool', () => {
  it('setzt Absatz und Punkte zusammen', () => {
    const text = kundenadaptionAusTool({
      absatz: 'Die Hook wird zum Produktproblem.',
      punkte: ['- Hook auf den Pain', 'Beweis mit dem Produkt', 'CTA']
    });
    expect(text).toBe([
      'Die Hook wird zum Produktproblem.',
      '',
      '- Hook auf den Pain',
      '- Beweis mit dem Produkt',
      '- CTA'
    ].join('\n'));
  });

  it('lehnt zu duenne Antworten ab', () => {
    expect(kundenadaptionAusTool({ absatz: 'Nur das', punkte: ['einer'] })).toBe('');
    expect(kundenadaptionAusTool(null)).toBe('');
  });
});

describe('buildKundenadaptionPrompt', () => {
  it('stellt die Umsetzungsvorgabe vor Transkript und Briefing', () => {
    const { stable, task } = buildKundenadaptionPrompt({
      briefing: {},
      produkte: [{ name: 'Toastie' }],
      personas: [],
      item: {
        umsetzungsvorgabe: 'Nur die Hook',
        beschreibung: 'Sandwich-Video',
        caption: 'lecker',
        transkript: 'Schau mal'
      }
    });
    expect(stable).toContain('Umsetzungsvorgabe ist der Fokus');
    expect(task.indexOf('Nur die Hook')).toBeLessThan(task.indexOf('Schau mal'));
    expect(task).toContain('Toastie');
    expect(task).not.toContain('Transkript nicht verfuegbar');
  });

  it('weist ohne Transkript auf Umsetzungsvorgabe und Caption hin', () => {
    const { task } = buildKundenadaptionPrompt({
      briefing: {},
      produkte: [],
      personas: [],
      item: {
        umsetzungsvorgabe: 'Nur die Hook',
        caption: 'lecker',
        transkript: '  '
      }
    });
    expect(task).toContain('Transkript nicht verfuegbar, stuetze dich auf Umsetzungsvorgabe und Caption.');
  });
});

describe('strategieItemsSelect', () => {
  it('laesst die Umsetzungsvorgabe beim Kunden weg', () => {
    const kunde = strategieItemsSelect(true);
    const team = strategieItemsSelect(false);
    expect(kunde).not.toMatch(/(^|,\s*)umsetzungsvorgabe(,|\s)/);
    expect(kunde).toContain('kundenadaption');
    expect(team.trim().startsWith('*')).toBe(true);
  });
});
