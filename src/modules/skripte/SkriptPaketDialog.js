// Zugang für mehrere freigegebene Skripte eines Creators in einer Kampagne.
// Ein Link, ein Code. Rechte und Creator nutzen das Tabellen-Dropdown.

import { renderTableSelect } from '../../core/components/TableSelect.js';
import { skripteService } from './SkripteService.js';
import {
  paketAuswahl, creatorOptionen, creatorAnzeigeName
} from './skriptPaketModel.js';

const RECHTE = [
  { value: 'ansehen', label: 'Nur ansehen' },
  { value: 'feedback', label: 'Ansehen + Bearbeiten' }
];

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class SkriptPaketDialog {
  constructor() {
    this.overlay = null;
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
      this.skripte = await skripteService.loadKampagneSkripteMitCreator(kampagneId);
      await this.applyCreator(this.creatorId, { initial: true });
    } catch (err) {
      window.toastSystem?.error(err.message || 'Skripte konnten nicht geladen werden.');
      this.close();
    }
  }

  close() {
    clearTimeout(this._emailSearchTimer);
    if (this._onPick) {
      document.removeEventListener('table-select-change', this._onPick);
      this._onPick = null;
    }
    this.overlay?.remove();
    this.overlay = null;
  }

  renderShell() {
    const overlay = document.createElement('div');
    overlay.className = 'modal overlay-modal share-list-modal skript-paket-modal';
    overlay.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Skripte teilen</h3>
          <button type="button" class="modal-close" data-action="close" aria-label="Schließen">&times;</button>
        </div>
        <div class="modal-body" id="skript-paket-body">
          <p class="modal-description">Freigegebene Skripte werden geladen …</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="mdc-btn mdc-btn--secondary" data-action="cancel">Abbrechen</button>
          <button type="button" id="skript-paket-submit" class="mdc-btn mdc-btn--create">Teilen</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    this.overlay = overlay;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
    overlay.querySelector('[data-action="close"]').addEventListener('click', () => this.close());
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => this.close());
    overlay.querySelector('#skript-paket-submit').addEventListener('click', () => this.submit());

    this._onPick = (e) => this.onPick(e);
    document.addEventListener('table-select-change', this._onPick);
  }

  async applyCreator(creatorId, { initial = false } = {}) {
    this.creatorId = creatorId || null;
    if (this.creatorId) {
      const stand = await skripteService.loadSkriptPaket(this.kampagneId, this.creatorId);
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
    this.renderForm();
  }

  currentCreator() {
    return this.skripte.find((s) => s.creatorId === this.creatorId)?.creator
      || creatorOptionen(this.skripte).find((c) => c.id === this.creatorId)
      || null;
  }

  renderForm() {
    const body = this.overlay?.querySelector('#skript-paket-body');
    const submit = this.overlay?.querySelector('#skript-paket-submit');
    if (!body || !submit) return;
    const creator = this.currentCreator();
    const nameDefault = creator ? creatorAnzeigeName(creator) : '';
    const nameValue = this.share?.label || (!this.nameTouched ? nameDefault : (body.querySelector('#skript-paket-name')?.value || nameDefault));
    const rechte = this.share?.rechte || 'ansehen';
    const creators = creatorOptionen(this.skripte);
    const link = this.share ? `${window.location.origin}/share/${this.share.token}` : '';
    const code = this.share ? this.codes[this.share.id] : '';

    body.innerHTML = `
      <p class="modal-description">${escapeHtml(this.kampagneName || 'Kampagne')}</p>
      <div class="share-dialog-form">
        <div class="form-group">
          <label class="form-label required">Creator</label>
          ${renderTableSelect({
            field: 'paket-creator',
            itemId: 'paket',
            value: this.creatorId || '',
            options: creators.map((c) => ({ value: c.id, label: creatorAnzeigeName(c) })),
            placeholder: 'Creator wählen',
            disabled: Boolean(this.share)
          })}
        </div>
        <div class="form-group">
          <label class="form-label required" for="skript-paket-name">Name des Zugangs</label>
          <input type="text" id="skript-paket-name" class="input" maxlength="80" value="${escapeHtml(nameValue)}">
        </div>
        <div class="form-group">
          <label class="form-label">Rechte</label>
          ${renderTableSelect({
            field: 'paket-rechte',
            itemId: 'paket',
            value: rechte,
            options: RECHTE
          })}
        </div>
        <div class="form-group">
          <label class="form-label" for="skript-paket-email">Per E-Mail versenden (optional)</label>
          <div class="tag-input-container">
            <div class="tag-input-wrapper">
              <div class="selected-tags" id="skript-paket-tags"></div>
              <input type="text" class="tag-input" id="skript-paket-email" placeholder="E-Mail eingeben …" autocomplete="off">
            </div>
            <div class="tag-suggestions" id="skript-paket-suggestions" style="display:none;"></div>
          </div>
        </div>
      </div>
      <div id="skript-paket-liste"></div>
      ${this.share ? `
        <div class="share-code-banner">
          <p class="share-code-line">Link</p>
          <p class="share-code-value">${escapeHtml(link)}</p>
          ${code ? `<p class="share-code-line">Code ${escapeHtml(code)}</p>` : ''}
          <div class="skript-paket-aktionen">
            <button type="button" class="mdc-btn mdc-btn--secondary" data-copy-link>Link kopieren</button>
            <button type="button" class="mdc-btn mdc-btn--secondary" data-rotate>Code rotieren</button>
            <button type="button" class="mdc-btn mdc-btn--secondary" data-resend>Erneut senden</button>
            <button type="button" class="mdc-btn mdc-btn--secondary" data-revoke>Widerrufen</button>
          </div>
        </div>` : ''}
    `;
    submit.textContent = this.share ? 'Speichern' : 'Teilen';
    this.renderListe();
    this.renderEmailTags();
    this.bindForm();
  }

  renderListe() {
    const el = this.overlay?.querySelector('#skript-paket-liste');
    if (!el) return;
    if (!this.creatorId) {
      el.innerHTML = '<p class="modal-description">Wähle einen Creator. Danach stehen seine freigegebenen Skripte hier.</p>';
      return;
    }
    const auswahl = paketAuswahl({
      skripte: this.skripte,
      creatorId: this.creatorId,
      gespeichertIds: [...this.checked],
      hatZugang: true
    });
    const zeile = (skript, extra) => `
      <label class="checkbox-label skript-paket-zeile">
        <input type="checkbox" data-skript-id="${skript.id}" ${this.checked.has(skript.id) ? 'checked' : ''}>
        <span>${skript.nr}. ${escapeHtml(skript.titel)}</span>
        ${extra ? `<span class="skript-paket-zeile-meta">${escapeHtml(extra)}</span>` : ''}
      </label>`;
    const weitereOffen = auswahl.weitere.some((s) => this.checked.has(s.id));
    el.innerHTML = `
      <div class="skript-paket-liste">
        ${auswahl.eigene.length
          ? auswahl.eigene.map((s) => zeile(s)).join('')
          : '<p class="modal-description">Keine freigegebenen Skripte für diesen Creator.</p>'}
        ${auswahl.weitere.length ? `
          <button type="button" class="mdc-btn mdc-btn--secondary" id="skript-paket-weitere">
            Weitere Skripte der Kampagne
          </button>
          <div id="skript-paket-weitere-liste" class="skript-paket-liste" ${weitereOffen ? '' : 'hidden'}>
            ${auswahl.weitere.map((s) => zeile(s, s.creator ? creatorAnzeigeName(s.creator) : 'ohne Creator')).join('')}
          </div>` : ''}
      </div>`;
    el.querySelectorAll('input[type="checkbox"]').forEach((box) => {
      box.addEventListener('change', () => {
        if (box.checked) this.checked.add(box.dataset.skriptId);
        else this.checked.delete(box.dataset.skriptId);
      });
    });
    el.querySelector('#skript-paket-weitere')?.addEventListener('click', () => {
      const liste = el.querySelector('#skript-paket-weitere-liste');
      if (liste) liste.hidden = !liste.hidden;
    });
  }

  bindForm() {
    const name = this.overlay.querySelector('#skript-paket-name');
    name?.addEventListener('input', () => { this.nameTouched = true; });
    const input = this.overlay.querySelector('#skript-paket-email');
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        this.addEmail(input.value, { warn: true });
        input.value = '';
      } else if (e.key === 'Backspace' && !input.value && this.emails.length) {
        this.emails.pop();
        this.emailsTouched = true;
        this.renderEmailTags();
      }
    });
    input?.addEventListener('input', () => {
      if (input.value.includes(',')) {
        input.value.split(',').forEach((part) => this.addEmail(part, { warn: false }));
        input.value = '';
      }
      this.schedulePartnerSearch(input.value.trim());
    });
    this.overlay.querySelector('[data-copy-link]')?.addEventListener('click', (e) => {
      const link = `${window.location.origin}/share/${this.share.token}`;
      navigator.clipboard?.writeText(link);
      e.currentTarget.textContent = 'Kopiert';
    });
    this.overlay.querySelector('[data-rotate]')?.addEventListener('click', () => this.rotate());
    this.overlay.querySelector('[data-resend]')?.addEventListener('click', () => this.resend());
    this.overlay.querySelector('[data-revoke]')?.addEventListener('click', () => this.revoke());
  }

  onPick(e) {
    const { field, value, element } = e.detail || {};
    if (!this.overlay?.contains(element)) return;
    element.dataset.value = value;
    const labelEl = element.querySelector('.table-select__label');
    if (field === 'paket-creator') {
      const creator = creatorOptionen(this.skripte).find((c) => c.id === value);
      if (labelEl && creator) labelEl.textContent = creatorAnzeigeName(creator);
      this.nameTouched = false;
      this.emailsTouched = false;
      this.applyCreator(value);
    }
    if (field === 'paket-rechte') {
      const option = RECHTE.find((o) => o.value === value);
      if (labelEl && option) labelEl.textContent = option.label;
    }
  }

  checkedIds() {
    return [...this.checked];
  }

  titelDerAuswahl() {
    const ids = new Set(this.checkedIds());
    return this.skripte.filter((s) => ids.has(s.id)).map((s) => s.titel);
  }

  async submit() {
    const name = (this.overlay.querySelector('#skript-paket-name')?.value || '').trim();
    const rechte = this.overlay.querySelector('[data-field="paket-rechte"]')?.dataset.value || 'ansehen';
    const emailInput = this.overlay.querySelector('#skript-paket-email');
    if (emailInput?.value) this.addEmail(emailInput.value, { warn: false });
    if (!this.creatorId) {
      window.toastSystem?.warning('Bitte einen Creator wählen.');
      return;
    }
    if (!name) {
      window.toastSystem?.warning('Bitte einen Namen für den Zugang vergeben.');
      return;
    }
    const ids = this.checkedIds();
    const btn = this.overlay.querySelector('#skript-paket-submit');
    btn.disabled = true;
    try {
      if (!ids.length) {
        if (this.share) {
          await this.revoke({ still: true });
          this.renderForm();
        } else window.toastSystem?.warning('Wähle mindestens ein Skript.');
        return;
      }
      const paket = await skripteService.ensureSkriptPaket(this.kampagneId, this.creatorId);
      this.paket = paket;
      await skripteService.setPaketSkripte(paket.id, ids);
      if (!this.share) {
        const { data, error } = await window.supabase.functions.invoke('share-list', {
          body: {
            action: 'create',
            entityType: 'skript_paket',
            entityId: paket.id,
            label: name,
            rechte,
            emails: [...this.emails],
            endsWithKampagne: true,
            scriptTitles: this.titelDerAuswahl()
          }
        });
        const errMsg = data?.error || (error ? 'Zugang konnte nicht angelegt werden.' : null);
        if (errMsg && !data?.shareId) throw new Error(errMsg);
        this.share = { id: data.shareId, token: String(data.link || '').split('/').pop(), label: name, rechte, empfaenger_emails: [...this.emails] };
        this.codes[data.shareId] = data.code;
        window.toastSystem?.success(this.emails.length ? 'Zugang angelegt und Mail verschickt.' : 'Zugang angelegt.');
      } else {
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
      this.renderForm();
    } catch (err) {
      window.toastSystem?.error(err.message || 'Speichern fehlgeschlagen.');
    } finally {
      if (this.overlay) btn.disabled = false;
    }
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
    this.renderForm();
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
    await skripteService.setPaketSkripte(this.paket.id, []);
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
    if (!still) this.renderForm();
  }

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
  }

  addEmail(raw, { warn } = {}) {
    const email = String(raw || '').trim().toLowerCase();
    if (!email) return;
    if (!this.isValidEmail(email)) {
      if (warn) window.toastSystem?.warning('Ungültige E-Mail-Adresse.');
      return;
    }
    this.emailsTouched = true;
    if (!this.emails.includes(email)) this.emails.push(email);
    this.renderEmailTags();
  }

  renderEmailTags() {
    const el = this.overlay?.querySelector('#skript-paket-tags');
    if (!el) return;
    el.innerHTML = this.emails.map((email) => `
      <span class="tag-item">
        ${escapeHtml(email)}
        <span class="tag-remove" data-email="${escapeHtml(email)}">&times;</span>
      </span>`).join('');
    el.querySelectorAll('.tag-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.emails = this.emails.filter((email) => email !== btn.dataset.email);
        this.emailsTouched = true;
        this.renderEmailTags();
      });
    });
  }

  schedulePartnerSearch(term) {
    clearTimeout(this._emailSearchTimer);
    if (!term) {
      this.hideSuggestions();
      return;
    }
    this._emailSearchTimer = setTimeout(() => this.searchPartners(term), 200);
  }

  hideSuggestions() {
    this._emailSearchGen += 1;
    const suggestions = this.overlay?.querySelector('#skript-paket-suggestions');
    if (!suggestions) return;
    suggestions.style.display = 'none';
    suggestions.innerHTML = '';
  }

  async searchPartners(term) {
    const suggestions = this.overlay?.querySelector('#skript-paket-suggestions');
    if (!suggestions) return;
    const safe = term.replace(/[,()%]/g, '').slice(0, 80);
    if (!safe) return this.hideSuggestions();
    const gen = ++this._emailSearchGen;
    const { data } = await window.supabase
      .from('ansprechpartner')
      .select('id, vorname, nachname, email, unternehmen:unternehmen_id(firmenname)')
      .or(`vorname.ilike.%${safe}%,nachname.ilike.%${safe}%,email.ilike.%${safe}%`)
      .order('nachname');
    if (gen !== this._emailSearchGen || !this.overlay) return;
    const rows = (data || []).filter((ap) => {
      const email = String(ap.email || '').trim().toLowerCase();
      return email && this.isValidEmail(email) && !this.emails.includes(email);
    }).slice(0, 8);
    if (!rows.length) {
      suggestions.innerHTML = '<div class="suggestion-hint">Keine Vorschläge</div>';
      suggestions.style.display = 'block';
      return;
    }
    suggestions.innerHTML = rows.map((ap) => {
      const name = `${ap.vorname || ''} ${ap.nachname || ''}`.trim();
      const email = String(ap.email).trim();
      return `<div class="suggestion-item" data-email="${escapeHtml(email)}">${escapeHtml(name || email)}
        <span class="suggestion-item-meta">${escapeHtml(email)}</span></div>`;
    }).join('');
    suggestions.style.display = 'block';
    suggestions.querySelectorAll('.suggestion-item').forEach((item) => {
      item.addEventListener('click', () => {
        this.addEmail(item.dataset.email, { warn: false });
        const input = this.overlay.querySelector('#skript-paket-email');
        if (input) input.value = '';
        this.hideSuggestions();
      });
    });
  }
}

export const skriptPaketDialog = new SkriptPaketDialog();
