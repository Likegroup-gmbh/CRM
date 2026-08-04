// LiveLinkToolbar
// Schwebende Aktionsleiste der Live-Link-Zelle - vom Prinzip wie die
// Formatierungsleiste eines Rich-Text-Editors: sie erscheint bei Hover direkt
// ueber der Zelle und verschwindet wieder. Vorher standen Haekchen, Extern-Link
// und X dauerhaft in der Zelle, haben das Eingabefeld zerdrueckt und sind je
// nach Link-Zustand ein- und ausgesprungen.
//
// Die Leiste haengt an document.body und ist fixed positioniert, weil
// .grid-wrapper mit overflow-y: clip arbeitet - ein Overlay innerhalb der Zelle
// wuerde am Zellenrand abgeschnitten. Gleiche Loesung wie beim Status-Dropdown
// und bei TableSelect.

import { findVideoInTable } from './liveLinkCell.js';

const OPEN_DELAY_MS = 120;
// Die Leiste sitzt ueber der Zelle, der Mauszeiger muss also einen kurzen
// Moment ausserhalb beider Elemente sein duerfen.
const CLOSE_DELAY_MS = 180;
const GAP_PX = 6;

const ICON_REFRESH = `<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M88,104H40a8,8,0,0,1-8-8V48a8,8,0,0,1,16,0V76.69L62.63,62.06A95.43,95.43,0,0,1,130,33.94h.53a95.36,95.36,0,0,1,67.07,27.33,8,8,0,0,1-11.18,11.44,79.52,79.52,0,0,0-55.89-22.77h-.45A79.56,79.56,0,0,0,73.94,73.37L59.31,88H88a8,8,0,0,1,0,16Zm128,48H168a8,8,0,0,0,0,16h28.69l-14.63,14.63a79.56,79.56,0,0,1-56.13,23.43h-.45a79.52,79.52,0,0,1-55.89-22.77,8,8,0,1,0-11.18,11.44,95.36,95.36,0,0,0,67.07,27.33H126a95.43,95.43,0,0,0,67.36-28.12L208,179.31V208a8,8,0,0,0,16,0V160A8,8,0,0,0,216,152Z"/></svg>`;

const ICON_CHART = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 15V9"/><path d="M12 15V5"/><path d="M17 15v-4"/></svg>`;

const ICON_WARN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v3.75m0 3.75h.008M10.34 3.94 2.7 17.1A1.5 1.5 0 0 0 4 19.35h16a1.5 1.5 0 0 0 1.3-2.25L13.66 3.94a1.5 1.5 0 0 0-2.62 0Z"/></svg>`;

const ICON_EXTERNAL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;

const ICON_TRASH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;

export class LiveLinkToolbar {
  constructor(table) {
    this.table = table;
    this.portal = null;
    this.cell = null;
    this._openTimer = null;
    this._closeTimer = null;
    this._pinned = false;
    this._globalsBound = false;
  }

  /**
   * Erst der Input, dann der Store: die Leiste soll auch fuer einen gerade
   * eingetippten, noch nicht gespeicherten Link oeffnen.
   */
  _currentUrl(cell, video) {
    const input = cell?.querySelector('input[data-field="link_live"]');
    const typed = input?.value?.trim();
    return typed || video?.link_live || '';
  }

  // --- Hover-Steuerung -----------------------------------------------------

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
      if (this._pinned || this._stillEngaged()) return;
      this.close();
    }, CLOSE_DELAY_MS);
  }

  cancelClose() {
    clearTimeout(this._closeTimer);
  }

  /**
   * Waehrend eines laufenden Abrufs offen halten: der Spinner und der
   * anschliessende Erfolgs-Zustand sitzen in der Leiste.
   */
  pin() {
    this._pinned = true;
    clearTimeout(this._closeTimer);
  }

  /**
   * Nach dem Abruf wieder freigeben. Ist der Zeiger inzwischen weitergewandert,
   * kommt kein mouseout mehr - die Leiste bliebe sonst dauerhaft stehen und
   * muss den Schliessvorgang selbst anstossen.
   */
  unpin() {
    this._pinned = false;
    if (this.portal) this.scheduleClose();
  }

  // --- Oeffnen / Schliessen ------------------------------------------------

  open(cell) {
    if (!cell?.isConnected) return null;

    const videoId = cell.dataset.videoId;
    const video = findVideoInTable(this.table, videoId) || { id: videoId };
    // Ohne Link gibt es nichts zu tun ausser tippen - dann bleibt die Zelle ruhig.
    if (!this._currentUrl(cell, video)) {
      this.close();
      return null;
    }

    this.close();

    const portal = document.createElement('div');
    portal.className = 'live-link-toolbar';
    portal.setAttribute('role', 'toolbar');
    portal.setAttribute('aria-label', 'Live-Link-Aktionen');
    portal.dataset.videoId = videoId;
    portal.innerHTML = this._renderContent(cell, video);

    portal.addEventListener('mouseenter', () => this.cancelClose());
    portal.addEventListener('mouseleave', () => this.scheduleClose());

    document.body.appendChild(portal);
    this.portal = portal;
    this.cell = cell;
    cell.classList.add('has-toolbar');

    this._position();
    requestAnimationFrame(() => portal.classList.add('is-visible'));
    this._bindGlobals();
    return portal;
  }

  close() {
    clearTimeout(this._openTimer);
    clearTimeout(this._closeTimer);
    this._pinned = false;

    document.querySelectorAll('.live-link-toolbar').forEach(el => el.remove());
    document.querySelectorAll('.live-link-cell.has-toolbar')
      .forEach(el => el.classList.remove('has-toolbar'));

    this.portal = null;
    this.cell = null;
  }

  /** Nach Abruf oder Clear: Beschriftung und Zustand der Buttons nachziehen. */
  refresh() {
    if (!this.portal || !this.cell?.isConnected) return;

    const video = findVideoInTable(this.table, this.cell.dataset.videoId);
    if (!this._currentUrl(this.cell, video)) {
      this.close();
      return;
    }

    this.portal.innerHTML = this._renderContent(this.cell, video || {});
    this._position();
  }

  // --- Inhalt --------------------------------------------------------------

  /**
   * Der erste Button traegt die Hauptaktion und wechselt mit dem Zustand:
   * noch kein Abruf, schon abgerufen, oder letzter Abruf fehlgeschlagen.
   */
  _statsButton(video) {
    const hasError = !!video.stats_error;
    const hasFetched = !hasError && !!video.stats_fetched_at;

    let icon = ICON_CHART;
    let label = 'Statistiken abrufen';
    let stateClass = '';
    let title = 'Views, Likes und Kommentare bei Instagram abrufen';

    if (hasError) {
      icon = ICON_WARN;
      label = 'Erneut versuchen';
      stateClass = ' is-error';
      title = `Abruf fehlgeschlagen: ${video.stats_error}`;
    } else if (hasFetched) {
      icon = ICON_REFRESH;
      label = 'Aktualisieren';
      stateClass = ' is-refresh';
      title = `Stand: ${new Date(video.stats_fetched_at).toLocaleString('de-DE')} · frisch abrufen`;
    }

    return `<button type="button" class="live-link-toolbar__btn live-link-toolbar__btn--primary${stateClass}"
      data-video-stats-fetch data-video-id="${video.id}"
      title="${this._escape(title)}">${icon}<span>${label}</span></button>`;
  }

  _renderContent(cell, video) {
    const url = this._currentUrl(cell, video);

    // Der Fehlertext steckte bisher nur im title-Attribut des Haekchens und war
    // damit praktisch unsichtbar.
    const errorRow = video.stats_error
      ? `<div class="live-link-toolbar__error">${this._escape(video.stats_error)}</div>`
      : '';

    // Nur der Zeitstempel eines erfolgten Abrufs ist eine Zusatzinfo wert. Ein
    // "noch nicht abgerufen" wuerde bloss die Button-Beschriftung wiederholen.
    const statusRow = !video.stats_error && video.stats_fetched_at
      ? `<div class="live-link-toolbar__hint">Stand: ${this._escape(new Date(video.stats_fetched_at).toLocaleString('de-DE'))}</div>`
      : '';

    return `
      <div class="live-link-toolbar__row">
        ${this._statsButton(video)}
        <a href="${this._escape(url)}" target="_blank" rel="noopener noreferrer"
          class="live-link-toolbar__btn live-link-toolbar__btn--icon"
          title="Video in neuem Tab öffnen" aria-label="Video öffnen">${ICON_EXTERNAL}</a>
        <span class="live-link-toolbar__divider" aria-hidden="true"></span>
        <button type="button" class="live-link-toolbar__btn live-link-toolbar__btn--icon live-link-toolbar__btn--danger"
          data-video-link-clear data-video-id="${video.id}"
          title="Live-Link und Statistiken entfernen" aria-label="Live-Link entfernen">${ICON_TRASH}</button>
      </div>
      ${errorRow}${statusRow}
    `;
  }

  _escape(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  // --- Positionierung ------------------------------------------------------

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

  // --- Globale Listener ----------------------------------------------------

  /**
   * Einmalig und nicht am AbortController der Tabelle: die Leiste lebt
   * ausserhalb des Grids und muss auch ein Re-Render der Tabelle ueberdauern
   * koennen. Beim Scrollen schliesst sie, weil eine fixe Position sonst neben
   * der weggewanderten Zelle stehen bliebe.
   */
  _bindGlobals() {
    if (this._globalsBound) return;
    this._globalsBound = true;

    this._onScroll = () => { if (this.portal) this.close(); };
    this._onResize = () => { if (this.portal) this.close(); };
    this._onKeydown = (e) => { if (e.key === 'Escape' && this.portal) this.close(); };

    window.addEventListener('scroll', this._onScroll, { capture: true, passive: true });
    window.addEventListener('resize', this._onResize);
    document.addEventListener('keydown', this._onKeydown);
  }

  destroy() {
    this.close();
    if (!this._globalsBound) return;
    window.removeEventListener('scroll', this._onScroll, { capture: true });
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('keydown', this._onKeydown);
    this._globalsBound = false;
  }
}
