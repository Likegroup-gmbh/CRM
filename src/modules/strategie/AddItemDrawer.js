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
      <!-- Input-Bereich -->
      <form id="add-item-form" class="add-item-drawer-form">
        <div class="form-field">
          <label for="drawer-video-url">Video-URL</label>
          <input 
            type="url" 
            id="drawer-video-url" 
            class="form-input" 
            placeholder="https://youtube.com/shorts/... oder leer für Idee"
            autocomplete="off"
          >
          <p class="form-hint">Leer lassen für eine Idee ohne Screenshot</p>
        </div>
        
        <div class="form-field">
          <label for="drawer-kategorie">Kategorie</label>
          <select id="drawer-kategorie" class="form-input">
            <option value="">Ohne Kategorie</option>
            ${this.teilbereiche.map(tb => `<option value="${tb}">${tb}</option>`).join('')}
          </select>
        </div>

        <button type="submit" class="primary-btn add-item-drawer-submit">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Zur Queue hinzufügen
        </button>
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
      <div class="drawer-footer add-item-drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--cancel" id="btn-close-drawer">
          <span class="mdc-btn__label">Fertig</span>
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
  }

  /**
   * Einzelnes Queue-Item rendern
   */
  renderQueueItem(item) {
    const statusIcons = {
      pending: `<svg class="queue-item-icon queue-item-icon--pending" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`,
      processing: `<svg class="queue-item-icon queue-item-icon--processing" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>`,
      done: `<svg class="queue-item-icon queue-item-icon--done" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`,
      error: `<svg class="queue-item-icon queue-item-icon--error" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`
    };

    const platformLabels = {
      youtube: 'YouTube',
      tiktok: 'TikTok',
      instagram: 'Instagram',
      other: 'Website',
      idea: 'Idee'
    };

    const displayUrl = item.url 
      ? (item.url.length > 45 ? item.url.substring(0, 45) + '...' : item.url)
      : 'Idee (ohne URL)';

    // Phase-Labels
    const phaseLabels = {
      screenshot: 'Screenshot wird erstellt...',
      saving: 'Speichere...'
    };

    // Progress-Bar nur bei processing
    let progressHtml = '';
    if (item.status === 'processing') {
      const progressPercent = Math.min((item.elapsed / item.estimatedTime) * 100, 95);
      const phaseLabel = item.phase ? phaseLabels[item.phase] : 'Verarbeite...';
      progressHtml = `
        <div class="queue-item-phase">${phaseLabel}</div>
        <div class="queue-item-progress">
          <div class="queue-item-progress-bar" style="width: ${progressPercent}%"></div>
        </div>
        <div class="queue-item-time" id="queue-time-${item.id}">
          ${item.elapsed} Sek. / ~${item.estimatedTime} Sek.
        </div>
      `;
    }

    // Thumbnail bei done
    let thumbnailHtml = '';
    if (item.status === 'done' && item.screenshot_url) {
      thumbnailHtml = `<img class="queue-item-thumbnail" src="${item.screenshot_url}" alt="Screenshot" onerror="this.style.display='none'">`;
    } else if (item.status === 'done' && !item.url) {
      // Idee ohne Screenshot
      thumbnailHtml = `<div class="queue-item-idea-badge">Idee</div>`;
    }

    // Error-Nachricht
    let errorHtml = '';
    if (item.status === 'error' && item.error) {
      errorHtml = `<div class="queue-item-error">${this.escapeHtml(item.error)}</div>`;
    }

    return `
      <div class="queue-item queue-item--${item.status}" data-item-id="${item.id}">
        <div class="queue-item-header">
          ${statusIcons[item.status]}
          <div class="queue-item-info">
            <span class="queue-item-platform">${platformLabels[item.platform]}</span>
            <span class="queue-item-url">${this.escapeHtml(displayUrl)}</span>
            ${item.kategorie ? `<span class="queue-item-kategorie">${this.escapeHtml(item.kategorie)}</span>` : ''}
          </div>
          ${thumbnailHtml}
        </div>
        ${progressHtml}
        ${errorHtml}
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
   * Timer für Echtzeit-Anzeige starten
   */
  startTimer(item) {
    this.stopTimer();
    
    this.timerInterval = setInterval(() => {
      if (item.status !== 'processing') {
        this.stopTimer();
        return;
      }

      item.elapsed = Math.floor((Date.now() - item.startTime) / 1000);
      
      // Zeit-Element aktualisieren
      const timeEl = document.getElementById(`queue-time-${item.id}`);
      if (timeEl) {
        timeEl.textContent = `${item.elapsed} Sek. / ~${item.estimatedTime} Sek.`;
      }

      // Progress-Bar aktualisieren
      const progressBar = document.querySelector(`.queue-item[data-item-id="${item.id}"] .queue-item-progress-bar`);
      if (progressBar) {
        const progressPercent = Math.min((item.elapsed / item.estimatedTime) * 100, 95);
        progressBar.style.width = `${progressPercent}%`;
      }
    }, 1000);
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

