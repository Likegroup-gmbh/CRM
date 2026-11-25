// Guard: Die Auth-Seiten unter src/auth/ laden ihr CSS selbst (nicht über src/main.js).
// Nach dem Split von components.css fehlten buttons.css und forms.css, dadurch
// waren Buttons und Passwort-Toggle ungestylt.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const AUTH_DIR = join(dirname(fileURLToPath(import.meta.url)), '../auth');
const REQUIRED = ['variables', 'base', 'layout', 'buttons', 'forms', 'components'];
const pages = readdirSync(AUTH_DIR).filter(file => file.endsWith('.html'));

describe.each(pages)('%s', (page) => {
  const html = readFileSync(join(AUTH_DIR, page), 'utf8');
  const hrefs = [...html.matchAll(/<link rel="stylesheet" href="([^"]+\.css)"/g)].map(m => m[1]);

  it.each(REQUIRED)('verlinkt %s.css', (name) => {
    expect(hrefs).toContain(`../../assets/styles/${name}.css`);
  });

  it('alle lokalen Stylesheets existieren', () => {
    for (const href of hrefs.filter(h => !h.startsWith('http'))) {
      expect(existsSync(resolve(AUTH_DIR, href)), href).toBe(true);
    }
  });

  if (html.includes('CustomDatePicker')) {
    it('verlinkt icons.css für das Kalender-Icon', () => {
      expect(hrefs).toContain('../../assets/styles/icons.css');
    });
  }
});
