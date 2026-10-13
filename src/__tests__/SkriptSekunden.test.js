// Zeitmarker und Pruefung: ESM-Spiegel im Editor muss dasselbe rechnen wie der Server.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import {
  stempelSekunden as stempelEsm, zeitmarkerPatch, hatZeitmarker, WOERTER_PRO_SEKUNDE as WPS_ESM
} from '../modules/skripte/skriptSekunden.js';
import {
  pruefeSkript as pruefeEsm, pruefeDokument, hookSekundenMax as hookMaxEsm, findeDoppelungen as doppelEsm
} from '../modules/skripte/skriptPruefung.js';

const require = createRequire(import.meta.url);
const {
  stempelSekunden: stempelCjs, pruefeSkript: pruefeCjs, hookSekundenMax: hookMaxCjs,
  findeDoppelungen: doppelCjs, neueBefunde, pruefHinweis, WOERTER_PRO_SEKUNDE: WPS_CJS
} = require('../../netlify/functions/_shared/skript-context/formatter.js');
const { gesprochenerEntwurf } = require('../../netlify/functions/skript-edit-background.js');

const STAENDE = [
  {
    hook: 'Kennst du das Gefühl, wenn die Leber nach dem Wochenende streikt?',
    hook_visuell: 'Sek. 0–3: Close-up Gesicht',
    hauptteil: 'Ich habe drei Wochen getestet.\n\nDie Mariendistel steckt drin.\n\nIch fühle mich leichter.',
    hauptteil_visuell: 'Sek. 3–6: Dose\n\nSek. 6–8: Kapsel in der Hand\n\nSek. 8–10: Lächeln',
    cta: 'Link in der Bio.',
    cta_visuell: 'Sek. 10–12: Zeigt nach unten'
  },
  {
    hook: 'Vier Veränderungen erleben die meisten Frauen in der Perimenopause. Erkennst du dich wieder?',
    hook_visuell: '0:00–0:03 Frau am Spiegel',
    hauptteil: 'Schlaf wird leichter. Vier Veränderungen erleben die meisten Frauen in der Perimenopause.',
    hauptteil_visuell: '',
    cta: '',
    cta_visuell: ''
  },
  { hook: '', hook_visuell: '', hauptteil: 'Nur Text', hauptteil_visuell: 'Bild ohne Marker', cta: null, cta_visuell: null }
];

const OPTS = [
  { video_laenge: '15-30', verbotene_claims: 'heilt, entgiftet', hook_vorgaben: 'Hook (0–3 Sek.): Leber nennen' },
  { video_laenge: '30-45', verbotene_claims: '', hook_vorgaben: 'Painpoint in Sekunde 1-3 nennen' },
  {}
];

describe('Paritaet ESM und Server', () => {
  it('gleiche Lesegeschwindigkeit', () => {
    expect(WPS_ESM).toBe(WPS_CJS);
  });

  it.each(STAENDE.map((s, i) => [i, s]))('stempelSekunden Stand %i', (_, stand) => {
    expect(stempelEsm(stand)).toEqual(stempelCjs(stand));
  });

  it.each(STAENDE.flatMap((s, i) => OPTS.map((o, j) => [i, j, s, o])))('pruefeSkript Stand %i Optionen %i', (_, __, stand, opts) => {
    expect(pruefeEsm(stand, opts)).toEqual(pruefeCjs(stand, opts));
  });

  it.each([
    'Hook (0–3 Sek.): Leber nennen',
    'innerhalb der ersten 3 Sekunden',
    'Painpoint/Problem in Sekunde 1-3 nennen',
    'in den ersten 1–2 Sekunden',
    'kein Zeitlimit'
  ])('hookSekundenMax „%s“', (text) => {
    expect(hookMaxEsm(text)).toBe(hookMaxCjs(text));
  });
});

describe('hookSekundenMax', () => {
  it('liest die Formate aus den Briefings', () => {
    expect(hookMaxCjs('Hook (0–3 Sek.): Leber nennen')).toBe(3);
    expect(hookMaxCjs('innerhalb der ersten 3 Sekunden')).toBe(3);
    expect(hookMaxCjs('Painpoint/Problem in Sekunde 1-3 nennen')).toBe(3);
    expect(hookMaxCjs('in den ersten 1–2 Sekunden')).toBe(2);
    expect(hookMaxCjs('Leber nennen')).toBeNull();
  });
});

describe('Pruefung markiert, schreibt nichts um', () => {
  it('Hook ueber der Vorgabe: ueber, mit Toleranz von einer Sekunde', () => {
    const lang = { hook: Array.from({ length: 14 }, (_, i) => `wort${i}`).join(' ') };
    expect(pruefeCjs(lang, { hook_vorgaben: 'Hook (0–3 Sek.)' }).hook_zeit).toEqual({ sekunden: 6, max: 3, status: 'ueber' });
    const knapp = { hook: 'eins zwei drei vier fuenf sechs sieben acht neun' };
    expect(pruefeCjs(knapp, { hook_vorgaben: 'Hook (0–3 Sek.)' }).hook_zeit.status).toBe('ok');
  });

  it('Satz aus dem Hauptteil im Hook ist eine Doppelung', () => {
    expect(doppelCjs(STAENDE[1])).toEqual([{
      satz: 'Vier Veränderungen erleben die meisten Frauen in der Perimenopause.',
      zellen: ['hook', 'hauptteil']
    }]);
    expect(doppelEsm(STAENDE[1])).toEqual(doppelCjs(STAENDE[1]));
    expect(doppelCjs(STAENDE[0])).toEqual([]);
  });

  it('neueBefunde meldet nur Neues oder Schlimmeres', () => {
    const vorher = pruefeCjs(STAENDE[1], {});
    expect(neueBefunde(vorher, pruefeCjs(STAENDE[1], {})).doppelungen).toEqual([]);
    const nachher = pruefeCjs({ ...STAENDE[1], cta: 'Vier Veränderungen erleben die meisten von uns.' }, {});
    const neu = neueBefunde(vorher, nachher);
    expect(neu.doppelungen.map((d) => d.zellen)).toEqual([['hook', 'cta'], ['hauptteil', 'cta']]);
    expect(pruefHinweis(neu)).toContain('Steht doppelt in Hauptteil und CTA');
    expect(pruefHinweis(neu)).not.toContain('Hook und Hauptteil');
  });

  it('pruefHinweis ist leer, wenn alles passt', () => {
    expect(pruefHinweis(neueBefunde(null, pruefeCjs(STAENDE[0], {})))).toBe('');
    expect(pruefHinweis(null)).toBe('');
  });

  it('pruefeDokument nimmt Claims vom Produkt und Hook-Vorgabe vom Briefing', () => {
    const p = pruefeDokument({
      ...STAENDE[0],
      hook: 'Dieses Produkt entgiftet deine Leber sofort und ohne jeden Aufwand, wirklich jeden Tag neu.',
      video_laenge: '15-30',
      produkt: { verbotene_claims: 'entgiftet' },
      briefing: { hook_vorgaben: 'Hook (0–3 Sek.)' }
    });
    expect(p.claims).toEqual(['entgiftet']);
    expect(p.hook_zeit.status).toBe('ueber');
  });
});

describe('zeitmarkerPatch', () => {
  it('stempelt alle Visual-Zellen neu, wenn sich der Hook aendert', () => {
    const stand = { ...STAENDE[0], hook: 'Kurz.' };
    const patch = zeitmarkerPatch(stand);
    expect(patch.hook_visuell).toBe('Sek. 0–1: Close-up Gesicht');
    expect(patch.hauptteil_visuell.startsWith('Sek. 1–')).toBe(true);
    expect(patch.cta_visuell).toBeDefined();
  });

  it('laesst die fokussierte Zelle stehen', () => {
    const patch = zeitmarkerPatch({ ...STAENDE[0], hook: 'Kurz.' }, { ausser: ['hauptteil_visuell'] });
    expect(patch).not.toHaveProperty('hauptteil_visuell');
    expect(patch).toHaveProperty('hook_visuell');
  });

  it('Altbestand ohne Zeitmarker bleibt unberuehrt', () => {
    expect(hatZeitmarker(STAENDE[2])).toBe(false);
    expect(zeitmarkerPatch(STAENDE[2])).toEqual({});
  });

  it('nichts geaendert: leerer Patch', () => {
    const fertig = { ...STAENDE[0], ...stempelEsm(STAENDE[0]) };
    expect(zeitmarkerPatch(fertig)).toEqual({});
  });
});

describe('gesprochenerEntwurf', () => {
  const skript = { hook: 'Alter Hook. Zweiter Satz.', hauptteil: 'Haupt', cta: 'CTA' };

  it('ersetzt die markierte Stelle', () => {
    expect(gesprochenerEntwurf(skript, { sektion: 'hook', vorschlag: 'Neu.', ist_visuell: false, selektion_text: 'Alter Hook.' }))
      .toEqual({ hook: 'Neu. Zweiter Satz.', hauptteil: 'Haupt', cta: 'CTA' });
  });

  it('ganze Zelle ohne Markierung, Bundle-Zellen gesprochen', () => {
    const out = gesprochenerEntwurf(skript, {
      sektion: null, vorschlag: null, ist_visuell: false,
      aenderungen: [
        { sektion: 'hauptteil', spalte: 'gesprochen', vorschlag_text: 'Neuer Hauptteil' },
        { sektion: 'cta', spalte: 'visuell', vorschlag_text: 'Bild' }
      ]
    });
    expect(out).toEqual({ hook: 'Alter Hook. Zweiter Satz.', hauptteil: 'Neuer Hauptteil', cta: 'CTA' });
  });

  it('nur Visuelles geaendert: kein Entwurf', () => {
    expect(gesprochenerEntwurf(skript, { sektion: 'hook', vorschlag: 'Bild', ist_visuell: true })).toBeNull();
    expect(gesprochenerEntwurf(skript, { sektion: 'titel', vorschlag: 'Titel', ist_visuell: false })).toBeNull();
  });
});
