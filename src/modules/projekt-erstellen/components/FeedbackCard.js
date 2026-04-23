// FeedbackCard.js
// Sticky Feedback-Card rechts neben dem Wizard. Zeigt Live-Zusammenfassung
// des aktuellen Steps. Nutzt bestehende .detail-card / .detail-section Klassen.

import { AUFTRAG_TYPES, CAMPAIGN_TYPES, RETAINER_TYPES, FEE_BASES } from '../constants.js';

const EMPTY_PLACEHOLDER = '—';

function formatDate(value) {
  if (!value) return EMPTY_PLACEHOLDER;
  try {
    const d = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(d)) return EMPTY_PLACEHOLDER;
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (_) {
    return EMPTY_PLACEHOLDER;
  }
}

function formatCurrency(value) {
  const n = parseFloat(value);
  if (isNaN(n)) return EMPTY_PLACEHOLDER;
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function looksLikeUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function resolveOptionLabel(selectId, value) {
  if (!value) return null;
  const select = document.getElementById(selectId);
  if (!select) return null;
  const opt = select.querySelector(`option[value="${value}"]`);
  return opt?.textContent || null;
}

export class FeedbackCard {
  constructor(host, wizard) {
    this.host = host;
    this.wizard = wizard;
  }

  render() {
    if (!this.host) return;
    this.host.innerHTML = `
      <div class="detail-card projekt-erstellen-feedback-card">
        <div class="detail-card-header">
          <h3 class="detail-card-title" id="feedback-card-title">Zusammenfassung</h3>
          <p class="detail-card-subtitle" id="feedback-card-subtitle"></p>
        </div>
        <div class="detail-card-body">
          <div id="feedback-card-content" class="projekt-erstellen-summary-list"></div>
        </div>
      </div>
    `;
    this.update(this.wizard?.currentStep || 1, this.wizard?.formData || {});
  }

  update(currentStep, formData) {
    if (!this.host) return;

    const title = document.getElementById('feedback-card-title');
    const subtitle = document.getElementById('feedback-card-subtitle');
    const content = document.getElementById('feedback-card-content');
    if (!title || !subtitle || !content) return;

    const stepTitles = {
      1: { t: 'Basisdaten', s: 'Grunddaten des Auftrags' },
      2: { t: 'Details & Finanzen', s: 'Agenturleistungen und Finanzen' },
      3: { t: 'Kampagnenarten', s: 'Ausgewählte Arten und Budgets' },
      4: { t: 'Kampagne', s: 'Die erste Kampagne zu diesem Auftrag' }
    };

    title.textContent = stepTitles[currentStep]?.t || 'Zusammenfassung';
    subtitle.textContent = stepTitles[currentStep]?.s || '';

    content.innerHTML = this.buildContent(currentStep, formData);
  }

  buildContent(step, formData) {
    if (step === 1) return this.buildStep1(formData);
    if (step === 2) return this.buildStep2(formData);
    if (step === 3) return this.buildStep3Kampagnenarten(formData);
    if (step === 4) return this.buildStep4(formData);
    return '';
  }

  renderItem(label, valueHtml, isEmpty = false) {
    const value = isEmpty || !valueHtml
      ? `<div class="projekt-erstellen-summary-value projekt-erstellen-summary-value--empty">${EMPTY_PLACEHOLDER}</div>`
      : `<div class="projekt-erstellen-summary-value">${valueHtml}</div>`;
    return `
      <div class="projekt-erstellen-summary-item">
        <div class="projekt-erstellen-summary-label">${label}</div>
        ${value}
      </div>
    `;
  }

  buildStep1(formData) {
    const a = formData.auftrag || {};

    const unternehmenLabel = resolveOptionLabel('field-pe-unternehmen_id', a.unternehmen_id) || (looksLikeUuid(a.unternehmen_id) ? null : a.unternehmen_id);
    const markeLabel = resolveOptionLabel('field-pe-marke_id', a.marke_id) || (looksLikeUuid(a.marke_id) ? null : a.marke_id);
    const apLabel = resolveOptionLabel('field-pe-ansprechpartner_id', a.ansprechpartner_id) || (looksLikeUuid(a.ansprechpartner_id) ? null : a.ansprechpartner_id);

    const artLabel = AUFTRAG_TYPES.find(t => t.value === a.auftragtype)?.label || null;

    const zeitraum = a.start || a.ende
      ? `${formatDate(a.start)} – ${formatDate(a.ende)}`
      : null;

    return `
      ${this.renderItem('Unternehmen', unternehmenLabel, !unternehmenLabel)}
      ${this.renderItem('Marke', markeLabel, !markeLabel)}
      ${this.renderItem('Ansprechpartner', apLabel, !apLabel)}
      ${this.renderItem('Art des Auftrags', artLabel, !artLabel)}
      ${this.renderItem('Zeitraum', zeitraum, !zeitraum)}
      ${this.renderItem('Titel', a.titel || null, !a.titel)}
    `;
  }

  buildCampaignBudgetBlocks(d) {
    const budgets = d.campaign_budgets || {};
    const types = d.campaign_type || [];
    if (!types.length) return '';

    const rangeOrDash = (vonRaw, bisRaw) => {
      const von = vonRaw != null && vonRaw !== '' ? formatCurrency(vonRaw) : null;
      const bis = bisRaw != null && bisRaw !== '' ? formatCurrency(bisRaw) : null;
      if (!von && !bis) return null;
      if (von && bis) return `${von} – ${bis}`;
      return von || bis;
    };

    return types.map(chipValue => {
      const label = CAMPAIGN_TYPES.find(t => t.value === chipValue)?.label || chipValue;
      const b = budgets[chipValue] || {};
      const ek = rangeOrDash(b.einkaufspreis_netto_von, b.einkaufspreis_netto_bis);
      const vk = rangeOrDash(b.verkaufspreis_netto_von, b.verkaufspreis_netto_bis);
      const info = (b.budget_info || '').trim() || null;

      const rows = [
        this.renderItem('Einkauf (Netto)', ek, !ek),
        this.renderItem('Verkauf (Netto)', vk, !vk)
      ];
      if (info) {
        rows.push(this.renderItem('Budget-Info', this.escapeHtml(info), false));
      }

      return `
        <div class="projekt-erstellen-summary-item">
          <div class="projekt-erstellen-summary-label" style="font-weight:600;">${this.escapeHtml(label)}</div>
        </div>
        ${rows.join('')}
      `;
    }).join('');
  }

  escapeHtml(v) {
    if (v == null) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  buildStep2(formData) {
    const d = formData.details || {};
    const a = formData.auftrag || {};

    let agencyBlock = '';
    if (d.agency_services_enabled) {
      const retainer = RETAINER_TYPES.find(t => t.value === d.retainer_type)?.label || d.retainer_type;
      const retainerLine = d.retainer_type && d.retainer_type !== 'none'
        ? `${retainer}: ${formatCurrency(d.retainer_amount)}`
        : null;

      const extraCount = d.extra_services_enabled
        ? (d.extra_services || []).filter(e => e?.name).length
        : 0;
      const extraLine = d.extra_services_enabled && extraCount > 0
        ? `${extraCount} Zusatzleistung${extraCount === 1 ? '' : 'en'}`
        : null;

      const pctLine = d.percentage_fee_enabled
        ? `${d.percentage_fee_value || 0} % auf ${FEE_BASES.find(b => b.value === d.percentage_fee_base)?.label || d.percentage_fee_base}`
        : null;

      const kskLine = d.ksk_enabled
        ? (d.ksk_type === 'percentage' ? `${d.ksk_value || 0} %` : formatCurrency(d.ksk_value))
        : null;

      agencyBlock = `
        ${this.renderItem('Retainer', retainerLine, !retainerLine)}
        ${this.renderItem('Zusatzleistungen', extraLine, !extraLine)}
        ${this.renderItem('Prozentuale Vergütung', pctLine, !pctLine)}
        ${this.renderItem('KSK', kskLine, !kskLine)}
      `;
    } else {
      agencyBlock = this.renderItem('Agenturleistungen', 'Deaktiviert', false);
    }

    return `
      ${agencyBlock}
      ${this.renderItem('Netto', a.nettobetrag != null && a.nettobetrag !== '' ? formatCurrency(a.nettobetrag) : null, a.nettobetrag == null || a.nettobetrag === '')}
      ${this.renderItem('Brutto', a.bruttobetrag != null && a.bruttobetrag !== '' ? formatCurrency(a.bruttobetrag) : null, a.bruttobetrag == null || a.bruttobetrag === '')}
      ${this.renderItem('Angebotsnummer', a.angebotsnummer || null, !a.angebotsnummer)}
      ${this.renderItem('Rechnungsnummer', a.re_nr || null, !a.re_nr)}
    `;
  }

  buildStep3Kampagnenarten(formData) {
    const d = formData.details || {};
    const campaignTypeLabels = (d.campaign_type || [])
      .map(v => CAMPAIGN_TYPES.find(t => t.value === v)?.label || v)
      .join(', ');
    const campaignBudgetBlocks = this.buildCampaignBudgetBlocks(d);

    return `
      ${this.renderItem('Kampagnenarten', campaignTypeLabels, !campaignTypeLabels)}
      ${campaignBudgetBlocks}
    `;
  }

  buildStep4(formData) {
    const k = formData.kampagne || {};
    const name = k.kampagnenname || null;
    const dreh = k.start || k.deadline
      ? `${formatDate(k.start)} – ${formatDate(k.deadline)}`
      : null;

    return `
      ${this.renderItem('Kampagnenname', name, !name)}
      ${this.renderItem('Zeitraum', dreh, !dreh)}
      ${this.renderItem('Creator-Anzahl', k.creatoranzahl || null, !k.creatoranzahl)}
      ${this.renderItem('Video-Anzahl', k.videoanzahl || null, !k.videoanzahl)}
      <div class="projekt-erstellen-summary-item">
        <div class="projekt-erstellen-summary-label">Projekt wird gespeichert</div>
        <div class="projekt-erstellen-summary-value">Auftrag + Auftragsdetails + Kampagne</div>
      </div>
    `;
  }
}
