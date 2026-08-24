import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { buildPrompt } = require('../../netlify/functions/skript-generate-background.js');
const { fmtMasterBlock } = require('../../netlify/functions/_shared/skript-master.js');

const seedDir = join(dirname(fileURLToPath(import.meta.url)), '../modules/skripte/master/seed');

function loadSeed(file) {
  return readFileSync(join(seedDir, file), 'utf8');
}

const SEEDS = {
  basis: loadSeed('00-basis.md'),
  owned_social: loadSeed('01-owned-social.md'),
  paid_creator_ads: loadSeed('02-paid-creator-ads.md'),
  influencer_marketing: loadSeed('03-influencer-marketing.md')
};

describe('Master-Seed-Templates', () => {
  it('Basis enthaelt Schutzregeln und Kategorie-Schicht', () => {
    expect(SEEDS.basis).toContain('Schutzregeln');
    expect(SEEDS.basis).toContain('Strategische Übergabe');
    expect(SEEDS.basis).toMatch(/Kategorie/i);
    expect(SEEDS.basis.length).toBeGreaterThan(10000);
  });

  it('Owned liefert Szenenplan-Tabelle als Ausgabe-Template', () => {
    expect(SEEDS.owned_social).toContain('## 1.14 Drehfertiger Aufbau');
    expect(SEEDS.owned_social).toContain('### C. Szenenplan');
    expect(SEEDS.owned_social).toContain('| Szene/Zeit |');
    expect(SEEDS.owned_social).toContain('| Gesprochen |');
  });

  it('Paid liefert Variantenübersicht + Zweispalter', () => {
    expect(SEEDS.paid_creator_ads).toContain('## 2.19 Drehfertiger Aufbau');
    expect(SEEDS.paid_creator_ads).toContain('### B. Variantenübersicht');
    expect(SEEDS.paid_creator_ads).toContain('| Version | Testvariable |');
    expect(SEEDS.paid_creator_ads).toContain('LINKS: Was gesprochen wird');
    expect(SEEDS.paid_creator_ads).toContain('RECHTS: Was zu sehen ist');
  });

  it('Influencer liefert Konzeptkarte', () => {
    expect(SEEDS.influencer_marketing).toContain('## 3.13 Drehfertiger Aufbau');
    expect(SEEDS.influencer_marketing).toContain('### A. Konzeptkarte');
    expect(SEEDS.influencer_marketing).toContain('Must-say');
    expect(SEEDS.influencer_marketing).toContain('Must-show');
  });
});

describe('Prompt-Assembly mit echten Seeds', () => {
  function docsFor(bereich) {
    return [
      { bereich: 'basis', name: 'Basis', version: 1, inhalt: SEEDS.basis },
      { bereich, name: bereich, version: 1, inhalt: SEEDS[bereich] }
    ];
  }

  it.each([
    ['owned_social', '1.14', 'Szenenplan'],
    ['paid_creator_ads', '2.19', 'Variantenübersicht'],
    ['influencer_marketing', '3.13', 'Konzeptkarte']
  ])('%s: Template landet im cachebaren Stable-Block, nicht im Task', (bereich, nr, marker) => {
    const master = docsFor(bereich);
    const { stable, task } = buildPrompt({
      dna: [{ name: 'Global', layer_typ: 'global', version: 1, inhalt: 'DNA-Regel' }],
      beispiele: [],
      antiPatterns: [],
      master,
      bereich
    }, { video_idee: 'Testdreh', modus: 'dynamisch' });

    expect(stable).toContain(nr);
    expect(stable).toContain(marker);
    expect(stable.indexOf('MASTER-REGELWERK')).toBeLessThan(stable.indexOf('SKRIPT-DNA'));
    expect(fmtMasterBlock(master).length).toBeGreaterThan(20000);
    expect(task).not.toContain(SEEDS.basis.slice(0, 80));
    expect(task).toContain('inhalt_md');
    expect(task).toContain(bereich === 'owned_social' ? 'Owned Social'
      : bereich === 'paid_creator_ads' ? 'Paid Creator Ads'
        : 'Influencer Marketing');
  });

  it('Regie-Modus bleibt im variablen Task (Cache-Prefix bleibt stabil)', () => {
    const { stable, task } = buildPrompt({
      dna: [],
      beispiele: [],
      antiPatterns: [],
      master: docsFor('owned_social'),
      bereich: 'owned_social',
      modus: { name: 'Klassisch', inhalt: 'Ruhige Bloecke, 5-10s.' }
    }, { video_idee: 'x' });

    expect(task).toContain('REGIE-MODUS: Klassisch');
    expect(task).toContain('Ruhige Bloecke, 5-10s.');
    expect(stable).not.toContain('Ruhige Bloecke, 5-10s.');
    expect(stable).toContain('## 1.14');
  });
});
