import { icon } from './icons/IconSystem.js';

export * from './videoFileNames.js';
export * from './externalAssets.js';

export const MAX_VERSIONS = 3;

// Varianten-Presets fuer Finale-Version-Uploads (Videos + Storys)
export const FINAL_VARIANTS = ['9:16', '4:5', '1:1'];

export function getAvailableVersions(existingVersions, maxVersions = MAX_VERSIONS) {
  const all = Array.from({ length: maxVersions }, (_, i) => i + 1);
  return all.filter(v => !existingVersions.includes(v));
}

// ─── Shared Upload Helpers ──────────────────────────────────

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// Attribut-sicheres Escaping: escaped auch doppelte Anführungszeichen,
// die escapeHtml (textContent->innerHTML) nicht behandelt und die sonst
// HTML-Attributwerte vorzeitig beenden.
export function escapeAttr(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Upload-Drawer Button Icons ──────────────────────────────

export function mdcBtnIcon(svgMarkup) {
  return `<span class="mdc-btn__icon" aria-hidden="true">${svgMarkup}</span>`;
}

export const ICON_PLUS_16 = `${icon('plus-lg')}`;

export const ICON_CHECK_16 = `${icon('check-filled')}`;

export const ICON_UPLOAD_16 = `${icon('upload')}`;
