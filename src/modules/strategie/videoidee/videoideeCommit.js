// videoideeCommit.js
// Autosave des Videoidee-Drawers: ein Feld pro Blur/Change, mit Dirty-Check
// ueber fieldSignature. Der Drawer reicht renderOpenItem/updateNav als hooks herein.

import { strategieService } from '../StrategieService.js';
import { updateItemField } from '../StrategieDetailTableEvents.js';
import { persistVideoideeEdit } from '../videoideeEdit.js';
import { cssEscape, fieldSignature } from '../videoideeFieldSync.js';
import { DRAWER_ID, STRUKTUR_FIELD_PREFIX } from './videoideeRender.js';
import { beschreibungStrukturVon, normalisiereStruktur, strukturZuText } from './beschreibungStruktur.js';

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
  else if (field.startsWith(STRUKTUR_FIELD_PREFIX)) ok = await commitStruktur(detail, el, item, hooks);
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

async function bestaetigeErsetzen() {
  const options = {
    title: 'Beschreibung ersetzen?',
    message: 'Die Beschreibung wurde von Hand geschrieben. Die neue Analyse ersetzt sie.',
    confirmText: 'Neu analysieren',
    cancelText: 'Abbrechen',
    danger: false
  };
  if (window.confirmationModal) {
    const res = await window.confirmationModal.open(options);
    return !!res?.confirmed;
  }
  return window.confirm(options.message);
}

/** Button „Neu analysieren“: Transkript durch Llama, Ergebnis als Tabelle. */
export async function analysiereBeschreibungAktion(detail, itemId, hooks, button) {
  const item = detail.items.find((entry) => String(entry.id) === String(itemId));
  if (!item) return false;

  if (item.beschreibung_quelle === 'user' && String(item.beschreibung || '').trim()) {
    if (!(await bestaetigeErsetzen())) return false;
  }

  if (button) button.disabled = true;
  try {
    window.toastSystem?.show('Beschreibung wird analysiert', 'info');
    const updates = await strategieService.analysiereBeschreibung(item.id);
    Object.assign(item, updates);
    detail.rerenderItemsTable?.();
    hooks.renderOpenItem(detail, item.id, { scroll: false });
    window.toastSystem?.show('Beschreibung aktualisiert', 'success');
    return true;
  } catch (error) {
    console.error('Beschreibung-Analyse fehlgeschlagen:', error);
    window.toastSystem?.show(error.message || 'Analyse fehlgeschlagen', 'error');
    if (button) button.disabled = false;
    return false;
  }
}

function strukturEingabe(panel) {
  const eingabe = {};
  panel?.querySelectorAll(`[data-field^="${STRUKTUR_FIELD_PREFIX}"]`).forEach((area) => {
    eingabe[area.dataset.field.slice(STRUKTUR_FIELD_PREFIX.length)] = area.value;
  });
  return eingabe;
}

/** Updates für eine geänderte Struktur: Fliesstext neu ableiten, Quelle user. */
function strukturUpdates(struktur) {
  const beschreibung = struktur ? strukturZuText(struktur) : '';
  return {
    beschreibung_struktur: struktur,
    beschreibung,
    beschreibung_quelle: beschreibung ? 'user' : null
  };
}

/**
 * Schloss an der Hook-Zeile (ADR 0054). Sperren schreibt die Struktur mit, damit der
 * Hook-Text auch bei Altbestand (nur Fliesstext) in beschreibung_struktur steht.
 */
export async function toggleHookSperreAktion(detail, itemId, hooks, button) {
  const item = detail.items.find((entry) => String(entry.id) === String(itemId));
  if (!item) return false;
  const panel = button?.closest(`#${DRAWER_ID}`) || document.getElementById(DRAWER_ID);

  const struktur = normalisiereStruktur(strukturEingabe(panel));
  const sperren = !item.hook_gesperrt;
  if (sperren && !String(struktur?.hook || '').trim()) {
    window.toastSystem?.show('Zuerst einen Hook eintragen', 'warning');
    return false;
  }

  const updates = { hook_gesperrt: sperren };
  if (sperren) {
    const gespeichert = normalisiereStruktur(item.beschreibung_struktur);
    if (JSON.stringify(struktur) !== JSON.stringify(gespeichert)) {
      // Altbestand ohne gespeicherte Struktur: der Fliesstext bleibt, nur die Struktur kommt dazu
      const nurStruktur = JSON.stringify(struktur) === JSON.stringify(beschreibungStrukturVon(item));
      Object.assign(updates, nurStruktur ? { beschreibung_struktur: struktur } : strukturUpdates(struktur));
    }
  }

  if (button) button.disabled = true;
  try {
    await strategieService.updateStrategieItem(item.id, updates);
  } catch (error) {
    console.error('Hook-Sperre fehlgeschlagen:', error);
    window.toastSystem?.show('Fehler beim Speichern', 'error');
    if (button) button.disabled = false;
    return false;
  }
  Object.assign(item, updates);
  detail.rerenderItemsTable?.();
  hooks.renderOpenItem(detail, item.id, { scroll: false });
  window.toastSystem?.show(sperren ? 'Hook gesperrt' : 'Hook entsperrt', 'success');
  return true;
}

/** Eine Zeile der Beschreibungs-Tabelle: alle Zeilen einsammeln, Fliesstext neu ableiten. */
async function commitStruktur(detail, el, item, hooks) {
  const panel = el.closest(`#${DRAWER_ID}`);
  const eingabe = strukturEingabe(panel);

  const struktur = normalisiereStruktur(eingabe);
  const aktuell = beschreibungStrukturVon(item);
  if (JSON.stringify(struktur) === JSON.stringify(aktuell)) return true;

  const updates = strukturUpdates(struktur);
  // Ohne Hook-Text gibt es nichts zu sperren
  if (item.hook_gesperrt && !String(struktur?.hook || '').trim()) updates.hook_gesperrt = false;

  try {
    await strategieService.updateStrategieItem(item.id, updates);
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Beschreibung:', error);
    window.toastSystem?.show('Fehler beim Speichern', 'error');
    return false;
  }
  Object.assign(item, updates);
  detail.rerenderItemsTable?.();
  if (!struktur || updates.hook_gesperrt === false) hooks.renderOpenItem(detail, item.id, { scroll: false });
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
    if (block && url.trim()) {
      block.hidden = false;
      if (block.classList.contains('is-collapsed')) block.querySelector('[data-videoidee-toggle]')?.click();
    }
    return false;
  }

  if (wasReferenz !== !!item.video_link) {
    hooks.renderOpenItem(detail, item.id, { scroll: false });
  }
  detail.rerenderItemsTable?.();
  return true;
}
