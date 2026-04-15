// KampagnePreviewDrawer.js - Drawer für Kampagne-Schnellansicht
// Basiert auf TaskDetailDrawer.js Pattern

import { KampagneUtils } from './KampagneUtils.js';

export class KampagnePreviewDrawer {
  constructor() {
    this.drawerId = 'kampagne-preview-drawer';
    this.kampagne = null;
    this.highlightedDeadline = null;
    
    // Deadline-Typ Mapping mit Hero Icons
    this.deadlineTypes = {
      start: { 
        label: 'Start', 
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" /></svg>` 
      },
      deadline_strategie: { 
        label: 'Strategie', 
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z" /></svg>` 
      },
      deadline_creator_sourcing: { 
        label: 'Sourcing', 
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m15.75 15.75-2.489-2.489m0 0a3.375 3.375 0 1 0-4.773-4.773 3.375 3.375 0 0 0 4.774 4.774ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>` 
      },
      deadline_video_produktion: { 
        label: 'Video Produktion', 
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>` 
      },
      deadline_post_produktion: { 
        label: 'Post Produktion', 
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m7.848 8.25 1.536.887M7.848 8.25a3 3 0 1 1-5.196-3 3 3 0 0 1 5.196 3Zm1.536.887a2.165 2.165 0 0 1 1.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 1 1-5.196 3 3 3 0 0 1 5.196-3Zm1.536-.887a2.165 2.165 0 0 0 1.083-1.838c.005-.352.054-.695.14-1.025m-1.223 2.863 2.077-1.199m0-3.328a4.323 4.323 0 0 1 2.068-1.379l5.325-1.628a4.5 4.5 0 0 1 2.48-.044l.803.215-7.794 4.5m-2.882-1.664A4.33 4.33 0 0 0 10.607 12m3.736 0 7.794 4.5-.802.215a4.5 4.5 0 0 1-2.48-.043l-5.326-1.629a4.324 4.324 0 0 1-2.068-1.379M14.343 12l-2.882 1.664" /></svg>` 
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
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </span>
            <span class="mdc-btn__label">Schließen</span>
          </button>
          <button class="mdc-btn mdc-btn--primary" id="btn-view-details">
            <span class="mdc-btn__icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
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
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }
}

