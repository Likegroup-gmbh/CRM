// AnschreibenDrawer.js
// Rechts-Drawer fuer das Anschreiben: Empfaenger-Composer, Mailvorlage,
// Betreff/Body (editierbar), PDF-Anhang mit Vorschau, Senden.
// Generisch ueber dokumentTyp/dokumentId. Seiten rufen openAnschreiben().

import { EmpfaengerComposer } from './EmpfaengerComposer.js';
import { authorizedFetch } from '../auth/getAccessToken.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class AnschreibenDrawer {
  /**
   * @param {Object} opts
   * @param {string} opts.dokumentTyp - z.B. 'briefing'
   * @param {string} opts.dokumentId
   * @param {string} opts.dokumentName - Anzeigename (Betreff-Platzhalter, Titel)
   * @param {string} opts.unternehmenId - Scope der Kampagne-Suche
   * @param {string} [opts.markeId]
   * @param {Object} [opts.db] - Supabase-Client (Tests)
   * @param {(detail: Object) => Promise<{ blob: Blob, dateiname: string }>} opts.createPdf
   * @param {Object} [opts.pdfContext] - Kontext fuer createPdf (z.B. BriefingDetail)
   * @param {boolean} [opts.empfaengerFest] - Anzeige statt Picker
   * @param {Array} [opts.prefill]
   * @param {string[]} [opts.extraTabs]
   * @param {(db: Object) => Promise<Object>} [opts.loadEmpfaengerScope]
   * @param {(empfaenger: Array) => Promise<Array>} [opts.buildAnhaenge]
   * @param {(container: HTMLElement, hooks: { onChange: () => void }) => void} [opts.mountExtras]
   * @param {(text: string) => string} [opts.rewriteMail]
   */
  constructor({
    dokumentTyp,
    dokumentId,
    dokumentName,
    unternehmenId,
    markeId = null,
    db = null,
    createPdf,
    pdfContext = null,
    platzhalter = ['vorname', 'name', 'briefing', 'unternehmen', 'marke'],
    prefill = [],
    empfaengerFest = false,
    extraTabs = [],
    loadEmpfaengerScope = null,
    buildAnhaenge = null,
    mountExtras = null,
    rewriteMail = null,
  }) {
    this.dokumentTyp = dokumentTyp;
    this.dokumentId = dokumentId;
    this.dokumentName = dokumentName || 'Dokument';
    this.unternehmenId = unternehmenId;
    this.markeId = markeId;
    this.db = db || window.supabase;
    this.createPdf = createPdf;
    this.pdfContext = pdfContext;
    this.platzhalter = platzhalter;
    this.prefill = prefill;
    this.empfaengerFest = Boolean(empfaengerFest);
    this.extraTabs = extraTabs;
    this.loadEmpfaengerScope = loadEmpfaengerScope;
    this.buildAnhaenge = buildAnhaenge;
    this.mountExtras = mountExtras;
    this.rewriteMail = rewriteMail;

    this.overlay = null;
    this.panel = null;
    this.composer = null;
    this.vorlagen = [];
    this.vorlageId = null;
    this.pdf = null; // { blob, dateiname }
    this.sending = false;
    this._abort = null;
  }

  async open() {
    this._build();
    if (this.loadEmpfaengerScope) {
      try {
        this.composer.empfaengerScope = await this.loadEmpfaengerScope(this.db);
        this.composer.managementCreators = this.composer.empfaengerScope?.managementCreators || {};
      } catch (err) {
        console.error('Empfänger-Scope laden fehlgeschlagen:', err);
        this.composer.empfaengerScope = { creators: [], managements: [], kampagne: null };
      }
    }
    await Promise.all([this.composer.render(), this._loadVorlagen(), this._buildPdf()]);
    if (this.prefill?.length) this.composer.applyPrefill(this.prefill);
    this._fillFromVorlage(this._defaultVorlage());
  }

  close() {
    this.composer?.destroy();
    this._abort?.abort();
    this._removeDom();
  }

  _removeDom() {
    this.overlay?.remove();
    this.panel?.remove();
    this.overlay = null;
    this.panel = null;
  }

  // ─── Daten ────────────────────────────────────────────────

  async _loadVorlagen() {
    const { data, error } = await this.db
      .from('mailvorlage')
      .select('id, name, betreff, body, empfaenger_typ, is_standard, is_shared, created_by, dokument_typ')
      .order('is_standard', { ascending: false })
      .order('name');
    if (error) {
      console.error('Mailvorlagen laden fehlgeschlagen:', error);
      this.vorlagen = [];
      return;
    }
    this.vorlagen = (data || []).filter((v) => (v.dokument_typ || 'briefing') === this.dokumentTyp);
    this._renderVorlageSelect();
  }

  _defaultVorlage() {
    return this.vorlagen.find((v) => v.is_standard) || this.vorlagen[0] || null;
  }

  _vorlagenForTyp() {
    const typ = this.composer?.typ || 'creator';
    return this.vorlagen.filter((v) => !v.empfaenger_typ || v.empfaenger_typ === typ);
  }

  async _buildPdf() {
    const lauf = (this._pdfLauf = (this._pdfLauf || 0) + 1);
    const status = this.panel?.querySelector('[data-pdf-status]');
    const btn = this.panel?.querySelector('[data-action="pdf-preview"]');
    this.pdf = null;
    this._updateSendState();
    if (status) status.textContent = 'PDF wird erzeugt …';
    if (btn) btn.disabled = true;
    try {
      const hint = {
        ...(this.pdfContext || {}),
        empfaenger: this.composer?.getEmpfaenger()?.[0] || null,
      };
      const result = await this.createPdf(hint);
      if (lauf !== this._pdfLauf) return;
      if (result?.empty) {
        this.pdf = null;
        if (status) status.textContent = 'Keine Skripte für diesen Empfänger';
        return;
      }
      if (result?.serverFallback) {
        this.pdf = result;
        if (status) status.textContent = `${result.dateiname || 'PDF'} — wird beim Senden geladen`;
        return;
      }
      if (result?.pdfs?.length) {
        this.pdf = {
          pdfs: result.pdfs,
          dateiname: result.pdfs.map((item) => item.dateiname).filter(Boolean).join(', '),
        };
        if (status) status.textContent = this.pdf.dateiname;
        if (btn) btn.disabled = false;
        return;
      }
      if (!result?.blob) throw new Error('PDF fehlt');
      this.pdf = result;
      if (status) status.textContent = this.pdf.dateiname;
      if (btn) btn.disabled = false;
    } catch (err) {
      if (lauf !== this._pdfLauf) return;
      console.error('PDF-Erzeugung fehlgeschlagen:', err);
      if (status) status.textContent = 'PDF konnte nicht erzeugt werden';
      window.toastSystem?.show('PDF konnte nicht erzeugt werden', 'error');
    } finally {
      if (lauf === this._pdfLauf) this._updateSendState();
    }
  }

  // ─── Render ───────────────────────────────────────────────

  _build() {
    this._removeDom();
    this._abort = new AbortController();

    this.overlay = document.createElement('div');
    this.overlay.className = 'drawer-overlay';

    this.panel = document.createElement('div');
    this.panel.setAttribute('role', 'dialog');
    this.panel.className = 'drawer-panel anschreiben-drawer';
    this.panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">Anschreiben</span>
          <p class="drawer-subtitle">${escapeHtml(this.dokumentName)}</p>
        </div>
        <button type="button" class="drawer-close-btn" data-action="close" aria-label="Schließen">&times;</button>
      </div>
      <div class="drawer-body">
        <section class="anschreiben-section">
          <h4 class="drawer-section-title">Empfänger</h4>
          <div data-composer></div>
        </section>

        <section class="anschreiben-section">
          <h4 class="drawer-section-title">Vorlage</h4>
          <div class="anschreiben-vorlage-row">
            <select class="input" data-vorlage-select></select>
            <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-action="vorlage-save" title="Aktuellen Text als Vorlage speichern">+</button>
          </div>
        </section>

        <section class="anschreiben-section">
          <h4 class="drawer-section-title">Betreff</h4>
          <input type="text" class="input" data-betreff maxlength="200">
        </section>

        <section class="anschreiben-section">
          <h4 class="drawer-section-title">Text</h4>
          <textarea class="input" data-body rows="8"></textarea>
          <p class="anschreiben-hint">Platzhalter: ${this.platzhalter.map((p) => `{{${p}}}`).join(' ')}</p>
        </section>

        <section class="anschreiben-section">
          <h4 class="drawer-section-title">Anhang</h4>
          <div class="anschreiben-anhang">
            <span class="anschreiben-anhang-name" data-pdf-status>PDF wird erzeugt …</span>
            <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-action="pdf-preview" disabled>Im neuen Tab öffnen</button>
          </div>
        </section>

        <p class="anschreiben-feedback" data-feedback hidden></p>
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--secondary" data-action="close">Abbrechen</button>
        <button type="button" class="mdc-btn" data-action="send" disabled>Senden</button>
      </div>
    `;

    document.body.appendChild(this.overlay);
    document.body.appendChild(this.panel);
    requestAnimationFrame(() => this.panel?.classList.add('show'));

    this.composer = new EmpfaengerComposer({
      container: this.panel.querySelector('[data-composer]'),
      db: this.db,
      unternehmenId: this.unternehmenId,
      markeId: this.markeId,
      empfaengerFest: this.empfaengerFest,
      prefill: this.prefill,
      extraTabs: this.extraTabs,
      onChange: () => {
        this._updateSendState();
        if (this.buildAnhaenge) this._buildPdf();
      },
    });

    if (this.mountExtras) {
      const host = document.createElement('div');
      host.className = 'anschreiben-extras';
      this.panel.querySelector('.anschreiben-vorlage-row')?.insertAdjacentElement('afterend', host);
      this.mountExtras(host, { onChange: () => this._onExtrasChange() });
    }

    this._bind();
  }

  async _onExtrasChange() {
    if (this.loadEmpfaengerScope) {
      try {
        const scope = await this.loadEmpfaengerScope(this.db);
        await this.composer.setEmpfaengerScope(scope);
      } catch (err) {
        console.error('Empfänger-Scope laden fehlgeschlagen:', err);
        await this.composer.setEmpfaengerScope({ creators: [], managements: [], kampagne: null });
      }
    }
    await this._buildPdf();
  }

  _bind() {
    const signal = this._abort.signal;

    this.overlay.addEventListener('click', () => this.close(), { signal });
    this.panel.querySelectorAll('[data-action="close"]').forEach((btn) =>
      btn.addEventListener('click', () => this.close(), { signal }));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    }, { signal });

    this.panel.querySelector('[data-vorlage-select]').addEventListener('change', (e) => {
      this.vorlageId = e.target.value || null;
      this._fillFromVorlage(this.vorlagen.find((v) => v.id === this.vorlageId));
    }, { signal });

    this.panel.querySelector('[data-action="vorlage-save"]').addEventListener('click', () => this._saveVorlage(), { signal });
    this.panel.querySelector('[data-action="pdf-preview"]').addEventListener('click', () => this._previewPdf(), { signal });
    this.panel.querySelector('[data-action="send"]').addEventListener('click', () => this._send(), { signal });

    // Composer-Toggle steuert den Vorlagenfilter
    this.panel.querySelector('[data-composer]').addEventListener('click', (e) => {
      if (e.target.closest('[data-typ]')) {
        // Nach dem Toggle neu filtern (Composer setzt typ synchron)
        requestAnimationFrame(() => this._renderVorlageSelect());
      }
    }, { signal });

    ['[data-betreff]', '[data-body]'].forEach((sel) =>
      this.panel.querySelector(sel).addEventListener('input', () => this._updateSendState(), { signal }));
  }

  _renderVorlageSelect() {
    const select = this.panel?.querySelector('[data-vorlage-select]');
    if (!select) return;
    const list = this._vorlagenForTyp();
    select.innerHTML = list.map((v) =>
      `<option value="${escapeHtml(v.id)}">${escapeHtml(v.name)}${v.is_standard ? ' (Standard)' : ''}</option>`
    ).join('');
    const current = list.find((v) => v.id === this.vorlageId) || this._defaultVorlage();
    this.vorlageId = current?.id || null;
    if (this.vorlageId) select.value = this.vorlageId;
  }

  _fillFromVorlage(vorlage) {
    if (!vorlage) return;
    this.vorlageId = vorlage.id;
    const select = this.panel?.querySelector('[data-vorlage-select]');
    if (select && select.value !== vorlage.id) select.value = vorlage.id;
    this.panel.querySelector('[data-betreff]').value = vorlage.betreff || '';
    this.panel.querySelector('[data-body]').value = vorlage.body || '';
    this._updateSendState();
  }

  async _saveVorlage() {
    const betreff = this.panel.querySelector('[data-betreff]').value.trim();
    const body = this.panel.querySelector('[data-body]').value.trim();
    if (!betreff || !body) {
      window.toastSystem?.show('Betreff und Text ausfüllen, bevor du eine Vorlage speicherst', 'warning');
      return;
    }
    const name = window.prompt('Name der Vorlage:');
    if (!name?.trim()) return;
    const isShared = window.confirm('Für alle Mitarbeiter nutzbar?\nOK = für alle, Abbrechen = nur für dich');

    const { data, error } = await this.db
      .from('mailvorlage')
      .insert({
        name: name.trim(),
        betreff,
        body,
        empfaenger_typ: this.composer?.typ || null,
        dokument_typ: this.dokumentTyp,
        is_shared: isShared,
        created_by: window.currentUser?.id || null,
      })
      .select('id, name, betreff, body, empfaenger_typ, is_standard, is_shared, created_by, dokument_typ')
      .single();
    if (error) {
      console.error('Vorlage speichern fehlgeschlagen:', error);
      window.toastSystem?.show('Vorlage konnte nicht gespeichert werden', 'error');
      return;
    }
    this.vorlagen.push(data);
    this._renderVorlageSelect();
    this._fillFromVorlage(data);
    window.toastSystem?.show('Vorlage gespeichert', 'success');
  }

  _previewPdf() {
    const items = this.pdf?.pdfs?.length ? this.pdf.pdfs : [this.pdf];
    for (const item of items) {
      if (!item?.blob) continue;
      const url = URL.createObjectURL(item.blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  }

  _updateSendState() {
    const btn = this.panel?.querySelector('[data-action="send"]');
    if (!btn) return;
    const betreff = this.panel.querySelector('[data-betreff]').value.trim();
    const body = this.panel.querySelector('[data-body]').value.trim();
    const ready = !this.sending
      && !this.composer?.isEmpty()
      && Boolean(betreff)
      && Boolean(body)
      && Boolean(this.pdf?.blob || this.pdf?.pdfs?.length || this.pdf?.serverFallback);
    btn.disabled = !ready;
  }

  _feedback(text, isError = false) {
    const el = this.panel?.querySelector('[data-feedback]');
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || '';
    el.classList.toggle('is-error', isError);
  }

  async _send() {
    if (this.sending) return;
    const empfaenger = this.composer.getEmpfaenger();
    const betreff = this.panel.querySelector('[data-betreff]').value.trim();
    const body = this.panel.querySelector('[data-body]').value.trim();
    if (!empfaenger.length || !betreff || !body) return;
    if (!this.pdf?.blob && !this.pdf?.pdfs?.length && !this.pdf?.serverFallback) return;

    this.sending = true;
    this._updateSendState();
    this._feedback(`Sende an ${empfaenger.length} Empfänger …`);

    try {
      const mailBetreff = this.rewriteMail ? this.rewriteMail(betreff) : betreff;
      const mailBody = this.rewriteMail ? this.rewriteMail(body) : body;
      const payload = {
        dokumentTyp: this.dokumentTyp,
        dokumentId: this.dokumentId,
        empfaenger,
        betreff: mailBetreff,
        body: mailBody,
        vorlageId: this.vorlageId,
        dateiname: this.pdf?.dateiname || '',
        pdfBase64: '',
      };
      if (this.buildAnhaenge) {
        const built = await this.buildAnhaenge(empfaenger);
        if (!built.length) throw new Error('Keine Skripte für die Empfänger');
        payload.empfaenger = [];
        for (const row of built) {
          const pdfs = [];
          for (const item of row.pdfs) {
            pdfs.push({
              dateiname: item.dateiname,
              pdfBase64: await this._blobToBase64(item.blob),
            });
          }
          payload.empfaenger.push({ ...row.empfaenger, pdfs });
        }
      } else if (this.pdf?.pdfs?.length) {
        payload.pdfs = [];
        for (const item of this.pdf.pdfs) {
          payload.pdfs.push({
            dateiname: item.dateiname,
            pdfBase64: await this._blobToBase64(item.blob),
          });
        }
      } else if (this.pdf?.blob) {
        payload.pdfBase64 = await this._blobToBase64(this.pdf.blob);
      }
      const response = await authorizedFetch('/.netlify/functions/anschreiben-send', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || `Senden fehlgeschlagen (HTTP ${response.status})`);
      }
      const skipped = this.composer.getSkipped();
      const parts = [`${result.sent} gesendet`];
      if (result.failed) parts.push(`${result.failed} fehlgeschlagen`);
      if (skipped) parts.push(`${skipped} ohne E-Mail übersprungen`);
      this._feedback(parts.join(' · '), Boolean(result.failed));
      window.toastSystem?.show(`Anschreiben: ${parts.join(', ')}`, result.failed ? 'warning' : 'success');
      window.dispatchEvent(new CustomEvent('anschreibenSent', {
        detail: { dokumentTyp: this.dokumentTyp, dokumentId: this.dokumentId, sent: result.sent, failed: result.failed },
      }));
      if (!result.failed) {
        setTimeout(() => this.close(), 1200);
      }
    } catch (err) {
      console.error('Anschreiben senden fehlgeschlagen:', err);
      this._feedback(err.message || 'Senden fehlgeschlagen', true);
      window.toastSystem?.show(err.message || 'Senden fehlgeschlagen', 'error');
    } finally {
      this.sending = false;
      this._updateSendState();
    }
  }

  _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('PDF konnte nicht gelesen werden'));
      reader.readAsDataURL(blob);
    });
  }
}
