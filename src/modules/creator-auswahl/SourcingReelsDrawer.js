// SourcingReelsDrawer.js (ES6-Modul)
// Drawer "Reels-Auswahl" der Sourcing-Detailseite: listet die Reels, die in
// der CPM-Rechnung stecken, plus bereits manuell ausgeschlossene. Pro Reel
// laesst sich per Checkbox steuern, ob es mitzaehlt.
//
// Hintergrund: Business Discovery kennzeichnet Nur-Reels-Tab-Videos
// (Testvideos) nicht - is_shared_to_feed wird abgelehnt. Ohne Thumbnail und
// Link waere der Ausschluss Blindflug, deshalb zeigt jede Zeile beides.
//
// Speichern schreibt die Permalinks in sourcing_creator.ig_excluded_media und
// zieht frische Instagram-Daten (aeltere Reels ruecken ins Fenster nach).

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatViews(views) {
  return views == null ? '–' : Number(views).toLocaleString('de-DE');
}

function formatDatum(timestamp) {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleDateString('de-DE') : '–';
}

const PLACEHOLDER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px; opacity: 0.4;" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>`;

const EXTERNAL_LINK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 14px; height: 14px;" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>`;

/**
 * Reels fuer den Drawer aus ig_stats zusammensetzen: verwendete Videos plus
 * bereits manuell Ausgeschlossene (skipped mit reason 'manually_excluded').
 * @param {object} igStats item.ig_stats
 * @returns {Array<{permalink, thumbnail_url, views, timestamp, excluded: boolean}>}
 */
export function sammleDrawerReels(igStats = {}) {
  const videos = Array.isArray(igStats.videos) ? igStats.videos : [];
  const skipped = Array.isArray(igStats.skipped_videos) ? igStats.skipped_videos : [];

  const reels = [
    ...videos.map((v) => ({ ...v, excluded: false })),
    ...skipped
      .filter((s) => s.reason === 'manually_excluded')
      .map((s) => ({ ...s, excluded: true }))
  ].filter((r) => r.permalink);

  // Neueste zuerst, wie in der Rechnung
  reels.sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));
  return reels;
}

export class SourcingReelsDrawer {
  /**
   * @param {object} config
   * @param {object} config.item Sourcing-Zeile mit ig_stats
   * @param {(permalinks: string[]) => Promise<void>} config.onSave neue
   *   Ausschlussliste speichern (wirft bei Fehler, Drawer bleibt dann offen)
   */
  constructor({ item, onSave }) {
    this.item = item || {};
    this.onSave = onSave;
    this.drawerId = 'sourcing-reels-drawer';
    this.reels = sammleDrawerReels(this.item.ig_stats);
  }

  open() {
    this.removeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;

    const header = document.createElement('div');
    header.className = 'drawer-header';

    const headerLeft = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Reels-Auswahl';

    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = this.item.name?.trim()
      ? `Welche Reels von ${this.item.name.trim()} zählen in die CPM-Rechnung?`
      : 'Welche Reels zählen in die CPM-Rechnung?';

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

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.drawerId}-body`;
    body.innerHTML = this.renderContent();

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.close());
    closeBtn.addEventListener('click', () => this.close());
    body.querySelector(`#btn-save-${this.drawerId}`)
      ?.addEventListener('click', () => this.handleSave());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });
  }

  removeDrawer() {
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const panel = document.getElementById(this.drawerId);
    if (overlay) overlay.remove();
    if (panel) panel.remove();
  }

  close() {
    const panel = document.getElementById(this.drawerId);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);

    if (overlay) overlay.classList.remove('active');
    if (panel) panel.classList.remove('show');

    setTimeout(() => {
      if (overlay) overlay.remove();
      if (panel) panel.remove();
    }, 300);
  }

  renderReelRow(reel) {
    const thumb = reel.thumbnail_url
      ? `<img src="${escapeHtml(reel.thumbnail_url)}" alt="" loading="lazy"
             style="width: 40px; height: 40px; object-fit: cover; border-radius: var(--radius-sm, 4px);"
             onerror="this.replaceWith(this.nextElementSibling); ">
         <span style="display:none; width: 40px; height: 40px; align-items: center; justify-content: center; background: var(--color-bg-secondary, #f0f0f0); border-radius: var(--radius-sm, 4px);">${PLACEHOLDER_ICON}</span>`
      : `<span style="display:flex; width: 40px; height: 40px; align-items: center; justify-content: center; background: var(--color-bg-secondary, #f0f0f0); border-radius: var(--radius-sm, 4px);">${PLACEHOLDER_ICON}</span>`;

    return `
      <tr${reel.excluded ? ' style="opacity: 0.6;"' : ''}>
        <td style="text-align: left;">
          <div style="display: flex; align-items: center; gap: var(--space-sm, 8px);">
            ${thumb}
            <div>
              <div><strong>${formatViews(reel.views)}</strong> Views</div>
              <div style="font-size: var(--text-sm, 12px); opacity: 0.7;">${formatDatum(reel.timestamp)}</div>
            </div>
          </div>
        </td>
        <td style="text-align: center;">
          <a href="${escapeHtml(reel.permalink)}" target="_blank" rel="noopener"
             class="link-icon-btn" title="Reel auf Instagram öffnen">${EXTERNAL_LINK_ICON}</a>
        </td>
        <td style="text-align: right;">
          <label class="toggle-switch">
            <input
              type="checkbox"
              class="reel-include-toggle"
              data-permalink="${escapeHtml(reel.permalink)}"
              ${reel.excluded ? '' : 'checked'}
            >
            <span class="toggle-slider"></span>
          </label>
        </td>
      </tr>
    `;
  }

  renderContent() {
    if (!this.reels.length) {
      return `
        <p class="drawer-info-text">
          Keine Reels vorhanden – zuerst die Instagram-Daten über den
          Häkchen-Button abrufen.
        </p>
      `;
    }

    const rows = this.reels.map((reel) => this.renderReelRow(reel)).join('');

    return `
      <p class="drawer-info-text">
        Abgeschaltete Reels (z.B. Testvideos, die nur im Reels-Tab hängen)
        zählen dauerhaft nicht in die CPM-Rechnung – in allen Listen, in denen
        dieser Creator steht. Ältere Reels rücken dafür nach.
      </p>
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="text-align: left;">Reel</th>
              <th style="text-align: center;">Link</th>
              <th style="text-align: right;">Einbeziehen</th>
            </tr>
          </thead>
          <tbody id="${this.drawerId}-reels">
            ${rows}
          </tbody>
        </table>
      </div>
      <div class="drawer-footer">
        <button type="button" class="primary-btn" id="btn-save-${this.drawerId}">
          Speichern &amp; neu berechnen
        </button>
      </div>
    `;
  }

  /**
   * Neue Ausschlussliste aus den Checkboxen ableiten. Permalinks, die der
   * Drawer gerade nicht zeigt (aeltere, laengst aus dem Fenster gefallene
   * Ausschluesse), bleiben unangetastet.
   */
  leseAusschluesse() {
    const body = document.getElementById(`${this.drawerId}-body`);
    const bestehend = Array.isArray(this.item.ig_stats?.excluded_media)
      ? this.item.ig_stats.excluded_media
      : [];
    const excluded = new Set(bestehend);

    body?.querySelectorAll('.reel-include-toggle').forEach((toggle) => {
      const permalink = toggle.dataset.permalink;
      if (!permalink) return;
      if (toggle.checked) excluded.delete(permalink);
      else excluded.add(permalink);
    });

    return [...excluded];
  }

  async handleSave() {
    const btn = document.getElementById(`btn-save-${this.drawerId}`);
    if (!btn || btn.disabled) return;

    btn.disabled = true;
    btn.textContent = 'Speichern...';

    try {
      await this.onSave?.(this.leseAusschluesse());
      this.close();
    } catch (error) {
      console.error('Fehler beim Speichern der Reels-Auswahl:', error);
      btn.disabled = false;
      btn.innerHTML = 'Speichern &amp; neu berechnen';
    }
  }
}
