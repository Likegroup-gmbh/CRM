// Guard: .custom-date-picker__popover--fixed muss position: fixed !important
// setzen. Ohne !important verliert die Regel gegen
// .data-table .custom-date-picker__popover { position: absolute } und der
// Popover landet mit Viewport-Koordinaten als absolute Offset unten rechts.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CSS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../assets/styles/components.css'
);

function extractFixedPopoverRule(css) {
  const match = css.match(/\.custom-date-picker__popover--fixed\s*\{([^}]+)\}/);
  if (!match) throw new Error('.custom-date-picker__popover--fixed in components.css nicht gefunden');
  return match[1];
}

describe('CustomDatePicker fixed popover CSS', () => {
  it('setzt position: fixed !important gegen die Absolute-Default-Regel', () => {
    const css = readFileSync(CSS_PATH, 'utf8');
    const rule = extractFixedPopoverRule(css);

    expect(rule).toMatch(/position:\s*fixed\s*!important/);
    expect(rule).toMatch(/z-index:\s*99999\s*!important/);
  });
});
