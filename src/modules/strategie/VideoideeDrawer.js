// VideoideeDrawer.js
// Lese- und Schreibansicht einer Videoidee. Die Tabelle bleibt editierbar;
// dieser Drawer ist die zweite Fläche, mit Zurück/Weiter und Autosave.

import { groupItemsByTeilbereich } from './StrategieDetailRenderer.js';
import { splitVideoideeVorschlaege } from './videoideeVorschlag.js';
import { tableSelect } from '../../core/components/TableSelect.js';
import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { cssEscape, fieldSignature, syncCustomPeer } from './videoideeFieldSync.js';
import {
  DRAWER_ID,
  itemTitle,
  renderBody,
  renderVorschlagActions,
  shellHtml
} from './videoidee/videoideeRender.js';
import { analysiereBeschreibungAktion, commitControl, commitFocused } from './videoidee/videoideeCommit.js';
import {
  bindCreator,
  bindProdukt,
  patchFields,
  patchPrio,
  patchStatus,
  refreshBlock
} from './videoidee/videoideeSync.js';

/** Was der Autosave vom Drawer braucht, ohne ihn zu importieren. */
const COMMIT_HOOKS = { renderOpenItem, updateNav };

let openDetail = null;
let keyAbort = null;
let closeTimer = null;

/**
 * Sichtbare Reihenfolge: KI-Vorschläge, dann Kategorien wie in der Tabelle.
 */
export function visibleVideoideen(detail) {
  const { vorschlaege, rest } = splitVideoideeVorschlaege(detail?.items || []);
  const groups = groupItemsByTeilbereich(rest);
  const definierte = detail?.getTeilbereicheFromStrategie?.() || [];
  const kategorien = [...definierte];
  if (!kategorien.includes('Ohne Kategorie')) kategorien.push('Ohne Kategorie');

  const ordered = [...vorschlaege];
  for (const kategorie of kategorien) {
    for (const entry of groups[kategorie] || []) {
      ordered.push(detail.items.find((item) => item.id === entry.id) || entry);
    }
  }
  return ordered;
}

function navState(detail, itemId) {
  const order = visibleVideoideen(detail);
  const index = order.findIndex((item) => String(item.id) === String(itemId));
  return {
    order,
    index,
    total: order.length,
    label: index >= 0 ? `${index + 1} von ${order.length}` : ''
  };
}

export function showEditItemDrawer(detail, itemId) {
  const item = detail.items?.find((entry) => String(entry.id) === String(itemId));
  if (!item) {
    window.toastSystem?.show('Item nicht gefunden', 'error');
    return;
  }

  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }

  openDetail = detail;
  const existing = document.getElementById(DRAWER_ID);
  if (existing) {
    existing.classList.add('show');
    void stepTo(detail, itemId);
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = `${DRAWER_ID}-overlay`;

  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'videoidee-drawer-title');
  panel.className = 'drawer-panel drawer-panel--wide videoidee-drawer';
  panel.id = DRAWER_ID;
  panel.dataset.itemId = String(item.id);
  panel.innerHTML = shellHtml(detail, item, navState(detail, item.id));

  overlay.addEventListener('click', () => closeEditItemDrawer());
  panel.querySelector('.drawer-close-btn')?.addEventListener('click', () => closeEditItemDrawer());

  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  requestAnimationFrame(() => panel.classList.add('show'));

  bindDrawer(detail, panel);
  markOpenRow(detail, item.id);
  bindKeys();
}

function renderOpenItem(detail, itemId, { scroll = false } = {}) {
  const panel = document.getElementById(DRAWER_ID);
  const item = detail.items?.find((entry) => String(entry.id) === String(itemId));
  if (!panel || !item) return;

  panel.dataset.itemId = String(item.id);
  panel.dataset.navIndex = String(navState(detail, item.id).index);
  const title = panel.querySelector('#videoidee-drawer-title');
  if (title) title.textContent = itemTitle(item);
  const actions = panel.querySelector('#videoidee-actions');
  if (actions) actions.innerHTML = renderVorschlagActions(item);
  updateNav(detail, item.id);

  const body = panel.querySelector('.videoidee-drawer__body');
  if (body) {
    body.innerHTML = renderBody(detail, item);
    if (scroll) body.scrollTop = 0;
  }

  bindDrawer(detail, panel);
  markOpenRow(detail, item.id);
}

function updateNav(detail, itemId) {
  const panel = document.getElementById(DRAWER_ID);
  if (!panel) return;
  const nav = navState(detail, itemId);
  const pos = panel.querySelector('#videoidee-pos');
  if (pos) pos.textContent = nav.label;
  const prev = panel.querySelector('[data-action="videoidee-prev"]');
  const next = panel.querySelector('[data-action="videoidee-next"]');
  if (prev) prev.disabled = nav.index <= 0;
  if (next) next.disabled = nav.index < 0 || nav.index >= nav.total - 1;
  panel.dataset.navIndex = String(nav.index);
}

async function stepTo(detail, itemId) {
  const panel = document.getElementById(DRAWER_ID);
  if (!panel) return;
  await commitFocused(panel);
  renderOpenItem(detail, itemId, { scroll: true });
}

async function step(detail, delta) {
  const panel = document.getElementById(DRAWER_ID);
  if (!panel) return;
  await commitFocused(panel);
  const nav = navState(detail, panel.dataset.itemId);
  const next = nav.order[nav.index + delta];
  if (!next) return;
  renderOpenItem(detail, next.id, { scroll: true });
}

function bindKeys() {
  keyAbort?.abort();
  keyAbort = new AbortController();
  document.addEventListener('videoidee-table-rendered', () => {
    if (openDetail) onTableRendered(openDetail);
  }, { signal: keyAbort.signal });
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById(DRAWER_ID)) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (document.querySelector('.table-select__portal')) return;
    const active = document.activeElement;
    if (active?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
    if (!openDetail) return;
    void step(openDetail, e.key === 'ArrowLeft' ? -1 : 1);
  }, { signal: keyAbort.signal });
}

function bindDrawer(detail, panel) {
  tableSelect.init();
  if (panel.dataset.navBound !== '1') {
    panel.dataset.navBound = '1';
    panel.querySelector('[data-action="videoidee-prev"]')?.addEventListener('click', () => {
      void step(detail, -1);
    });
    panel.querySelector('[data-action="videoidee-next"]')?.addEventListener('click', () => {
      void step(detail, 1);
    });
  }

  if (panel.dataset.toggleBound !== '1') {
    panel.dataset.toggleBound = '1';
    panel.addEventListener('click', (e) => {
      const btn = e.target.closest?.('[data-videoidee-toggle]');
      if (!btn || !panel.contains(btn)) return;
      const sectionEl = btn.closest('[data-videoidee-section]');
      setSectionExpanded(sectionEl, btn.getAttribute('aria-expanded') !== 'true');
    });
  }

  const analyseBtn = panel.querySelector('[data-action="analysiere-beschreibung"]');
  if (analyseBtn && analyseBtn.dataset.videoideeBound !== '1') {
    analyseBtn.dataset.videoideeBound = '1';
    analyseBtn.addEventListener('click', () => {
      void analysiereBeschreibungAktion(detail, panel.dataset.itemId, COMMIT_HOOKS, analyseBtn);
    });
  }

  panel.querySelectorAll('[data-field]').forEach((el) => {
    if (el.dataset.videoideeBound === '1') return;
    if (!('value' in el) && el.type !== 'checkbox') return;
    el.dataset.videoideeBound = '1';
    el.dataset.videoideeSaved = fieldSignature(el);
    const commit = () => commitControl(detail, el, COMMIT_HOOKS);
    el._videoideeCommit = commit;
    el.addEventListener('blur', () => { void commit(); });
    if (el.type === 'checkbox' || el.tagName === 'SELECT') {
      el.addEventListener('change', () => { void commit(); });
    }
  });

  const urlInput = panel.querySelector('[data-field="video_link"]');
  urlInput?.addEventListener('input', () => {
    const block = panel.querySelector('[data-videoidee-section="umsetzungsvorgabe"]');
    if (block) block.hidden = !urlInput.value.trim() && !detail.items.find((i) => String(i.id) === panel.dataset.itemId)?.video_link;
  });

  bindCreator(detail, panel.dataset.itemId);
  bindProdukt(detail, panel.dataset.itemId);
  bindCustom(detail, panel);
  bindVorschlag(detail, panel);
  bindAutogrow(panel);
  bindClickToWrite(panel);

  if (panel.dataset.dateBound !== '1') {
    panel.dataset.dateBound = '1';
    panel._dateCleanup = CustomDatePicker.bind(panel) || null;
  }
}

function bindCustom(detail, panel) {
  if (!detail.customColumns?.hasColumns && !panel.querySelector('.custom-col-input')) return;
  panel.querySelectorAll('.custom-col-input').forEach((el) => {
    if (el.dataset.videoideeBound === '1') return;
    el.dataset.videoideeBound = '1';
    const handler = async () => {
      const ok = await detail.customColumns.handleFieldUpdate(el);
      if (ok) syncCustomPeer(el);
    };
    const isChangeOnly = el.type === 'checkbox' || el.tagName === 'SELECT' || el.classList.contains('custom-col-date');
    if (isChangeOnly) el.addEventListener('change', handler);
    else {
      el.addEventListener('blur', handler);
      el.addEventListener('change', handler);
    }
  });
  panel.querySelectorAll('.custom-upload-btn').forEach((btn) => {
    if (btn.dataset.videoideeBound === '1') return;
    btn.dataset.videoideeBound = '1';
    btn.addEventListener('click', () => {
      detail.customColumns.openUploadDrawer(btn, uploadMeta(detail), () => {
        detail.rerenderItemsTable?.();
        renderOpenItem(detail, panel.dataset.itemId, { scroll: false });
      });
    });
  });
}

function uploadMeta(detail) {
  const s = detail.strategie || {};
  return {
    unternehmen: s.unternehmen?.firmenname || '',
    marke: s.marke?.markenname || '',
    kampagne: s.kampagne?.kampagnenname || '',
    kooperationName: s.name || 'Konzept'
  };
}

function bindVorschlag(detail, panel) {
  panel.querySelector('[data-action="uebernehmen-vorschlag"]')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const id = e.currentTarget.dataset.id;
    await detail.vorschlagPanel?.uebernehmen(id);
    if (detail.items.find((item) => String(item.id) === String(id))) {
      renderOpenItem(detail, id, { scroll: false });
    }
  });
  panel.querySelector('[data-action="verwerfen-vorschlag"]')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const id = e.currentTarget.dataset.id;
    const nav = navState(detail, id);
    const neighbor = nav.order[nav.index + 1] || nav.order[nav.index - 1];
    await detail.vorschlagPanel?.verwerfen(id);
    if (detail.items.find((item) => String(item.id) === String(id))) return;
    if (neighbor && detail.items.find((item) => item.id === neighbor.id)) {
      renderOpenItem(detail, neighbor.id, { scroll: true });
    } else {
      closeEditItemDrawer();
    }
  });
}

function onTableRendered(detail) {
  const panel = document.getElementById(DRAWER_ID);
  if (!panel) return;
  const itemId = panel.dataset.itemId;
  const item = detail.items?.find((entry) => String(entry.id) === String(itemId));
  if (!item) {
    const index = Number(panel.dataset.navIndex);
    const order = visibleVideoideen(detail);
    const neighbor = order[index] || order[index - 1] || order[0];
    if (neighbor) renderOpenItem(detail, neighbor.id, { scroll: true });
    else closeEditItemDrawer();
    return;
  }
  markOpenRow(detail, item.id);
  updateNav(detail, item.id);
  patchFields(panel, item);
  if (!panel.querySelector('.form-field--creator')?.contains(document.activeElement)) {
    refreshBlock(detail, item.id, 'creator');
  }
  if (!panel.querySelector('.form-field--produkt')?.contains(document.activeElement)) {
    refreshBlock(detail, item.id, 'produkt');
  }
  patchPrio(detail, panel, item);
  patchStatus(panel, item);
}

function setSectionExpanded(sectionEl, expanded) {
  if (!sectionEl) return;
  const btn = sectionEl.querySelector('[data-videoidee-toggle]');
  const body = sectionEl.querySelector('.videoidee-doc__section-body');
  btn?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  sectionEl.classList.toggle('is-collapsed', !expanded);
  sectionEl.classList.toggle('is-expanded', expanded);
  if (body) body.hidden = !expanded;
  if (expanded) {
    body?.querySelectorAll('textarea.videoidee-doc__text').forEach((area) => {
      requestAnimationFrame(() => autogrow(area));
    });
  }
}

function autogrow(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

function bindAutogrow(panel) {
  const areas = panel.querySelectorAll('textarea.videoidee-doc__text');
  areas.forEach((area) => {
    if (area.dataset.autogrowBound === '1') return;
    area.dataset.autogrowBound = '1';
    area.addEventListener('input', () => autogrow(area));
  });
  requestAnimationFrame(() => areas.forEach(autogrow));
}

function bindClickToWrite(panel) {
  const body = panel.querySelector('.videoidee-drawer__body');
  if (!body || body.dataset.clickWriteBound === '1') return;
  body.dataset.clickWriteBound = '1';
  body.addEventListener('mousedown', (e) => {
    const section = e.target.closest('.videoidee-doc__section');
    if (!section || section.classList.contains('is-collapsed') || e.target.closest('textarea, input, a, button, select')) return;
    const area = section.querySelector('textarea');
    if (!area) return;
    e.preventDefault();
    area.focus();
    const end = area.value.length;
    area.setSelectionRange?.(end, end);
  });
}

export function markOpenRow(detail, itemId) {
  document.querySelectorAll('tr.item-row.is-videoidee-open').forEach((row) => {
    row.classList.remove('is-videoidee-open');
  });
  const selector = `tr.item-row[data-item-id="${cssEscape(String(itemId))}"]`;
  const row = detail?._q?.(selector) || document.querySelector(selector);
  row?.classList.add('is-videoidee-open');
}

export function removeEditItemDrawer() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  keyAbort?.abort();
  keyAbort = null;
  const panel = document.getElementById(DRAWER_ID);
  panel?._dateCleanup?.();
  document.getElementById(`${DRAWER_ID}-overlay`)?.remove();
  panel?.remove();
  document.querySelectorAll('tr.item-row.is-videoidee-open').forEach((row) => {
    row.classList.remove('is-videoidee-open');
  });
  openDetail = null;
}

export function closeEditItemDrawer() {
  const panel = document.getElementById(DRAWER_ID);
  if (!panel) {
    removeEditItemDrawer();
    return;
  }
  void commitFocused(panel);
  panel.classList.remove('show');
  closeTimer = setTimeout(() => {
    closeTimer = null;
    removeEditItemDrawer();
  }, 300);
}
