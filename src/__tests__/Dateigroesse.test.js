import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const MAX_ZEILEN = 400;
const ROOT = join(__dirname, '..', '..');

const ORDNER = [
  'src/modules/share',
  'src/modules/shares',
  'supabase/functions/share-list',
  'supabase/functions/einladung',
  'supabase/functions/_shared',
];

const DATEI_MUSTER = [
  { ordner: 'src/core/components', muster: /^share/i },
  { ordner: 'src/modules/skripte', muster: /^skriptPaket/i },
  { ordner: 'src/__tests__', muster: /^(share|guest|einladung|skriptPaket|accountReturn|zugang|dateigroesse)/i },
];

function dateienIn(ordner) {
  const abs = join(ROOT, ordner);
  return readdirSync(abs).flatMap((name) => {
    const pfad = join(abs, name);
    return statSync(pfad).isDirectory() ? dateienIn(relative(ROOT, pfad)) : [pfad];
  });
}

function ueberwachteDateien() {
  const ausOrdnern = ORDNER.flatMap(dateienIn);
  const ausMustern = DATEI_MUSTER.flatMap(({ ordner, muster }) => (
    readdirSync(join(ROOT, ordner))
      .filter((name) => muster.test(name))
      .map((name) => join(ROOT, ordner, name))
  ));
  return [...new Set([...ausOrdnern, ...ausMustern])].filter((pfad) => /\.(js|ts)$/.test(pfad));
}

function zeilen(pfad) {
  const text = readFileSync(pfad, 'utf8');
  return text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length;
}

describe('Dateigröße', () => {
  it(`hält jede überwachte Datei bei höchstens ${MAX_ZEILEN} Zeilen`, () => {
    const zuGross = ueberwachteDateien()
      .map((pfad) => ({ datei: relative(ROOT, pfad), zeilen: zeilen(pfad) }))
      .filter((f) => f.zeilen > MAX_ZEILEN);
    expect(zuGross).toEqual([]);
  });
});
