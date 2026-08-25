// BriefingDetail.js (ES6-Modul)
// Read-only-Detailansicht eines Campaign Briefings (campaign_briefings).
// Rendert die Inhalte datengetrieben aus fieldConfig.js (gleiche
// Step-/Section-Struktur wie der Generator). Bearbeiten oeffnet den
// Generator im Edit-Modus (/briefing/:id/edit).

import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { BEREICH_LABELS, getStepsForBereich, evaluateCondition } from './create/fieldConfig.js';

export class BriefingDetail {
  constructor() {
    this.briefingId = null;
    this.briefing = null;
    this._abortController = null;
  }

  async init(briefingId) {
    this.briefingId = briefingId;

    if (window.moduleRegistry?.currentModule !== this) {
      return;
    }

    try {
      await this.loadData();

      if (window.breadcrumbSystem && this.briefing) {
        const canEdit = window.isAdmin() || window.currentUser?.permissions?.briefing?.can_edit;
        window.breadcrumbSystem.updateDetailLabel(this.briefing.aktivierung_name || 'Details', {
          id: 'btn-edit-briefing',
          canEdit
        });
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
        *,
        unternehmen:unternehmen_id(id, firmenname),
        marke:marke_id(id, markenname)
      `)
      .eq('id', this.briefingId)
      .single();

    if (error) throw error;
    this.briefing = data;
  }

  setupCacheInvalidation() {
    const signal = this._abortController?.signal;
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'briefing' && e.detail.id === this.briefingId) {
        tabDataCache.invalidate('briefing', this.briefingId);
        if (e.detail.action === 'updated') {
          this.loadData().then(() => this.render());
        }
      }
    }, { signal });
  }

  async render() {
    if (!this.briefing) {
      this.showNotFound();
      return;
    }

    const title = this.briefing.aktivierung_name || 'Briefing';
    window.setHeadline(`Briefing: ${window.validatorSystem?.sanitizeHtml?.(title) || title}`);

    const canDelete = window.isAdmin() || window.currentUser?.permissions?.briefing?.can_delete;
    const escape = (s) => window.validatorSystem?.sanitizeHtml?.(s ?? '-') || (s ?? '-');
    const bereichLabel = BEREICH_LABELS[this.briefing.bereich] || this.briefing.bereich || '-';

    const html = `
      <div class="page-header">
        <div class="page-header-right">
          ${canDelete ? `<button id="btn-delete-briefing" class="mdc-btn mdc-btn--delete">Löschen</button>` : ''}
        </div>
      </div>

      <div class="content-section">
        <div class="detail-section">
          <div class="detail-grid">
            <div class="detail-card">
              <h3>Allgemein</h3>
              <div class="detail-grid-2">
                <div class="detail-item">
                  <label>Aktivierung:</label>
                  <span>${escape(this.briefing.aktivierung_name)}</span>
                </div>
                <div class="detail-item">
                  <label>Bereich:</label>
                  <span>${escape(bereichLabel)}</span>
                </div>
                <div class="detail-item">
                  <label>Status:</label>
                  <span>${this.briefing.is_draft ? 'Entwurf' : 'Final'}</span>
                </div>
                <div class="detail-item">
                  <label>Unternehmen:</label>
                  <span>${escape(this.briefing.unternehmen?.firmenname)}</span>
                </div>
                <div class="detail-item">
                  <label>Marke:</label>
                  <span>${escape(this.briefing.marke?.markenname)}</span>
                </div>
                <div class="detail-item">
                  <label>Erstellt:</label>
                  <span>${this.formatDate(this.briefing.created_at)}</span>
                </div>
                <div class="detail-item">
                  <label>Aktualisiert:</label>
                  <span>${this.formatDate(this.briefing.updated_at)}</span>
                </div>
              </div>
            </div>
            ${this.renderContentCards()}
          </div>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  // Datengetriebene Read-only-Karten aus den Step-Definitionen
  renderContentCards() {
    const steps = getStepsForBereich(this.briefing.bereich);
    const cards = [];

    for (const step of steps) {
      for (const section of step.sections) {
        if (section.condition && !evaluateCondition(section.condition, this.briefing)) continue;

        const items = section.fields
          // Zuordnung steht schon in der Allgemein-Karte
          .filter(f => f.type !== 'entitySelect')
          .map(field => this.renderFieldValue(field))
          .filter(Boolean);

        if (items.length === 0) continue;

        cards.push(`
          <div class="detail-card">
            <h3>${this.escape(section.title || step.label)}</h3>
            ${items.join('')}
          </div>
        `);
      }
    }

    return cards.join('');
  }

  renderFieldValue(field) {
    if (field.condition && !evaluateCondition(field.condition, this.briefing)) return null;

    const value = this.briefing[field.name];
    const formatted = this.formatValue(field, value);
    if (formatted === null) return null;

    return `
      <div class="detail-item">
        <label>${this.escape(field.label)}</label>
        <span>${formatted}</span>
      </div>
    `;
  }

  formatValue(field, value) {
    if (value === null || value === undefined || value === '') return null;

    switch (field.type) {
      case 'checkbox':
        return value ? 'Ja' : null; // nicht gesetzte Checkboxen ausblenden
      case 'date':
        return this.formatDate(value);
      case 'url':
        return `<a href="${this.escape(value)}" target="_blank" rel="noopener">Link</a>`;
      case 'radio': {
        const opt = field.options?.find(o => String(o.value) === String(value));
        return this.escape(opt?.label || value);
      }
      case 'checkboxes':
      case 'customMulti': {
        if (!Array.isArray(value) || value.length === 0) return null;
        const labels = value.map(v => {
          const opt = field.options?.find(o => o.value === v);
          return opt?.label || v;
        });
        return labels.map(l => `<span class="tag tag--type">${this.escape(l)}</span>`).join(' ');
      }
      case 'group': {
        if (typeof value !== 'object') return null;
        const parts = field.fields
          .filter(sub => value[sub.name])
          .map(sub => `<strong>${this.escape(sub.label)}:</strong> ${this.escape(value[sub.name])}`);
        return parts.length ? parts.join('<br>') : null;
      }
      case 'channelGroup': {
        if (typeof value !== 'object') return null;
        const parts = [];
        for (const channel of field.channels || []) {
          const cv = value[channel.key];
          if (cv === true) {
            parts.push(`<span class="tag tag--type">${this.escape(channel.label)}</span>`);
          } else if (Array.isArray(cv) && cv.length) {
            const formatLabels = cv.map(f => channel.formats?.find(o => o.value === f)?.label || f);
            parts.push(`<strong>${this.escape(channel.label)}:</strong> ${formatLabels.map(l => `<span class="tag tag--type">${this.escape(l)}</span>`).join(' ')}`);
          }
        }
        if (value.weitere) parts.push(`<strong>Weitere:</strong> ${this.escape(value.weitere)}`);
        return parts.length ? parts.join('<br>') : null;
      }
      case 'repeatableKpi': {
        if (!Array.isArray(value) || value.length === 0) return null;
        return value
          .filter(e => e.kpi || e.zielwert)
          .map(e => {
            const label = field.kpiOptions?.find(o => o.value === e.kpi)?.label || e.kpi;
            return `<strong>${this.escape(label)}:</strong> ${this.escape(e.zielwert || '-')}`;
          })
          .join('<br>');
      }
      case 'repeatableText': {
        if (!Array.isArray(value) || value.length === 0) return null;
        return value.map(v => `• ${this.escape(v)}`).join('<br>');
      }
      case 'repeatableUpload': {
        if (!Array.isArray(value) || value.length === 0) return null;
        const links = value.map((entry, i) => {
          if (entry.typ === 'upload' && entry.value) {
            const { data: urlData } = window.supabase.storage.from('documents').getPublicUrl(entry.value);
            const url = urlData?.publicUrl || '#';
            return `<a href="${url}" target="_blank" rel="noopener">${this.escape(entry.label || `Datei ${i + 1}`)}</a>`;
          }
          if (entry.value) {
            return `<a href="${this.escape(entry.value)}" target="_blank" rel="noopener">${this.escape(entry.value)}</a>`;
          }
          return null;
        }).filter(Boolean);
        return links.length ? links.join('<br>') : null;
      }
      default:
        return this.escape(value);
    }
  }

  formatDate(d) {
    return d ? new Date(d).toLocaleDateString('de-DE') : '-';
  }

  escape(s) {
    const str = String(s ?? '');
    if (window.validatorSystem?.sanitizeHtml) return window.validatorSystem.sanitizeHtml(str);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  bindEvents() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    document.addEventListener('click', (e) => {
      if (e.target.closest('#btn-edit-briefing')) {
        e.preventDefault();
        window.navigateTo(`/briefing/${this.briefingId}/edit`);
      }
    }, { signal });

    document.addEventListener('click', async (e) => {
      if (e.target.id === 'btn-delete-briefing') {
        e.preventDefault();
        const doDelete = async () => {
          try {
            const { error } = await window.supabase
              .from('campaign_briefings')
              .delete()
              .eq('id', this.briefingId);
            if (error) throw error;
            window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'briefing', action: 'deleted', id: this.briefingId } }));
            window.navigateTo('/briefing');
          } catch (err) {
            console.error('Fehler beim Löschen des Briefings:', err);
            window.toastSystem?.show('Löschen fehlgeschlagen.', 'error');
          }
        };

        if (window.confirmationModal) {
          const res = await window.confirmationModal.open({
            title: 'Briefing löschen',
            message: 'Dieses Briefing wirklich löschen?',
            confirmText: 'Endgültig löschen',
            cancelText: 'Abbrechen',
            danger: true
          });
          if (res?.confirmed) await doDelete();
        } else if (confirm('Dieses Briefing wirklich löschen?')) {
          await doDelete();
        }
      }
    }, { signal });
  }

  showNotFound() {
    window.setHeadline('Briefing nicht gefunden');
    window.content.innerHTML = `
      <div class="error-message">
        <h2>Briefing nicht gefunden</h2>
        <p>Das angeforderte Briefing konnte nicht gefunden werden.</p>
      </div>
    `;
  }

  destroy() {
    this._abortController?.abort();
    this._abortController = null;
    tabDataCache.invalidate('briefing', this.briefingId);
    window.setContentSafely('');
  }
}

export const briefingDetail = new BriefingDetail();
