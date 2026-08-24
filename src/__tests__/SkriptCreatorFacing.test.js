import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  extractSkriptAusMaster,
  zusatzInfosMarkdown,
  hatGridInhalt,
  gridFelderFuerSkript
} = require('../../netlify/functions/_shared/skript-creator-facing.js');

const PAID_MD = `## Strategischer Produktionskopf
Arbeitstitel: Ninja Max Pro

## Variantenübersicht

| Version | Testvariable | Audio-Hook | Text-Hook | Visual-Hook | Erwartete Wirkung |
|---|---|---|---|---|---|
| A | Kontrolle | Klein, aber oho. | Ninja Max Pro 6,2 L | Karton aufschneiden | Baseline |
| B | Hook-Variante | | | Karton neben Maßband auf schmaler Ablage. | Größenvergleich |
| C | Hook-Variante | | | Erster Frame Payoff-Pommes, dann Rückschnitt auf Karton. | Payoff first |

## Creator-facing Skript (links gesprochen, rechts zu sehen)

| **LINKS: Was gesprochen wird** | **RECHTS: Was zu sehen ist** |
|---|---|
| *Kein VO. Nur ASMR: Folie raschelt.* | Sek. 0–2: Close-up. Hände schneiden die Folie am Karton auf. |
| *Kein VO. ASMR: Karton öffnet sich.* | Sek. 2–6: Karton wird geöffnet. Gerät wird gehoben. |
| *Leise, natürlich:* „Klein, aber oho.“ | Sek. 6–10: Halbtotale. Text-Overlay: „Ninja Max Pro 6,2 L“. |
| *Kein VO. ASMR: Schublade slidet auf.* | Sek. 10–15: Close-up. Crisper-Einsatz. Text-Overlay: „StiWa-Testsieger 2025“. |
| *Kein VO. ASMR: Pommes fallen.* | Sek. 15–20: Top-View. TK-Pommes in die Schublade. |
| *Kein VO. ASMR: Crunch.* | Sek. 20–27: Goldbraune Pommes, Teller neben Kaffee. |
| *Ruhig:* „Passt.“ | Sek. 27–30: Endframe. On-Screen-CTA: „Jetzt entdecken“. |

Alternativer Opener B: Karton neben Maßband auf schmaler Ablage.
Alternativer Opener C: Erster Frame Payoff-Pommes, dann Rückschnitt auf Karton.

## Produktionshinweise
Timing: 30 Sekunden.
`;

describe('skript-creator-facing', () => {
  it('mappt Zweispalter auf Hook/Hauptteil/CTA inkl. Visuals', () => {
    const { felder } = extractSkriptAusMaster(PAID_MD);
    expect(felder.hook).toContain('Klein, aber oho');
    expect(felder.hook_visuell).toContain('Sek. 0–2');
    expect(felder.hook_visuell).toContain('Sek. 6–10');
    expect(felder.hauptteil).toContain('Schublade');
    expect(felder.hauptteil_visuell).toContain('Sek. 10–15');
    expect(felder.cta).toContain('Passt');
    expect(felder.cta_visuell).toContain('Endframe');
    expect(felder.cta_visuell).toContain('Jetzt entdecken');
  });

  it('zieht Variante B/C als alternative Versionen (Hook-Visual, Rest gleich)', () => {
    const { felder, varianten } = extractSkriptAusMaster(PAID_MD);
    expect(varianten.map((v) => v.label)).toEqual(['B', 'C']);
    expect(varianten[0].felder.hauptteil).toBe(felder.hauptteil);
    expect(varianten[0].felder.cta).toBe(felder.cta);
    expect(varianten[0].felder.hook_visuell).toContain('Maßband');
    expect(varianten[1].felder.hook_visuell).toContain('Payoff-Pommes');
    expect(varianten[0].beschreibung).toMatch(/Variante B/);
  });

  it('laesst Creator-facing und Alternativen aus den Zusatzinfos raus', () => {
    const extra = zusatzInfosMarkdown(PAID_MD);
    expect(extra).toContain('Strategischer Produktionskopf');
    expect(extra).toContain('Produktionshinweise');
    expect(extra).not.toMatch(/Creator-facing/i);
    expect(extra).not.toContain('Variantenübersicht');
    expect(extra).not.toContain('Jetzt entdecken');
    expect(extra).not.toContain('Alternativer Opener');
    expect(extra).not.toContain('Maßband');
    expect(extra).not.toContain('Payoff-Pommes');
  });

  it('nimmt Varianten aus dem Tool-Array, nicht aus dem MD', () => {
    const { varianten } = extractSkriptAusMaster('## Produktionskopf\nNur Rest', {
      hook: 'A-Hook',
      hauptteil: 'Mitte',
      cta: 'Ende',
      hook_visuell: 'A-Bild',
      hauptteil_visuell: 'Mitte-Bild',
      cta_visuell: 'Ende-Bild',
      varianten: [
        { label: 'B', beschreibung: 'Maßband', hook_visuell: 'Karton neben Maßband' },
        { label: 'C', beschreibung: 'Payoff first', hook_visuell: 'Payoff-Pommes zuerst' }
      ]
    });
    expect(varianten).toHaveLength(2);
    expect(varianten[0].felder.hook).toBe('A-Hook');
    expect(varianten[0].felder.hook_visuell).toContain('Maßband');
    expect(varianten[1].felder.hook_visuell).toContain('Payoff-Pommes');
  });

  it('Tool-Felder gewinnen gegen den Parser', () => {
    const { felder } = extractSkriptAusMaster(PAID_MD, { hook: 'Eigener Hook' });
    expect(felder.hook).toBe('Eigener Hook');
    expect(felder.cta).toContain('Passt');
  });

  it('hatGridInhalt erkennt persistierte Felder und extrahierbares MD', () => {
    expect(hatGridInhalt({ hook: 'Hi' })).toBe(true);
    expect(hatGridInhalt({ inhalt_md: PAID_MD })).toBe(true);
    expect(hatGridInhalt({ inhalt_md: '## Produktionskopf\nTitel: X' })).toBe(false);
  });

  it('gridFelderFuerSkript nimmt persistierte Felder vor MD', () => {
    const g = gridFelderFuerSkript({ hook: 'Persist', inhalt_md: PAID_MD });
    expect(g.hook).toBe('Persist');
  });
});
