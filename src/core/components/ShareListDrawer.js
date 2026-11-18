// ShareListDrawer.js
// Zugänge für eine Liste anlegen (Link + 6-stelliger Code), als Side-Drawer.
// Aktionen über shareApi (Edge Function 'share-list'), Liste der Zugänge via RLS.

import { DRAWER_EXIT_MS } from '../animation/drawer.js';
import { escapeHtml } from '../format.js';
import { icon } from '../icons/IconSystem.js';
import { renderTableSelect, tableSelect } from './TableSelect.js';
import { installShareListEmailField } from './shareListEmailField.js';
import { installShareListAccessList } from './shareListAccessList.js';
import { installShareListRowMail } from './shareListRowMail.js';
import { installShareListActions } from './shareListActions.js';
import { accountListUrl } from '../../modules/share/shareRecipientPlan.js';

const DRAWER_ID = 'share-list-drawer';
const RECHTE_OPTIONEN = [['ansehen', 'Nur ansehen'], ['feedback', 'Ansehen + Feedback']];
const KOPIERT_MS = 1200;

/** Escape gehört zuerst offenen Menüs, Auswahllisten, Bestätigungen und Vorschlägen. */
function escapeGehoertAnderen(panel) {
  if (document.querySelector('.actions-dropdown-portal:not([data-menu-state="closing"]), .table-select__portal, .modal.overlay-modal')) {
    return true;
  }
  return [...(panel?.querySelectorAll('.tag-suggestions') || [])].some((el) => el.style.display !== 'none');
}

export class ShareListDrawer {
  constructor() {
    this.overlay = null;
    this.panel = null;
    this._abort = null;
    this.entityType = null;
    this.entityId = null;
    this.entityName = '';
    this.reset();
  }

  reset() {
    this.codes = {};
    this.angelegt = {};
    this.shares = [];
    this.emails = [];
    this.emailField = null;
    this.rowMail = null;
    this.plan = { listLink: [], guest: [], blocked: [] };
    this.autoName = '';
    this.frischId = null;
    this._sending = false;
    this._planGen = 0;
  }

  open({ entityType, entityId, entityName = '' }) {
    if (!window.isInternal?.()) return;
    this.emailField?.destroy();
    this.closeRowMail();
    this.entityType = entityType;
    this.entityId = entityId;
    this.entityName = entityName;
    this.reset();
    this.render();
    this.loadShares();
  }

  close() {
    this.emailField?.destroy();
    this.emailField = null;
    this.closeRowMail();
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
        <section class="share-drawer-abschnitt share-einladen">
          <h4 class="drawer-section-title">Einladen</h4>
          <div id="share-email-field"></div>
          <div id="share-recipient-plan" class="share-recipient-plan"></div>
          <p id="share-nur-konten" class="share-plan-note" hidden>Diese Adressen haben ein Konto und sehen die Liste mit ihrem Login. Es wird kein Gast-Zugang angelegt.</p>
          <div id="share-gast-optionen" class="share-einladen-raster">
            <div class="form-group">
              <label class="form-label" for="share-label-input">Name des Zugangs</label>
              <input type="text" id="share-label-input" class="input" maxlength="80" autocomplete="off">
            </div>
            <div class="form-group">
              <label class="form-label">Rechte</label>
              ${this.rechteFeld()}
            </div>
          </div>
        </section>

        <section class="share-drawer-abschnitt">
          <h4 class="drawer-section-title">Zugänge <span id="share-zugaenge-anzahl" class="share-zugaenge-anzahl"></span></h4>
          <div id="share-recipients" class="share-dialog-empty">Wird geladen …</div>
        </section>
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--secondary share-footer-link" id="share-copy-list-link" title="Für Kunden mit Login">
          ${icon('link')}<span data-copy-label>Listen-Link kopieren</span>
        </button>
        <button type="button" id="share-submit-btn" class="mdc-btn mdc-btn--create">Zugang erstellen</button>
      </div>`;

    const rechteInput = panel.querySelector('[data-field="share-rechte"] [data-table-select-input]');
    if (rechteInput) rechteInput.id = 'share-rechte-select';

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    this.overlay = overlay;
    this.panel = panel;
    tableSelect.init();
    requestAnimationFrame(() => panel.classList.add('show'));
    this.bind(signal);
    this.mountEmailField();
    this.emailField?.input.focus({ preventScroll: true });
  }

  bind(signal) {
    const { panel } = this;
    this.overlay.addEventListener('click', () => this.close(), { signal });
    panel.querySelectorAll('[data-action="close"]').forEach((btn) =>
      btn.addEventListener('click', () => this.close(), { signal }));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !escapeGehoertAnderen(this.panel)) this.close();
    }, { signal, capture: true });
    panel.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      if (e.target.closest('[data-row-mail]')) this.sendRowMail();
      else this.submit();
    }, { signal });
    panel.querySelector('#share-submit-btn').addEventListener('click', () => this.submit(), { signal });
    panel.querySelector('#share-copy-list-link').addEventListener('click', (e) => {
      const url = accountListUrl(this.entityType, this.entityId, window.location.origin);
      if (url) this.copy(url, e.currentTarget);
    }, { signal });
    this.bindAccessList(signal);
  }

  async copyQuiet(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  /** Beschriftete Buttons zeigen kurz „Kopiert“, reine Icon-Buttons melden per Toast. */
  async copy(text, btn, meldung = 'Kopiert.') {
    if (!(await this.copyQuiet(text))) {
      window.toastSystem?.warning('Kopieren fehlgeschlagen.');
      return;
    }
    const label = btn?.querySelector('[data-copy-label]');
    if (!label) {
      btn?.classList.add('is-copied');
      setTimeout(() => btn?.classList.remove('is-copied'), KOPIERT_MS);
      window.toastSystem?.success(meldung);
      return;
    }
    label.dataset.text ??= label.textContent;
    label.textContent = 'Kopiert';
    setTimeout(() => { label.textContent = label.dataset.text; }, KOPIERT_MS);
  }
}

installShareListEmailField(ShareListDrawer.prototype);
installShareListAccessList(ShareListDrawer.prototype);
installShareListRowMail(ShareListDrawer.prototype);
installShareListActions(ShareListDrawer.prototype);

export const shareListDrawer = new ShareListDrawer();

if (typeof window !== 'undefined') {
  window.shareListDrawer = shareListDrawer;
}
