// E-Mail-Tags, Empfänger-Vorschau und Listen-Link im Teilen-Drawer.

import { classifyShareEmails, recipientPlanRows } from '../../modules/share/shareRecipientPlan.js';

export function installShareListEmailField(proto) {
  Object.assign(proto, {
    bindEmailTags() {
      const input = this.panel.querySelector('#share-email-tag-input');
      const suggestions = this.panel.querySelector('#share-email-suggestions');
      const tagsEl = this.panel.querySelector('#share-email-tags');
      if (!input || !suggestions || !tagsEl) return;

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          this.commitEmailInput(input, { warn: true });
        } else if (e.key === 'Backspace' && !input.value && this.emails.length) {
          this.emails.pop();
          this.renderEmailTags();
        } else if (e.key === 'Escape' && suggestions.style.display !== 'none') {
          // Erst die Vorschläge schließen, der Drawer bleibt offen
          e.stopPropagation();
          this.hideEmailSuggestions();
        }
      });

      input.addEventListener('input', () => {
        if (input.value.includes(',')) {
          const parts = input.value.split(',');
          const rest = parts.pop();
          parts.forEach((part) => this.addEmail(part.trim(), { warn: false }));
          input.value = rest;
        }
        this.schedulePartnerSearch(input.value.trim());
      });

      input.addEventListener('blur', () => {
        setTimeout(() => {
          this.commitEmailInput(input, { warn: false });
          this.hideEmailSuggestions();
        }, 150);
      });

      suggestions.addEventListener('mousedown', (e) => e.preventDefault());
      suggestions.addEventListener('click', (e) => {
        const item = e.target.closest('.suggestion-item');
        if (!item?.dataset.email) return;
        this.addEmail(item.dataset.email);
        input.value = '';
        this.hideEmailSuggestions();
      });

      tagsEl.addEventListener('click', (e) => {
        const remove = e.target.closest('.tag-remove');
        if (!remove) return;
        this.emails = this.emails.filter((email) => email !== remove.dataset.email);
        this.renderEmailTags();
      });
    },

    commitEmailInput(input, { warn } = {}) {
      if (!input) return;
      const raw = (input.value || '').trim().replace(/,$/, '');
      if (!raw) return;
      if (this.addEmail(raw, { warn })) {
        input.value = '';
        this.hideEmailSuggestions();
      }
    },

    isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
    },

    addEmail(raw, { warn } = {}) {
      const email = String(raw || '').trim().toLowerCase();
      if (!email) return false;
      if (!this.isValidEmail(email)) {
        if (warn) window.toastSystem?.warning('Ungültige E-Mail-Adresse.');
        return false;
      }
      if (!this.emails.includes(email)) this.emails.push(email);
      this.renderEmailTags();
      return true;
    },

    renderEmailTags() {
      const el = this.panel?.querySelector('#share-email-tags');
      if (!el) return;
      el.innerHTML = this.emails.map((email) => `
        <span class="tag-item" data-email="${this.escape(email)}">
          ${this.escape(email)}
          <span class="tag-remove" data-email="${this.escape(email)}">&times;</span>
        </span>
      `).join('');
      this.refreshPlan();
    },

    async refreshPlan() {
      if (!this.emails.length) {
        this.plan = { listLink: [], guest: [], blocked: [] };
        this.renderPlan();
        return this.plan;
      }
      try {
        this.plan = await classifyShareEmails(window.supabase, {
          emails: this.emails,
          entityType: this.entityType,
          entityId: this.entityId,
        });
      } catch (err) {
        console.error('Empfänger-Aufteilung fehlgeschlagen:', err);
        this.plan = null;
      }
      this.renderPlan();
      return this.plan;
    },

    renderPlan() {
      const el = this.panel?.querySelector('#share-recipient-plan');
      if (!el) return;
      el.innerHTML = recipientPlanRows(this.plan).map((row) => `
        <p class="share-plan-row"><span class="share-plan-email">${this.escape(row.email)}</span> ${this.escape(row.text)}</p>
      `).join('');
    },

    async sendAccountLinks(emails) {
      if (!emails.length) return { ok: true, unsupported: false };
      const { data, error } = await window.supabase.functions.invoke('share-list', {
        body: {
          action: 'send_account_links',
          entityType: this.entityType,
          entityId: this.entityId,
          emails,
        },
      });
      const errMsg = data?.error || (error ? (await this.readFunctionError(error)) : null);
      const unsupported = /unbekannte action/i.test(errMsg || '');
      if (errMsg && !unsupported) return { ok: false, error: errMsg, unsupported: false };
      return { ok: !unsupported, unsupported, error: errMsg };
    },

    hideEmailSuggestions() {
      this._emailSearchGen += 1;
      const suggestions = this.panel?.querySelector('#share-email-suggestions');
      if (!suggestions) return;
      suggestions.style.display = 'none';
      suggestions.innerHTML = '';
    },

    schedulePartnerSearch(term) {
      clearTimeout(this._emailSearchTimer);
      if (!term) {
        this.hideEmailSuggestions();
        return;
      }
      this._emailSearchTimer = setTimeout(() => this.searchPartners(term), 200);
    },

    async searchPartners(term) {
      const suggestions = this.panel?.querySelector('#share-email-suggestions');
      if (!suggestions || !window.supabase) return;
      const safe = term.replace(/[,()%]/g, '').slice(0, 80);
      if (!safe) {
        this.hideEmailSuggestions();
        return;
      }
      const tagged = new Set(this.emails);
      const gen = ++this._emailSearchGen;
      const { data } = await window.supabase
        .from('ansprechpartner')
        .select('id, vorname, nachname, email, unternehmen:unternehmen_id(firmenname)')
        .or(`vorname.ilike.%${safe}%,nachname.ilike.%${safe}%,email.ilike.%${safe}%`)
        .order('nachname');
      if (gen !== this._emailSearchGen || !this.panel) return;
      const rows = (data || []).filter((ap) => {
        const email = String(ap.email || '').trim().toLowerCase();
        return email && this.isValidEmail(email) && !tagged.has(email);
      });
      if (rows.length === 0) {
        suggestions.innerHTML = '<div class="suggestion-hint">Keine Vorschläge</div>';
        suggestions.style.display = 'block';
        return;
      }
      suggestions.innerHTML = rows.slice(0, 8).map((ap) => {
        const name = `${ap.vorname || ''} ${ap.nachname || ''}`.trim();
        const firma = ap.unternehmen?.firmenname || '';
        const email = String(ap.email).trim();
        const meta = [email, firma].filter(Boolean).join(' · ');
        return `<div class="suggestion-item" data-email="${this.escape(email)}">
          ${this.escape(name || email)}
          ${meta ? `<span class="suggestion-item-meta">${this.escape(meta)}</span>` : ''}
        </div>`;
      }).join('');
      suggestions.style.display = 'block';
    },
  });
}
