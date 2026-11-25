// CastingDetailRowActions.js
// Zeilenaenderungen: Felder, Status, Feedback, Art, Kategorie, Loeschen. Der Profilabruf
// (Instagram, TikTok) liegt in CastingDetailProfilAbruf.js.
// (Prototype-Mixin von CreatorAuswahlDetail)

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { renderItemRow } from './castingItemRow.js';
import { refreshCastingDrawer } from './castingDetailDrawer.js';
import { applyProfilZelleState } from './sourcingProfilZelle.js';
import { linkZiel, plattformDesFelds, profilPlattform } from './sourcingProfilPlattformen.js';
import { plattformenDerEintraege } from './sourcingSpaltenSichtbarkeit.js';
import { formatCompactNumber, formatExactNumber, parseCompactNumber } from '../../core/format/compactNumber.js';
import { verknuepfeEintrag, verknuepfungsText } from './castingCreatorVerknuepfung.js';
import { absorbEditedTextFields, rememberTextBaseline, shouldPersistTextField } from '../../core/table/textFieldBaseline.js';

/**
 * Hinweis, wenn derselbe Creator (gleicher Pool-Eintrag) schon in dieser
 * Liste steht. Blockiert nichts - manchmal ist die Dublette gewollt.
 */
export function warnBeiDoppeltemCreator(item) {
  if (!item.sourcing_creator_id) return;

  const doppelt = this.items.filter(i =>
    i.id !== item.id && i.sourcing_creator_id === item.sourcing_creator_id
  );
  if (!doppelt.length) return;

  const name = item.name?.trim() || 'Dieser Creator';
  window.toastSystem?.show(`${name} steht in dieser Liste bereits ein weiteres Mal`, 'warning');
}

/** Zeile mit einem bekannten Creator (gleicher Instagram-Handle) verknuepfen und das melden. */
export async function _meldeBekanntenCreator(item) {
  if (!item || this.isKunde || !this._canSourcing('edit')) return [];
  const links = await verknuepfeEintrag(
    item,
    this.items,
    (id, updates) => creatorAuswahlService.updateItem(id, updates)
  );
  const text = verknuepfungsText(links);
  if (text) window.toastSystem?.show(text, 'success');
  return links;
}

export function absorbCastingEdits(detail, root) {
  absorbEditedTextFields(root, (el) => {
    if (el.hasAttribute('data-custom-column-id') || el.getAttribute('data-entity') === 'custom') {
      rememberTextBaseline(el);
      detail.customColumns?.handleFieldUpdate(el);
      return;
    }
    detail.handleFieldUpdate(el);
  });
}

/**
 * Eine einzelne Tabellenzeile neu rendern, ohne die ganze Tabelle anzufassen.
 * Die Rueckmeldung eines Abrufs uebernimmt die Hover-Toolbar (siehe
 * _flashProfilAbruf) - sie liegt ausserhalb der Zeile und uebersteht den
 * Austausch.
 */
export function refreshItemRow(itemId) {
  const row = this._q(`.item-row[data-item-id="${itemId}"]`);
  const item = this.items.find(i => i.id === itemId);
  if (!row || !item) return;

  absorbCastingEdits(this, row);
  row.outerHTML = renderItemRow(this.getRenderContext(), item, 0);
  this.bindEvents();
}

export async function handleFieldUpdate(element) {
  // Defense in depth: view-only Rollen (Investor) duerfen keine Feld-Updates
  // schreiben - Kunden-Felder (feedback_kunde, kunden_feedback) bleiben
  // ueber den isKunde-Pfad unberuehrt.
  if (!this.isKunde && !this._canSourcing('edit')) return;
  // Custom-Column-Felder werden separat behandelt (CustomDatePicker nutzt ebenfalls data-field)
  if (element.hasAttribute('data-custom-column-id') || element.getAttribute('data-entity') === 'custom') {
    return;
  }
  if (!shouldPersistTextField(element)) return;
  rememberTextBaseline(element);
  const itemId = element.dataset.itemId;
  const field = element.dataset.field;
  let value;

  if (element.type === 'checkbox') {
    value = element.checked;
  } else if (field === 'follower_instagram' || field === 'follower_tiktok') {
    value = parseCompactNumber(element.value);
  } else if (field === 'preis_ek' || field === 'preis_vk') {
    const numValue = element.value?.trim();
    value = numValue ? parseFloat(numValue) : null;
  } else {
    value = element.value?.trim() || null;
  }

  if (plattformDesFelds(field)) {
    try {
      await this._speichereLink(itemId, field, value, element);
    } catch (error) {
      console.error('Fehler beim Speichern des Links:', error);
      window.toastSystem?.show('Fehler beim Speichern', 'error');
    }
    return;
  }

  const item = this.items.find(i => i.id === itemId);
  const previous = {};
  try {
    const updates = { [field]: value };

    // Kunden-Feedback: Autor + Zeitstempel mitschreiben (Kunde und Gast)
    if (field === 'feedback_kunde' && this.isKunde) {
      const authorName = window.currentUser?.name || 'Unbekannt';
      updates.feedback_kunde_author_name = window.isGast?.() ? `${authorName} (Gast)` : authorName;
      updates.feedback_kunde_updated_at = new Date().toISOString();
    }

    if (item) {
      for (const key of Object.keys(updates)) previous[key] = item[key];
      Object.assign(item, updates);
    }

    await creatorAuswahlService.updateItem(itemId, updates);

    if (field === 'follower_instagram' || field === 'follower_tiktok') {
      this.refreshNumberCell(element, value);
    }
  } catch (error) {
    if (item) Object.assign(item, previous);
    console.error('Fehler beim Aktualisieren:', error);
    window.toastSystem?.show('Fehler beim Speichern', 'error');
  }
}

/**
 * Link speichern, und zwar im Feld seiner Plattform (linkZiel): ein TikTok-Link im Instagram-Feld
 * zieht ins TikTok-Feld um und umgekehrt. Das Feld, in das er kam, behaelt seinen Wert, ausser
 * der war selbst ein Link der falschen Plattform. Bringt der Eintrag die ersten Links einer
 * Plattform in die Liste, zeichnet die ganze Tabelle neu, damit deren Zeilen erscheinen.
 * @param {HTMLInputElement|null} element Feld, in das der Link eingegeben wurde
 * @returns {Promise<string|null>} Feld, in dem der Link jetzt steht; null, wenn nichts gespeichert wurde
 */
export async function _speichereLink(itemId, feld, wert, element = null) {
  const item = this.items.find(i => i.id === itemId);
  const ziel = linkZiel(feld, wert);
  const umgezogen = ziel.feld !== feld;
  const alt = item?.[feld] ?? null;
  const name = profilPlattform(ziel.plattform).name;

  if (umgezogen && wert === alt && item?.[ziel.feld] && item[ziel.feld] !== ziel.wert) {
    window.toastSystem?.show(`Hier steht ein ${name}-Link, beim ${name}-Profil ist aber schon ein anderer eingetragen`, 'info');
    return null;
  }
  const updates = { [ziel.feld]: ziel.wert };
  if (umgezogen && alt && linkZiel(feld, alt).feld !== feld) updates[feld] = null;

  const vorher = plattformenDerEintraege(this.items).join();
  const previous = Object.fromEntries(Object.keys(updates).map(k => [k, item?.[k]]));
  if (item) Object.assign(item, updates);
  try {
    await creatorAuswahlService.updateItem(itemId, updates);
  } catch (error) {
    if (item) Object.assign(item, previous);
    throw error;
  }

  if (element) {
    element.value = (umgezogen ? item?.[feld] : ziel.wert) || '';
    rememberTextBaseline(element);
  }
  const links = ziel.plattform === 'instagram' && item ? await this._meldeBekanntenCreator(item) : [];
  if (umgezogen) {
    window.toastSystem?.show(`${name}-Link erkannt und beim ${name}-Profil eingetragen`, 'info');
    refreshCastingDrawer(this, itemId);
  }
  // Chip und Abruf-Button gehoeren zum eingetragenen Link, sonst bleibt die Zelle optisch leer
  if (plattformenDerEintraege(this.items).join() !== vorher) this.rerenderTable();
  else if (umgezogen || links.length) this.refreshItemRow(itemId);
  else applyProfilZelleState(element?.closest('.chip-cell'), item || { id: itemId, [feld]: ziel.wert }, ziel.plattform);
  return ziel.feld;
}

/**
 * Overlay der Follower-Zelle nachziehen: der Input haelt den Rohwert, das
 * Overlay die kompakte Anzeige. Guenstiger als die ganze Zeile neu zu rendern.
 */
export function refreshNumberCell(element, value) {
  element.value = value ?? '';

  const display = element.parentElement?.querySelector('[data-number-display]');
  if (!display) return;

  display.textContent = formatCompactNumber(value) || '–';
  display.title = formatExactNumber(value);
}

export async function handleDeleteItem(itemId) {
  const result = await window.confirmationModal?.open({
    title: 'Creator entfernen?',
    message: 'Möchten Sie diesen Creator wirklich aus der Liste entfernen?',
    confirmText: 'Entfernen',
    cancelText: 'Abbrechen',
    danger: true
  });

  if (!result?.confirmed) return;

  try {
    await creatorAuswahlService.deleteItem(itemId);
    this.items = this.items.filter(i => i.id !== itemId);
    window.toastSystem?.show('Creator entfernt', 'success');
    this.rerenderTable();
  } catch (error) {
    console.error('Fehler beim Löschen:', error);
    window.toastSystem?.show('Fehler beim Löschen', 'error');
  }
}

export const castingDetailRowActionsMethods = {
  _meldeBekanntenCreator,
  warnBeiDoppeltemCreator,
  refreshItemRow,
  handleFieldUpdate,
  _speichereLink,
  refreshNumberCell,
  handleDeleteItem
};
