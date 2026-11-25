import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..');

/** Der Drawer-Kopf zeigt sein Bild klein und rund, nicht als Tabellenzelle. */
const ERLAUBT_TABLE_AVATAR = ['src/core/format/tableIdentity.js', 'src/modules/creator/creatorDrawer.js'];

function dateien(ordner, endung) {
  const abs = join(ROOT, ordner);
  return readdirSync(abs).flatMap((name) => {
    const pfad = join(abs, name);
    if (statSync(pfad).isDirectory()) return name === '__tests__' ? [] : dateien(relative(ROOT, pfad), endung);
    return pfad.endsWith(endung) ? [relative(ROOT, pfad)] : [];
  });
}

const lies = (datei) => readFileSync(join(ROOT, datei), 'utf8');

describe('Namenszelle in Tabellen', () => {
  it('baut Bild und Name nur ueber tableIdentity.js', () => {
    const verstoesse = dateien('src', '.js').flatMap((datei) => {
      const text = lies(datei);
      const treffer = [];
      if (/class="table-logo/.test(text)) treffer.push('table-logo');
      if (/col-name-with-icon|koop-creator-|table-avatar--sourcing/.test(text)) treffer.push('altes Zellmuster');
      if (/class="table-avatar/.test(text) && !ERLAUBT_TABLE_AVATAR.includes(datei)) treffer.push('table-avatar von Hand');
      return treffer.map((was) => `${datei}: ${was}`);
    });
    expect(verstoesse).toEqual([]);
  });

  it('legt die Bildgroesse als rem-Variable fest', () => {
    expect(lies('assets/styles/variables.css')).toMatch(/--size-table-avatar:\s*[\d.]+rem;/);
  });

  it('setzt am Tabellenbild keine festen Pixelgroessen', () => {
    const verstoesse = dateien('assets/styles', '.css').flatMap((datei) =>
      lies(datei).split('}')
        .map((block) => block.split('{'))
        .filter(([selektor, rumpf]) => rumpf && /\.table-avatar/.test(selektor))
        .filter(([, rumpf]) => /(^|[\s;])(min-)?(width|height):\s*\d+px/.test(rumpf))
        .map(([selektor]) => `${datei}: ${selektor.trim()}`)
    );
    expect(verstoesse).toEqual([]);
  });
});
