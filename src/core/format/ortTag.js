// Stadt/Land als Tag, im selben Tag-System wie Branche (tags-compact + tag--*).

import { escapeHtml } from '../format.js';

/**
 * @param {string|null|undefined} value
 * @param {'stadt'|'land'} type
 * @param {(v: string) => string} [sanitize]  Standard: escapeHtml
 * @returns {string} Tag-HTML oder '-'
 */
export function renderOrtTag(value, type, sanitize = escapeHtml) {
  const text = String(value ?? '').trim();
  if (!text) return '-';
  return `<div class="tags tags-compact"><span class="tag tag--${type}">${sanitize(text)}</span></div>`;
}
