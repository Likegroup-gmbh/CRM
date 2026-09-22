// CastingDetailRowActions.js
// Zeilenaenderungen: Instagram-Abruf, Felder, Status, Feedback, Art, Persona, Loeschen
// (Prototype-Mixin von CreatorAuswahlDetail)

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { normalizeCreatorTyp, isAllowedCreatorTyp } from './creatorTypeOptions.js';
import { renderItemRow } from './castingItemRow.js';
import { hoverToolbar } from '../../core/hoverToolbar/HoverToolbar.js';
import { setChipCellLoading } from '../../core/components/chipCell.js';
import { applySourcingIgCellState, findSourcingIgCell } from './sourcingIgCell.js';
import {
  buildSourcingStatusUpdates, isSourcingStatus,
  buildKundenFeedbackUpdates, isKundenFeedback
} from './sourcingStatusOptions.js';
import { preserveScroll } from '../../core/dom/preserveScroll.js';
import { formatCompactNumber, formatExactNumber, parseCompactNumber } from '../../core/format/compactNumber.js';
import {
  NICHT_UMSETZEN_KATEGORIE,
  personaGroupKey,
  updatesForGroupKey
} from './castingPersonaGroups.js';

const IG_FETCH_FLASH_MS = 2000;

/**
 * Hauptaktion der Instagram-Hover-Toolbar: Profil, Follower und CPM-Werte
 * nachladen und die Zeile aktualisieren.
 *
 * Erster Klick fragt den Creator-Pool: steckt der Handle schon in einer
 * anderen Liste, kommen die Werte von dort. Steht die Zeile danach im
 * Refresh-Zustand, erzwingt der naechste Klick einen echten Meta-Abruf.
 *
 * Die itemId kommt als Argument, weil der Button in der Leiste an
 * document.body haengt - von dort findet closest() keine Zeile mehr.
 */
export async function handleInstagramFetch(itemId, button) {
  if (button.disabled) return;

  const item = this.items.find(i => i.id === itemId);
  if (!item) return;

  const linkInput = this._q(`input[data-field="link_instagram"][data-item-id="${itemId}"]`);
  const link = linkInput?.value?.trim();
  // canOpen der Config laesst die Leiste ohne Link nicht aufgehen; kommt hier
  // trotzdem keiner an, ist die Zeile inzwischen weg.
  if (!link) return;

  // Noch nicht gespeicherte Eingabe zuerst persistieren, sonst liest die
  // Function den alten Wert aus der DB
  if (link !== item.link_instagram) {
    try {
      await creatorAuswahlService.updateItem(itemId, { link_instagram: link });
      item.link_instagram = link;
    } catch (error) {
      console.error('Fehler beim Speichern des Instagram-Links:', error);
      window.toastSystem?.show('Instagram-Link konnte nicht gespeichert werden', 'error');
      return;
    }
  }

  // Zeile hat schon Daten -> der Button zeigt Refresh, dieser Klick soll
  // also frisch bei Meta holen statt den Pool-Stand zu wiederholen
  const force = !!item.ig_fetched_at && !item.ig_fetch_error;

  button.disabled = true;
  button.classList.remove('is-error', 'is-success', 'is-refresh');
  button.classList.add('is-loading');
  // Der Abruf dauert; die Leiste muss offen bleiben, auch wenn der Zeiger sie
  // in der Zwischenzeit verlaesst.
  hoverToolbar.pin();
  setChipCellLoading(findSourcingIgCell(itemId), true);

  try {
    const { item: updated, source, poolFetchedAt, debug } = await creatorAuswahlService
      .fetchInstagramStats(itemId, { force });
    Object.assign(item, updated);
    this.refreshItemRow(itemId);
    // Die Zeile ist per outerHTML ersetzt, die Zelle unter der Leiste also
    // eine andere. rebind() verankert sie neu und zeigt jetzt "Frisch abrufen".
    hoverToolbar.rebind();
    this._flashIgFetchSuccess(itemId);

    if (debug) {
      const handle = debug.username || 'unknown';
      console.group(`[IG-CPM] @${handle} (${debug.source || source})`);
      console.log('Regeln', debug.rules);
      if (debug.skipped?.length) console.table(debug.skipped);
      else console.log('Skipped (zu frisch / manuell ausgeschlossen): keine');
      if (debug.included_8?.length) {
        console.log(`Included 8er (${debug.included_8.length} Reels im Schnitt)`);
        console.table(debug.included_8);
      } else console.log('Included 8er: keine');
      if (debug.included_30?.length) {
        console.log(`Included 30er (${debug.included_30.length} Reels im Schnitt)`);
        console.table(debug.included_30);
      } else console.log('Included 30er: keine');
      if (debug.outliers?.window_8?.length) console.table(debug.outliers.window_8);
      if (debug.outliers?.window_30?.length) console.table(debug.outliers.window_30);
      console.log('Fenster / Preis', debug.summary);
      if (debug.pool_fetched_at) console.log('Pool-Stand', debug.pool_fetched_at);
      if (debug.image_error) console.warn('Profilbild', debug.image_error);
      console.groupEnd();
    }

    if (source === 'pool') {
      const stand = poolFetchedAt ? new Date(poolFetchedAt).toLocaleDateString('de-DE') : null;
      window.toastSystem?.show(
        stand
          ? `Aus dem Creator-Pool übernommen (Stand ${stand}) – nochmal klicken für frische Instagram-Daten`
          : 'Aus dem Creator-Pool übernommen – nochmal klicken für frische Instagram-Daten',
        'info'
      );
    } else {
      // Der 30er-Schnitt ist der belastbarste Wert; hat der Creator dafuer zu
      // wenige Feed-Reels, greift der 8er-Schnitt
      const views = updated.ig_views_30 ?? updated.ig_views_8;
      window.toastSystem?.show(
        views != null
          ? `Instagram-Daten aktualisiert (${Number(views).toLocaleString('de-DE')} Views im Schnitt)`
          : 'Instagram-Daten aktualisiert – zu wenige Reels für eine CPM-Berechnung',
        views != null ? 'success' : 'info'
      );
    }

    this.warnBeiDoppeltemCreator(item);
  } catch (error) {
    console.error('Fehler beim Instagram-Abruf:', error);
    // Bei toter Session hat authorizedFetch schon Hinweis und Logout uebernommen;
    // der Abbruch gehoert dann nicht als Abruf-Fehler an die Zeile
    if (error.sessionDead) {
      button.disabled = false;
      button.classList.remove('is-loading');
      setChipCellLoading(findSourcingIgCell(itemId), false);
      hoverToolbar.unpin();
      return;
    }
    item.ig_fetch_error = error.message;
    this.refreshItemRow(itemId);
    // Die Leiste zeigt danach "Erneut versuchen" plus den Fehlertext als Zeile
    hoverToolbar.rebind();
    hoverToolbar.unpin();
    window.toastSystem?.show(error.hint || error.message, error.retryable ? 'info' : 'error');
  }
}

/**
 * Kurz gruen quittieren. Der Button aus dem Klick ist nach dem Zeilen-Neuaufbau
 * ein toter Knoten - der Flash muss den treffen, den rebind() gerade neu
 * gerendert hat. Das unpin() haengt hinten dran, damit die Leiste den Flash
 * ueberdauert, auch wenn der Zeiger inzwischen weitergewandert ist.
 */
export function _flashIgFetchSuccess(itemId) {
  const button = this._q(`.ig-fetch-btn[data-item-id="${itemId}"]`)
    || document.querySelector('.hover-toolbar [data-hover-action="ig-fetch"]');
  if (!button) {
    hoverToolbar.unpin();
    return;
  }

  button.classList.add('is-success');
  setTimeout(() => {
    button.classList.remove('is-success');
    hoverToolbar.unpin();
  }, IG_FETCH_FLASH_MS);
}

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

/**
 * Eine einzelne Tabellenzeile neu rendern, ohne die ganze Tabelle anzufassen.
 * Die Rueckmeldung eines Abrufs uebernimmt die Hover-Toolbar (siehe
 * _flashIgFetchSuccess) - sie liegt ausserhalb der Zeile und uebersteht den
 * Austausch.
 */
export function refreshItemRow(itemId) {
  const row = this._q(`.item-row[data-item-id="${itemId}"]`);
  const item = this.items.find(i => i.id === itemId);
  if (!row || !item) return;

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

  try {
    const updates = { [field]: value };

    // Kunden-Feedback: Autor + Zeitstempel mitschreiben (Kunde und Gast)
    if (field === 'feedback_kunde' && this.isKunde) {
      const authorName = window.currentUser?.name || 'Unbekannt';
      updates.feedback_kunde_author_name = window.isGast?.() ? `${authorName} (Gast)` : authorName;
      updates.feedback_kunde_updated_at = new Date().toISOString();
    }

    await creatorAuswahlService.updateItem(itemId, updates);

    const item = this.items.find(i => i.id === itemId);
    if (item) Object.assign(item, updates);

    if (field === 'follower_instagram' || field === 'follower_tiktok') {
      this.refreshNumberCell(element, value);
    }

    // Chip und Status-Punkt gehoeren zum eingetragenen Link. Ohne das bleibt
    // die Zelle nach dem Einfuegen optisch leer und der Punkt, der auf die
    // Aktionen hinweist, unsichtbar.
    if (field === 'link_instagram') {
      applySourcingIgCellState(element.closest('.chip-cell'), item || { link_instagram: value });
    }
  } catch (error) {
    console.error('Fehler beim Aktualisieren:', error);
    window.toastSystem?.show('Fehler beim Speichern', 'error');
  }
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

    this.rerenderTable();
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

  try {
    await creatorAuswahlService.updateItem(itemId, updates);

    const item = this.items.find(i => i.id === itemId);
    if (item) Object.assign(item, updates);

    // Feedback ist Teil des Toolbar-Filters - ein Wechsel kann die Zeile
    // aus der gefilterten Ansicht nehmen, deshalb die ganze Tabelle neu.
    // preserveScroll: vertikal das Fenster, horizontal der Scrollport
    // (main-wrapper standalone, Tabellen-Container embedded).
    const hScroll = this._getHScrollTarget(this._q('.table-container'));
    preserveScroll(() => this.rerenderTable(), { keep: hScroll ? [hScroll] : [] });
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

  const getKey = (entry) => personaGroupKey(entry);
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

export async function handlePersonaChange(itemId, groupKey, personaId = null) {
  try {
    const updates = updatesForGroupKey(groupKey, personaId);
    await creatorAuswahlService.updateItem(itemId, updates);

    const item = this.items.find(i => i.id === itemId);
    if (item) Object.assign(item, updates);

    this.rerenderTable([itemId]);
    window.toastSystem?.show('Persona aktualisiert', 'success');
  } catch (error) {
    console.error('Fehler beim Ändern der Persona:', error);
    window.toastSystem?.show('Fehler beim Ändern der Persona', 'error');
  }
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
  handleInstagramFetch,
  _flashIgFetchSuccess,
  warnBeiDoppeltemCreator,
  refreshItemRow,
  handleFieldUpdate,
  refreshNumberCell,
  handleStatusChange,
  handleKundenFeedbackChange,
  handleTypChange,
  promoteBookedItemWithinCategory,
  handleNichtUmsetzenChange,
  handlePersonaChange,
  handleDeleteItem
};
