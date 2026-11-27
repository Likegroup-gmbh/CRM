// CastingDetailZeilenStatus.js
// Status, Kundenfeedback, Art und Kategorie einer Casting-Zeile (Prototype-Mixin).

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { normalizeCreatorTyp, isAllowedCreatorTyp } from './creatorTypeOptions.js';
import {
  buildSourcingStatusUpdates, isSourcingStatus,
  buildKundenFeedbackUpdates, isKundenFeedback
} from './sourcingStatusOptions.js';
import { preserveScroll } from '../../core/dom/preserveScroll.js';
import { getSourcingTabForItem } from './sourcingTabs.js';
import { istFreigabeBereit } from './castingFreigabeLogik.js';
import {
  NICHT_UMSETZEN_KATEGORIE,
  kategorieGroupKey,
  updatesForGroupKey
} from './castingKategorien.js';

function rerenderMitScrollErhalt(detail) {
  const hScroll = detail._getHScrollTarget(detail._q('.table-container'));
  const keep = hScroll
    ? [hScroll.classList?.contains('table-container') ? { sel: '.table-container', scope: detail._getRoot() } : hScroll]
    : [];
  preserveScroll(() => detail.rerenderTable(), { keep });
}

/**
 * Nach Status oder Kundenfeedback: bleibt die Zeile in Reiter, Filter und
 * Sortierung, reicht die Zeile (Freigabe-Zelle schaltet in-place). Sonst
 * Tabelle neu und den Freigabe-Uebergang nachspielen.
 */
function aktualisiereNachStatus(detail, itemId, { warBereit, tabVorher, tabelleNeu = false }) {
  const item = detail.items.find(i => i.id === itemId);
  const bleibtStehen = !tabelleNeu && item
    && getSourcingTabForItem(item) === tabVorher
    && !detail.hasColumnFilters()
    && (detail.tableFilter?.isManualSort() ?? true)
    && detail._q(`.item-row[data-item-id="${itemId}"]`);
  if (bleibtStehen) {
    detail.refreshItemRow(itemId);
    detail.updateTabCounts();
    return;
  }
  rerenderMitScrollErhalt(detail);
  detail.animiereFreigabeNachRender?.(itemId, warBereit);
}

function freigabeVorher(detail, itemId) {
  const item = detail.items.find(i => i.id === itemId);
  return { warBereit: istFreigabeBereit(item), tabVorher: item ? getSourcingTabForItem(item) : null };
}

/**
 * Status-Select der Tabelle: setzt genau eines der Prozess-Flags angefragt /
 * in_verhandlung / preis_zugesagt / zusage / on_hold / gebucht / absage und
 * nimmt die anderen zurueck. Das Kundenfeedback (prio_1 / prio_2 / abgelehnt)
 * bleibt stehen.
 */
export async function handleStatusChange(itemId, status) {
  // Der Prozess-Status ist intern. Kunden geben ihr Feedback ueber die
  // eigene Spalte (kunden_feedback), nicht ueber diesen Select.
  if (this.isKunde) return;
  if (!itemId || !isSourcingStatus(status)) return;

  const updates = buildSourcingStatusUpdates(status);
  const vorher = freigabeVorher(this, itemId);

  try {
    // Absage loest die Zuordnung an Videoideen; blockt, wenn eine davon
    // schon ein Skript hat (eingefroren).
    if (status === 'absage') {
      await creatorAuswahlService._loeseVideoideeZuordnungen(itemId, 'abgesagt');
    }

    await creatorAuswahlService.updateItem(itemId, updates);

    const item = this.items.find(i => i.id === itemId);
    if (item) Object.assign(item, updates);

    // Frisch gebuchte Creator wandern an den Anfang ihrer Kategorie
    if (status === 'gebucht') {
      const reorderedItems = this.promoteBookedItemWithinCategory(itemId);
      await creatorAuswahlService.updateItemsSortierungWithKategorie(reorderedItems);
      this.items = reorderedItems.map((entry, index) => ({ ...entry, sortierung: index }));
    }

    aktualisiereNachStatus(this, itemId, { ...vorher, tabelleNeu: status === 'gebucht' });
  } catch (error) {
    console.error('Fehler beim Status-Update:', error);
    window.toastSystem?.show('Fehler beim Speichern', 'error');
  }
}

/**
 * Kundenfeedback-Select der Tabelle: setzt genau eines der Feedback-Flags
 * prio_1 / prio_2 / abgelehnt und nimmt die anderen zurueck. Der
 * Prozess-Status bleibt stehen.
 */
export async function handleKundenFeedbackChange(itemId, feedback) {
  if (!itemId || !isKundenFeedback(feedback)) return;

  const updates = buildKundenFeedbackUpdates(feedback);
  const vorher = freigabeVorher(this, itemId);

  try {
    await creatorAuswahlService.updateItem(itemId, updates);

    const item = this.items.find(i => i.id === itemId);
    if (item) Object.assign(item, updates);

    // Feedback entscheidet ueber den Reiter (Alle vs. Abgelehnt) und den Filter
    aktualisiereNachStatus(this, itemId, vorher);
  } catch (error) {
    console.error('Fehler beim Feedback-Update:', error);
    window.toastSystem?.show('Fehler beim Speichern', 'error');
  }
}

/** Creator-Art-Select der Tabelle */
export async function handleTypChange(itemId, rawValue) {
  const value = normalizeCreatorTyp(rawValue);
  if (!isAllowedCreatorTyp(value)) {
    window.toastSystem?.show('Ungültige Creator Art. Bitte einen gültigen Wert auswählen.', 'error');
    return;
  }

  try {
    await creatorAuswahlService.updateItem(itemId, { typ: value });

    const item = this.items.find(i => i.id === itemId);
    if (item) item.typ = value;

    this.refreshItemRow(itemId);
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Creator Art:', error);
    window.toastSystem?.show('Fehler beim Speichern', 'error');
  }
}

export function promoteBookedItemWithinCategory(itemId) {
  const item = this.items.find(entry => entry.id === itemId);
  if (!item) return this.items;

  const getKey = (entry) => kategorieGroupKey(entry);
  const targetKey = getKey(item);

  const categoryIndexes = [];
  const categoryItems = [];

  this.items.forEach((entry, index) => {
    if (getKey(entry) === targetKey) {
      categoryIndexes.push(index);
      categoryItems.push(entry);
    }
  });

  if (categoryItems.length <= 1) {
    return this.items.map((entry, index) => ({ ...entry, sortierung: index }));
  }

  const targetItem = categoryItems.find(entry => entry.id === itemId);
  const remaining = categoryItems.filter(entry => entry.id !== itemId);
  const booked = remaining.filter(entry => entry.gebucht);
  const nonBooked = remaining.filter(entry => !entry.gebucht);
  const reordered = [targetItem, ...booked, ...nonBooked];

  const result = [...this.items];
  categoryIndexes.forEach((index, slot) => {
    result[index] = reordered[slot];
  });

  return result.map((entry, index) => ({ ...entry, sortierung: index }));
}

export async function handleNichtUmsetzenChange(itemId, isNichtUmsetzen) {
  try {
    if (isNichtUmsetzen) {
      const updates = { nicht_umsetzen: true, kategorie: NICHT_UMSETZEN_KATEGORIE };
      await creatorAuswahlService.updateItem(itemId, updates);

      const item = this.items.find(i => i.id === itemId);
      if (item) Object.assign(item, updates);

      window.toastSystem?.show('Creator als "Nicht umsetzen" markiert', 'info');
    } else {
      const updates = { nicht_umsetzen: false, kategorie: null };
      await creatorAuswahlService.updateItem(itemId, updates);

      const item = this.items.find(i => i.id === itemId);
      if (item) Object.assign(item, updates);

      window.toastSystem?.show('Creator wieder aktiv', 'success');
    }

    this.rerenderTable();
  } catch (error) {
    console.error('Fehler beim Ändern von "Nicht umsetzen":', error);
    window.toastSystem?.show('Fehler beim Speichern', 'error');
  }
}

export async function handleKategorieChange(itemId, groupKey) {
  try {
    const updates = updatesForGroupKey(groupKey);
    await creatorAuswahlService.updateItem(itemId, updates);

    const item = this.items.find(i => i.id === itemId);
    if (item) Object.assign(item, updates);

    this.rerenderTable([itemId]);
    window.toastSystem?.show('Kategorie aktualisiert', 'success');
  } catch (error) {
    console.error('Fehler beim Ändern der Kategorie:', error);
    window.toastSystem?.show('Fehler beim Ändern der Kategorie', 'error');
  }
}

export const castingDetailZeilenStatusMethods = {
  handleStatusChange,
  handleKundenFeedbackChange,
  handleTypChange,
  promoteBookedItemWithinCategory,
  handleNichtUmsetzenChange,
  handleKategorieChange
};
