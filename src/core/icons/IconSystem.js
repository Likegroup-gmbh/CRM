// IconSystem.js
// Zentrale Icon-API mit SVG-Sprite und konfigurierbarer Stroke-Breite.

import * as iconDefsModule from './iconDefs.js';

// Bei HMR: iconDefs.js-Änderungen akzeptieren und Sprite neu mounten
if (import.meta.hot) {
  import.meta.hot.accept('./iconDefs.js', () => {
    ensureSpriteMounted();
  });
}

function getIconDefs() {
  return iconDefsModule.ICON_DEFS;
}

function getIconAliases() {
  return iconDefsModule.ICON_ALIASES;
}

const SPRITE_ID = 'crm-icon-sprite';
const DEFAULT_STROKE = 1.5;

function toKebab(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

function stripIconPrefix(value) {
  return value.startsWith('icon-') ? value.slice(5) : value;
}

/**
 * Normalisiert beliebige Icon-Keys auf canonical kebab-case.
 * Beispiele: icon-auftragsdetails -> auftragsdetails, userCircle -> user-circle
 */
export function normalizeIconKey(key) {
  if (!key) return null;
  const raw = stripIconPrefix(toKebab(key));
  return getIconAliases()[raw] || raw;
}

export function hasIcon(key) {
  const normalized = normalizeIconKey(key);
  return !!(normalized && getIconDefs()[normalized]);
}

/**
 * Stabiler Content-Hash ueber alle Icon-Defs. Erfasst auch reine
 * Path-Aenderungen, die die Symbol-Anzahl nicht veraendern.
 */
export function defsHash() {
  const src = JSON.stringify(getIconDefs());
  let h = 5381;
  for (let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

function buildSpriteSvg(hash = defsHash()) {
  const symbols = Object.entries(getIconDefs())
    .map(([id, def]) => `<symbol id="crm-icon-${id}" viewBox="${def.viewBox}">${def.body}</symbol>`)
    .join('');
  return `<svg id="${SPRITE_ID}" data-icon-hash="${hash}" xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">${symbols}</svg>`;
}

/**
 * Mountet das SVG-Sprite in den DOM. Bei HMR/Modul-Updates wird das Sprite
 * neu gebaut, sobald sich der Inhalt der Icon-Defs aendert (auch ohne
 * Anzahl-Aenderung).
 */
export function ensureSpriteMounted() {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(SPRITE_ID);
  const hash = defsHash();

  if (existing) {
    if (existing.dataset.iconHash !== hash) {
      existing.outerHTML = buildSpriteSvg(hash);
    }
  } else {
    document.body.insertAdjacentHTML('afterbegin', buildSpriteSvg(hash));
  }

  // Debug-Badge anzeigen, wenn ?icon-debug in URL
  if (typeof window !== 'undefined' && window.location.search.includes('icon-debug')) {
    let badge = document.getElementById('icon-debug-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'icon-debug-badge';
      badge.style.cssText = 'position:fixed;bottom:10px;left:10px;background:#000;color:#0f0;padding:8px 12px;font:12px monospace;z-index:99999;border-radius:4px;';
      document.body.appendChild(badge);
    }
    const sprite = document.getElementById(SPRITE_ID);
    const symbolCount = sprite ? sprite.querySelectorAll('symbol').length : 0;
    const hasHome = sprite ? !!sprite.querySelector('#crm-icon-home') : false;
    badge.textContent = `Icons: ${symbolCount} | home: ${hasHome ? 'OK' : 'MISSING'}`;
  }
}

function strokeClass(stroke) {
  return String(stroke).replace('.', '-');
}

/**
 * Rendert ein Icon als <svg><use ...></use></svg>.
 * @param {string} key - beliebiger Icon-Key (mit oder ohne icon- Prefix)
 * @param {Object} [options]
 * @param {number} [options.stroke=1.5] - Stroke-Breite (1 | 1.5)
 * @param {boolean} [options.filled] - Fill statt Stroke (Default: def.filled)
 * @param {number|string} [options.size] - optionale feste Größe in px
 * @returns {string} SVG-HTML
 */
export function icon(key, options = {}) {
  const normalized = normalizeIconKey(key);
  if (!normalized) return '';

  ensureSpriteMounted();

  const defs = getIconDefs();
  const isMissing = !defs[normalized];
  const def = defs[normalized] || defs.missing;
  const id = isMissing ? 'missing' : normalized;
  const stroke = options.stroke ?? DEFAULT_STROKE;

  if (isMissing && typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    console.warn(`[IconSystem] Unbekannter Icon-Key: "${key}" (normalisiert "${normalized}") – zeige "missing"-Glyph`);
  }
  const size = options.size;
  const sizeAttr = size ? ` width="${size}" height="${size}"` : '';
  const extraClass = options.className ? ` ${options.className}` : '';
  const filled = options.filled ?? def.filled;
  const filledClass = filled ? ' crm-icon--filled' : '';

  if (typeof window !== 'undefined' && window.location.search.includes('icon-debug')) {
    console.log(`[IconSystem] key="${key}" normalized="${normalized}" id="${id}" hasDef=${!!defs[normalized]}`);
  }

  return `<svg class="crm-icon crm-icon--stroke-${strokeClass(stroke)}${filledClass}${extraClass}" viewBox="${def.viewBox}" aria-hidden="true"${sizeAttr}><use href="#crm-icon-${id}"></use></svg>`;
}

/**
 * Tabellen-Zelle fuer PDF/Beleg-Links: Icon statt Text "PDF".
 * @param {Array<{open_url?: string, file_url?: string}>|null} pdfs
 * @param {string|null} [fallbackUrl]
 * @returns {string}
 */
export function renderPdfLinks(pdfs, fallbackUrl = null) {
  const list = Array.isArray(pdfs) ? pdfs.filter(p => p?.open_url || p?.file_url) : [];
  if (list.length) {
    return list.map((p, i) => {
      const url = p.open_url || p.file_url;
      const title = list.length > 1 ? `PDF ${i + 1}` : 'PDF öffnen';
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="${title}">${icon('pdf')}</a>`;
    }).join(' ');
  }
  if (fallbackUrl) {
    return `<a href="${fallbackUrl}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="PDF öffnen">${icon('pdf')}</a>`;
  }
  return '-';
}
