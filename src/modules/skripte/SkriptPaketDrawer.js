// Zugang für die freigegebenen Skripte eines Creators in einer Kampagne.
// Ein Link, ein Code. Formular und Mail-Tags liegen in skriptPaketDrawerView.

import { DRAWER_EXIT_MS } from '../../core/animation/drawer.js';
import {
  loadKampagneSkripteFuerPaket, loadSkriptPaket, ensureSkriptPaket, setPaketSkripte
} from './skriptPaketApi.js';
import { paketAuswahl } from './skriptPaketModel.js';
import { renderPaketForm, addEmail } from './skriptPaketDrawerView.js';

const DRAWER_ID = 'skript-paket-drawer';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
    this.nameTouched = false;
    this.emailsTouched = false;
    this._onPick = null;
    this._emailSearchTimer = null;
    this._emailSearchGen = 0;
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
    this.nameTouched = false;
    this.emailsTouched = false;
    this.renderShell();
    try {
      this.skripte = await loadKampagneSkripteFuerPaket(kampagneId);
      await this.applyCreator(this.creatorId, { initial: true });
    } catch (err) {
      window.toastSystem?.error(err.message || 'Skripte konnten nicht geladen werden.');
      this.close();
    }
  }

  close() {
    clearTimeout(this._emailSearchTimer);
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
    }, { signal });
    panel.querySelector('#skript-paket-submit').addEventListener('click', () => this.submit(), { signal });
    this._onPick = (e) => this.onPick(e);
    document.addEventListener('table-select-change', this._onPick);
  }

  async applyCreator(creatorId, { initial = false } = {}) {
    this.creatorId = creatorId || null;
    if (this.creatorId) {
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
        const gespeichert = stand.share?.empfaenger_emails || [];
        if (gespeichert.length) this.emails = [...gespeichert];
        else {
          const mail = this.currentCreator()?.mail;
          this.emails = mail ? [String(mail).trim().toLowerCase()] : [];
        }
      }
    } else {
      this.paket = null;
      this.share = null;
      this.checked = new Set();
      if (!this.emailsTouched) this.emails = [];
    }
    renderPaketForm(this);
  }

  currentCreator() {
    return this.skripte.find((s) => s.creatorId === this.creatorId)?.creator || null;
  }

  onPick(e) {
    const { field, value, element } = e.detail || {};
    if (!this.panel?.contains(element)) return;
    if (field === 'paket-creator') {
      this.nameTouched = false;
      this.emailsTouched = false;
      this.applyCreator(value);
    }
  }

  titelDerAuswahl() {
    const ids = new Set(this.checked);
    return this.skripte.filter((s) => ids.has(s.id)).map((s) => s.titel);
  }

  async submit() {
    const name = (this.panel?.querySelector('#skript-paket-name')?.value || '').trim();
    const rechte = this.panel?.querySelector('[data-field="paket-rechte"]')?.dataset.value || 'ansehen';
    const emailInput = this.panel?.querySelector('#skript-paket-email');
    if (emailInput?.value) addEmail(this, emailInput.value, { warn: false });
    if (!this.creatorId) {
      window.toastSystem?.warning('Bitte einen Creator wählen.');
      return;
    }
    if (!name) {
      window.toastSystem?.warning('Bitte einen Namen für den Zugang vergeben.');
      return;
    }
    const ids = [...this.checked];
    const btn = this.panel.querySelector('#skript-paket-submit');
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
      if (btn?.isConnected) btn.disabled = false;
    }
  }

  async createShare(paketId, name, rechte) {
    const { data, error } = await window.supabase.functions.invoke('share-list', {
      body: {
        action: 'create',
        entityType: 'skript_paket',
        entityId: paketId,
        label: name,
        rechte,
        emails: [...this.emails],
        endsWithKampagne: true,
        scriptTitles: this.titelDerAuswahl()
      }
    });
    const errMsg = data?.error || (error ? 'Zugang konnte nicht angelegt werden.' : null);
    if (errMsg && !data?.shareId) throw new Error(errMsg);
    this.share = {
      id: data.shareId,
      token: String(data.link || '').split('/').pop(),
      label: name,
      rechte,
      empfaenger_emails: [...this.emails]
    };
    this.codes[data.shareId] = data.code;
    window.toastSystem?.success(this.emails.length ? 'Zugang angelegt und Mail verschickt.' : 'Zugang angelegt.');
  }

  async updateShare(name, rechte) {
    const { data, error } = await window.supabase.functions.invoke('share-list', {
      body: {
        action: 'update',
        shareId: this.share.id,
        label: name,
        rechte,
        emails: [...this.emails]
      }
    });
    if (error || data?.error) throw new Error(data?.error || 'Speichern fehlgeschlagen.');
    this.share = { ...this.share, label: name, rechte, empfaenger_emails: [...this.emails] };
    window.toastSystem?.success('Auswahl gespeichert.');
  }

  async rotate() {
    const { data, error } = await window.supabase.functions.invoke('share-list', {
      body: { action: 'rotate_code', shareId: this.share.id }
    });
    if (error || data?.error || !data?.code) {
      window.toastSystem?.error(data?.error || 'Code konnte nicht erneuert werden.');
      return;
    }
    this.codes[this.share.id] = data.code;
    window.toastSystem?.success(`Neuer Code: ${data.code}`);
    renderPaketForm(this);
  }

  async resend() {
    const code = this.codes[this.share.id];
    if (!code) {
      window.toastSystem?.warning('Bitte zuerst den Code rotieren. Der bisherige Code ist nicht mehr lesbar.');
      return;
    }
    if (!this.emails.length) {
      window.toastSystem?.warning('Keine E-Mail-Adresse hinterlegt.');
      return;
    }
    const { data, error } = await window.supabase.functions.invoke('share-list', {
      body: {
        action: 'resend',
        shareId: this.share.id,
        emails: [...this.emails],
        code,
        scriptTitles: this.titelDerAuswahl()
      }
    });
    if (error || data?.error) {
      window.toastSystem?.error(data?.error || 'Mail fehlgeschlagen.');
      return;
    }
    window.toastSystem?.success('Einladung versendet.');
  }

  async revoke({ still = false } = {}) {
    if (this.paket) await setPaketSkripte(this.paket.id, []);
    const { data, error } = await window.supabase.functions.invoke('share-list', {
      body: { action: 'revoke', shareId: this.share.id }
    });
    if (error || data?.error) {
      window.toastSystem?.error(data?.error || 'Widerruf fehlgeschlagen.');
      return;
    }
    this.share = null;
    this.checked = new Set();
    window.toastSystem?.success('Zugang widerrufen.');
    if (!still) renderPaketForm(this);
  }
}

export const skriptPaketDrawer = new SkriptPaketDrawer();
if (typeof window !== 'undefined') window.skriptPaketDrawer = skriptPaketDrawer;
