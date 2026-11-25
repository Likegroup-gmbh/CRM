// CastingBestandAuswahl.js (ES6-Modul)
// Auswahlmodus von Creator Casting (ADR 0050): Zeilen markieren und als neue
// Casting-Einträge auf ein Casting legen. Die Liste rendert Checkbox-Spalte und
// Zeilen immer, dieser Controller schaltet den Modus synchron per Klasse
// `is-auswahl` an der Tabelle und hält die Auswahl (pro Person, überlebt
// Seitenwechsel) und die schwebende Leiste. Die Castings fürs Ziel laden im
// Hintergrund, der Modus wartet nicht darauf.

import { SelectionBar, bindCheckboxSelection } from '../../core/list/SelectionBar.js';
import { creatorAuswahlService } from '../creator-auswahl/CreatorAuswahlService.js';
import { castingPickerLabel } from '../creator-auswahl/AddCreatorToCastingDrawer.js';
import { parseTeilbereiche, OHNE_KATEGORIE } from '../creator-auswahl/castingKategorien.js';
import { bestandKey, bestandErgebnisText } from '../creator-auswahl/bestandZuCasting.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { escapeAttr } from '../../core/VideoUploadUtils.js';

export const BUTTON_ID = 'btn-casting-bestand-auswahl';
export const ITEM_CHECK_CLASS = 'bestand-check';
export const SELECT_ALL_CLASS = 'bestand-select-all';
const BAR_ID = 'casting-bestand-bar';
const CASTING_SELECT_ID = 'casting-bestand-bar-casting';
const KATEGORIE_SELECT_ID = 'casting-bestand-bar-kategorie';

export class CastingBestandAuswahl {
  /**
   * @param {Object} params
   * @param {() => HTMLElement|null} params.getTable - die Datentabelle, trägt die Klasse is-auswahl
   * @param {() => void} params.reload - Seite neu laden (Zähler haben sich geändert)
   */
  constructor({ getTable, reload }) {
    this.getTable = getTable;
    this.reload = reload;
    this.modus = false;
    this.selected = new Map();
    this.rowsByKey = new Map();
    this.listenById = new Map();
    this.listenGeladen = false;
    this._listenPromise = null;
    this.bar = null;
    this.binding = null;
    this.root = null;
    this._busy = false;
  }

  /** Nur wer Casting-Einträge anlegen darf, sieht den Button. */
  canUse() {
    if (window.isKunde?.()) return false;
    return window.permissionSystem?.can('sourcing', 'create') ?? false;
  }

  has(key) {
    return this.selected.has(key);
  }

  /** Zeilen der aktuellen Seite merken, damit eine Auswahl beim Blättern den Snapshot behält. */
  remember(rows) {
    (rows || []).forEach(row => {
      const key = bestandKey(row);
      if (key) this.rowsByKey.set(key, row);
    });
  }

  bind({ root, signal }) {
    this.root = root;

    this.binding = bindCheckboxSelection({
      root,
      signal,
      selected: this.selected,
      itemSelector: `.${ITEM_CHECK_CLASS}`,
      selectAllSelector: `.${SELECT_ALL_CLASS}`,
      keyOf: (cb) => cb.dataset.key,
      snapshotOf: (cb) => this.rowsByKey.get(cb.dataset.key) || null,
      rowSelector: 'tr[data-auswahl-key]',
      rowEnabled: () => this.modus,
      onChange: () => this.syncUi()
    });

    root.addEventListener('click', (e) => {
      if (e.target.closest(`#${BUTTON_ID}`)) this.toggle();
    }, { signal });
  }

  /** Nach einem Render der Zeilen: Select-All und Leiste an die Auswahl anpassen. */
  afterRender() {
    this.binding?.syncSelectAll();
    this.syncUi();
  }

  /** Zeilen-Markierung, Zähler und Button-Beschriftung mit der Auswahl abgleichen. */
  syncUi() {
    this.root?.querySelectorAll?.('tr[data-auswahl-key]').forEach(tr => {
      tr.classList.toggle('row-selected', this.selected.has(tr.dataset.auswahlKey));
    });
    this.bar?.update(this.selected.size);
    this.syncButton();
  }

  syncButton() {
    const btn = this.root?.querySelector?.(`#${BUTTON_ID}`);
    if (!btn) return;
    btn.textContent = this.modus ? 'Auswahl beenden' : 'Zu Casting hinzufügen';
    btn.classList.toggle('mdc-btn--secondary', this.modus);
    btn.setAttribute('aria-pressed', this.modus ? 'true' : 'false');
  }

  /** Modus synchron umschalten: Klasse an der Tabelle, kein Neurender, kein Warten auf Daten. */
  toggle() {
    this.modus = !this.modus;
    this.getTable()?.classList.toggle('is-auswahl', this.modus);

    if (this.modus) {
      this.mountBar();
      this.ladeListen();
    } else {
      this.binding?.clear();
      this.selected.clear();
      this.bar?.destroy();
      this.bar = null;
    }
    this.afterRender();
  }

  /** Auswahl leeren, der Modus bleibt an. */
  clear() {
    this.binding?.clear();
    this.selected.clear();
    this.syncUi();
  }

  /** Leiste aufbauen (versteckt bis zur ersten Auswahl). Die Castings tragen sich nach, sobald sie da sind. */
  mountBar() {
    this.bar = new SelectionBar({
      id: BAR_ID,
      countLabel: 'Personen ausgewählt',
      onAction: (name) => { if (name === 'add') this.hinzufuegen(); },
      onDeselect: () => this.clear()
    });

    const el = this.bar.mount(`
      <select class="bulk-kategorie-select" id="${CASTING_SELECT_ID}" aria-label="Casting"></select>
      <select class="bulk-kategorie-select" id="${KATEGORIE_SELECT_ID}" aria-label="Kategorie" hidden></select>
      <button type="button" class="mdc-btn mdc-btn--sm" data-selection-action="add" disabled>Hinzufügen</button>
    `);
    el.addEventListener('change', (e) => {
      if (e.target.id === CASTING_SELECT_ID) this.syncZiel();
    });
    // Suchfeld geleert: die Wahl entfällt, Hinzufügen bleibt gesperrt
    el.addEventListener('input', (e) => {
      if (!e.target.classList?.contains('searchable-select-input') || e.target.value) return;
      const select = this.bar?.query(`#${CASTING_SELECT_ID}`);
      if (!select?.value) return;
      select.value = '';
      this.syncZiel();
    });
    this.fuelleCastings();
  }

  /** Castings fürs Ziel einmal pro Seitenbesuch laden, ohne den Modus aufzuhalten. */
  ladeListen() {
    if (!this._listenPromise) {
      this._listenPromise = creatorAuswahlService.getListenFuerPicker()
        .then((listen) => {
          this.listenById = new Map((listen || []).filter(l => l?.id).map(l => [l.id, l]));
          this.listenGeladen = true;
          this.fuelleCastings();
        })
        .catch((error) => {
          console.error('Fehler beim Laden der Castings:', error);
          window.toastSystem?.show('Castings konnten nicht geladen werden', 'error');
          this._listenPromise = null;
          this.fuelleCastings();
        });
    }
    return this._listenPromise;
  }

  /** Casting-Select mit dem Stand der Listen füllen; eine schon getroffene Wahl bleibt. */
  fuelleCastings() {
    const select = this.bar?.query(`#${CASTING_SELECT_ID}`);
    if (!select) return;

    const gewaehlt = select.value;
    const optionen = [...this.listenById.values()]
      .map(l => `<option value="${escapeAttr(l.id)}">${escapeAttr(castingPickerLabel(l))}</option>`)
      .join('');
    select.innerHTML = `<option value="">${this.listenGeladen ? 'Casting wählen…' : 'Castings werden geladen…'}</option>${optionen}`;
    select.disabled = !this.listenGeladen;
    if (gewaehlt && this.listenById.has(gewaehlt)) select.value = gewaehlt;
    this.macheCastingsDurchsuchbar(select);
    this.syncZiel();
  }

  /**
   * Sobald die Castings da sind, wird das Select zum Suchfeld (tippen und filtern).
   * Das versteckte Select bleibt die Quelle für value und change.
   */
  macheCastingsDurchsuchbar(select) {
    if (!this.listenGeladen || !window.formSystem?.createSimpleSearchableSelect) return;

    const optionen = [...this.listenById.values()].map(l => ({
      value: l.id,
      label: castingPickerLabel(l),
      selected: l.id === select.value
    }));
    window.formSystem.createSimpleSearchableSelect(select, optionen, {
      placeholder: 'Casting suchen…'
    });
  }

  /** Kategorie-Feld nur, wenn das gewählte Casting welche hat; Hinzufügen erst mit Casting. */
  syncZiel() {
    const casting = this.bar?.query(`#${CASTING_SELECT_ID}`);
    const kategorie = this.bar?.query(`#${KATEGORIE_SELECT_ID}`);
    const button = this.bar?.query('[data-selection-action="add"]');
    if (!casting || !kategorie || !button) return;

    const liste = this.listenById.get(casting.value);
    const kategorien = parseTeilbereiche(liste?.teilbereich);
    kategorie.innerHTML = kategorien.length
      ? `<option value="">${OHNE_KATEGORIE}</option>`
        + kategorien.map(k => `<option value="${escapeAttr(k)}">${escapeAttr(k)}</option>`).join('')
      : '';
    kategorie.hidden = !kategorien.length;
    button.disabled = !casting.value;
  }

  async hinzufuegen() {
    if (this._busy) return;
    const listeId = this.bar?.query(`#${CASTING_SELECT_ID}`)?.value;
    if (!listeId) {
      window.toastSystem?.show('Bitte ein Casting auswählen', 'warning');
      return;
    }
    const personen = [...this.selected.values()].filter(Boolean);
    if (!personen.length) return;

    const kategorie = this.bar?.query(`#${KATEGORIE_SELECT_ID}`)?.value || null;
    const button = this.bar?.query('[data-selection-action="add"]');

    this._busy = true;
    if (button) button.disabled = true;
    try {
      const { added, skipped } = await creatorAuswahlService.addBestandPersonen(listeId, personen, kategorie);
      const text = bestandErgebnisText({ added: added.length, skipped: skipped.length });

      if (!added.length) {
        window.toastSystem?.show(text, 'warning');
        return;
      }

      added.filter(p => p.id).forEach(p => tabDataCache.invalidate('creator', p.id));
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'creator_auswahl', action: 'items-added', id: listeId }
      }));
      window.toastSystem?.show(text, 'success');
      this.clear();
      this.reload();
    } catch (error) {
      console.error('Fehler beim Hinzufügen zum Casting:', error);
      window.toastSystem?.show(error.message || 'Hinzufügen fehlgeschlagen', 'error');
    } finally {
      this._busy = false;
      if (button) button.disabled = !this.bar?.query(`#${CASTING_SELECT_ID}`)?.value;
    }
  }

  /** Beim Verlassen der Seite: Modus, Auswahl und Leiste zurücksetzen. */
  destroy() {
    this.getTable?.()?.classList.remove('is-auswahl');
    this.bar?.destroy();
    this.bar = null;
    this.modus = false;
    this.selected.clear();
    this.rowsByKey.clear();
    this.listenById = new Map();
    this.listenGeladen = false;
    this._listenPromise = null;
    this.binding = null;
    this.root = null;
  }
}
