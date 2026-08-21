// AddItemDrawer.js - Drawer zum Hinzufügen von Videos/Ideen mit Queue-System
//
// Der Drawer legt Items nur noch an und stoesst die Verarbeitung an. Screenshot
// und Transkription laufen danach in einer Netlify Background Function und
// erscheinen per Realtime in der Tabelle - der Drawer darf sofort zu.

import { strategieService } from './StrategieService.js';
import { escapeAttr } from '../../core/VideoUploadUtils.js';
import { icon } from '../../core/icons/IconSystem.js';
import { buildAddItemQueueEntry, buildStrategieItemInsert } from './addItemPayload.js';

export class AddItemDrawer {
  constructor() {
    this.drawerId = 'add-item-drawer';
    this.strategie = null;
    this.strategieId = null;
    this.teilbereiche = [];

    // Queue System: { id, url, kategorie, beschreibung, platform,
    //                 status: 'pending'|'processing'|'done'|'error', error }
    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * Drawer öffnen
   */
  async open(strategie, teilbereiche = []) {
    this.strategie = strategie;
    this.strategieId = strategie.id;
    this.teilbereiche = teilbereiche;
    this.queue = [];
    this.isProcessing = false;
    
    this.createDrawer();
    this.renderBody();
    this.bindEvents();
  }

  /**
   * Drawer DOM erstellen
   */
  createDrawer() {
    this.removeDrawer();

    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;
    
    // Panel
    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel drawer-panel--wide';
    panel.id = this.drawerId;

    // Header
    const header = document.createElement('div');
    header.className = 'drawer-header';
    
    const headerLeft = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Video/Idee hinzufügen';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Video-URL oder Idee. Screenshot und Transkript entstehen automatisch. Beschreibung nur, wenn das Feld leer bleibt.';
    
    headerLeft.appendChild(title);
    headerLeft.appendChild(subtitle);
    
    const headerRight = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close-btn';
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.innerHTML = '&times;';
    headerRight.appendChild(closeBtn);
    
    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    // Body
    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.drawerId}-body`;

    panel.appendChild(header);
    panel.appendChild(body);

    // Events
    overlay.addEventListener('click', () => this.handleClose());
    closeBtn.addEventListener('click', () => this.handleClose());

    // Zum DOM hinzufügen
    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    // Slide-in Animation
    requestAnimationFrame(() => {
      panel.classList.add('show');
    });
  }

  /**
   * Body rendern
   */
  renderBody() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    body.innerHTML = `
      <!-- Input-Bereich -->
      <form id="add-item-form" class="add-item-drawer-form" data-no-submit-guard="true">
        <div class="add-item-drawer-form-row">
          <div class="form-field form-field--grow">
            <label for="drawer-video-url">Video-URL</label>
            <input 
              type="url" 
              id="drawer-video-url" 
              class="form-input" 
              placeholder="https://tiktok.com/... oder https://instagram.com/reel/... – leer lassen für eine Idee"
              autocomplete="off"
            >
          </div>
          
          <div class="form-field">
            <label for="drawer-kategorie">Kategorie</label>
            <select id="drawer-kategorie" class="form-input">
              <option value="">Ohne Kategorie</option>
              ${this.teilbereiche.map(tb => `<option value="${escapeAttr(tb)}">${escapeAttr(tb)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="add-item-drawer-form-row add-item-drawer-form-row--full" id="drawer-beschreibung-row">
          <div class="form-field form-field--full">
            <label for="drawer-beschreibung">Beschreibung</label>
            <textarea
              id="drawer-beschreibung"
              class="form-input"
              rows="2"
              placeholder="Eigene Worte bleiben. Leer lassen – dann füllt die KI."
            ></textarea>
          </div>
        </div>

        <div class="add-item-drawer-form-row add-item-drawer-form-row--actions">
          <button type="submit" class="mdc-btn mdc-btn--create" id="btn-add-to-queue">
            <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
              ${icon('plus-lg')}
            </span>
            <span class="mdc-btn__spinner" aria-hidden="true">
              <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
                <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
              </svg>
            </span>
            <span class="mdc-btn__label">Zur Queue hinzufügen</span>
          </button>
        </div>
      </form>

      <!-- Queue-Liste -->
      <div class="add-item-queue" id="add-item-queue">
        <div class="queue-header">
          <span class="queue-title">Queue</span>
          <span class="queue-counter" id="queue-counter">0 Einträge</span>
        </div>
        <div class="queue-list" id="queue-list">
          <div class="queue-empty">
            ${icon('document-duplicate')}
            <p>Noch keine Einträge in der Queue</p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="drawer-footer">
        <button type="button" class="mdc-btn" id="btn-close-drawer">
          Fertig
        </button>
      </div>
    `;
  }

  /**
   * Events binden
   */
  bindEvents() {
    const form = document.getElementById('add-item-form');
    const closeBtn = document.getElementById('btn-close-drawer');

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAddToQueue();
    });

    closeBtn?.addEventListener('click', () => this.handleClose());
  }

  /**
   * URL zur Queue hinzufügen
   */
  handleAddToQueue() {
    const urlInput = document.getElementById('drawer-video-url');
    const kategorieSelect = document.getElementById('drawer-kategorie');
    const beschreibungInput = document.getElementById('drawer-beschreibung');
    
    const url = urlInput?.value?.trim() || null;
    const kategorie = kategorieSelect?.value || null;
    const beschreibung = beschreibungInput?.value?.trim() || null;

    // URL-Validierung: Nur TikTok, Instagram oder leer (Idee)
    if (url && !this.isAllowedUrl(url)) {
      window.toastSystem?.show('Nur TikTok- und Instagram-Links sind erlaubt', 'warning');
      return;
    }

    // Ohne URL ist eine Beschreibung Pflicht
    if (!url && !beschreibung) {
      window.toastSystem?.show('Ohne Video-URL bitte eine Beschreibung angeben', 'warning');
      beschreibungInput?.focus();
      return;
    }

    // Kategorie-Validierung: gesetzte Kategorie muss eine existierende sein
    // (leer = "Ohne Kategorie" ist erlaubt). Verhindert, dass ungültige/abgeschnittene
    // Kategorien Screenshots erzeugen und Waisen-Items in der DB anlegen.
    if (kategorie && !(this.teilbereiche || []).includes(kategorie)) {
      window.toastSystem?.show('Ungültige Kategorie – bitte neu auswählen', 'warning');
      return;
    }

    // Eindeutige ID generieren
    const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.queue.push(buildAddItemQueueEntry({
      id,
      url,
      kategorie,
      beschreibung,
      platform: this.detectPlatform(url)
    }));

    // Inputs leeren
    urlInput.value = '';
    if (beschreibungInput) beschreibungInput.value = '';
    urlInput.focus();

    // Queue rendern
    this.renderQueue();

    // Verarbeitung starten falls nicht bereits läuft
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Prüft ob URL erlaubt ist. Nur TikTok und Instagram: aus beiden laesst sich
   * eine Tonspur bzw. Untertitel ziehen, YouTube nicht.
   */
  isAllowedUrl(url) {
    if (!url) return true; // Leere URL = Idee, erlaubt
    const urlLower = url.toLowerCase();
    return ['tiktok.com', 'instagram.com'].some(domain => urlLower.includes(domain));
  }

  /**
   * Plattform aus URL erkennen
   */
  detectPlatform(url) {
    if (!url) return 'idea';
    const urlLower = url.toLowerCase();
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
    if (urlLower.includes('tiktok.com')) return 'tiktok';
    if (urlLower.includes('instagram.com')) return 'instagram';
    return 'other';
  }

  /**
   * Queue-Liste rendern
   */
  renderQueue() {
    const listEl = document.getElementById('queue-list');
    const counterEl = document.getElementById('queue-counter');
    
    if (!listEl) return;

    // Counter aktualisieren
    const done = this.queue.filter(i => i.status === 'done').length;
    const total = this.queue.length;
    if (counterEl) {
      counterEl.textContent = total === 0 ? '0 Einträge' : `${done}/${total} abgeschlossen`;
    }

    // Leere Queue
    if (this.queue.length === 0) {
      listEl.innerHTML = `
        <div class="queue-empty">
          ${icon('document-duplicate')}
          <p>Noch keine Einträge in der Queue</p>
        </div>
      `;
      return;
    }

    // Queue-Items rendern
    listEl.innerHTML = this.queue.map(item => this.renderQueueItem(item)).join('');

    // Button Events binden
    this.bindQueueItemEvents();
  }

  /**
   * Queue-Item Button Events binden (Retry & Delete)
   */
  bindQueueItemEvents() {
    // Retry-Buttons
    document.querySelectorAll('.queue-item-retry').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const itemId = btn.dataset.itemId;
        this.handleRetry(itemId);
      });
    });

    // Delete-Buttons
    document.querySelectorAll('.queue-item-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const itemId = btn.dataset.itemId;
        this.handleDelete(itemId);
      });
    });
  }

  /**
   * Item aus Queue löschen
   */
  handleDelete(itemId) {
    const itemIndex = this.queue.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return;

    const item = this.queue[itemIndex];

    // Wenn Item gerade verarbeitet wird, als cancelled markieren
    if (item.status === 'processing') {
      item.status = 'cancelled';
    }

    // Aus Queue entfernen
    this.queue.splice(itemIndex, 1);

    // Queue neu rendern
    this.renderQueue();
  }

  /**
   * Item erneut versuchen
   */
  handleRetry(itemId) {
    const item = this.queue.find(i => i.id === itemId);
    if (!item) return;

    // Status zurücksetzen
    item.status = 'pending';
    item.error = null;

    // Queue neu rendern
    this.renderQueue();

    // Verarbeitung starten falls nicht bereits läuft
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Einzelnes Queue-Item rendern (Download-Style)
   */
  renderQueueItem(item) {
    // Plattform-Icons
    const platformIcons = {
      youtube: `${icon('youtube')}`,
      tiktok: `${icon('tiktok')}`,
      instagram: `${icon('instagram')}`,
      other: `${icon('globe')}`,
      idea: `${icon('light-bulb')}`
    };

    // Status-Icons (rechts)
    const statusIcons = {
      pending: `${icon('clock')}`,
      processing: `<svg class="mdc-spinner queue-status-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="18" height="18"><circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/></svg>`,
      done: `${icon('check-bold')}`,
      error: `${icon('x-mark')}`
    };

    // Retry-Icon
    const retryIcon = `${icon('arrow-path')}`;

    // Delete-Icon
    const deleteIcon = `${icon('trash-alt')}`;

    const displayUrl = item.url 
      ? (item.url.length > 50 ? item.url.substring(0, 50) + '...' : item.url)
      : 'Idee (ohne URL)';

    // Die eigentliche Arbeit passiert danach in der Background Function; hier
    // wird nur angelegt und angestossen, deshalb kein Zeit-Balken mehr.
    const statusText = item.status === 'done'
      ? (item.url ? 'Angelegt – Screenshot & Transkript laufen im Hintergrund' : 'Idee angelegt')
      : item.status === 'error' ? (item.error || 'Fehlgeschlagen')
        : item.status === 'processing' ? 'Wird angelegt...' : 'Wartet...';

    const statusClass = item.status === 'error' ? 'queue-item-error-text' : 'queue-item-hint';
    const progressHtml = `<span class="${statusClass}">${this.escapeHtml(statusText)}</span>`;

    // Retry-Button nur bei error
    let retryHtml = '';
    if (item.status === 'error') {
      retryHtml = `<button type="button" class="queue-item-retry" data-item-id="${item.id}" title="Erneut versuchen">${retryIcon}</button>`;
    }

    // Delete-Button nur bei pending oder processing
    let deleteHtml = '';
    if (item.status === 'pending' || item.status === 'processing') {
      deleteHtml = `<button type="button" class="queue-item-delete" data-item-id="${item.id}" title="Aus Queue entfernen">${deleteIcon}</button>`;
    }

    return `
      <div class="queue-item queue-item--${item.status}" data-item-id="${item.id}">
        <div class="queue-item-row">
          <div class="queue-item-left">
            ${platformIcons[item.platform]}
          </div>
          <div class="queue-item-center">
            <span class="queue-item-url">${this.escapeHtml(displayUrl)}</span>
            ${item.kategorie ? `<span class="queue-item-kategorie">${this.escapeHtml(item.kategorie)}</span>` : ''}
            ${item.beschreibung ? `<span class="queue-item-beschreibung">${this.escapeHtml(item.beschreibung)}</span>` : ''}
            ${progressHtml}
          </div>
          <div class="queue-item-right">
            ${retryHtml}
            <div class="queue-item-status-stack">
              ${statusIcons[item.status]}
              ${deleteHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Queue verarbeiten: Item anlegen und die Verarbeitung anstossen. Screenshot
   * und Transkription laufen danach serverseitig weiter - dieser Schritt dauert
   * nur so lange wie der Insert.
   */
  async processQueue() {
    if (this.isProcessing) return;
    
    const nextItem = this.queue.find(i => i.status === 'pending');
    if (!nextItem) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    nextItem.status = 'processing';
    this.renderQueue();

    try {
      // Defensiv: Kategorie erneut validieren BEVOR das Item entsteht.
      // Verhindert Waisen-Items in der DB, falls eine ungültige/nicht
      // existierende Kategorie durchrutscht.
      if (nextItem.kategorie && !(this.teilbereiche || []).includes(nextItem.kategorie)) {
        nextItem.status = 'error';
        nextItem.error = 'Ungültige Kategorie';
        this.renderQueue();
        window.toastSystem?.show('Ungültige Kategorie – nicht gespeichert', 'error');
        this.isProcessing = false;
        this.processQueue();
        return;
      }

      const existingItems = await strategieService.getStrategieItems(this.strategieId);
      const created = await strategieService.createStrategieItem(
        buildStrategieItemInsert({
          strategieId: this.strategieId,
          nextItem,
          sortierung: existingItems.length
        })
      );

      if (nextItem.url) {
        // Schlaegt der Trigger fehl, bleibt das Item auf 'pending' und laesst
        // sich ueber "Neu verarbeiten" nachziehen - das Item selbst ist da.
        try {
          await strategieService.enqueueItemProcessing(this.strategieId, created.id);
        } catch (e) {
          console.warn('Verarbeitung konnte nicht gestartet werden:', e);
        }
      }

      nextItem.status = 'done';
      this.renderQueue();

      // Live-Update der Tabelle dispatchen
      window.dispatchEvent(new CustomEvent('strategieItemCreated', {
        detail: { strategieId: this.strategieId }
      }));

      const msg = nextItem.url ? 'Video hinzugefügt – Verarbeitung läuft' : 'Idee hinzugefügt';
      window.toastSystem?.show(msg, 'success');

    } catch (error) {
      console.error('Fehler beim Verarbeiten:', error);
      nextItem.status = 'error';
      nextItem.error = error.message || 'Unbekannter Fehler';
      this.renderQueue();

      window.toastSystem?.show('Fehler beim Hinzufügen', 'error');
    }

    this.isProcessing = false;

    // Nächstes Item verarbeiten
    this.processQueue();
  }

  /**
   * Drawer schließen
   */
  handleClose() {
    // Nur der Insert darf nicht abgeschnitten werden; Screenshot und Transkript
    // laufen serverseitig weiter, dafuer muss der Drawer nicht offen bleiben.
    const processing = this.queue.find(i => i.status === 'processing');
    if (processing) {
      window.toastSystem?.show('Eintrag wird noch angelegt – einen Moment', 'warning');
      return;
    }

    this.close();
  }

  /**
   * Drawer schließen (ohne Prüfung)
   */
  close() {
    const panel = document.getElementById(this.drawerId);
    if (panel) {
      panel.classList.remove('show');
      setTimeout(() => this.removeDrawer(), 250);
    } else {
      this.removeDrawer();
    }
  }

  /**
   * Drawer entfernen
   */
  removeDrawer() {
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }

  /**
   * HTML escapen
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text || '').replace(/[&<>"']/g, m => map[m]);
  }
}

