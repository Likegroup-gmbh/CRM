// EntityCustomColumnsManager.js
// Orchestriert Custom Columns fuer einstufige Detail-Tabellen (Sourcing/Strategie):
// Laden, State, Rendering-Helfer, Verwaltungs-Drawer, Inline-Edit-Routing,
// Header-Drag&Drop und Upload-Drawer. Haelt die Modul-Integration duenn.

import { EntityCustomColumnDataLoader } from './EntityCustomColumnDataLoader.js';
import { EntityCustomColumnsDrawer } from './EntityCustomColumnsDrawer.js';
import { EntityCustomColumnFieldHandler } from './EntityCustomColumnFieldHandler.js';
import { renderCustomHeaders, renderCustomCells } from './EntityCustomColumnRenderer.js';
import {
  orderCustomColumns, makeCustomColumnId, groupCustomColumnsByAnchor, toOrderEntry,
  isCustomColumnId
} from './entityColumnUtils.js';

/** Randzone in px, in der beim Spalten-Ziehen auto-gescrollt wird */
const DRAG_SCROLL_EDGE = 64;
const DRAG_SCROLL_STEP = 22;

export class EntityCustomColumnsManager {
  /**
   * @param {object} cfg
   * @param {string} cfg.parentType   'sourcing' | 'strategie'
   * @param {string} cfg.parentTable  'creator_auswahl' | 'strategie'
   * @param {string} [cfg.orderColumn='custom_column_order']
   * @param {string[]} [cfg.anchorColumns]
   * @param {Record<string, string>} [cfg.anchorLabels]  Anzeigenamen der Anker
   * @param {string[]} [cfg.disabledAnchors]  Anker, die im Positionsmenue fehlen
   */
  constructor({
    parentType,
    parentTable,
    orderColumn = 'custom_column_order',
    anchorColumns = [],
    anchorLabels = {},
    disabledAnchors = []
  }) {
    this.parentType = parentType;
    this.parentTable = parentTable;
    this.orderColumn = orderColumn;
    // Standardspalten, hinter denen eine eigene Spalte verankert werden darf.
    // Leer = alle Anker sind unbekannt, alles landet am Tabellenende.
    this.anchorColumns = anchorColumns;
    this.anchorLabels = anchorLabels || {};
    this.disabledAnchors = disabledAnchors || [];
    this.dataLoader = null;
    this.columns = [];
    this.order = [];
    this.values = {};   // { [entityId]: { [columnId]: value } }
    this._uploadDrawer = null;
  }

  async init(parentId) {
    this.parentId = parentId;
    this.dataLoader = new EntityCustomColumnDataLoader({
      parentType: this.parentType,
      parentId,
      parentTable: this.parentTable,
      orderColumn: this.orderColumn
    });
    this.columns = await this.dataLoader.loadColumns();
    this.order = (await this.dataLoader.loadColumnOrder()) || this.columns.map(c => makeCustomColumnId(c.id));
  }

  async loadValues(entityIds) {
    const columnIds = this.columns.map(c => c.id);
    this.values = await this.dataLoader.loadValues(columnIds, entityIds || []);
  }

  get hasColumns() { return this.columns.length > 0; }

  getOrderedColumns() {
    return orderCustomColumns(this.columns, this.order);
  }

  /** Anzahl Custom-Spalten, die fuer die aktuelle Rolle sichtbar sind (fuer colspan). */
  visibleCount(hiddenColumns, isKunde) {
    return this.getOrderedColumns().filter(col => {
      if (isKunde && !col.visible_for_kunden) return false;
      if (Array.isArray(hiddenColumns) && hiddenColumns.includes(makeCustomColumnId(col.id))) return false;
      return true;
    }).length;
  }

  /** Spalten getrennt nach Anker; unbekannte Anker fallen ans Ende. */
  _grouped() {
    return groupCustomColumnsByAnchor(this.getOrderedColumns(), this.anchorColumns);
  }

  /** Spalten ohne (gueltigen) Anker - sie stehen weiterhin am Tabellenende. */
  renderHeaders(hiddenColumns, isKunde) {
    return renderCustomHeaders(this._grouped().trailing, hiddenColumns, isKunde);
  }

  renderCells(entityId, hiddenColumns, isKunde) {
    return renderCustomCells(
      this._grouped().trailing,
      entityId,
      (eId, uuid) => this.getValue(eId, uuid),
      hiddenColumns,
      isKunde
    );
  }

  /** Header der Spalten, die hinter `anchor` verankert sind. */
  renderHeadersAt(anchor, hiddenColumns, isKunde) {
    const cols = this._grouped().byAnchor.get(anchor);
    if (!cols?.length) return '';
    return renderCustomHeaders(cols, hiddenColumns, isKunde);
  }

  /** Zellen der Spalten, die hinter `anchor` verankert sind. */
  renderCellsAt(anchor, entityId, hiddenColumns, isKunde) {
    const cols = this._grouped().byAnchor.get(anchor);
    if (!cols?.length) return '';
    return renderCustomCells(
      cols,
      entityId,
      (eId, uuid) => this.getValue(eId, uuid),
      hiddenColumns,
      isKunde
    );
  }

  getValue(entityId, uuid) {
    return this.values?.[entityId]?.[uuid] ?? '';
  }

  setValue(entityId, uuid, value) {
    (this.values[entityId] ||= {})[uuid] = value;
  }

  openManagementDrawer(onChange) {
    const drawer = new EntityCustomColumnsDrawer({
      dataLoader: this.dataLoader,
      columns: this.columns,
      order: this.order,
      onChange: () => onChange?.()
    });
    drawer.open();
  }

  isCustomField(el) {
    return EntityCustomColumnFieldHandler.isCustomColumnField(el);
  }

  async handleFieldUpdate(el, onChange) {
    const ok = await EntityCustomColumnFieldHandler.handleUpdate(el, {
      dataLoader: this.dataLoader,
      columns: this.columns,
      onValueChange: (entityId, columnId, value) => this.setValue(entityId, columnId, value)
    });
    if (ok) onChange?.();
    return ok;
  }

  /**
   * Bindet Drag&Drop fuer Custom-Spalten-Header. Ziehbar ist nur der
   * Hand-Griff; Drop-Ziel ist jede eigene Spalte und jede Standardspalte aus
   * `anchorColumns`. Sticky-Spalten und Aktionen bleiben gesperrt.
   * Am Rand des Scroll-Containers wird automatisch horizontal gescrollt.
   * @param {HTMLElement} root  Container mit den <th>
   * @param {() => void} onReorder  wird nach gespeicherter Reihenfolge aufgerufen
   * @returns {() => void} cleanup
   */
  bindHeaderDragAndDrop(root, onReorder) {
    if (!root) return () => {};

    let draggedId = null;
    let indicator = null;
    const scrollParent = root.closest('.main-wrapper')
      || root.closest('.data-table-container')
      || root.parentElement;

    const removeIndicator = () => { indicator?.remove(); indicator = null; };

    const showIndicator = (th, clientX) => {
      const rect = th.getBoundingClientRect();
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'column-drop-indicator';
        document.body.appendChild(indicator);
      }
      const links = this._istLinkeHaelfte(th, clientX);
      indicator.style.top = `${rect.top}px`;
      indicator.style.height = `${rect.height}px`;
      indicator.style.left = links ? `${rect.left - 1}px` : `${rect.right - 1}px`;
    };

    const findeZielUnter = (clientX, clientY) => {
      const el = document.elementFromPoint(clientX, clientY);
      const th = el?.closest?.('th');
      if (!th || !root.contains(th)) return null;
      return this._istDropZiel(th) ? th : null;
    };

    const autoScroll = (clientX) => {
      if (!scrollParent) return;
      const rect = scrollParent.getBoundingClientRect();
      if (clientX < rect.left + DRAG_SCROLL_EDGE) {
        scrollParent.scrollLeft -= DRAG_SCROLL_STEP;
      } else if (clientX > rect.right - DRAG_SCROLL_EDGE) {
        scrollParent.scrollLeft += DRAG_SCROLL_STEP;
      }
    };

    const onDragStart = (e) => {
      const grip = e.target?.closest?.('.entity-custom-col-grip');
      if (!grip || !root.contains(grip)) {
        // Drag vom Spaltennamen / sonstigem Header-Inhalt unterbinden
        if (e.target?.closest?.('.entity-custom-col-header')) e.preventDefault();
        return;
      }
      const th = grip.closest('.entity-custom-col-header');
      if (!th) return;
      draggedId = th.dataset.customColId || grip.dataset.customColGrip;
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', draggedId); } catch { /* noop */ }
      th.classList.add('column-dragging');
    };

    const onDragOver = (e) => {
      if (!draggedId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      autoScroll(e.clientX);
      const th = findeZielUnter(e.clientX, e.clientY);
      if (th) showIndicator(th, e.clientX);
      else removeIndicator();
    };

    const onDrop = async (e) => {
      if (!draggedId) return;
      e.preventDefault();
      const th = findeZielUnter(e.clientX, e.clientY);
      const id = draggedId;
      cleanupDragState();
      if (!th) return;
      const geaendert = await this._reorderAnTh(id, th, e.clientX);
      if (geaendert) onReorder?.();
    };

    const cleanupDragState = () => {
      removeIndicator();
      root.querySelectorAll('.column-dragging').forEach(el => el.classList.remove('column-dragging'));
      draggedId = null;
    };

    const onDragEnd = () => cleanupDragState();

    // Document-Level: Auto-Scroll und Drop auch wenn der Cursor ueber dem Body liegt
    root.addEventListener('dragstart', onDragStart);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);
    root.addEventListener('dragend', onDragEnd);

    return () => {
      cleanupDragState();
      root.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDrop);
      root.removeEventListener('dragend', onDragEnd);
    };
  }

  _istDropZiel(th) {
    return th.classList.contains('entity-custom-col-header') || !!this._anchorVonTh(th);
  }

  /** Standardspalten-Klasse der Kopfzelle, sofern sie als Anker erlaubt ist. */
  _anchorVonTh(th) {
    for (const cls of th.classList) {
      if (this.anchorColumns.includes(cls)) return cls;
    }
    return null;
  }

  _istLinkeHaelfte(th, clientX) {
    const rect = th.getBoundingClientRect();
    if (!rect.width) return false;
    return (clientX - rect.left) < rect.width / 2;
  }

  /**
   * Ermittelt aus der Ziel-Kopfzelle den neuen Anker und die Position innerhalb
   * der Ankergruppe und speichert die Reihenfolge.
   * @returns {Promise<boolean>} true, wenn sich etwas geaendert hat
   */
  async _reorderAnTh(draggedId, th, clientX) {
    const cols = this.getOrderedColumns();
    const dragged = cols.find(c => makeCustomColumnId(c.id) === draggedId);
    if (!dragged) return false;

    const links = this._istLinkeHaelfte(th, clientX);
    const rest = cols.filter(c => c !== dragged);
    let anchor;
    let positionInGruppe;

    if (th.classList.contains('entity-custom-col-header')) {
      const zielId = th.dataset.customColId;
      if (zielId === draggedId) return false;
      const ziel = rest.find(c => makeCustomColumnId(c.id) === zielId);
      if (!ziel) return false;
      anchor = ziel._anchor ?? null;
      const gruppe = rest.filter(c => (c._anchor ?? null) === anchor);
      positionInGruppe = gruppe.indexOf(ziel) + (links ? 0 : 1);
    } else {
      const zielAnchor = this._anchorVonTh(th);
      if (!zielAnchor) return false;
      if (links) {
        // Links von einer Standardspalte heisst: ans Ende der Gruppe davor.
        const vorherige = this._vorherigerAnchor(zielAnchor);
        anchor = vorherige ?? zielAnchor;
        positionInGruppe = vorherige
          ? rest.filter(c => (c._anchor ?? null) === vorherige).length
          : 0;
      } else {
        anchor = zielAnchor;
        positionInGruppe = 0;
      }
    }

    return this._applyMove(draggedId, anchor, positionInGruppe);
  }

  /**
   * Ziele fuer das Positionsmenue einer eigenen Spalte, in Tabellenreihenfolge.
   * @param {string} colId  "custom:{uuid}"
   * @param {{hiddenColumns?: string[], isKunde?: boolean}} [opts]
   * @returns {Array<{value: string, label: string, active: boolean}>}
   */
  getMoveTargets(colId, { hiddenColumns = [], isKunde = false } = {}) {
    const cols = this.getOrderedColumns();
    const self = cols.find(c => makeCustomColumnId(c.id) === colId);
    if (!self) return [];

    const versteckt = (className) => Array.isArray(hiddenColumns) && hiddenColumns.includes(className);
    const targets = [];

    for (const anchor of this.anchorColumns) {
      if (this.disabledAnchors.includes(anchor)) continue;
      if (versteckt(anchor)) continue;

      const label = this.anchorLabels[anchor] || anchor;
      targets.push({
        value: `anchor:${anchor}`,
        label: `Hinter ${label}`,
        active: false
      });

      const gruppe = cols.filter(c => (c._anchor ?? null) === anchor);
      for (const c of gruppe) {
        const id = makeCustomColumnId(c.id);
        if (id === colId) continue;
        if (versteckt(id)) continue;
        if (isKunde && !c.visible_for_kunden) continue;
        targets.push({
          value: id,
          label: `Hinter ${c.name}`,
          active: false
        });
      }
    }

    targets.push({ value: 'end', label: 'Am Tabellenende', active: false });

    const trailing = cols.filter(c => (c._anchor ?? null) === null);
    for (const c of trailing) {
      const id = makeCustomColumnId(c.id);
      if (id === colId) continue;
      if (versteckt(id)) continue;
      if (isKunde && !c.visible_for_kunden) continue;
      targets.push({
        value: id,
        label: `Hinter ${c.name}`,
        active: false
      });
    }

    const current = this._currentTargetValue(self, cols);
    for (const t of targets) {
      if (t.value === current) t.active = true;
    }
    return targets;
  }

  /** Aktuelles Menue-Ziel einer Spalte anhand Anker und Position in der Gruppe. */
  _currentTargetValue(col, orderedCols) {
    const anchor = col._anchor ?? null;
    const gruppe = orderedCols.filter(c => (c._anchor ?? null) === anchor);
    const idx = gruppe.indexOf(col);
    if (idx > 0) return makeCustomColumnId(gruppe[idx - 1].id);
    if (anchor) return `anchor:${anchor}`;
    return 'end';
  }

  /**
   * Verschiebt eine eigene Spalte auf das gewaehlte Menue-Ziel.
   * @param {string} colId  "custom:{uuid}"
   * @param {string} targetValue  "anchor:…", "custom:…" oder "end"
   * @returns {Promise<boolean>}
   */
  async moveColumnTo(colId, targetValue) {
    const cols = this.getOrderedColumns();
    const dragged = cols.find(c => makeCustomColumnId(c.id) === colId);
    if (!dragged) return false;

    const rest = cols.filter(c => c !== dragged);
    let anchor;
    let positionInGruppe;

    if (targetValue === 'end') {
      anchor = null;
      positionInGruppe = 0;
    } else if (typeof targetValue === 'string' && targetValue.startsWith('anchor:')) {
      anchor = targetValue.slice('anchor:'.length);
      if (!this.anchorColumns.includes(anchor)) return false;
      positionInGruppe = 0;
    } else if (isCustomColumnId(targetValue)) {
      const ziel = rest.find(c => makeCustomColumnId(c.id) === targetValue);
      if (!ziel) return false;
      anchor = ziel._anchor ?? null;
      const gruppe = rest.filter(c => (c._anchor ?? null) === anchor);
      positionInGruppe = gruppe.indexOf(ziel) + 1;
    } else {
      return false;
    }

    return this._applyMove(colId, anchor, positionInGruppe);
  }

  /**
   * Gemeinsamer Speicherpfad fuer Drag und Positionsmenue.
   * @returns {Promise<boolean>} true, wenn sich etwas geaendert hat
   */
  async _applyMove(draggedId, anchor, positionInGruppe) {
    const cols = this.getOrderedColumns();
    const dragged = cols.find(c => makeCustomColumnId(c.id) === draggedId);
    if (!dragged) return false;

    // Gleicher Anker und gleiche Position: nichts zu tun, kein Speichern.
    if ((dragged._anchor ?? null) === anchor) {
      const alt = cols.filter(c => (c._anchor ?? null) === anchor).indexOf(dragged);
      if (positionInGruppe === alt) return false;
    }

    const rest = cols.filter(c => c !== dragged);
    const neu = this._einfuegen(rest, dragged, anchor, positionInGruppe);
    this.order = neu.map(c => toOrderEntry(makeCustomColumnId(c.id), c._anchor ?? null));

    try {
      await this.dataLoader.saveColumnOrder(this.order);
    } catch (error) {
      console.error('❌ Spalten-Reihenfolge speichern fehlgeschlagen:', error);
      window.toastSystem?.show('Fehler beim Speichern der Reihenfolge', 'error');
    }
    return true;
  }

  /** Setzt die gezogene Spalte mit neuem Anker an die Position ihrer Gruppe. */
  _einfuegen(rest, dragged, anchor, positionInGruppe) {
    const neueSpalte = { ...dragged, _anchor: anchor };
    const gruppenIndizes = rest
      .map((c, i) => ((c._anchor ?? null) === anchor ? i : -1))
      .filter(i => i >= 0);

    let einfuegeIndex;
    if (gruppenIndizes.length === 0) einfuegeIndex = rest.length;
    else if (positionInGruppe <= 0) einfuegeIndex = gruppenIndizes[0];
    else if (positionInGruppe >= gruppenIndizes.length) einfuegeIndex = gruppenIndizes[gruppenIndizes.length - 1] + 1;
    else einfuegeIndex = gruppenIndizes[positionInGruppe];

    const neu = [...rest];
    neu.splice(einfuegeIndex, 0, neueSpalte);
    return neu;
  }

  /** Standardspalte, die im Tabellenkopf vor `anchor` steht. */
  _vorherigerAnchor(anchor) {
    const idx = this.anchorColumns.indexOf(anchor);
    return idx > 0 ? this.anchorColumns[idx - 1] : null;
  }

  /**
   * Oeffnet den (kampagnen-eigenen) VideoUploadDrawer im custom-Tab fuer ein Upload-Feld.
   * Schreibt ueber valueTable/assetTable in die entity_custom_column*-Tabellen.
   */
  async openUploadDrawer(btn, metadaten, onChange) {
    const columnId = btn.dataset.customColumnId;
    const entityId = btn.dataset.entityId;
    const columnName = btn.dataset.columnName || 'Upload';

    if (!this._uploadDrawer) {
      const mod = await import('../../modules/kampagne/VideoUploadDrawer.js');
      this._uploadDrawer = new mod.VideoUploadDrawer();
    }

    this._uploadDrawer.open(null, metadaten || {}, null, null, null, {
      initialTab: 'custom',
      customMeta: {
        columnId,
        entityId,
        columnName,
        folderName: columnName,
        valueTable: this.dataLoader.valueTable,
        assetTable: this.dataLoader.assetTable,
        currentValue: this.getValue(entityId, columnId) || null,
        onSuccess: (folderUrl) => {
          // folderUrl === null: alle Dateien geloescht -> Zelle zeigt wieder Upload-Button
          this.setValue(entityId, columnId, folderUrl || null);
          onChange?.();
        }
      }
    });
  }
}
