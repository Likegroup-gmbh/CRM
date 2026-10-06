// videoideeCommit.js
// Autosave des Videoidee-Drawers: ein Feld pro Blur/Change, mit Dirty-Check
// ueber fieldSignature. Der Drawer reicht renderOpenItem/updateNav als hooks herein.

import { strategieService } from '../StrategieService.js';
import { updateItemField } from '../StrategieDetailTableEvents.js';
import { persistVideoideeEdit } from '../videoideeEdit.js';
import { cssEscape, fieldSignature } from '../videoideeFieldSync.js';
import { DRAWER_ID } from './videoideeRender.js';

export async function commitFocused(panel) {
  const el = document.activeElement;
  if (!el || !panel?.contains(el) || typeof el._videoideeCommit !== 'function') return;
  await el._videoideeCommit();
}

/** hooks: { renderOpenItem, updateNav } vom Drawer. */
export async function commitControl(detail, el, hooks) {
  const signature = fieldSignature(el);
  if (el.dataset.videoideeSaved === signature) return true;
  const field = el.dataset.field;
  const itemId = el.dataset.itemId;
  const item = detail.items.find((entry) => String(entry.id) === String(itemId));
  if (!item) return false;

  el.dataset.videoideeSaved = signature;
  let ok = true;

  if (field === 'video_link') ok = await commitLink(detail, el, item, hooks);
  else if (field === 'teilbereich') ok = await commitKategorie(detail, el, item, hooks);
  else if (field === 'video_umgesetzt') ok = await commitUmsetzen(detail, el, item);
  else if (field === 'umsetzungsvorgabe' && linkDirty(el, item)) ok = await commitLink(detail, linkInput(el), item, hooks);
  else ok = await commitText(detail, el, item);

  if (!ok) delete el.dataset.videoideeSaved;
  else el.dataset.videoideeSaved = fieldSignature(el);
  return ok;
}

function linkInput(from) {
  return from?.closest(`#${DRAWER_ID}`)?.querySelector('[data-field="video_link"]') || null;
}

function linkDirty(from, item) {
  const input = linkInput(from);
  if (!input) return false;
  return input.value.trim() !== (item.video_link || '');
}

async function commitText(detail, el, item) {
  const field = el.dataset.field;
  const value = el.type === 'checkbox' ? el.checked : el.value;
  const current = item[field] ?? '';
  if (String(current ?? '') === String(value ?? '')) return true;
  await updateItemField(detail, item.id, field, value, el);
  return true;
}

async function commitUmsetzen(detail, el, item) {
  if (el.checked && item.nicht_umsetzen) {
    el.checked = false;
    window.toastSystem?.show('Zuerst „Nicht umsetzen" deaktivieren', 'warning');
    return false;
  }
  if (!!item.video_umgesetzt === el.checked) return true;
  await updateItemField(detail, item.id, 'video_umgesetzt', el.checked, el);
  el.closest('label')?.classList.toggle('is-active', el.checked);
  const row = document.querySelector(`tr.item-row[data-item-id="${cssEscape(String(item.id))}"]`);
  row?.classList.toggle('strategie-item-umgesetzt', el.checked);
  return true;
}

async function commitKategorie(detail, el, item, hooks) {
  const teilbereich = el.value || null;
  if ((item.teilbereich || null) === teilbereich) return true;
  await strategieService.updateStrategieItem(item.id, { teilbereich });
  item.teilbereich = teilbereich;
  detail.rerenderItemsTable?.();
  hooks.updateNav(detail, item.id);
  return true;
}

async function commitLink(detail, el, item, hooks) {
  if (!el) return false;
  const panel = el.closest(`#${DRAWER_ID}`);
  const url = el.value || '';
  const vorgabeEl = panel?.querySelector('[data-field="umsetzungsvorgabe"]');
  const beschreibungEl = panel?.querySelector('[data-field="beschreibung"]');
  const kategorieEl = panel?.querySelector('[data-field="teilbereich"]');
  const wasReferenz = !!item.video_link;

  if (url.trim() === (item.video_link || '') && (vorgabeEl?.value ?? '') === (item.umsetzungsvorgabe || '')) {
    return true;
  }

  const result = await persistVideoideeEdit(detail, item.id, {
    art: url.trim() ? 'videoreferenz' : 'idee',
    video_link: url,
    umsetzungsvorgabe: vorgabeEl?.value ?? item.umsetzungsvorgabe ?? '',
    beschreibung: beschreibungEl?.value ?? item.beschreibung ?? '',
    teilbereich: kategorieEl?.value ?? item.teilbereich ?? ''
  });
  if (!result.ok) {
    window.toastSystem?.show(result.error, 'warning');
    const vorgabeFehlt = result.error === 'Was sollen wir von diesem Video umsetzen?';
    if (!vorgabeFehlt) el.value = item.video_link || '';
    const block = panel?.querySelector('[data-videoidee-section="umsetzungsvorgabe"]');
    if (block && url.trim()) block.hidden = false;
    return false;
  }

  if (wasReferenz !== !!item.video_link) {
    hooks.renderOpenItem(detail, item.id, { scroll: false });
  }
  detail.rerenderItemsTable?.();
  return true;
}
