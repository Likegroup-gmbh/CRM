// CastingDetailSpalten.js
// Spalten-Sichtbarkeit, Spaltenreihenfolge, Listeneinstellungen und Kunden Call
// (Prototype-Mixin von CreatorAuswahlDetail)

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { SourcingTabelleAnpassenDrawer } from './SourcingTabelleAnpassenDrawer.js';
import { migrateHiddenColumns } from './sourcingSpaltenSichtbarkeit.js';
import { ankerEintraegeAusFolge, ersetzeEigeneSpalten } from './sourcingSpaltenfolge.js';

export function loadColumnVisibilitySettings() {
  this.hiddenColumns = migrateHiddenColumns(this.liste?.hidden_columns);
  try {
    const callKey = `sourcing_detail_kunden_call_${this.listeId}`;
    this.kundenCallActive = localStorage.getItem(callKey) === 'true';
  } catch (error) {
    this.kundenCallActive = false;
  }
}

export async function saveColumnVisibilitySettings() {
  try {
    await creatorAuswahlService.updateListe(this.listeId, {
      hidden_columns: this.hiddenColumns
    });
    if (this.liste) this.liste.hidden_columns = this.hiddenColumns;
  } catch (error) {
    console.error('Fehler beim Speichern der Spalten-Sichtbarkeit:', error);
  }
}

/**
 * Reihenfolge aus dem Drawer. Die eigenen Spalten bekommen denselben Anker,
 * damit der Griff im Tabellenkopf sie weiterhin an dieselbe Stelle zieht.
 */
export async function saveColumnOrder(order) {
  await creatorAuswahlService.updateListe(this.listeId, { column_order: order });
  if (this.liste) this.liste.column_order = order;

  if (this.customColumns?.hasColumns && this.customColumns.dataLoader) {
    const entries = ankerEintraegeAusFolge(order);
    this.customColumns.order = entries;
    try {
      await this.customColumns.dataLoader.saveColumnOrder(entries);
    } catch (error) {
      console.error('Anker der eigenen Spalten speichern fehlgeschlagen:', error);
    }
  }

  this.rerenderTable();
}

/** Kopf-Griff einer eigenen Spalte: Standardreihenfolge behalten, Anker neu setzen. */
export async function uebernehmeKopfVerschiebung() {
  const gespeichert = this.liste?.column_order;
  if (!Array.isArray(gespeichert) || gespeichert.length === 0) return;
  const neu = ersetzeEigeneSpalten(gespeichert, this.customColumns.getOrderedColumns());
  if (neu.join('|') === gespeichert.join('|')) return;
  await creatorAuswahlService.updateListe(this.listeId, { column_order: neu });
  this.liste.column_order = neu;
}

/**
 * Listeneinstellungen speichern. Ein neuer TKP schlägt direkt auf die
 * Reels-Preise durch, geänderte hidden_columns auf die Spalten.
 * In beiden Fällen die Tabelle neu rendern.
 */
export async function saveListenEinstellungen(updates) {
  try {
    await creatorAuswahlService.updateListe(this.listeId, updates);
    Object.assign(this.liste, updates);
    if (updates.hidden_columns) {
      this.hiddenColumns = updates.hidden_columns;
    }
    this.rerenderTable();
  } catch (error) {
    console.error('Fehler beim Speichern der Listeneinstellungen:', error);
    window.toastSystem?.show('Einstellung konnte nicht gespeichert werden', 'error');
  }
}

export function showTabelleAnpassenDrawer() {
  // Drawer bei jedem Oeffnen neu bauen, damit neue Custom-Spalten erscheinen
  this.tabelleAnpassenDrawer = new SourcingTabelleAnpassenDrawer({
    liste: this.liste,
    hiddenColumns: this.hiddenColumns,
    spaltenPflege: this.customColumns,
    onColumnsChanged: () => this.rerenderTable(),
    onHiddenColumnsChange: async (newHiddenColumns) => {
      this.hiddenColumns = newHiddenColumns;
      await this.saveColumnVisibilitySettings();
      this.rerenderTable();
    },
    onListeChange: (updates) => this.saveListenEinstellungen(updates),
    onColumnOrderChange: (order) => this.saveColumnOrder(order)
  });
  this.tabelleAnpassenDrawer.open();
}

export function toggleKundenCall() {
  this.kundenCallActive = !this.kundenCallActive;
  try {
    const callKey = `sourcing_detail_kunden_call_${this.listeId}`;
    localStorage.setItem(callKey, this.kundenCallActive ? 'true' : 'false');
  } catch (error) { /* ignore */ }

  const btn = this._q('#btn-kunden-call-toggle');
  if (btn) btn.classList.toggle('active', this.kundenCallActive);

  this._qq('[data-blur-target]').forEach(el => {
    el.classList.toggle('kunden-call-blur', this.kundenCallActive);
  });
}

export const castingDetailSpaltenMethods = {
  loadColumnVisibilitySettings,
  saveColumnVisibilitySettings,
  saveColumnOrder,
  uebernehmeKopfVerschiebung,
  saveListenEinstellungen,
  showTabelleAnpassenDrawer,
  toggleKundenCall
};
