// Formular, Skript-Auswahl und Mail-Tags des Paket-Dialogs.

import { renderTableSelect } from '../../core/components/TableSelect.js';
import { paketAuswahl, creatorOptionen, creatorAnzeigeName } from './skriptPaketModel.js';
import { BLOCKED_TEXT, classifyShareEmails, recipientPlanRows } from '../share/shareRecipientPlan.js';

export const RECHTE = [
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

export function installSkriptPaketDialogView(proto) {
  Object.assign(proto, {
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
            <p class="share-plan-note">${escapeHtml(BLOCKED_TEXT.paket)}</p>
            <div id="skript-paket-plan" class="share-recipient-plan"></div>
          </div>
        </div>
        <div id="skript-paket-liste"></div>
        ${this.share ? `
          <div class="share-code-banner">
            <p class="share-code-line">Link</p>
            <p class="share-code-value">${escapeHtml(link)}</p>
            ${code ? `<p class="share-code-line">Code ${escapeHtml(code)}</p>` : ''}
            <div class="skript-paket-aktionen">
              <button type="button" class="mdc-btn mdc-btn--secondary" data-copy-link>Gast-Link kopieren</button>
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
    },

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
    },

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
    },

    isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
    },

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
      this.planRecipients(this.paket?.id);
    },

    async planRecipients(entityId) {
      const el = this.overlay?.querySelector('#skript-paket-plan');
      if (!this.emails.length) {
        if (el) el.innerHTML = '';
        return { listLink: [], guest: [], blocked: [] };
      }
      try {
        const plan = await classifyShareEmails(window.supabase, {
          emails: this.emails,
          entityType: 'skript_paket',
          entityId: entityId || '00000000-0000-0000-0000-000000000000',
        });
        if (el) {
          el.innerHTML = recipientPlanRows(plan).map((row) => `
            <p class="share-plan-row"><span class="share-plan-email">${escapeHtml(row.email)}</span> ${escapeHtml(row.text)}</p>
          `).join('');
        }
        return plan;
      } catch (err) {
        console.error('Empfänger-Aufteilung fehlgeschlagen:', err);
        window.toastSystem?.error('Empfänger konnten nicht geprüft werden.');
        return null;
      }
    },

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
    },

    schedulePartnerSearch(term) {
      clearTimeout(this._emailSearchTimer);
      if (!term) {
        this.hideSuggestions();
        return;
      }
      this._emailSearchTimer = setTimeout(() => this.searchPartners(term), 200);
    },

    hideSuggestions() {
      this._emailSearchGen += 1;
      const suggestions = this.overlay?.querySelector('#skript-paket-suggestions');
      if (!suggestions) return;
      suggestions.style.display = 'none';
      suggestions.innerHTML = '';
    },

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
    },
  });
}
