// CastingKategorienDrawer.js
// Kategorien-Verwaltung eines Castings (anlegen, umbenennen, sortieren, loeschen).
// Die Liste liegt kommagetrennt in creator_auswahl.teilbereich, der Eintrag
// traegt den Namen in creator_auswahl_items.kategorie (ADR 0049).

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { escapeAttr } from '../../core/VideoUploadUtils.js';
import { icon } from '../../core/icons/IconSystem.js';
import {
  serializeTeilbereiche,
  pruefeKategorieName,
  reorderCastingItemsByKategorien
} from './castingKategorien.js';

const DRAWER_ID = 'casting-kategorien-drawer';

let _reorderUnbind = [];
let _draggedRow = null;

function toast(message, type = 'success') {
  window.toastSystem?.show(message, type);
}

export function renderKategorienDrawerBody(kategorien) {
  const liste = kategorien.length
    ? kategorien.map(name => `
        <div class="kategorie-item" data-kategorie="${escapeAttr(name)}" draggable="false">
          <button type="button" class="kategorie-drag-handle" data-action="drag-kategorie" title="Reihenfolge ändern" aria-label="Reihenfolge ändern">
            ${icon('bars-3', { className: 'icon-16' })}
          </button>
          <span class="kategorie-name">${escapeAttr(name)}</span>
          <button type="button" class="kategorie-delete-btn" data-action="edit-kategorie" data-kategorie="${escapeAttr(name)}" title="Kategorie bearbeiten">
            ${icon('pencil-square')}
          </button>
          <button type="button" class="kategorie-delete-btn" data-action="delete-kategorie" data-kategorie="${escapeAttr(name)}" title="Kategorie löschen">
            ${icon('x-mark')}
          </button>
        </div>
      `).join('')
    : '<p class="no-kategorien">Keine Kategorien vorhanden</p>';

  return `
    <div class="kategorien-list" id="casting-kategorien-list">${liste}</div>
    <div class="kategorie-add-form">
      <input type="text" id="casting-new-kategorie-input" class="form-input" placeholder="Neue Kategorie...">
      <button type="button" class="mdc-btn" id="btn-casting-add-kategorie">
        ${icon('plus-lg', { className: 'icon-16' })}
        Hinzufügen
      </button>
    </div>
  `;
}

export function showCastingKategorienDrawer(detail) {
  removeKategorienDrawer();

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = `${DRAWER_ID}-overlay`;

  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.className = 'drawer-panel';
  panel.id = DRAWER_ID;

  panel.innerHTML = `
    <div class="drawer-header">
      <div>
        <span class="drawer-title">Kategorien verwalten</span>
        <p class="drawer-subtitle">Kategorien hinzufügen, umbenennen, sortieren oder entfernen</p>
      </div>
      <div>
        <button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button>
      </div>
    </div>
    <div class="drawer-body" id="${DRAWER_ID}-body">${renderKategorienDrawerBody(detail.getTeilbereiche())}</div>
  `;

  overlay.addEventListener('click', () => closeKategorienDrawer());
  panel.querySelector('.drawer-close-btn').addEventListener('click', () => closeKategorienDrawer());

  document.body.appendChild(overlay);
  document.body.appendChild(panel);
  requestAnimationFrame(() => panel.classList.add('show'));

  bindDrawerEvents(detail);
}

export function removeKategorienDrawer() {
  unbindReorder();
  document.getElementById(`${DRAWER_ID}-overlay`)?.remove();
  document.getElementById(DRAWER_ID)?.remove();
}

export function closeKategorienDrawer() {
  const panel = document.getElementById(DRAWER_ID);
  if (!panel) {
    removeKategorienDrawer();
    return;
  }
  panel.classList.remove('show');
  setTimeout(() => removeKategorienDrawer(), 300);
}

function rerenderDrawerBody(detail) {
  const body = document.getElementById(`${DRAWER_ID}-body`);
  if (!body) return;
  body.innerHTML = renderKategorienDrawerBody(detail.getTeilbereiche());
  bindDrawerEvents(detail);
}

async function speichereTeilbereiche(detail, kategorien) {
  const teilbereich = serializeTeilbereiche(kategorien);
  await creatorAuswahlService.updateListe(detail.listeId, { teilbereich });
  detail.liste.teilbereich = teilbereich;
}

function bindDrawerEvents(detail) {
  const addBtn = document.getElementById('btn-casting-add-kategorie');
  const input = document.getElementById('casting-new-kategorie-input');

  const addHandler = () => handleAdd(detail);
  addBtn?.addEventListener('click', addHandler);
  input?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addHandler();
    }
  });

  document.querySelectorAll(`#${DRAWER_ID} [data-action="edit-kategorie"]`).forEach(btn => {
    btn.addEventListener('click', () => startInlineEdit(detail, btn.dataset.kategorie));
  });
  document.querySelectorAll(`#${DRAWER_ID} [data-action="delete-kategorie"]`).forEach(btn => {
    btn.addEventListener('click', () => handleDelete(detail, btn.dataset.kategorie));
  });

  bindReorderEvents(detail);
  input?.focus();
}

function unbindReorder() {
  _reorderUnbind.forEach(fn => fn());
  _reorderUnbind = [];
  _draggedRow = null;
}

function readOrderFromDom() {
  const list = document.getElementById('casting-kategorien-list');
  if (!list) return [];
  return Array.from(list.querySelectorAll('.kategorie-item')).map(row => row.dataset.kategorie);
}

function bindReorderEvents(detail) {
  unbindReorder();
  const list = document.getElementById('casting-kategorien-list');
  if (!list) return;

  const rows = () => list.querySelectorAll('.kategorie-item');

  list.querySelectorAll('[data-action="drag-kategorie"]').forEach(handle => {
    const onMouseDown = () => handle.closest('.kategorie-item')?.setAttribute('draggable', 'true');
    handle.addEventListener('mousedown', onMouseDown);
    _reorderUnbind.push(() => handle.removeEventListener('mousedown', onMouseDown));
  });

  const onMouseUp = () => rows().forEach(row => row.setAttribute('draggable', 'false'));
  document.addEventListener('mouseup', onMouseUp);
  _reorderUnbind.push(() => document.removeEventListener('mouseup', onMouseUp));

  rows().forEach(row => {
    const onDragStart = (e) => {
      _draggedRow = row;
      row.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', row.dataset.kategorie);
    };
    const onDragEnd = async () => {
      row.classList.remove('is-dragging');
      row.setAttribute('draggable', 'false');
      _draggedRow = null;
      list.querySelectorAll('.kategorie-item.drag-over').forEach(el => el.classList.remove('drag-over'));
      await applyKategorieOrder(detail, readOrderFromDom());
    };
    const onDragOver = (e) => {
      e.preventDefault();
      const dragged = _draggedRow;
      if (!dragged || dragged === row) return;
      const siblings = Array.from(list.children);
      const from = siblings.indexOf(dragged);
      const to = siblings.indexOf(row);
      if (from < 0 || to < 0) return;
      list.insertBefore(dragged, from < to ? row.nextSibling : row);
    };
    const onDrop = (e) => e.preventDefault();

    row.addEventListener('dragstart', onDragStart);
    row.addEventListener('dragend', onDragEnd);
    row.addEventListener('dragover', onDragOver);
    row.addEventListener('drop', onDrop);
    _reorderUnbind.push(() => {
      row.removeEventListener('dragstart', onDragStart);
      row.removeEventListener('dragend', onDragEnd);
      row.removeEventListener('dragover', onDragOver);
      row.removeEventListener('drop', onDrop);
    });
  });
}

export async function applyKategorieOrder(detail, next) {
  const existing = detail.getTeilbereiche();
  if (next.join('\0') === existing.join('\0')) return false;
  if (next.length !== existing.length) return false;
  const existingSet = new Set(existing);
  if (next.some(k => !existingSet.has(k))) return false;

  try {
    await speichereTeilbereiche(detail, next);
    const reordered = reorderCastingItemsByKategorien(detail.items || [], next);
    if (reordered.length) {
      await creatorAuswahlService.updateItemsSortierungWithKategorie(reordered);
      detail.items = reordered;
    }
    rerenderDrawerBody(detail);
    detail.rerenderTable();
    toast('Reihenfolge gespeichert');
    return true;
  } catch (error) {
    console.error('Fehler beim Sortieren der Kategorien:', error);
    toast('Fehler beim Sortieren', 'error');
    rerenderDrawerBody(detail);
    return false;
  }
}

async function handleAdd(detail) {
  const input = document.getElementById('casting-new-kategorie-input');
  const name = input?.value?.trim();
  const existing = detail.getTeilbereiche();

  const fehler = pruefeKategorieName(name, existing);
  if (fehler) {
    toast(fehler, 'warning');
    return;
  }

  try {
    await speichereTeilbereiche(detail, [...existing, name]);
    rerenderDrawerBody(detail);
    detail.rerenderTable();
    toast(`Kategorie "${name}" hinzugefügt`);
  } catch (error) {
    console.error('Fehler beim Hinzufügen der Kategorie:', error);
    toast('Fehler beim Hinzufügen der Kategorie', 'error');
  }
}

function startInlineEdit(detail, kategorie) {
  const row = document.querySelector(`#${DRAWER_ID} .kategorie-item[data-kategorie="${CSS.escape(kategorie)}"]`);
  if (!row) return;

  row.innerHTML = `
    <input type="text" class="form-input" value="${escapeAttr(kategorie)}">
    <button type="button" class="kategorie-delete-btn" data-action="save-kategorie" title="Speichern">${icon('check-bold', { stroke: 2 })}</button>
    <button type="button" class="kategorie-delete-btn" data-action="cancel-edit" title="Abbrechen">${icon('x-mark', { stroke: 2 })}</button>
  `;

  const input = row.querySelector('input');
  input.focus();
  input.select();

  let saving = false;
  const save = async () => {
    if (saving) return;
    saving = true;
    await handleRename(detail, kategorie, input.value);
  };
  const cancel = () => rerenderDrawerBody(detail);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
  row.querySelector('[data-action="save-kategorie"]').addEventListener('click', save);
  row.querySelector('[data-action="cancel-edit"]').addEventListener('click', cancel);
}

async function handleRename(detail, alt, neuEingabe) {
  const neu = neuEingabe?.trim();
  const existing = detail.getTeilbereiche();

  if (neu === alt) {
    rerenderDrawerBody(detail);
    return;
  }
  const fehler = pruefeKategorieName(neu, existing, { ausser: alt });
  if (fehler) {
    toast(fehler, 'warning');
    rerenderDrawerBody(detail);
    return;
  }

  try {
    await speichereTeilbereiche(detail, existing.map(k => (k === alt ? neu : k)));

    const betroffen = (detail.items || []).filter(item => item.kategorie === alt);
    if (betroffen.length) {
      await creatorAuswahlService.updateItemsGroup(betroffen.map(i => i.id), { kategorie: neu });
      betroffen.forEach(item => { item.kategorie = neu; });
    }

    rerenderDrawerBody(detail);
    detail.rerenderTable();
    toast(`Kategorie "${alt}" wurde umbenannt`);
  } catch (error) {
    console.error('Fehler beim Umbenennen der Kategorie:', error);
    toast('Fehler beim Umbenennen der Kategorie', 'error');
    rerenderDrawerBody(detail);
  }
}

async function handleDelete(detail, kategorie) {
  const result = await window.confirmationModal?.open({
    title: 'Kategorie löschen?',
    message: `Möchten Sie die Kategorie "${kategorie}" wirklich löschen? Creator in dieser Kategorie werden zu "Ohne Kategorie" verschoben.`,
    confirmText: 'Löschen',
    cancelText: 'Abbrechen',
    danger: true
  });
  if (!result?.confirmed) return;

  try {
    const verbleibend = detail.getTeilbereiche().filter(k => k !== kategorie);
    await speichereTeilbereiche(detail, verbleibend);

    const betroffen = (detail.items || []).filter(item => item.kategorie === kategorie);
    if (betroffen.length) {
      await creatorAuswahlService.updateItemsGroup(betroffen.map(i => i.id), { kategorie: null });
      betroffen.forEach(item => { item.kategorie = null; });
    }

    rerenderDrawerBody(detail);
    detail.rerenderTable();
    toast(`Kategorie "${kategorie}" gelöscht`);
  } catch (error) {
    console.error('Fehler beim Löschen der Kategorie:', error);
    toast('Fehler beim Löschen der Kategorie', 'error');
    rerenderDrawerBody(detail);
  }
}
