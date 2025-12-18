// AddItemDrawer.js - Drawer zum Hinzufügen von Videos/Ideen mit Queue-System
// Features: Progress-Bar mit echter Zeit, Queue-Verwaltung, Live-Updates

import { strategieService } from './StrategieService.js';

export class AddItemDrawer {
  constructor() {
    this.drawerId = 'add-item-drawer';
    this.strategie = null;
    this.strategieId = null;
    this.teilbereiche = [];
    
    // Queue System
    this.queue = []; // { id, url, kategorie, status: 'pending'|'processing'|'done'|'error', screenshot_url, error, startTime, elapsed }
    this.isProcessing = false;
    this.timerInterval = null;
    
    // Geschätzte Zeiten pro Plattform (in Sekunden)
    this.estimatedTimes = {
      youtube: 20,
      tiktok: 15,
      instagram: 15,
      other: 12,
      idea: 2
    };
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
    subtitle.textContent = 'URLs hinzufügen – Screenshots werden automatisch erstellt';
    
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
      <!-- Input-Bereich (eine Zeile) -->
      <form id="add-item-form" class="add-item-drawer-form-row">
        <div class="form-field form-field--grow">
          <label for="drawer-video-url">Video-URL</label>
          <input 
            type="url" 
            id="drawer-video-url" 
            class="form-input" 
            placeholder="https://youtube.com/shorts/... oder leer für Idee"
            autocomplete="off"
          >
        </div>
        
        <div class="form-field">
          <label for="drawer-kategorie">Kategorie</label>
          <select id="drawer-kategorie" class="form-input">
            <option value="">Ohne Kategorie</option>
            ${this.teilbereiche.map(tb => `<option value="${tb}">${tb}</option>`).join('')}
          </select>
        </div>

        <div class="form-field form-field--btn">
          <label>&nbsp;</label>
          <button type="submit" class="mdc-btn mdc-btn--create" id="btn-add-to-queue">
            <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
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
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p>Noch keine Einträge in der Queue</p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="drawer-footer">
        <button type="button" class="primary-btn" id="btn-close-drawer">
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
    
    const url = urlInput?.value?.trim() || null;
    const kategorie = kategorieSelect?.value || null;

    // URL-Validierung: Nur YouTube, TikTok, Instagram oder leer (Idee)
    if (url && !this.isAllowedUrl(url)) {
      window.toastSystem?.show('Nur YouTube, TikTok und Instagram Links sind erlaubt', 'warning');
      return;
    }

    // Eindeutige ID generieren
    const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Plattform erkennen
    const platform = this.detectPlatform(url);
    const estimatedTime = url ? this.estimatedTimes[platform] : this.estimatedTimes.idea;

    // Zur Queue hinzufügen
    this.queue.push({
      id,
      url,
      kategorie,
      platform,
      status: 'pending',
      phase: null, // 'screenshot' | 'saving'
      estimatedTime,
      elapsed: 0,
      screenshot_url: null,
      error: null,
      startTime: null
    });

    // Input leeren
    urlInput.value = '';
    urlInput.focus();

    // Queue rendern
    this.renderQueue();

    // Verarbeitung starten falls nicht bereits läuft
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Prüft ob URL erlaubt ist (nur YouTube, TikTok, Instagram)
   */
  isAllowedUrl(url) {
    if (!url) return true; // Leere URL = Idee, erlaubt
    const urlLower = url.toLowerCase();
    
    // Erlaubte Plattformen
    const allowedDomains = [
      'youtube.com',
      'youtu.be',
      'tiktok.com',
      'instagram.com'
    ];
    
    return allowedDomains.some(domain => urlLower.includes(domain));
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
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
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
      this.stopTimer();
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
    item.elapsed = 0;
    item.startTime = null;

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
      youtube: `<svg class="queue-platform-icon queue-platform-icon--youtube" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
      tiktok: `<svg class="queue-platform-icon queue-platform-icon--tiktok" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>`,
      instagram: `<svg class="queue-platform-icon queue-platform-icon--instagram" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`,
      other: `<svg class="queue-platform-icon queue-platform-icon--other" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" /></svg>`,
      idea: `<svg class="queue-platform-icon queue-platform-icon--idea" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>`
    };

    // Status-Icons (rechts)
    const statusIcons = {
      pending: `<svg class="queue-status-icon queue-status-icon--pending" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`,
      processing: `<svg class="mdc-spinner queue-status-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="18" height="18"><circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/></svg>`,
      done: `<svg class="queue-status-icon queue-status-icon--done" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>`,
      error: `<svg class="queue-status-icon queue-status-icon--error" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>`
    };

    // Retry-Icon
    const retryIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>`;

    // Delete-Icon
    const deleteIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`;

    const displayUrl = item.url 
      ? (item.url.length > 50 ? item.url.substring(0, 50) + '...' : item.url)
      : 'Idee (ohne URL)';

    // Progress in Prozent
    const progressPercent = Math.min(Math.round((item.elapsed / item.estimatedTime) * 100), 99);

    // Progress-Bar (bei processing)
    let progressHtml = '';
    if (item.status === 'processing') {
      progressHtml = `
        <div class="queue-item-progress-row">
          <div class="queue-item-progress">
            <div class="queue-item-progress-bar" style="width: ${progressPercent}%"></div>
          </div>
          <span class="queue-item-percent" id="queue-percent-${item.id}">${progressPercent}%</span>
        </div>
      `;
    }

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
            ${progressHtml}
            ${item.status === 'error' ? `<span class="queue-item-error-text">Fehlgeschlagen</span>` : ''}
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
   * Queue verarbeiten
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
    nextItem.phase = nextItem.url ? 'screenshot' : 'saving';
    nextItem.startTime = Date.now();
    nextItem.elapsed = 0;

    // Timer starten für Echtzeit-Anzeige
    this.startTimer(nextItem);
    this.renderQueue();

    try {
      // Screenshot generieren (nur wenn URL vorhanden)
      let screenshotUrl = null;
      let platform = nextItem.platform;

      if (nextItem.url) {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (!isLocalhost) {
          console.log('📸 Starte Screenshot-Generierung für:', nextItem.url);
          const screenshotResult = await strategieService.generateScreenshot(nextItem.url);
          screenshotUrl = screenshotResult.screenshot_url;
          platform = screenshotResult.platform || platform;
          console.log('✅ Screenshot erstellt:', screenshotUrl);
        } else {
          console.log('⚠️ Screenshot übersprungen (localhost)');
        }
      }

      // Prüfen ob Item noch existiert (könnte gelöscht worden sein)
      if (!this.queue.find(i => i.id === nextItem.id)) {
        console.log('⏭️ Item während Verarbeitung gelöscht, überspringe...');
        this.stopTimer();
        this.isProcessing = false;
        this.processQueue();
        return;
      }

      // Phase wechseln zu "speichern"
      nextItem.phase = 'saving';
      this.renderQueue();

      // Item erstellen
      const existingItems = await strategieService.getStrategieItems(this.strategieId);
      const itemData = {
        strategie_id: this.strategieId,
        video_link: nextItem.url,
        screenshot_url: screenshotUrl,
        plattform: nextItem.url ? platform : null,
        sortierung: existingItems.length,
        teilbereich: nextItem.kategorie
      };

      await strategieService.createStrategieItem(itemData);

      // Nochmal prüfen ob Item noch existiert
      if (!this.queue.find(i => i.id === nextItem.id)) {
        console.log('⏭️ Item während Speichern gelöscht');
        this.stopTimer();
        this.isProcessing = false;
        this.processQueue();
        return;
      }

      // Erfolg
      nextItem.status = 'done';
      nextItem.screenshot_url = screenshotUrl;
      this.stopTimer();
      this.renderQueue();

      // Live-Update der Tabelle dispatchen
      window.dispatchEvent(new CustomEvent('strategieItemCreated', {
        detail: { strategieId: this.strategieId }
      }));

      // Toast
      const msg = nextItem.url ? 'Video hinzugefügt' : 'Idee hinzugefügt';
      window.toastSystem?.show(msg, 'success');

    } catch (error) {
      console.error('Fehler beim Verarbeiten:', error);
      nextItem.status = 'error';
      nextItem.error = error.message || 'Unbekannter Fehler';
      this.stopTimer();
      this.renderQueue();

      window.toastSystem?.show('Fehler beim Hinzufügen', 'error');
    }

    this.isProcessing = false;

    // Nächstes Item verarbeiten
    this.processQueue();
  }

  /**
   * Timer für Echtzeit-Anzeige starten (Prozent)
   */
  startTimer(item) {
    this.stopTimer();
    
    this.timerInterval = setInterval(() => {
      if (item.status !== 'processing') {
        this.stopTimer();
        return;
      }

      item.elapsed = Math.floor((Date.now() - item.startTime) / 1000);
      const progressPercent = Math.min(Math.round((item.elapsed / item.estimatedTime) * 100), 99);
      
      // Prozent-Element aktualisieren
      const percentEl = document.getElementById(`queue-percent-${item.id}`);
      if (percentEl) {
        percentEl.textContent = `${progressPercent}%`;
      }

      // Progress-Bar aktualisieren
      const progressBar = document.querySelector(`.queue-item[data-item-id="${item.id}"] .queue-item-progress-bar`);
      if (progressBar) {
        progressBar.style.width = `${progressPercent}%`;
      }
    }, 500);
  }

  /**
   * Timer stoppen
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Drawer schließen
   */
  handleClose() {
    // Prüfen ob noch Items in Verarbeitung
    const processing = this.queue.find(i => i.status === 'processing');
    if (processing) {
      window.toastSystem?.show('Warte bis alle Einträge verarbeitet sind', 'warning');
      return;
    }

    this.close();
  }

  /**
   * Drawer schließen (ohne Prüfung)
   */
  close() {
    this.stopTimer();
    
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

