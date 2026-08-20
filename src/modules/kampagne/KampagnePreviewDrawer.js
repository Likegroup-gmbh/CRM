// KampagnePreviewDrawer.js - Drawer für Kampagne-Schnellansicht
// Basiert auf TaskDetailDrawer.js Pattern

import { KampagneUtils } from './KampagneUtils.js';
import { icon } from '../../core/icons/IconSystem.js';

export class KampagnePreviewDrawer {
  constructor() {
    this.drawerId = 'kampagne-preview-drawer';
    this.kampagne = null;
    this.highlightedDeadline = null;
    
    // Deadline-Typ Mapping mit Hero Icons
    this.deadlineTypes = {
      start: { 
        label: 'Start', 
        icon: `${icon('rocket-launch')}` 
      },
      deadline_strategie: { 
        label: 'Strategie', 
        icon: `${icon('puzzle')}` 
      },
      deadline_creator_sourcing: { 
        label: 'Sourcing', 
        icon: `${icon('search-circle')}` 
      },
      deadline_video_produktion: { 
        label: 'Video Produktion', 
        icon: `${icon('play-rect')}` 
      },
      deadline_post_produktion: { 
        label: 'Post Produktion', 
        icon: `${icon('share-nodes')}` 
      }
    };
  }

  async open(kampagne, highlightedDeadline = null) {
    console.log('🎯 KampagnePreviewDrawer: open()', kampagne?.kampagnenname);
    
    this.kampagne = kampagne;
    this.highlightedDeadline = highlightedDeadline;
    
    this.createDrawer();
    this.renderContent();
    this.bindEvents();
  }

  createDrawer() {
    this.removeDrawer();

    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;

    // Panel
    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;

    // Header
    const header = document.createElement('div');
    header.className = 'drawer-header';

    const headerLeft = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Kampagne';

    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.id = `${this.drawerId}-subtitle`;
    subtitle.textContent = KampagneUtils.getDisplayName(this.kampagne);

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
    overlay.addEventListener('click', () => this.close());
    closeBtn.addEventListener('click', () => this.close());

    // Zum DOM hinzufügen
    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    // Animation
    requestAnimationFrame(() => {
      panel.classList.add('show');
    });
  }

  renderContent() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body || !this.kampagne) return;

    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }) : '–';

    const k = this.kampagne;
    const orgName = k.marke?.markenname || k.unternehmen?.firmenname || '–';
    const orgLogo = k.marke?.logo_url || k.unternehmen?.logo_url;

    body.innerHTML = `
      <div class="kampagne-preview">
        <!-- Organisation Header -->
        <div class="preview-org-header">
          ${orgLogo 
            ? `<img class="preview-org-logo" src="${orgLogo}" alt="${safe(orgName)}" />`
            : `<div class="preview-org-avatar">${orgName.substring(0, 2).toUpperCase()}</div>`
          }
          <div class="preview-org-info">
            <div class="preview-org-name">${safe(orgName)}</div>
            <div class="preview-org-type">${k.marke ? 'Marke' : 'Unternehmen'}</div>
          </div>
        </div>

        <!-- Quick Stats -->
        <div class="preview-stats">
          <div class="preview-stat">
            <span class="preview-stat-value">${k.creatoranzahl || 0}</span>
            <span class="preview-stat-label">Creator</span>
          </div>
          <div class="preview-stat">
            <span class="preview-stat-value">${k.videoanzahl || 0}</span>
            <span class="preview-stat-label">Videos</span>
          </div>
        </div>

        <!-- Deadlines -->
        <div class="preview-section">
          <h3 class="preview-section-title">Deadlines</h3>
          <div class="preview-deadlines">
            ${this.renderDeadlineRow('start', k.start)}
            ${this.renderDeadlineRow('deadline_strategie', k.deadline_strategie)}
            ${this.renderDeadlineRow('deadline_creator_sourcing', k.deadline_creator_sourcing)}
            ${this.renderDeadlineRow('deadline_video_produktion', k.deadline_video_produktion)}
            ${this.renderDeadlineRow('deadline_post_produktion', k.deadline_post_produktion)}
          </div>
        </div>

        <!-- Actions -->
        <div class="drawer-footer">
          <button class="mdc-btn mdc-btn--cancel" id="btn-close-drawer">
            <span class="mdc-btn__icon" aria-hidden="true">
              ${icon('x-mark')}
            </span>
            <span class="mdc-btn__label">Schließen</span>
          </button>
          <button class="mdc-btn mdc-btn--primary" id="btn-view-details">
            <span class="mdc-btn__icon">
              ${icon('external-link')}
            </span>
            <span class="mdc-btn__label">Details anzeigen</span>
          </button>
        </div>
      </div>
    `;
  }

  renderDeadlineRow(field, value) {
    const config = this.deadlineTypes[field];
    if (!config) return '';

    const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }) : '–';

    const isHighlighted = this.highlightedDeadline === field;
    const isPast = value && new Date(value) < new Date();
    const isToday = value && new Date(value).toDateString() === new Date().toDateString();

    let statusClass = '';
    if (isToday) statusClass = 'deadline--today';
    else if (isPast && value) statusClass = 'deadline--past';

    return `
      <div class="preview-deadline ${isHighlighted ? 'preview-deadline--highlighted' : ''} ${statusClass}">
        <span class="preview-deadline-icon">${config.icon}</span>
        <span class="preview-deadline-label">${config.label}</span>
        <span class="preview-deadline-value">${formatDate(value)}</span>
      </div>
    `;
  }

  bindEvents() {
    // Details anzeigen
    document.getElementById('btn-view-details')?.addEventListener('click', () => {
      if (this.kampagne?.id) {
        this.close();
        window.navigateTo(`/kampagne/${this.kampagne.id}`);
      }
    });

    // Schließen Button
    document.getElementById('btn-close-drawer')?.addEventListener('click', () => {
      this.close();
    });

    // ESC-Taste
    this._escHandler = (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    document.addEventListener('keydown', this._escHandler);
  }

  close() {
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const panel = document.getElementById(this.drawerId);

    if (panel) panel.classList.remove('show');

    setTimeout(() => {
      overlay?.remove();
      panel?.remove();
    }, 250);

    // ESC-Handler entfernen
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
  }

  removeDrawer() {
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }
}

