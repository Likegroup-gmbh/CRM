// AddItemDrawer.js - Drawer zum Hinzufügen von Videos/Ideen mit Queue-System
//
// Der Drawer legt Items nur noch an und stoesst die Verarbeitung an. Screenshot
// und Transkription laufen danach in einer Netlify Background Function und
// erscheinen per Realtime in der Tabelle - der Drawer darf sofort zu.

import { strategieService } from './StrategieService.js';
import { escapeAttr } from '../../core/VideoUploadUtils.js';
import { icon } from '../../core/icons/IconSystem.js';
import { renderTableSelect, tableSelect } from '../../core/components/TableSelect.js';
import {
  FUNNEL_WERTE,
  FUNNEL_LABELS,
  briefingFunnelStufen,
  briefingEinzigeFunnelStufe
} from './strategieFunnelOptions.js';
import { briefingEinzigePersonaId, STRATEGIE_PERSONA_OFFEN } from './strategiePersonaOptions.js';
import {
  buildAddItemQueueEntry,
  buildStrategieItemInsert,
  detectPlatform,
  isTranscribableUrl,
  resolveVideoideeForm
} from './addItemPayload.js';
import { videolaengeFuerStufe } from '../briefing/videolaenge.js';
import {
  bindSekundenSpanne,
  renderSekundenSpanne,
  sekundenSpanneAttrs,
  sekundenSpanneWert,
  setSekundenSpanne
} from '../../core/components/SekundenSpanne.js';
import { DRAWER_EXIT_MS } from '../../core/animation/drawer.js';

export class AddItemDrawer {
  constructor() {
    this.drawerId = 'add-item-drawer';
    this.strategie = null;
    this.strategieId = null;
    this.teilbereiche = [];
    this.personaOptionen = [];
    this.produktOptionen = [];
    this.art = 'videoreferenz';

    // Queue System: { id, url, kategorie, beschreibung, platform,
    //                 status: 'pending'|'processing'|'done'|'error', error }
    this.queue = [];
    this.isProcessing = false;
    this.abort = null;
  }

  /**
   * Drawer öffnen
   */
  async open(strategie, teilbereiche = [], personaOptionen = []) {
    this.strategie = strategie;
    this.strategieId = strategie.id;
    this.teilbereiche = teilbereiche;
    // Select-Optionen der Briefing-Personas ("Keine Persona" inklusive).
    this.personaOptionen = (personaOptionen || []).filter(o => o.value !== STRATEGIE_PERSONA_OFFEN);
    this.art = 'videoreferenz';
    this.queue = [];
    this.isProcessing = false;

    // Produkte des Briefings dieser Linie. Fehler: Feld entfaellt, Drawer geht trotzdem auf.
    try {
      this.produktOptionen = await strategieService.getBriefingProdukte(strategie.id);
    } catch (error) {
      console.error('Fehler beim Laden der Briefing-Produkte:', error);
      this.produktOptionen = [];
    }

    tableSelect.init();
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
    title.textContent = 'Hinzufügen';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.id = 'add-item-drawer-subtitle';
    subtitle.textContent = 'Videoreferenz: Link und was wir davon umsetzen. Idee: nur die Beschreibung.';
    
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

    // Footer als Geschwister des Bodys: bleibt unten stehen, der Body scrollt
    const footer = document.createElement('div');
    footer.className = 'drawer-footer';
    footer.innerHTML = '<button type="button" class="mdc-btn" id="btn-close-drawer">Fertig</button>';

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(footer);

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

    const referenz = this.art !== 'idee';
    body.innerHTML = `
      <form id="add-item-form" class="add-item-drawer-form" data-no-submit-guard="true">
        <div class="drawer-tab-nav" role="tablist">
          <button type="button" class="drawer-tab-btn ${referenz ? 'active' : ''}" data-add-art="videoreferenz" role="tab" aria-selected="${referenz ? 'true' : 'false'}">Videoreferenz</button>
          <button type="button" class="drawer-tab-btn ${referenz ? '' : 'active'}" data-add-art="idee" role="tab" aria-selected="${referenz ? 'false' : 'true'}">Idee</button>
        </div>

        <section class="add-item-section" data-add-section="inhalt">
          <h3 class="drawer-section-title">Inhalt</h3>
          <div class="add-item-section__body">
            <div class="add-item-section__body" data-art-panel="videoreferenz" ${referenz ? '' : 'hidden'}>
              <div class="form-field">
                <label for="drawer-video-url">Video-URL</label>
                <input
                  type="url"
                  id="drawer-video-url"
                  class="form-input"
                  placeholder="https://tiktok.com/... oder https://instagram.com/reel/..."
                  autocomplete="off"
                >
              </div>
              <div class="form-field">
                <label for="drawer-umsetzungsvorgabe">Was sollen wir von diesem Video umsetzen?</label>
                <textarea
                  id="drawer-umsetzungsvorgabe"
                  class="form-input"
                  rows="3"
                  placeholder="Zum Beispiel nur die Hook, der Schnitt oder die Situation."
                ></textarea>
              </div>
            </div>
            <div class="form-field" id="drawer-beschreibung-row">
              <label for="drawer-beschreibung">Kurzbeschreibung</label>
              <textarea
                id="drawer-beschreibung"
                class="form-input"
                rows="3"
                placeholder="${referenz ? 'Kurz in eigenen Worten für die Tabelle (optional).' : 'Worum geht es in der Idee?'}"
              ></textarea>
            </div>
          </div>
        </section>

        <section class="add-item-section" data-add-section="einordnung">
          <h3 class="drawer-section-title">Einordnung</h3>
          <div class="add-item-section__grid">
            ${this.renderKategorieField()}
            ${this.renderFunnelField()}
            ${this.renderPersonaField()}
            ${this.renderProduktField()}
            ${this.renderDauerField()}
          </div>
        </section>

        <div class="add-item-actions">
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

      <section class="add-item-queue" id="add-item-queue" data-add-section="queue">
        <div class="queue-header">
          <h3 class="drawer-section-title">Queue</h3>
          <span class="queue-counter" id="queue-counter">0 Einträge</span>
        </div>
        <div class="queue-list" id="queue-list">
          <div class="queue-empty">
            ${icon('document-duplicate')}
            <p>Noch keine Einträge in der Queue</p>
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Ein Select-Feld mit dem zentralen TableSelect. Der Wert steht im hidden input
   * mit dem Namen `name`; `field` ist der Name im table-select-change-Event.
   */
  renderSelectField({ label, field, name, value = '', options, placeholder }) {
    return `
          <div class="form-field">
            <label>${escapeAttr(label)}</label>
            ${renderTableSelect({
              field,
              itemId: 'add-item',
              value,
              options: [{ value: '', label: placeholder }, ...options],
              placeholder,
              input: name,
              matchWidth: true
            })}
          </div>`;
  }

  /** Wert eines Select-Felds aus dem hidden input. */
  selectValue(name) {
    return document.querySelector(`#add-item-form [name="${name}"]`)?.value || null;
  }

  renderKategorieField() {
    return this.renderSelectField({
      label: 'Kategorie',
      field: 'add_kategorie',
      name: 'kategorie',
      options: this.teilbereiche.map(tb => ({ value: tb, label: tb })),
      placeholder: 'Ohne Kategorie'
    });
  }

  /** Funnel-Stufe nur bei Paid oder wenn das Briefing Stufen nennt. */
  funnelFeldSichtbar() {
    const briefing = this.strategie?.briefing;
    return briefing?.bereich === 'paid_creator_ads' || briefingFunnelStufen(briefing).length > 0;
  }

  /** Vorbelegt, wenn das Briefing genau eine Stufe nennt, sonst leer. */
  renderFunnelField() {
    if (!this.funnelFeldSichtbar()) return '';
    const vorbelegt = briefingEinzigeFunnelStufe(this.strategie?.briefing);
    return this.renderSelectField({
      label: 'Funnel-Stufe',
      field: 'add_funnel',
      name: 'funnel_stufe',
      value: vorbelegt || '',
      options: FUNNEL_WERTE.map(w => ({ value: w, label: FUNNEL_LABELS[w] })),
      placeholder: 'Keine Stufe'
    });
  }

  /** Vorbelegung der Dauer aus dem Briefing (bei Paid je nach gewaehlter Stufe). */
  dauerVorbelegung(funnelStufe) {
    return videolaengeFuerStufe(this.strategie?.briefing, funnelStufe || null);
  }

  /** Dauer als Slider (wie im Briefing), vorbelegt aus dem Briefing. Leer = keine Vorgabe. */
  renderDauerField() {
    this.dauerDirty = false;
    const iv = this.dauerVorbelegung(briefingEinzigeFunnelStufe(this.strategie?.briefing));
    const spanne = { von: iv?.von, bis: iv?.bis };
    return `
          <div class="form-field add-item-section__full">
            <label>Dauer</label>
            <div id="drawer-dauer" class="videoidee-dauer" ${sekundenSpanneAttrs({ name: 'videolaenge', ...spanne })}>${renderSekundenSpanne(spanne)}</div>
          </div>`;
  }

  /** Persona nur, wenn das Briefing Personas nennt. Vorbelegt bei genau einer. */
  renderPersonaField() {
    if (!this.personaOptionen.length) return '';
    const vorbelegt = briefingEinzigePersonaId(this.strategie?.briefing);
    return this.renderSelectField({
      label: 'Persona',
      field: 'add_persona',
      name: 'persona_id',
      value: vorbelegt || '',
      options: this.personaOptionen.map(o => ({ value: o.value, label: o.label })),
      placeholder: 'Keine Persona'
    });
  }

  /** Produkt nur, wenn am Briefing eines hängt. Vorbelegt bei genau einem. */
  renderProduktField() {
    if (!this.produktOptionen.length) return '';
    const vorbelegt = this.produktOptionen.length === 1 ? this.produktOptionen[0].id : null;
    return this.renderSelectField({
      label: 'Produkt',
      field: 'add_produkt',
      name: 'produkt_id',
      value: vorbelegt || '',
      options: this.produktOptionen.map(p => ({ value: p.id, label: p.name || 'Unbenannt' })),
      placeholder: 'Kein Produkt'
    });
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

    form?.querySelectorAll('[data-add-art]').forEach(btn => {
      btn.addEventListener('click', () => this.setArt(btn.dataset.addArt));
    });

    closeBtn?.addEventListener('click', () => this.handleClose());

    // Dauer folgt der Funnel-Stufe (Paid), solange sie nicht von Hand geaendert wurde.
    const dauerRoot = document.getElementById('drawer-dauer');
    bindSekundenSpanne(dauerRoot, { onCommit: () => { this.dauerDirty = true; } });
    // Das Optionspanel rendert als Portal an body, deshalb haengt der Listener an document.
    this.abort?.abort();
    this.abort = new AbortController();
    document.addEventListener('table-select-change', (e) => {
      const { field, value, element } = e.detail || {};
      if (field !== 'add_funnel' || !element?.closest(`#${this.drawerId}`)) return;
      if (this.dauerDirty || !dauerRoot) return;
      setSekundenSpanne(dauerRoot, this.dauerVorbelegung(value), { forceInputs: true });
    }, { signal: this.abort.signal });
  }

  setArt(art) {
    this.art = art === 'idee' ? 'idee' : 'videoreferenz';
    const referenz = this.art === 'videoreferenz';
    const form = document.getElementById('add-item-form');
    form?.querySelectorAll('[data-add-art]').forEach(btn => {
      const active = btn.dataset.addArt === this.art;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const panel = form?.querySelector('[data-art-panel="videoreferenz"]');
    if (panel) panel.hidden = !referenz;
    const beschreibung = document.getElementById('drawer-beschreibung');
    if (beschreibung) {
      beschreibung.placeholder = referenz
        ? 'Kurz in eigenen Worten für die Tabelle (optional).'
        : 'Worum geht es in der Idee?';
    }
  }

  /**
   * URL zur Queue hinzufügen
   */
  handleAddToQueue() {
    const urlInput = document.getElementById('drawer-video-url');
    const beschreibungInput = document.getElementById('drawer-beschreibung');
    const vorgabeInput = document.getElementById('drawer-umsetzungsvorgabe');

    const resolved = resolveVideoideeForm({
      art: this.art,
      url: urlInput?.value,
      beschreibung: beschreibungInput?.value,
      umsetzungsvorgabe: vorgabeInput?.value,
      kategorie: this.selectValue('kategorie'),
      funnelStufe: this.selectValue('funnel_stufe'),
      personaId: this.selectValue('persona_id'),
      produktId: this.selectValue('produkt_id'),
      videolaenge: sekundenSpanneWert(document.getElementById('drawer-dauer'))
    });
    if (!resolved.ok) {
      window.toastSystem?.show(resolved.error, 'warning');
      const focus = resolved.error.includes('URL')
        ? urlInput
        : (resolved.error.includes('umsetzen') ? vorgabeInput : beschreibungInput);
      focus?.focus();
      return;
    }

    const { url, kategorie, beschreibung, umsetzungsvorgabe, funnelStufe, personaId, produktId, videolaenge } = resolved;
    const produktName = this.produktOptionen.find(p => p.id === produktId)?.name || null;

    if (url && !this.isAllowedUrl(url)) {
      window.toastSystem?.show('Nur TikTok- und Instagram-Links sind erlaubt', 'warning');
      urlInput?.focus();
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
      umsetzungsvorgabe,
      funnelStufe,
      personaId,
      produktId,
      produktName,
      videolaenge,
      platform: this.detectPlatform(url)
    }));

    if (urlInput) urlInput.value = '';
    if (vorgabeInput) vorgabeInput.value = '';
    if (beschreibungInput) beschreibungInput.value = '';
    (url ? urlInput : beschreibungInput)?.focus();

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
    return isTranscribableUrl(url);
  }

  /**
   * Plattform aus URL erkennen
   */
  detectPlatform(url) {
    return detectPlatform(url) || 'idea';
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
      ? (item.url ? 'Angelegt – Screenshot, Transkript und Kundenadaption laufen' : 'Idee angelegt')
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
            ${item.produktName ? `<span class="queue-item-kategorie">${this.escapeHtml(item.produktName)}</span>` : ''}
            ${item.beschreibung ? `<span class="queue-item-beschreibung">${this.escapeHtml(item.beschreibung)}</span>` : ''}
            ${item.umsetzungsvorgabe ? `<span class="queue-item-beschreibung">${this.escapeHtml(item.umsetzungsvorgabe)}</span>` : ''}
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

      let processingFailed = false;
      if (nextItem.url) {
        // Schlaegt der Trigger fehl (z.B. 404, weil die Function nicht deployed
        // ist), bleibt das Item sonst ewig auf 'pending'. Stattdessen Fehler
        // schreiben — "Neu verarbeiten" zieht es danach nach.
        try {
          await strategieService.enqueueItemProcessing(this.strategieId, created.id);
        } catch (e) {
          processingFailed = true;
          console.warn('Verarbeitung konnte nicht gestartet werden:', e);
          await strategieService.updateStrategieItem(created.id, {
            verarbeitung_status: 'error',
            verarbeitung_fehler: `Verarbeitung konnte nicht gestartet werden (${e.message}) – bitte neu verarbeiten`
          });
          window.toastSystem?.show('Videoreferenz angelegt, Verarbeitung fehlgeschlagen – bitte neu verarbeiten', 'warning');
        }
      }

      nextItem.status = 'done';
      this.renderQueue();

      // Live-Update der Tabelle dispatchen
      window.dispatchEvent(new CustomEvent('strategieItemCreated', {
        detail: { strategieId: this.strategieId }
      }));

      if (!processingFailed) {
        const msg = nextItem.url ? 'Videoreferenz hinzugefügt – Verarbeitung läuft' : 'Idee hinzugefügt';
        window.toastSystem?.show(msg, 'success');
      }

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
      setTimeout(() => this.removeDrawer(), DRAWER_EXIT_MS);
    } else {
      this.removeDrawer();
    }
  }

  /**
   * Drawer entfernen
   */
  removeDrawer() {
    this.abort?.abort();
    this.abort = null;
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

