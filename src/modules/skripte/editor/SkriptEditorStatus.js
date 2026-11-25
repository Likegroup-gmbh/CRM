// SkriptEditorStatus.js
// Status-Wahl im Dokumentkopf (Prototype-Mixin): derselbe Select wie in der
// Skripte-Tabelle der Produktion, gespeichert mit derselben Freigabe-Regel.

import { renderTableSelect } from '../../../core/components/TableSelect.js';
import { skripteService } from '../SkripteService.js';
import { skriptStatusOptions } from '../skriptStatusOptions.js';
import { SkriptEditorView } from './SkriptEditorViewCore.js';

// Eigener Feldname: 'skript_status' aus einem Pane speichert die Produktion selbst
export const STATUS_FELD = 'ed_skript_status';

SkriptEditorView.prototype.statusWahlHtml = function() {
  if (!this.kannStatusSetzen) return '';
  return `<div class="skripte-editor-status" data-ed-status>${renderTableSelect({
    field: STATUS_FELD,
    itemId: this.skript.id,
    value: this.skript.status || '',
    options: skriptStatusOptions(this.skript.status)
  })}</div>`;
};

/** TableSelect meldet die Wahl auf document; je Editor ein Listener. */
SkriptEditorView.prototype.bindStatusWahl = function() {
  this.unbindStatusWahl();
  this.onStatusWahl = (e) => {
    const { field, itemId, value } = e.detail || {};
    if (field !== STATUS_FELD || !itemId || itemId !== this.skript?.id) return;
    void this.setzeStatus(value);
  };
  document.addEventListener('table-select-change', this.onStatusWahl);
};

SkriptEditorView.prototype.unbindStatusWahl = function() {
  if (!this.onStatusWahl) return;
  document.removeEventListener('table-select-change', this.onStatusWahl);
  this.onStatusWahl = null;
};

SkriptEditorView.prototype.setzeStatus = async function(status) {
  const skriptId = this.skript?.id;
  const vorher = this.skript?.status;
  if (!this.kannStatusSetzen || !skriptId || !status || status === vorher) return;
  this.zeigeStatus(skriptId, status, vorher);
  try {
    await skripteService.setzeSkriptStatus(skriptId, status);
    window.toastSystem?.show('Skript-Status aktualisiert', 'success');
  } catch (error) {
    this.zeigeStatus(skriptId, vorher, status);
    window.toastSystem?.show(error.message || 'Status konnte nicht gespeichert werden', 'error');
  }
};

/** Status lokal übernehmen: Kopf, Skriptliste bzw. Skriptwahl der Produktion. */
SkriptEditorView.prototype.zeigeStatus = function(skriptId, status, vorher) {
  const eintrag = this.skripte?.find((s) => s.id === skriptId);
  if (eintrag) eintrag.status = status;
  if (this.skript?.id !== skriptId) return;
  this.skript.status = status;
  // Rückfragen-Phase zeigt ein anderes Dokument, sonst reicht der Select
  if (status === 'fragen' || vorher === 'fragen') {
    this.renderDoc();
  } else {
    const slot = this.container?.querySelector('[data-ed-status]');
    if (slot) slot.outerHTML = this.statusWahlHtml();
  }
  this.renderListe();
};
