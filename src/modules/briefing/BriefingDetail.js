// BriefingDetail.js (ES6-Modul)
// Dokumentansicht eines Campaign Briefings (campaign_briefings): die drei Sektionen des
// Creator-Briefings (BriefingDocView). Textfelder sind inline editierbar; alles andere
// geht ueber /briefing/:id/edit. Kunden laden nur BRIEFING_SPALTEN, das Team alles
// (fuer „Fruehere Angaben“).

import { dropAnschreibenWarm, warmAnschreiben } from '../../core/anschreiben/openAnschreiben.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { renderBriefingDoc, bindBriefingDoc } from './BriefingDocView.js';
import { loadBriefingProduktDetails } from './BriefingProdukte.js';
import { BRIEFING_SPALTEN } from './briefingSpalten.js';
import { backTarget } from '../../core/breadcrumbTrail.js';
import { formatBriefingWert } from './briefingWertAnzeige.js';
export class BriefingDetail {
  constructor() {
    this.briefingId = null;
    this.briefing = null;
    this.compactView = true;
    this._abortController = null;
    this._docHandle = null;
    // Eingebettet (Produktion, Tab Briefing): Host-Element statt Seite.
    this.host = null;
    this._onDeleted = null;
    this._onDuplicated = null;
    this._duplicating = false;
    this._destroyed = false;
  }

  get embedded() {
    return Boolean(this.host);
  }

  canEdit() {
    return Boolean(window.isAdmin?.() || window.currentUser?.permissions?.briefing?.can_edit);
  }

  zeigtFruehereAngaben() {
    return Boolean(window.canFeature?.('briefingFruehereAngaben'));
  }

  /** Duplizieren legt eine neue Linie an: Anlegerecht (canCreate) und eine Produktion am Briefing. */
  canDuplicate() {
    return Boolean(this.briefing?.produktion_id && window.canCreate?.('briefing'));
  }

  /**
   * Dokumentansicht in ein Host-Element legen (Produktion, Tab Briefing).
   * Kein Headline, kein Breadcrumb, kein Modul-Check: die Seite gehört dem Host.
   * @param {HTMLElement} host
   * @param {string} briefingId
   * @param {{ onDeleted?: Function, onDuplicated?: Function }} [opts]
   */
  async mountEmbedded(host, briefingId, { onDeleted, onDuplicated } = {}) {
    this._destroyed = false;
    this.host = host;
    this.briefingId = briefingId;
    this._onDeleted = onDeleted || null;
    this._onDuplicated = onDuplicated || null;

    await this.loadData();
    if (this._destroyed || !this.host?.isConnected) return;
    await this.render();
    this.bindEvents();
    this.setupCacheInvalidation();
  }

  async init(briefingId) {
    this._destroyed = false;
    this.briefingId = briefingId;

    if (window.moduleRegistry?.currentModule !== this) {
      return;
    }

    try {
      await this.loadData();

      if (window.breadcrumbSystem && this.briefing) {
        const label = this.briefing.aktivierung_name || 'Details';
        window.breadcrumbSystem.updateDetailLabel(label, { id: 'btn-edit-briefing', canEdit: this.canEdit() });
      }

      await this.render();
      this.bindEvents();
      this.setupCacheInvalidation();
    } catch (error) {
      console.error('BRIEFINGDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler?.handle?.(error, 'BriefingDetail.init');
    }
  }

  async loadData() {
    if (!this.briefingId || this.briefingId === 'new') return;

    const { data, error } = await window.supabase
      .from('campaign_briefings')
      .select(`
        ${this.zeigtFruehereAngaben() ? '*' : BRIEFING_SPALTEN},
        unternehmen:unternehmen_id(id, firmenname, logo_url),
        marke:marke_id(id, markenname, logo_url)
      `)
      .eq('id', this.briefingId)
      .single();

    if (error) throw error;
    this.briefing = data;
    this.briefing.produkte = await loadBriefingProduktDetails(this.briefingId);
    const personaIds = Array.isArray(data.persona_ids) ? data.persona_ids.filter(Boolean) : [];
    if (personaIds.length && window.supabase) {
      const { data: personas } = await window.supabase
        .from('personas')
        .select('id, name, oberbegriff')
        .in('id', personaIds);
      this.briefing.personas = personas || [];
    } else {
      this.briefing.personas = [];
    }
    this.warmBriefingAnschreiben();
  }

  warmBriefingAnschreiben() {
    if (!this.briefing || this.briefing.is_draft || !window.isInternal?.()) return;
    warmAnschreiben({
      dokumentTyp: 'briefing',
      dokumentId: this.briefingId,
      detail: this,
    }).catch((err) => console.error('Anschreiben vorwärmen fehlgeschlagen:', err));
  }

  setupCacheInvalidation() {
    const signal = this._abortController?.signal;
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'briefing' && e.detail.id === this.briefingId) {
        dropAnschreibenWarm('briefing', this.briefingId);
        tabDataCache.invalidate('briefing', this.briefingId);
        if (e.detail.action === 'updated') {
          this.loadData().then(() => this.render());
        }
        if (e.detail.action === 'deleted') this._handleDeleted();
      }
    }, { signal });
  }

  // Löschen läuft zentral über confirmDeleteBriefing; hier nur die Folge.
  _handleDeleted() {
    if (this.embedded) {
      this._onDeleted?.(this.briefingId);
      return;
    }
    window.navigateTo(backTarget('/briefing'));
  }

  _contentRoot() {
    return this.host || window.content;
  }

  async render() {
    await this._unbindDoc();
    if (this._destroyed) return;

    if (!this.briefing) {
      this.showNotFound();
      return;
    }

    if (!this.embedded) {
      const title = this.briefing.aktivierung_name || 'Briefing';
      window.setHeadline(`Briefing: ${window.validatorSystem?.sanitizeHtml?.(title) || title}`);
    }

    const canDelete = window.isAdmin() || window.currentUser?.permissions?.briefing?.can_delete;
    const canAnschreiben = Boolean(window.isInternal?.()) && !this.briefing.is_draft;
    const html = renderBriefingDoc({
      detail: this,
      compact: this.compactView,
      canDelete,
      canEdit: this.canEdit(),
      canAnschreiben,
      canDuplicate: this.canDuplicate(),
      showEdit: this.embedded,
      embedded: this.embedded,
      fruehereAngaben: this.zeigtFruehereAngaben()
    });

    if (this.embedded) this.host.innerHTML = html;
    else window.setContentSafely(window.content, html);
    this._bindDoc();
  }

  _bindDoc() {
    const root = this._contentRoot()?.querySelector('.briefing-doc');
    this._docHandle = bindBriefingDoc(root, {
      briefingId: this.briefingId,
      bereich: this.briefing?.bereich,
      canEdit: this.canEdit(),
      onSaved: (feld, text) => {
        if (this.briefing) this.briefing[feld] = text;
        if (feld !== 'aktivierung_name' || this.embedded) return;
        const title = text || 'Briefing';
        window.breadcrumbSystem?.updateDetailLabel(title, {
          id: 'btn-edit-briefing',
          canEdit: this.canEdit()
        });
        const safe = window.validatorSystem?.sanitizeHtml?.(title) || title;
        window.setHeadline?.(`Briefing: ${safe}`);
      }
    });
  }

  async _unbindDoc() {
    if (!this._docHandle) return;
    try {
      await this._docHandle.destroy();
    } catch (_) { /* Unmount trotzdem */ }
    this._docHandle = null;
  }

  formatValue(field, value) {
    return formatBriefingWert(field, value, {
      escape: (v) => this.escape(v),
      formatDate: (d) => this.formatDate(d)
    });
  }

  formatDate(d) {
    return d ? new Date(d).toLocaleDateString('de-DE') : '-';
  }

  async _openAnschreiben() {
    if (!this.briefing || this.briefing.is_draft) return;
    if (!window.isInternal?.()) return;
    try {
      await this._docHandle?.inlineEdit?.flush?.();
    } catch (err) {
      console.error('Briefing vor Anschreiben speichern fehlgeschlagen:', err);
      window.toastSystem?.show('Änderungen konnten nicht gespeichert werden', 'error');
      return;
    }
    const { openAnschreiben } = await import('../../core/anschreiben/openAnschreiben.js');
    await openAnschreiben({
      dokumentTyp: 'briefing',
      dokumentId: this.briefingId,
      detail: this,
    });
  }

  escape(s) {
    // Bewusst ohne Validator-Sanitize: Slash (/) braucht kein XSS-Escaping,
    // und &#x2F; wuerde im PDF als Rohtext landen (siehe htmlToPlainText).
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  bindEvents() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    // Seite: Klicks aus Breadcrumb und Dokument am document. Eingebettet: nur im Host.
    const scope = this.host || document;
    scope.addEventListener('click', (e) => {
      if (e.target.closest('#btn-edit-briefing')) {
        e.preventDefault();
        this._unbindDoc().finally(() => {
          window.navigateTo(`/briefing/${this.briefingId}/edit`);
        });
      }
      if (e.target.closest('#btn-briefing-fields-toggle')) {
        e.preventDefault();
        this.compactView = !this.compactView;
        this.render();
      }
      if (e.target.closest('#btn-anschreiben-briefing')) {
        e.preventDefault();
        this._openAnschreiben();
      }
      if (e.target.closest('#btn-delete-briefing')) {
        e.preventDefault();
        this._confirmDelete();
      }
      const duplicateBtn = e.target.closest('#btn-duplicate-briefing');
      if (duplicateBtn) {
        e.preventDefault();
        this._duplicate(duplicateBtn);
      }
    }, { signal });
  }

  async _duplicate(button) {
    if (this._duplicating || !this.canDuplicate()) return;
    this._duplicating = true;
    if (button) button.disabled = true;
    try {
      const { duplicateBriefingMitHinweis } = await import('./duplicateBriefing.js');
      const kopie = await duplicateBriefingMitHinweis(this.briefingId);
      if (!kopie || this._destroyed) return;
      if (this._onDuplicated) this._onDuplicated(kopie);
      else window.navigateTo(`/briefing/${kopie.id}`);
    } finally {
      this._duplicating = false;
      if (button?.isConnected) button.disabled = false;
    }
  }

  async _confirmDelete() {
    const { confirmDeleteBriefing } = await import('../../core/actions/actionDelete.js');
    await confirmDeleteBriefing(this.briefingId);
  }

  showNotFound() {
    const html = `
      <div class="error-message">
        <h2>Briefing nicht gefunden</h2>
        <p>Das angeforderte Briefing konnte nicht gefunden werden.</p>
      </div>
    `;
    if (this.embedded) {
      this.host.innerHTML = html;
      return;
    }
    window.setHeadline('Briefing nicht gefunden');
    window.content.innerHTML = html;
  }

  destroy() {
    this._destroyed = true;
    this._abortController?.abort();
    this._abortController = null;
    this._unbindDoc();
    tabDataCache.invalidate('briefing', this.briefingId);
    if (this.embedded) {
      this.host = null;
      this._onDeleted = null;
      return;
    }
    window.setContentSafely('');
  }
}

export const briefingDetail = new BriefingDetail();
