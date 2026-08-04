// HoverToolbar
// Schwebende Aktionsleiste fuer Tabellenzellen - vom Prinzip wie die
// Formatierungsleiste eines Rich-Text-Editors: sie erscheint bei Hover direkt
// ueber dem Element und verschwindet wieder. Damit muessen Icon-Buttons nicht
// dauerhaft in der Zelle stehen, wo sie das Eingabefeld zerdruecken und je nach
// Datenlage ein- und ausspringen.
//
// Eine Zelle meldet sich allein durch Markup an:
//   data-hover-toolbar="<config-name>"   macht das Element zum Ausloeser
//   data-hover-toolbar-trigger           Indikator, der ohne Hover per Tap oeffnet
// Was in der Leiste steht, steckt in der Config unter diesem Namen
// (HoverToolbarRegistry). Kein Modul muss dafuer Listener binden.
//
// Die Leiste haengt an document.body und ist fixed positioniert, weil
// .grid-wrapper mit overflow-y: clip arbeitet - ein Overlay innerhalb der Zelle
// wuerde am Zellenrand abgeschnitten. Gleiche Loesung wie beim Status-Dropdown
// und bei TableSelect.

import { getHoverToolbarConfig } from './HoverToolbarRegistry.js';
import { buildHoverToolbarContent, resolve, visibleActions } from './HoverToolbarBuilder.js';

const OPEN_DELAY_MS = 120;
// Die Leiste sitzt ueber der Zelle, der Mauszeiger muss also einen kurzen
// Moment ausserhalb beider Elemente sein duerfen.
const CLOSE_DELAY_MS = 180;
const GAP_PX = 6;

const CELL_SELECTOR = '[data-hover-toolbar]';
const TRIGGER_SELECTOR = '[data-hover-toolbar-trigger]';
const PORTAL_SELECTOR = '.hover-toolbar';

export class HoverToolbar {
  constructor() {
    this.portal = null;
    this.cell = null;
    this.config = null;
    this._openTimer = null;
    this._closeTimer = null;
    this._pinned = false;
    this._bound = false;
  }

  // --- Kontext ---------------------------------------------------------------

  _configFor(cell) {
    return getHoverToolbarConfig(cell?.dataset?.hoverToolbar);
  }

  /**
   * Der Datensatz hinter der Zelle. Wird bei jedem Oeffnen, Refresh und Klick
   * frisch geholt, damit die Leiste nie auf einem veralteten Stand arbeitet -
   * die Tabellen aktualisieren einzelne Zellen im DOM, ohne neu zu rendern.
   */
  _contextFor(cell, config) {
    return config?.resolveContext ? config.resolveContext(cell) : { id: cell?.dataset?.id };
  }

  // --- Hover-Steuerung -------------------------------------------------------

  /** Zeitversetzt oeffnen, damit ein Mauszeiger im Vorbeiflug nichts ausloest. */
  scheduleOpen(cell) {
    if (!cell) return;
    clearTimeout(this._closeTimer);
    if (this.cell === cell && this.portal) return;

    clearTimeout(this._openTimer);
    this._openTimer = setTimeout(() => this.open(cell), OPEN_DELAY_MS);
  }

  /** Liegt Zeiger oder Fokus noch auf Zelle oder Leiste? */
  _stillEngaged() {
    return !!(this.portal?.matches(':hover')
      || this.cell?.matches(':hover')
      || this.cell?.contains(document.activeElement)
      || this.portal?.contains(document.activeElement));
  }

  /**
   * Verzoegert schliessen. Der Weg von der Zelle zur Leiste fuehrt durch den
   * Zwischenraum - ohne Nachlauf waere die Leiste dabei weg.
   *
   * Entschieden wird erst beim Ablauf des Timers, nicht beim Anmelden: ein
   * focusout beim Mausklick auf einen Button der Leiste wuerde sonst genau den
   * Klick wegziehen, auf den er reagiert.
   */
  scheduleClose() {
    clearTimeout(this._openTimer);
    clearTimeout(this._closeTimer);
    this._closeTimer = setTimeout(() => {
      // Nach einem Re-Render der Tabelle zeigt die Leiste auf eine Zelle, die
      // es nicht mehr gibt - dann hilft auch kein Nachlauf mehr.
      if (this.cell && !this.cell.isConnected) {
        this.close();
        return;
      }
      if (this._pinned || this._stillEngaged()) return;
      this.close();
    }, CLOSE_DELAY_MS);
  }

  cancelClose() {
    clearTimeout(this._closeTimer);
  }

  /**
   * Waehrend eines laufenden Vorgangs offen halten - etwa ein Abruf mit Spinner
   * oder eine Rueckfrage, die ueber der Leiste liegt und deren Weg dorthin sonst
   * ein mouseleave ausloest.
   */
  pin() {
    this._pinned = true;
    clearTimeout(this._closeTimer);
  }

  /**
   * Wieder freigeben. Ist der Zeiger inzwischen weitergewandert, kommt kein
   * mouseout mehr - die Leiste bliebe sonst dauerhaft stehen und muss den
   * Schliessvorgang selbst anstossen.
   */
  unpin() {
    this._pinned = false;
    if (this.portal) this.scheduleClose();
  }

  // --- Oeffnen / Schliessen --------------------------------------------------

  open(cell) {
    if (!cell?.isConnected) return null;

    const config = this._configFor(cell);
    if (!config) return null;

    const ctx = this._contextFor(cell, config);
    // Eine Zelle ohne verfuegbare Aktion bleibt ruhig, statt eine leere Leiste
    // aufzuklappen.
    if (config.canOpen && !config.canOpen(ctx)) {
      this.close();
      return null;
    }
    if (visibleActions(config.actions, ctx).length === 0) {
      this.close();
      return null;
    }

    this.close();

    const portal = document.createElement('div');
    portal.className = 'hover-toolbar';
    portal.setAttribute('role', 'toolbar');
    portal.setAttribute('aria-label', resolve(config.label, ctx) || 'Aktionen');
    portal.dataset.hoverToolbarFor = cell.dataset.hoverToolbar || '';
    if (ctx?.id != null) portal.dataset.id = String(ctx.id);
    portal.innerHTML = buildHoverToolbarContent(config, ctx);

    document.body.appendChild(portal);
    this.portal = portal;
    this.cell = cell;
    this.config = config;
    cell.classList.add('has-toolbar');

    this._position();
    requestAnimationFrame(() => portal.classList.add('is-visible'));
    return portal;
  }

  close() {
    clearTimeout(this._openTimer);
    clearTimeout(this._closeTimer);
    this._pinned = false;

    document.querySelectorAll(PORTAL_SELECTOR).forEach(el => el.remove());
    document.querySelectorAll(`${CELL_SELECTOR}.has-toolbar`)
      .forEach(el => el.classList.remove('has-toolbar'));

    this.portal = null;
    this.cell = null;
    this.config = null;
  }

  /**
   * Inhalt auf den aktuellen Datenstand bringen, ohne die Leiste zu schliessen.
   * Nach einem Abruf wechselt so etwa die Beschriftung der Hauptaktion.
   */
  refresh() {
    if (!this.portal || !this.cell?.isConnected || !this.config) return;

    const ctx = this._contextFor(this.cell, this.config);
    if (this.config.canOpen && !this.config.canOpen(ctx)) {
      this.close();
      return;
    }

    this.portal.innerHTML = buildHoverToolbarContent(this.config, ctx);
    this._position();
  }

  /**
   * Wie refresh(), aber fuer Tabellen, die eine Zeile per outerHTML ersetzen
   * statt einzelne Zellen zu patchen (Sourcing). Die Zelle unter der Leiste ist
   * danach ein anderes Element; wiedergefunden wird sie ueber Config-Name und ID,
   * die beide am Portal haengen. Kommt sie nicht zurueck - Filter greift jetzt,
   * Zeile ist raus - schliesst die Leiste.
   */
  rebind() {
    if (!this.portal || !this.config) return;
    if (this.cell?.isConnected) {
      this.refresh();
      return;
    }

    const neu = document.querySelector(
      `[data-hover-toolbar="${this.portal.dataset.hoverToolbarFor}"][data-id="${this.portal.dataset.id}"]`
    );
    if (!neu) {
      this.close();
      return;
    }

    this.cell = neu;
    neu.classList.add('has-toolbar');
    this.refresh();
  }

  // --- Positionierung --------------------------------------------------------

  /**
   * Ueber der Zelle, linksbuendig - kippt nach unten, wenn oben kein Platz ist
   * (gleiche Flip-Logik wie TableSelect und das Status-Dropdown).
   */
  _position() {
    const portal = this.portal;
    const cell = this.cell;
    if (!portal || !cell) return;

    const rect = cell.getBoundingClientRect();
    const height = portal.offsetHeight || 36;
    const width = portal.offsetWidth || 220;

    const openDown = rect.top - height - GAP_PX < 8;
    portal.classList.toggle('opens-down', openDown);
    portal.style.top = openDown
      ? `${rect.bottom + GAP_PX}px`
      : `${rect.top - height - GAP_PX}px`;

    const left = Math.min(rect.left, window.innerWidth - width - 8);
    portal.style.left = `${Math.max(8, left)}px`;
  }

  // --- Aktionen --------------------------------------------------------------

  /**
   * Klick auf einen Button der Leiste. Der ctx wird hier neu aufgeloest, nicht
   * der vom Oeffnen wiederverwendet: zwischen Hover und Klick koennen Sekunden
   * liegen, in denen ein Realtime-Update die Zeile veraendert hat.
   */
  _runAction(button) {
    if (!this.config || !this.cell) return;
    if (!this.cell.isConnected) {
      this.close();
      return;
    }

    const action = (this.config.actions || [])
      .find(a => a && a.id && a.id === button.dataset.hoverAction);
    if (!action?.onClick) return;

    action.onClick(this._contextFor(this.cell, this.config), button);
  }

  // --- Globale Listener ------------------------------------------------------

  /**
   * Einmalig an document, nicht pro Tabellen-Render: die Leiste lebt ausserhalb
   * des Grids und soll ein Re-Render ueberdauern koennen. Beim Scrollen
   * schliesst sie, weil eine fixe Position sonst neben der weggewanderten Zelle
   * stehen bliebe.
   */
  init() {
    if (this._bound) return;
    this._bound = true;

    this._onMouseover = (e) => {
      const cell = e.target.closest?.(CELL_SELECTOR);
      if (cell) {
        this.scheduleOpen(cell);
        return;
      }
      if (e.target.closest?.(PORTAL_SELECTOR)) {
        this.cancelClose();
        return;
      }
      // Zeiger ist weder auf Zelle noch Leiste - anders als bei mouseout
      // braucht es dafuer keine relatedTarget-Pruefung.
      if (this.portal) this.scheduleClose();
    };

    // Verlaesst der Zeiger das Fenster, kommt kein weiteres mouseover mehr.
    this._onMouseleave = () => { if (this.portal) this.scheduleClose(); };

    // Tastatur-Zugang: wer sich in die Zelle tabbt, bekommt die Aktionen auch -
    // und wer weitertabbt, wird sie wieder los.
    this._onFocusin = (e) => {
      const cell = e.target.closest?.(CELL_SELECTOR);
      if (cell) this.scheduleOpen(cell);
      else if (this.portal && !e.target.closest?.(PORTAL_SELECTOR)) this.scheduleClose();
    };

    this._onFocusout = (e) => {
      const cell = e.target.closest?.(CELL_SELECTOR);
      if (cell && !cell.contains(e.relatedTarget)) this.scheduleClose();
    };

    this._onClick = (e) => {
      const button = e.target.closest?.(`${PORTAL_SELECTOR} [data-hover-action]`);
      if (button) {
        // Links duerfen ihrem href folgen, Buttons fuehren ihre Aktion aus.
        if (button.tagName !== 'A') {
          e.preventDefault();
          this._runAction(button);
        }
        return;
      }

      // Ohne Hover (Touch) ist der Indikator der Ausloeser.
      const trigger = e.target.closest?.(TRIGGER_SELECTOR);
      if (trigger) {
        const cell = trigger.closest(CELL_SELECTOR);
        e.preventDefault();
        if (this.cell === cell && this.portal) this.close();
        else this.open(cell);
        return;
      }

      // Klick ins Leere schliesst die Leiste - sonst haengt sie nach einem Tap
      // auf dem Indikator dauerhaft im Bild. Die Pruefung laeuft nur bei
      // offener Leiste, der Handler sieht jeden Klick der Anwendung.
      if (!this.portal) return;
      if (!e.target.closest?.(PORTAL_SELECTOR) && !e.target.closest?.(CELL_SELECTOR)) {
        this.close();
      }
    };

    this._onScroll = () => { if (this.portal) this.close(); };
    this._onResize = () => { if (this.portal) this.close(); };
    this._onKeydown = (e) => { if (e.key === 'Escape' && this.portal) this.close(); };

    document.addEventListener('mouseover', this._onMouseover);
    document.addEventListener('mouseleave', this._onMouseleave);
    document.addEventListener('focusin', this._onFocusin);
    document.addEventListener('focusout', this._onFocusout);
    document.addEventListener('click', this._onClick);
    document.addEventListener('keydown', this._onKeydown);
    window.addEventListener('scroll', this._onScroll, { capture: true, passive: true });
    window.addEventListener('resize', this._onResize);
  }

  destroy() {
    this.close();
    if (!this._bound) return;

    document.removeEventListener('mouseover', this._onMouseover);
    document.removeEventListener('mouseleave', this._onMouseleave);
    document.removeEventListener('focusin', this._onFocusin);
    document.removeEventListener('focusout', this._onFocusout);
    document.removeEventListener('click', this._onClick);
    document.removeEventListener('keydown', this._onKeydown);
    window.removeEventListener('scroll', this._onScroll, { capture: true });
    window.removeEventListener('resize', this._onResize);
    this._bound = false;
  }
}

export const hoverToolbar = new HoverToolbar();
