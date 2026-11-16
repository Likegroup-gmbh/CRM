// ShareListDrawer.js
// Zugänge für eine Liste anlegen (Link + 6-stelliger Code), als Side-Drawer.
// Aktionen über shareApi (Edge Function 'share-list'), Liste der Zugänge via RLS.

import { DRAWER_EXIT_MS } from '../animation/drawer.js';
import { escapeHtml } from '../format.js';
import { renderTableSelect } from './TableSelect.js';
import { installShareListEmailField } from './shareListEmailField.js';
import { installShareListAccessList } from './shareListAccessList.js';
import { installShareListActions } from './shareListActions.js';
import { accountListUrl } from '../../modules/share/shareRecipientPlan.js';

const DRAWER_ID = 'share-list-drawer';
const RECHTE_OPTIONEN = [['ansehen', 'Nur ansehen'], ['feedback', 'Ansehen + Feedback']];

export class ShareListDrawer {
  constructor() {
    this.overlay = null;
    this.panel = null;
    this._abort = null;
    this.entityType = null;
    this.entityId = null;
    this.entityName = '';
    this.codes = {};
    this.emails = [];
    this.emailField = null;
    this.plan = { listLink: [], guest: [], blocked: [] };
    this._planGen = 0;
  }

  open({ entityType, entityId, entityName = '' }) {
    if (!window.isInternal?.()) return;
    this.entityType = entityType;
    this.entityId = entityId;
    this.entityName = entityName;
    this.codes = {};
    this.emails = [];
    this.plan = { listLink: [], guest: [], blocked: [] };
    this.render();
    this.loadShares();
  }

  close() {
    this.emailField?.destroy();
    this.emailField = null;
    this._abort?.abort();
    this._abort = null;
    const { panel, overlay } = this;
    this.panel = null;
    this.overlay = null;
    if (!panel && !overlay) return;
    panel?.classList.remove('show');
    setTimeout(() => {
      overlay?.remove();
      panel?.remove();
    }, DRAWER_EXIT_MS);
  }

  entferneAlt() {
    document.getElementById(`${DRAWER_ID}-overlay`)?.remove();
    document.getElementById(DRAWER_ID)?.remove();
  }

  rechteOptions() {
    return RECHTE_OPTIONEN;
  }

  rechteFeld() {
    return renderTableSelect({
      field: 'share-rechte',
      itemId: 'share',
      value: 'ansehen',
      options: this.rechteOptions().map(([value, label]) => ({ value, label })),
      input: 'rechte',
      matchWidth: true
    });
  }

  render() {
    this.emailField?.destroy();
    this.entferneAlt();
    this._abort?.abort();
    this._abort = new AbortController();
    const { signal } = this._abort;

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${DRAWER_ID}-overlay`;

    const panel = document.createElement('div');
    panel.className = 'drawer-panel share-list-drawer';
    panel.id = DRAWER_ID;
    panel.setAttribute('role', 'dialog');
    panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">Liste teilen</span>
          ${this.entityName ? `<p class="drawer-subtitle">${escapeHtml(this.entityName)}</p>` : ''}
        </div>
        <button type="button" class="drawer-close-btn" data-action="close" aria-label="Schließen">&times;</button>
      </div>
      <div class="drawer-body">
        <section class="share-drawer-abschnitt">
          <div class="form-group">
            <label class="form-label required" for="share-label-input">Name des Zugangs</label>
            <input type="text" id="share-label-input" class="input" placeholder="z. B. Marketing-Team" maxlength="80">
          </div>
          <div class="form-group">
            <label class="form-label">Rechte</label>
            ${this.rechteFeld()}
          </div>
        </section>

        <section class="share-drawer-abschnitt">
          <h4 class="drawer-section-title">Per E-Mail senden (optional)</h4>
          <div class="form-group">
            <label class="form-label" for="share-email-tag-input">E-Mail-Adressen</label>
            <div id="share-email-field"></div>
            <div id="share-recipient-plan" class="share-recipient-plan"></div>
          </div>
          <button type="button" class="mdc-btn mdc-btn--secondary" id="share-copy-list-link">Listen-Link kopieren</button>
        </section>

        <div id="share-created-banner" class="share-code-banner" hidden></div>

        <section class="share-drawer-abschnitt">
          <h4 class="drawer-section-title">Zugänge</h4>
          <div id="share-recipients" class="share-dialog-empty">Wird geladen …</div>
        </section>
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--secondary" data-action="close">Schließen</button>
        <button type="button" id="share-submit-btn" class="mdc-btn mdc-btn--create">Zugang erstellen</button>
      </div>`;

    const rechteInput = panel.querySelector('[data-field="share-rechte"] [data-table-select-input]');
    if (rechteInput) rechteInput.id = 'share-rechte-select';

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    this.overlay = overlay;
    this.panel = panel;
    requestAnimationFrame(() => panel.classList.add('show'));

    overlay.addEventListener('click', () => this.close(), { signal });
    panel.querySelectorAll('[data-action="close"]').forEach((btn) =>
      btn.addEventListener('click', () => this.close(), { signal }));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    }, { signal });
    panel.querySelector('#share-submit-btn').addEventListener('click', () => this.submit(), { signal });
    panel.querySelector('#share-copy-list-link')?.addEventListener('click', (e) => {
      const url = accountListUrl(this.entityType, this.entityId, window.location.origin);
      if (url) this.copy(url, e.currentTarget);
    }, { signal });
    this.mountEmailField();
  }

  async copy(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      const prev = btn.textContent;
      btn.textContent = 'Kopiert';
      setTimeout(() => { btn.textContent = prev; }, 1200);
    } catch {
      window.toastSystem?.warning('Kopieren fehlgeschlagen.');
    }
  }
}

installShareListEmailField(ShareListDrawer.prototype);
installShareListAccessList(ShareListDrawer.prototype);
installShareListActions(ShareListDrawer.prototype);

export const shareListDrawer = new ShareListDrawer();

if (typeof window !== 'undefined') {
  window.shareListDrawer = shareListDrawer;
}
