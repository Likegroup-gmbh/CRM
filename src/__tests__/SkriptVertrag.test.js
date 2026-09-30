import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { stempelSekunden, pruefeSkript } = require('../../netlify/functions/_shared/skript-context/formatter.js');
const { fmtReferenzKarte } = require('../../netlify/functions/_shared/skript-referenz-karte.js');
const { buildKontextText } = require('../../netlify/functions/_shared/skript-context.js');
const { stripMasterVorlagen } = require('../../netlify/functions/_shared/skript-master.js');

describe('stempelSekunden', () => {
  it('rechnet die Uhr aus den gesprochenen Woertern und laeuft durch', () => {
    const out = stempelSekunden({
      hook: 'eins zwei drei vier fuenf',
      hook_visuell: 'Gesicht am Fenster',
      hauptteil: 'sechs sieben acht neun',
      hauptteil_visuell: 'Sek. 0–9: Hand am Glas',
      cta: '',
      cta_visuell: ''
    });
    expect(out.hook_visuell).toBe('Sek. 0–2: Gesicht am Fenster');
    expect(out.hauptteil_visuell).toBe('Sek. 2–4: Hand am Glas');
    expect(out.cta_visuell).toBeNull();
  });
});

describe('pruefeSkript', () => {
  it('flaggt Laenge und verbotene Claims, schreibt nichts um', () => {
    const r = pruefeSkript({
      hook: 'Das heilt alles sofort.',
      hauptteil: 'Kurz.',
      cta: 'Los.'
    }, { video_laenge: '30-45', verbotene_claims: 'heilt alles\nGratis' });
    expect(r.laenge.status).toBe('unter');
    expect(r.claims).toEqual(['heilt alles']);
    expect(r.hook).toBeUndefined();
  });
});

describe('Referenz-Karte', () => {
  it('nimmt die Karte und nicht das Rohtranskript', () => {
    const text = buildKontextText({}, {
      nur_karte: true,
      referenz_karte: { hook_mechanik: 'Frage in den Raum', pace: 'schnell', cta_mechanik: 'Einladung' },
      referenz_video: { transkript: 'ROHTRANSKRIPT-DARF-NICHT-REIN' }
    });
    expect(text).toContain('Hook-Mechanik: Frage in den Raum');
    expect(text).not.toContain('ROHTRANSKRIPT-DARF-NICHT-REIN');
    expect(fmtReferenzKarte({ hook_mechanik: 'x', pace: '', cta_mechanik: '' })).toContain('Hook-Mechanik: x');
  });

  it('ohne Karte und mit nur_karte bleibt das Transkript draussen', () => {
    const text = buildKontextText({}, {
      nur_karte: true,
      referenz_video: { transkript: 'ROHTRANSKRIPT-DARF-NICHT-REIN' }
    });
    expect(text).not.toContain('ROHTRANSKRIPT-DARF-NICHT-REIN');
  });
});

describe('stripMasterVorlagen', () => {
  it('schneidet Drehfertig und Shotlist samt Unterpunkten, laesst den Rest', () => {
    const md = [
      '## Regeln',
      'Bleibt.',
      '## 1.14 Drehfertiger Aufbau',
      '### C. Szenenplan',
      '| a | b |',
      '### H. Shotlist',
      'Shot weg',
      '## Danach',
      'Bleibt auch.'
    ].join('\n');
    const out = stripMasterVorlagen(md);
    expect(out).toContain('## Regeln');
    expect(out).toContain('Bleibt auch.');
    expect(out).not.toContain('Szenenplan');
    expect(out).not.toContain('Shot weg');
  });
});
