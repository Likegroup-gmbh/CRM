// Schublade eines Casting-Eintrags.
// Oben das Instagram-Profil, darunter dieselben Felder wie in der Tabelle.
// Speichern passiert beim Verlassen des Feldes, die Zeile uebernimmt den Wert.

import { DRAWER_EXIT_MS } from '../../core/animation/drawer.js';
import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { renderIgFetchButton } from './sourcingIgCell.js';
import { rowCanWrite } from './castingPreisZellen.js';
import { renderBody, renderHeader, zahl } from './castingDetailDrawerView.js';

const DRAWER_ID = 'casting-detail-drawer';

let openDetail = null;
let openItemId = null;
let panel = null;
let overlay = null;
let bodyAbort = null;


function bindBody(detail) {
  bodyAbort?.abort();
  bodyAbort = new AbortController();
  const { signal } = bodyAbort;
  panel.querySelectorAll('input[data-field], textarea[data-field]').forEach(el => {
    el.addEventListener('change', () => speichern(detail, el), { signal });
    el.addEventListener('blur', () => speichern(detail, el), { signal });
  });
  panel.querySelectorAll('.custom-col-input').forEach(el => {
    const handler = () => detail.customColumns?.handleFieldUpdate(el);
    el.addEventListener('change', handler, { signal });
    el.addEventListener('blur', handler, { signal });
  });
  panel.querySelectorAll('.custom-upload-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      detail.customColumns?.openUploadDrawer(btn, detail._buildUploadMetadaten?.() || {}, () => {
        detail.rerenderTable?.();
        paint(detail);
      });
    }, { signal });
  });
  const cleanup = CustomDatePicker.bind(panel);
  if (cleanup) signal.addEventListener('abort', cleanup, { once: true });
}

async function speichern(detail, el) {
  await detail.handleFieldUpdate(el);
  const item = detail.items?.find(i => i.id === el.dataset.itemId);
  const follower = panel?.querySelector('[data-casting-follower]');
  if (follower && item && el.dataset.field === 'follower_instagram') {
    follower.textContent = zahl(item.follower_instagram);
  }
  detail.refreshItemRow?.(el.dataset.itemId);
}

function paint(detail) {
  const item = detail.items?.find(i => i.id === openItemId);
  if (!item || !panel) {
    closeCastingDetailDrawer();
    return;
  }
  const name = panel.querySelector('[data-field="name"]');
  if (name && document.activeElement !== name) name.value = item.name || '';
  const actions = panel.querySelector('[data-casting-header-actions]');
  if (actions) {
    const abruf = rowCanWrite(detail, item) ? renderIgFetchButton(item) : '';
    actions.innerHTML = `${abruf}<button type="button" class="drawer-close-btn" data-close-casting-detail aria-label="Schließen">&times;</button>`;
  }
  const body = panel.querySelector('[data-casting-detail-body]');
  if (body) body.innerHTML = renderBody(detail, item);
  bindBody(detail);
}

export function openCastingDetailDrawer(detail, itemId) {
  const item = detail.items?.find(i => i.id === itemId);
  if (!item) return;
  openDetail = detail;
  openItemId = itemId;
  closeCastingDetailDrawer({ immediate: true, keepState: true });
  openDetail = detail;
  openItemId = itemId;

  overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = `${DRAWER_ID}-overlay`;

  panel = document.createElement('div');
  panel.className = 'drawer-panel drawer-panel--wide casting-detail-drawer';
  panel.id = DRAWER_ID;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Casting-Eintrag');
  panel.innerHTML = renderHeader(detail, item);

  overlay.addEventListener('click', () => closeCastingDetailDrawer());
  panel.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-casting-detail]')) closeCastingDetailDrawer();
  });

  document.body.appendChild(overlay);
  document.body.appendChild(panel);
  paint(detail);
  requestAnimationFrame(() => panel?.classList.add('show'));
}

export function refreshCastingDrawer(detail, itemId) {
  if (!panel || openDetail !== detail || openItemId !== itemId) return;
  paint(detail);
}

export function closeCastingDetailDrawer({ immediate = false, keepState = false } = {}) {
  bodyAbort?.abort();
  bodyAbort = null;
  const currentPanel = panel;
  const currentOverlay = overlay;
  panel = null;
  overlay = null;
  if (!keepState) {
    openDetail = null;
    openItemId = null;
  }
  if (!currentPanel && !currentOverlay) return;
  currentPanel?.classList.remove('show');
  const remove = () => {
    currentOverlay?.remove();
    currentPanel?.remove();
  };
  if (immediate) remove();
  else setTimeout(remove, DRAWER_EXIT_MS);
}
