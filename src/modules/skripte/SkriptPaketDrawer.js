// Zugang für Skripte einer Kampagne, in jedem Status. Ohne Creator ist es das
// Kampagnen-Paket (z. B. Kunden-Feedback), mit Creator nur dessen Skripte.
// Ein Link, ein Code. Formular liegt in skriptPaketDrawerView, Zugangs-Aktionen in
// skriptPaketShareActions.

import { DRAWER_EXIT_MS } from '../../core/animation/drawer.js';
import { escapeHtml } from '../../core/format.js';
import {
  loadKampagneSkripteFuerPaket, loadKampagneAnsprechpartner, loadSkriptPaket, ensureSkriptPaket, setPaketSkripte
} from './skriptPaketApi.js';
import { paketAuswahl, creatorAnzeigeName } from './skriptPaketModel.js';
import { renderPaketForm } from './skriptPaketDrawerView.js';
import { installSkriptPaketShareActions } from './skriptPaketShareActions.js';
import { shareApi } from '../share/shareApi.js';
import { renderRecipientPlan } from '../share/shareRecipientPlan.js';

const DRAWER_ID = 'skript-paket-drawer';

export class SkriptPaketDrawer {
  constructor() {
    this.overlay = null;
    this.panel = null;
    this._abort = null;
    this.kampagneId = null;
    this.kampagneName = '';
    this.creatorId = null;
    this.skripte = [];
    this.checked = new Set();
    this.paket = null;
    this.share = null;
    this.emails = [];
    this.codes = {};
    this.ansprechpartner = [];
    this.optionenOffen = false;
    this.nameTouched = false;
    this.emailsTouched = false;
    this._sending = false;
    this._onPick = null;
    this.emailField = null;
    this._planGen = 0;
  }

  async open({ kampagneId, kampagneName = '', creatorId = null } = {}) {
    if (!window.isInternal?.()) return;
    if (!kampagneId) {
      window.toastSystem?.warning('Teilen gibt es nur für Skripte mit Kampagne.');
      return;
    }
    this.close();
    this.kampagneId = kampagneId;
    this.kampagneName = kampagneName;
    this.creatorId = creatorId;
    this.skripte = [];
    this.checked = new Set();
    this.paket = null;
    this.share = null;
    this.emails = [];
    this.ansprechpartner = [];
    this.optionenOffen = false;
    this.nameTouched = false;
    this.emailsTouched = false;
    this.renderShell();
    try {
      const [skripte, ansprechpartner] = await Promise.all([
        loadKampagneSkripteFuerPaket(kampagneId),
        this.loadVorschlaege(kampagneId)
      ]);
      this.skripte = skripte;
      this.ansprechpartner = ansprechpartner;
      await this.applyCreator(this.creatorId, { initial: true });
    } catch (err) {
      window.toastSystem?.error(err.message || 'Skripte konnten nicht geladen werden.');
      this.close();
    }
  }

  close() {
    this.emailField?.destroy();
    this.emailField = null;
    this._abort?.abort();
    this._abort = null;
    if (this._onPick) {
      document.removeEventListener('table-select-change', this._onPick);
      this._onPick = null;
    }
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

  renderShell() {
    document.getElementById(`${DRAWER_ID}-overlay`)?.remove();
    document.getElementById(DRAWER_ID)?.remove();
    this._abort?.abort();
    this._abort = new AbortController();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${DRAWER_ID}-overlay`;
    const panel = document.createElement('div');
    panel.className = 'drawer-panel share-list-drawer skript-paket-drawer';
    panel.id = DRAWER_ID;
    panel.setAttribute('role', 'dialog');
    panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">Skripte teilen</span>
          <p class="drawer-subtitle">${escapeHtml(this.kampagneName || 'Kampagne')}</p>
        </div>
        <button type="button" class="drawer-close-btn" data-action="close" aria-label="Schließen">&times;</button>
      </div>
      <div class="drawer-body" id="skript-paket-body">
        <p class="share-dialog-empty">Freigegebene Skripte werden geladen …</p>
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--secondary" data-action="close">Schließen</button>
        <button type="button" id="skript-paket-submit" class="mdc-btn mdc-btn--create">Teilen</button>
      </div>`;
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    this.overlay = overlay;
    this.panel = panel;
    requestAnimationFrame(() => panel.classList.add('show'));

    const { signal } = this._abort;
    overlay.addEventListener('click', () => this.close(), { signal });
    panel.querySelectorAll('[data-action="close"]').forEach((btn) => {
      btn.addEventListener('click', () => this.close(), { signal });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.submit();
      }
    }, { signal });
    panel.querySelector('#skript-paket-submit').addEventListener('click', () => this.submit(), { signal });
    this._onPick = (e) => this.onPick(e);
    document.addEventListener('table-select-change', this._onPick);
  }

  /** Ansprechpartner der Kampagne als Vorschläge, ohne Kundenkonten (die blockt das Paket). */
  async loadVorschlaege(kampagneId) {
    try {
      const rows = await loadKampagneAnsprechpartner(kampagneId);
      if (!rows.length) return [];
      const plan = await shareApi.plan({
        emails: rows.map((ap) => ap.email),
        entityType: 'skript_paket',
        entityId: 'paket'
      });
      const gast = new Set(plan?.guest || []);
      return rows
        .map((ap) => ({ ...ap, email: String(ap.email).trim().toLowerCase() }))
        .filter((ap) => gast.has(ap.email));
    } catch (err) {
      console.error('Ansprechpartner-Vorschläge laden fehlgeschlagen:', err);
      return [];
    }
  }

  async applyCreator(creatorId, { initial = false } = {}) {
    this.creatorId = creatorId || null;
    const stand = await loadSkriptPaket(this.kampagneId, this.creatorId);
    this.paket = stand.paket;
    this.share = stand.share;
    const auswahl = paketAuswahl({
      skripte: this.skripte,
      creatorId: this.creatorId,
      gespeichertIds: stand.skriptIds,
      hatZugang: Boolean(stand.share)
    });
    this.checked = new Set(auswahl.checkedIds);
    if (initial || !this.emailsTouched) {
      this.emails = [...(stand.share?.empfaenger_emails || [])];
    }
    renderPaketForm(this);
  }

  currentCreator() {
    if (!this.creatorId) return null;
    for (const skript of this.skripte) {
      const creator = (skript.creators || [skript.creator]).find((c) => c?.id === this.creatorId);
      if (creator) return creator;
    }
    return null;
  }

  standardName() {
    const creator = this.currentCreator();
    if (creator) return creatorAnzeigeName(creator);
    return this.kampagneName || 'Alle Skripte';
  }

  onPick(e) {
    const { field, value, element } = e.detail || {};
    if (!this.panel?.contains(element)) return;
    if (field === 'paket-creator') {
      this.nameTouched = false;
      this.applyCreator(value);
    }
  }

  titelDerAuswahl() {
    const ids = new Set(this.checked);
    return this.skripte.filter((s) => ids.has(s.id)).map((s) => s.titel);
  }

  async submit() {
    if (this._sending || !this.panel) return;
    const name = (this.panel.querySelector('#skript-paket-name')?.value || '').trim() || this.standardName();
    const rechte = this.panel.querySelector('[data-field="paket-rechte"]')?.dataset.value || 'feedback';
    this.emailField?.commit({ warn: false });
    const ids = [...this.checked];
    const btn = this.panel.querySelector('#skript-paket-submit');
    this._sending = true;
    btn.disabled = true;
    try {
      if (!ids.length) {
        if (this.share) {
          await this.revoke({ still: true });
          renderPaketForm(this);
        } else window.toastSystem?.warning('Wähle mindestens ein Skript.');
        return;
      }
      const paket = await ensureSkriptPaket(this.kampagneId, this.creatorId);
      this.paket = paket;
      await setPaketSkripte(paket.id, ids);
      if (!this.share) await this.createShare(paket.id, name, rechte);
      else await this.updateShare(name, rechte);
      renderPaketForm(this);
    } catch (err) {
      window.toastSystem?.error(err.message || 'Speichern fehlgeschlagen.');
    } finally {
      this._sending = false;
      if (btn?.isConnected) btn.disabled = false;
    }
  }

  async refreshPaketPlan() {
    const el = this.panel?.querySelector('#skript-paket-plan');
    if (!el) return;
    const anfrage = ++this._planGen;
    const plan = await shareApi.plan({
      emails: this.emails,
      entityType: 'skript_paket',
      entityId: this.paket?.id || 'paket'
    });
    if (anfrage !== this._planGen) return;
    renderRecipientPlan(el, plan);
  }
}

installSkriptPaketShareActions(SkriptPaketDrawer.prototype);

export const skriptPaketDrawer = new SkriptPaketDrawer();
if (typeof window !== 'undefined') window.skriptPaketDrawer = skriptPaketDrawer;
