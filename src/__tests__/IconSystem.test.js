// IconSystem.test.js
// Guard: haelt das zentrale Icon-System intakt.
// 1) Verbot neuer inline <svg> in src/**/*.js (Allowlist fuer bewusste Ausnahmen)
// 2) Alle Registry-Keys (ENTITY_ICONS, ICON_ALIASES, ROUTE_CONFIG.entity) existieren in ICON_DEFS
// 3) buildSpriteSvg enthaelt fuer jeden Def-Key genau ein <symbol>

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ICON_DEFS, ICON_ALIASES } from '../core/icons/iconDefs.js';
import { ENTITY_ICONS } from '../core/icons/entityIcons.js';
import { icon, hasIcon, normalizeIconKey, defsHash } from '../core/icons/IconSystem.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');

// Inline-<svg> ist verboten – mit wenigen, an der Form erkennbaren Ausnahmen:
// - Spinner (viewBox 0 0 50 50, animiert, kein Icon-Glyph)
// - Brand-Logos / Charts mit nicht-24er viewBox (PDF-Generatoren, Donuts)
// - IconSystem-interne Sprite-Templates (${symbols}, <use>)
// Inline-<svg> ist verboten – mit wenigen, klar identifizierbaren Ausnahmen:
// - Spinner (viewBox 0 0 50 50, animiert, kein Icon-Glyph)
// - Brand-Logos / PDFs (viewBox 0 0 120 66 oder 0 0 256 256)
// - IconSystem-intern (Sprite-Template, <use>-Referenzen, crm-icon-Output)
// - Donut-Chart (200er viewBox) und animierter Progress-Circle in ProduktDoc
const ALLOWED_SVG = /<svg[^>]*(viewBox="0 0 50 50"|viewBox="0 0 120 66"|viewBox="0 0 256 256"|viewBox="0 0 200 200"|class="mdc-spinner|class="crm-icon|id="\$\{SPRITE_ID\}"|\$\{symbols\}|<use)/;
const ALLOWED_FILES = new Set([
  'src/core/icons/IconSystem.js',                     // Sprite-Template + icon()-Output
  'src/modules/produkt/ProduktDoc.js',                // animierter Progress-Circle
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      walk(full, out);
    } else if (entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

describe('IconSystem Guard', () => {
  it('keine inline Icon-<svg> in src/**/*.js (nur Spinner/Brand/Chart erlaubt)', () => {
    const files = walk(SRC);
    const offenders = [];
    const svgRe = /<svg[\s\S]*?<\/svg>/g;
    for (const abs of files) {
      const rel = path.relative(ROOT, abs);
      if (ALLOWED_FILES.has(rel)) continue;
      const src = fs.readFileSync(abs, 'utf8');
      let m;
      while ((m = svgRe.exec(src)) !== null) {
        if (!ALLOWED_SVG.test(m[0])) offenders.push(`${rel}: ${m[0].slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('jeder ENTITY_ICONS-Wert existiert als Icon-Def', () => {
    for (const [entity, key] of Object.entries(ENTITY_ICONS)) {
      expect(hasIcon(key), `ENTITY_ICONS.${entity} -> "${key}" fehlt in ICON_DEFS`).toBe(true);
    }
    expect(ENTITY_ICONS['projekt-erstellen']).toBe('plus-sign');
    expect(ENTITY_ICONS.creator).toBe('creator');
    expect(ENTITY_ICONS.creators).toBe('creator');
    expect(ENTITY_ICONS.management).toBe('management');
  });

  it('jeder ICON_ALIASES-Wert zeigt auf einen existierenden Def-Key', () => {
    for (const [alias, target] of Object.entries(ICON_ALIASES)) {
      expect(ICON_DEFS[target], `ICON_ALIASES.${alias} -> "${target}" fehlt`).toBeTruthy();
    }
  });

  it('normalizeIconKey mappt Aliase und kebab-case korrekt', () => {
    expect(normalizeIconKey('userCircle')).toBe('user-circle');
    expect(normalizeIconKey('icon-campaign')).toBe('campaign');
    expect(normalizeIconKey('koops-videos')).toBe('video');
    expect(normalizeIconKey('icon-plus')).toBe('plus');
    expect(normalizeIconKey('icon-plus-sign')).toBe('plus-sign');
    expect(normalizeIconKey('icon-creator')).toBe('creator');
    expect(normalizeIconKey('creator')).toBe('creator');
    expect(normalizeIconKey('modus-klassisch')).toBe('clapperboard');
    expect(normalizeIconKey('modus-dynamisch')).toBe('spark-doc');
    expect(normalizeIconKey('ai-visual')).toBe('skripte');
  });

  it('buildSpriteSvg enthaelt pro Def-Key genau ein <symbol>', () => {
    // icon() triggert ensureSpriteMounted; wir bauen das Sprite ueber das DOM
    icon('home');
    const sprite = document.getElementById('crm-icon-sprite');
    expect(sprite).toBeTruthy();
    const ids = [...sprite.querySelectorAll('symbol')].map(s => s.id.replace('crm-icon-', ''));
    const defKeys = Object.keys(ICON_DEFS);
    expect(ids.sort()).toEqual(defKeys.sort());
    expect(sprite.dataset.iconHash).toBe(defsHash());
  });

  it('icon() rendert missing-Glyph + Warnung bei unbekanntem Key', () => {
    const html = icon('definitiv-nicht-vorhanden-xyz');
    expect(html).toContain('#crm-icon-missing');
  });

  it('icon() respektiert className-Option', () => {
    const html = icon('check', { className: 'icon-16 foo' });
    expect(html).toContain('icon-16 foo');
  });

  it('filled-Defs (plus-sign) bekommen crm-icon--filled', () => {
    expect(icon('plus-sign')).toContain('crm-icon--filled');
    expect(icon('plus')).not.toContain('crm-icon--filled');
  });
});
