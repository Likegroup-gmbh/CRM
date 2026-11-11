// Zugang für freigegebene Skripte einer Kampagne. Ohne Creator ist es das
// Kampagnen-Paket (z. B. Kunden-Feedback), mit Creator nur dessen Skripte.
// Ein Link, ein Code. Formular und Mail-Tags liegen in skriptPaketDrawerView.

import { DRAWER_EXIT_MS } from '../../core/animation/drawer.js';
import {
  loadKampagneSkripteFuerPaket, loadKampagneAnsprechpartner, loadSkriptPaket, ensureSkriptPaket, setPaketSkripte
} from './skriptPaketApi.js';
import { paketAuswahl, creatorAnzeigeName } from './skriptPaketModel.js';
import { renderPaketForm, addEmail } from './skriptPaketDrawerView.js';
import { classifyShareEmails, recipientPlanRows } from '../share/shareRecipientPlan.js';

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
    this.ansprechpartner = [];
    this.optionenOffen = false;
    this.nameTouched = false;
    this.emailsTouched = false;
    this._sending = false;
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
      const plan = await classifyShareEmails(window.supabase, {
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
    return this.skripte.find((s) => s.creatorId === this.creatorId)?.creator || null;
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
    const emailInput = this.panel.querySelector('#skript-paket-email');
    if (emailInput?.value && addEmail(this, emailInput.value, { warn: false })) emailInput.value = '';
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
    if (!this.emails.length) {
      el.innerHTML = '';
      return;
    }
    let plan = null;
    try {
      plan = await classifyShareEmails(window.supabase, {
        emails: this.emails,
        entityType: 'skript_paket',
        entityId: this.paket?.id || 'paket'
      });
    } catch (err) {
      console.error('Empfänger-Aufteilung fehlgeschlagen:', err);
    }
    this.paketPlan = plan;
    el.innerHTML = recipientPlanRows(plan).map((row) => `
      <div class="share-plan-row">
        <span class="share-plan-email">${escapeHtml(row.email)}</span>
        <span>${escapeHtml(row.text)}</span>
      </div>`).join('');
  }

  async createShare(paketId, name, rechte) {
    const plan = await classifyShareEmails(window.supabase, {
      emails: this.emails,
      entityType: 'skript_paket',
      entityId: paketId
    });
    if (!plan) throw new Error('Empfänger konnten nicht geprüft werden.');
    if (this.emails.length && !plan.guest.length) {
      window.toastSystem?.warning('Für diese Adressen gibt es keinen Gast-Zugang. Die Auswahl kann nur an Personen ohne Kundenkonto gehen.');
      return;
    }
    const { data, error } = await window.supabase.functions.invoke('share-list', {
      body: {
        action: 'create',
        entityType: 'skript_paket',
        entityId: paketId,
        label: name,
        rechte,
        emails: plan.guest,
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
      empfaenger_emails: [...plan.guest]
    };
    this.emails = [...plan.guest];
    this.codes[data.shareId] = data.code;
    window.toastSystem?.success(plan.guest.length ? 'Zugang angelegt und Mail verschickt.' : 'Zugang angelegt.');
    if (plan.blocked.length) {
      window.toastSystem?.warning('Adressen mit Kundenkonto wurden nicht angeschrieben. Die Auswahl gibt es nur als Gast-Zugang.');
    }
  }

  async updateShare(name, rechte) {
    const vorher = new Set(this.share.empfaenger_emails || []);
    const plan = await classifyShareEmails(window.supabase, {
      emails: this.emails,
      entityType: 'skript_paket',
      entityId: this.paket?.id || this.share.entity_id
    });
    if (!plan) throw new Error('Empfänger konnten nicht geprüft werden.');
    const { data, error } = await window.supabase.functions.invoke('share-list', {
      body: {
        action: 'update',
        shareId: this.share.id,
        label: name,
        rechte,
        emails: plan.guest
      }
    });
    if (error || data?.error) throw new Error(data?.error || 'Speichern fehlgeschlagen.');
    this.emails = [...plan.guest];
    this.share = { ...this.share, label: name, rechte, empfaenger_emails: [...plan.guest] };
    const neu = plan.guest.filter((email) => !vorher.has(email));
    if (neu.length) await this.ladeNeueEin(neu, plan.guest);
    else window.toastSystem?.success('Auswahl gespeichert.');
    if (plan.blocked.length) {
      window.toastSystem?.warning('Adressen mit Kundenkonto bleiben ohne Mail. Die Auswahl gibt es nur als Gast-Zugang.');
    }
  }

  /** Neue Adressen am bestehenden Zugang. Der Code liegt nur gehasht vor, ohne ihn geht keine Einladung raus. */
  async ladeNeueEin(neu, alle) {
    let code = this.codes[this.share.id];
    let an = neu;
    if (!code) {
      const wer = neu.length === 1 ? 'Eine neue Adresse' : `${neu.length} neue Adressen`;
      const ok = window.confirm(`${wer} einladen?\nDafür wird der Code erneuert. Alle ${alle.length} Empfänger bekommen eine Mail mit dem neuen Code.`);
      if (!ok) {
        window.toastSystem?.success('Auswahl gespeichert. Neue Adressen haben noch keine Mail.');
        return;
      }
      code = await this.rotateCode();
      if (!code) return;
      an = alle;
    }
    if (await this.sendInvite(an, code)) {
      window.toastSystem?.success(an.length === 1 ? 'Gespeichert und Einladung versendet.' : `Gespeichert und ${an.length} Einladungen versendet.`);
    }
  }

  async rotateCode() {
    const { data, error } = await window.supabase.functions.invoke('share-list', {
      body: { action: 'rotate_code', shareId: this.share.id }
    });
    if (error || data?.error || !data?.code) {
      window.toastSystem?.error(data?.error || 'Code konnte nicht erneuert werden.');
      return null;
    }
    this.codes[this.share.id] = data.code;
    return data.code;
  }

  async rotate() {
    const code = await this.rotateCode();
    if (!code) return;
    window.toastSystem?.success(`Neuer Code: ${code}`);
    renderPaketForm(this);
  }

  async sendInvite(emails, code) {
    const { data, error } = await window.supabase.functions.invoke('share-list', {
      body: {
        action: 'resend',
        shareId: this.share.id,
        emails,
        code,
        scriptTitles: this.titelDerAuswahl()
      }
    });
    if (error || data?.error) {
      window.toastSystem?.error(data?.error || 'Mail fehlgeschlagen.');
      return false;
    }
    return true;
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
    const plan = await classifyShareEmails(window.supabase, {
      emails: this.emails,
      entityType: 'skript_paket',
      entityId: this.paket?.id || this.share.entity_id
    });
    if (!plan?.guest.length) {
      window.toastSystem?.warning('Für diese Adressen gibt es keinen Gast-Zugang.');
      return;
    }
    if (await this.sendInvite(plan.guest, code)) window.toastSystem?.success('Einladung versendet.');
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
