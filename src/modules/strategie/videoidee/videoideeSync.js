// videoideeSync.js
// Haelt Creator-/Produkt-Zeile, Status und Prio im offenen Drawer aktuell,
// wenn die Tabelle sie aendert oder ein Unter-Drawer etwas verknuepft.

import { StrategieCreatorDrawer } from '../StrategieCreatorDrawer.js';
import { StrategieProduktDrawer } from '../StrategieProduktDrawer.js';
import { handleCreatorUnlink, handleProduktUnlink } from '../StrategieDetailTableEvents.js';
import { renderSkriptFreigabeStatus } from '../StrategieDetailRenderer.js';
import { STRATEGIE_PRIO_OPTIONS, getStrategiePrio } from '../strategiePrioOptions.js';
import { renderTableSelect } from '../../../core/components/TableSelect.js';
import { fieldSignature } from '../videoideeFieldSync.js';
import {
  DRAWER_ID,
  contentEditable,
  fieldText,
  prioDisabled,
  renderEditCreatorField,
  renderEditProduktField
} from './videoideeRender.js';

export function bindCreator(detail, itemId) {
  const root = document.getElementById(DRAWER_ID);
  if (!root) return;
  const openCreator = () => {
    const drawer = new StrategieCreatorDrawer(detail);
    drawer.open(itemId, { onSuccess: () => refreshBlock(detail, itemId, 'creator') });
  };
  root.querySelector('#btn-edit-creator-connect')?.addEventListener('click', openCreator);
  root.querySelector('#btn-edit-creator-change')?.addEventListener('click', openCreator);
  root.querySelector('#btn-edit-creator-unlink')?.addEventListener('click', async () => {
    const done = await handleCreatorUnlink(detail, itemId);
    if (done) refreshBlock(detail, itemId, 'creator');
  });
}

export function bindProdukt(detail, itemId) {
  const root = document.getElementById(DRAWER_ID);
  if (!root) return;
  const openProdukt = () => {
    const drawer = new StrategieProduktDrawer(detail);
    drawer.open(itemId, { onSuccess: () => refreshBlock(detail, itemId, 'produkt') });
  };
  root.querySelector('#btn-edit-produkt-connect')?.addEventListener('click', openProdukt);
  root.querySelector('#btn-edit-produkt-change')?.addEventListener('click', openProdukt);
  root.querySelector('#btn-edit-produkt-unlink')?.addEventListener('click', async () => {
    const done = await handleProduktUnlink(detail, itemId);
    if (done) refreshBlock(detail, itemId, 'produkt');
  });
}

export function refreshBlock(detail, itemId, kind) {
  const item = detail.items.find((entry) => String(entry.id) === String(itemId));
  const field = document.querySelector(`#${DRAWER_ID} .form-field--${kind}`);
  if (!item || !field) return;
  const html = kind === 'creator'
    ? renderEditCreatorField(item, contentEditable(detail, item))
    : renderEditProduktField(item, contentEditable(detail, item));
  if (!html) {
    field.remove();
    return;
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  field.replaceWith(tmp.firstElementChild);
  if (kind === 'creator') bindCreator(detail, itemId);
  else bindProdukt(detail, itemId);
}

export function patchFields(panel, item) {
  panel.querySelectorAll('[data-field]').forEach((el) => {
    if (el === document.activeElement || el.contains(document.activeElement)) return;
    const field = el.dataset.field;
    if (!field || field === 'strategie_prio' || !(field in item)) return;
    const tag = el.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return;
    const value = field === 'teilbereich' ? (item.teilbereich || '') : fieldText(item, field);
    if (el.type === 'checkbox') el.checked = !!value;
    else el.value = value ?? '';
    el.dataset.videoideeSaved = fieldSignature(el);
  });
}

export function patchStatus(panel, item) {
  const slot = panel.querySelector('[data-videoidee-status]');
  if (!slot) return;
  slot.innerHTML = renderSkriptFreigabeStatus(item);
}

export function patchPrio(detail, panel, item) {
  const slot = panel.querySelector('[data-videoidee-prio]');
  if (!slot || slot.contains(document.activeElement) || slot.querySelector('.table-select.show')) return;
  const current = slot.querySelector('[data-table-select]')?.dataset.value;
  const next = getStrategiePrio(item);
  if (current === next) return;
  slot.innerHTML = renderTableSelect({
    field: 'strategie_prio',
    itemId: item.id,
    value: next,
    options: STRATEGIE_PRIO_OPTIONS,
    disabled: prioDisabled(detail, item)
  });
}
