// FeedbackCard.js
// Sticky Feedback-Card rechts neben dem Wizard. Zeigt Live-Zusammenfassung
// des aktuellen Steps. Nutzt bestehende .detail-card / .detail-section Klassen.

import { AUFTRAG_TYPES, CAMPAIGN_TYPES, RETAINER_TYPES } from '../constants.js';
import { normalizeCampaignBlocks } from '../logic/CampaignBudgetFields.js';

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

function formatNumber(value) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return EMPTY_PLACEHOLDER;
  return n.toLocaleString('de-DE');
}

function parseMoney(value) {
  if (value === '' || value == null) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value) {
  return Math.round((parseMoney(value) + Number.EPSILON) * 100) / 100;
}

function calculateAgencyDeductions(details = {}) {
  if (!details.agency_services_enabled) return { extraServicesTotal: 0, agencyFee: 0, ksk: 0, total: 0 };

  const extraServicesTotal = details.extra_services_enabled && Array.isArray(details.extra_services)
    ? details.extra_services.reduce((sum, item) => sum + parseMoney(item?.amount), 0)
    : 0;
  const agencyFee = details.percentage_fee_enabled ? parseMoney(details.percentage_fee_value) : 0;
  const ksk = details.ksk_enabled ? parseMoney(details.ksk_value) : 0;

  return {
    extraServicesTotal: roundMoney(extraServicesTotal),
    agencyFee: roundMoney(agencyFee),
    ksk: roundMoney(ksk),
    total: roundMoney(extraServicesTotal + agencyFee + ksk)
  };
}

function calculateCreatorBudget(auftrag = {}, details = {}) {
  if (auftrag.nettobetrag === '' || auftrag.nettobetrag == null) return null;
  const deductions = calculateAgencyDeductions(details);
  return roundMoney(Math.max(0, parseMoney(auftrag.nettobetrag) - deductions.total));
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
        <div class="detail-card-body">
          <div id="feedback-card-content" class="projekt-erstellen-summary-list"></div>
        </div>
      </div>
    `;
    this.update(this.wizard?.currentStep || 1, this.wizard?.formData || {});
  }

  update(currentStep, formData) {
    if (!this.host) return;

    const content = document.getElementById('feedback-card-content');
    if (!content) return;

    content.innerHTML = this.buildContent(formData);
  }

  buildContent(formData) {
    return `
      <div class="projekt-erstellen-summary-doc">
        ${this.renderSummarySection('Basisdaten', this.buildStep1(formData))}
        ${this.renderSummarySection('Details', this.buildStep2(formData))}
        ${this.renderSummarySection('Kampagne', this.buildKampagneSummary(formData))}
      </div>
    `;
  }

  renderSummarySection(title, contentHtml) {
    return `
      <section class="projekt-erstellen-summary-section">
        <div class="projekt-erstellen-summary-section-header">
          <h4>${title}</h4>
        </div>
        ${contentHtml}
      </section>
    `;
  }

  renderValue(valueHtml, isEmpty = false) {
    return isEmpty || !valueHtml
      ? `<div class="projekt-erstellen-summary-value projekt-erstellen-summary-value--empty">${EMPTY_PLACEHOLDER}</div>`
      : `<div class="projekt-erstellen-summary-value">${valueHtml}</div>`;
  }

  renderSummaryMetric(label, valueHtml, isEmpty = false) {
    return `
      <div class="projekt-erstellen-summary-metric">
        <div class="projekt-erstellen-summary-label">${label}</div>
        ${this.renderValue(valueHtml, isEmpty)}
      </div>
    `;
  }

  renderEntityMetric(label, entity, type = 'org') {
    const name = entity?.label || null;
    const imageUrl = entity?.imageUrl || null;
    const initial = name ? name.trim().charAt(0).toUpperCase() : '';

    const avatar = imageUrl
      ? `<span class="projekt-erstellen-summary-avatar projekt-erstellen-summary-avatar--${type}">
          <img src="${this.escapeAttr(imageUrl)}" alt="">
        </span>`
      : `<span class="projekt-erstellen-summary-avatar projekt-erstellen-summary-avatar--${type} projekt-erstellen-summary-avatar--placeholder">
          ${this.escapeHtml(initial || '–')}
        </span>`;

    const value = name
      ? `<div class="projekt-erstellen-summary-entity">${avatar}<span>${this.escapeHtml(name)}</span></div>`
      : null;

    return this.renderSummaryMetric(label, value, !name);
  }

  renderSummaryGrid(columns) {
    return `
      <div class="projekt-erstellen-summary-grid">
        ${columns.map(items => `
          <div class="projekt-erstellen-summary-grid-col">
            ${items.join('')}
          </div>
        `).join('')}
      </div>
    `;
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

    const unternehmen = this.resolveBasisdatenEntity('unternehmen', a.unternehmen_id);
    const marke = this.resolveBasisdatenEntity('marke', a.marke_id);
    const ap = this.resolveBasisdatenEntity('ansprechpartner', a.ansprechpartner_id);

    const artLabel = AUFTRAG_TYPES.find(t => t.value === a.auftragtype)?.label || null;

    const zeitraum = a.start || a.ende
      ? `${formatDate(a.start)} – ${formatDate(a.ende)}`
      : null;

    return this.renderSummaryGrid([
      [
        this.renderEntityMetric('Unternehmen', unternehmen, 'org'),
        this.renderEntityMetric('Marke', marke, 'org'),
        this.renderEntityMetric('Ansprechpartner', ap, 'person')
      ],
      [
        this.renderSummaryMetric('Art des Auftrags', artLabel, !artLabel),
        this.renderSummaryMetric('Zeitraum', zeitraum, !zeitraum),
        this.renderSummaryMetric('Titel', this.escapeHtml(a.titel || ''), !a.titel)
      ]
    ]);
  }

  resolveBasisdatenEntity(type, value) {
    if (!value) return null;

    const fallbackLabel = looksLikeUuid(value) ? null : value;
    if (type === 'unternehmen') {
      const option = this.wizard?.steps?.[0]?.unternehmenOptions?.find(o => o.value === value);
      const label = resolveOptionLabel('field-pe-unternehmen_id', value) || option?.label || fallbackLabel;
      return label ? {
        label,
        imageUrl: option?.logo_thumb_url || option?.logo_url || null
      } : null;
    }
    if (type === 'marke') {
      const allMarken = Array.from(this.wizard?.steps?.[0]?.markenOptionsByUnternehmen?.values?.() || []).flat();
      const option = allMarken.find(o => o.value === value);
      const label = resolveOptionLabel('field-pe-marke_id', value) || option?.label || fallbackLabel;
      return label ? {
        label,
        imageUrl: option?.logo_thumb_url || option?.logo_url || null
      } : null;
    }
    if (type === 'ansprechpartner') {
      const allAp = Array.from(this.wizard?.steps?.[0]?.ansprechpartnerOptionsByUnternehmen?.values?.() || []).flat();
      const option = allAp.find(o => o.value === value);
      const label = resolveOptionLabel('field-pe-ansprechpartner_id', value) || option?.label || fallbackLabel;
      return label ? {
        label,
        imageUrl: option?.profile_image_thumb_url || option?.profile_image_url || null
      } : null;
    }
    return fallbackLabel ? { label: fallbackLabel, imageUrl: null } : null;
  }

  buildCampaignBudgetBlocks(d) {
    const blocks = normalizeCampaignBlocks(d);
    if (!blocks.length) return '';

    const rangeOrDash = (vonRaw, bisRaw) => {
      const von = vonRaw != null && vonRaw !== '' ? formatCurrency(vonRaw) : null;
      const bis = bisRaw != null && bisRaw !== '' ? formatCurrency(bisRaw) : null;
      if (!von && !bis) return null;
      if (von && bis) return `${von} – ${bis}`;
      return von || bis;
    };

    return blocks.map((b, index) => {
      const label = CAMPAIGN_TYPES.find(t => t.value === b.campaign_type)?.label || b.campaign_type;
      const ek = rangeOrDash(b.einkaufspreis_netto_von, b.einkaufspreis_netto_bis);
      const vk = rangeOrDash(b.verkaufspreis_netto_von, b.verkaufspreis_netto_bis);
      const info = (b.budget_info || '').trim() || null;
      const videos = b.video_anzahl != null && b.video_anzahl !== '' ? formatNumber(b.video_anzahl) : null;
      const creators = b.creator_anzahl != null && b.creator_anzahl !== '' ? formatNumber(b.creator_anzahl) : null;
      const deadline = b.kooperations_deadline ? formatDate(b.kooperations_deadline) : null;
      const cell = (value, isEmpty = false) => isEmpty || !value
        ? `<span class="projekt-erstellen-summary-table-empty">${EMPTY_PLACEHOLDER}</span>`
        : value;

      return `
        <tr>
          <td class="col-campaign-type">${this.escapeHtml(label)}${index > 0 ? ` <span class="projekt-erstellen-summary-table-empty">#${index + 1}</span>` : ''}</td>
          <td class="col-deadline">${cell(deadline, !deadline)}</td>
          <td class="col-count">${cell(videos, !videos)}</td>
          <td class="col-count">${cell(creators, !creators)}</td>
          <td class="col-price">${cell(ek, !ek)}</td>
          <td class="col-price">${cell(vk, !vk)}</td>
          <td class="col-budget-info">${cell(info ? this.escapeHtml(info) : null, !info)}</td>
        </tr>
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

  escapeAttr(v) {
    if (v == null) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  buildStep2(formData) {
    const d = formData.details || {};
    const a = formData.auftrag || {};
    const creatorBudget = calculateCreatorBudget(a, d);

    let agencyBlock = '';
    let agencyLeft = [];
    if (d.agency_services_enabled) {
      const retainer = RETAINER_TYPES.find(t => t.value === d.retainer_type)?.label || d.retainer_type;
      const retainerLine = d.retainer_type && d.retainer_type !== 'none'
        ? `${retainer}: ${formatCurrency(d.retainer_amount)}`
        : null;

      const extraCount = d.extra_services_enabled
        ? (d.extra_services || []).filter(e => e?.name).length
        : 0;
      const deductions = calculateAgencyDeductions(d);
      const extraLine = d.extra_services_enabled && extraCount > 0
        ? `${extraCount} Zusatzleistung${extraCount === 1 ? '' : 'en'}: ${formatCurrency(deductions.extraServicesTotal)}`
        : null;

      const pctLine = d.percentage_fee_enabled
        ? formatCurrency(d.percentage_fee_value)
        : null;

      const kskLine = d.ksk_enabled
        ? formatCurrency(d.ksk_value)
        : null;

      agencyLeft = [
        this.renderSummaryMetric('Retainer', retainerLine, !retainerLine),
        this.renderSummaryMetric('Zusatzleistungen', extraLine, !extraLine),
        this.renderSummaryMetric('Agentur Fee', pctLine, !pctLine),
        this.renderSummaryMetric('KSK', kskLine, !kskLine)
      ];
    } else {
      agencyBlock = this.renderSummaryMetric('Agenturleistungen', 'Deaktiviert', false);
      agencyLeft = [agencyBlock];
    }

    return this.renderSummaryGrid([
      agencyLeft,
      [
        this.renderSummaryMetric('Auftrag Netto', a.nettobetrag != null && a.nettobetrag !== '' ? formatCurrency(a.nettobetrag) : null, a.nettobetrag == null || a.nettobetrag === ''),
        this.renderSummaryMetric('Gesamtbudget (netto)', creatorBudget != null ? formatCurrency(creatorBudget) : null, creatorBudget == null),
        this.renderSummaryMetric('Brutto', a.bruttobetrag != null && a.bruttobetrag !== '' ? formatCurrency(a.bruttobetrag) : null, a.bruttobetrag == null || a.bruttobetrag === ''),
        this.renderSummaryMetric('Angebotsnummer', this.escapeHtml(a.angebotsnummer || ''), !a.angebotsnummer),
        this.renderSummaryMetric('Rechnungsnummer', this.escapeHtml(a.re_nr || ''), !a.re_nr)
      ]
    ]);
  }

  buildStep3Kampagnenarten(formData) {
    const d = formData.details || {};
    const blocks = normalizeCampaignBlocks(d);
    const campaignTypeLabels = blocks
      .map(v => CAMPAIGN_TYPES.find(t => t.value === v.campaign_type)?.label || v.campaign_type)
      .join(', ');
    const campaignBudgetBlocks = this.buildCampaignBudgetBlocks(d);

    return `
      ${this.renderSummaryMetric('Kampagnenarten', this.escapeHtml(campaignTypeLabels), !campaignTypeLabels)}
      ${campaignBudgetBlocks ? `
        <div class="projekt-erstellen-summary-campaign-table-wrap">
          <table class="pe-summary-table projekt-erstellen-summary-campaign-table">
            <thead>
              <tr>
                <th>Kampagnenart</th>
                <th>Deadline</th>
                <th>Videos</th>
                <th>Creator</th>
                <th>Einkauf</th>
                <th>Verkauf</th>
                <th>Budget Info</th>
              </tr>
            </thead>
            <tbody>
              ${campaignBudgetBlocks}
            </tbody>
          </table>
        </div>
      ` : `
        <div class="projekt-erstellen-empty-note">Keine Kampagnenarten ausgewählt.</div>
      `}
    `;
  }

  buildKampagneSummary(formData) {
    const k = formData.kampagne || {};
    const a = formData.auftrag || {};
    const d = formData.details || {};
    const name = k.kampagnenname || null;
    const dreh = a.start || a.ende
      ? `${formatDate(a.start)} – ${formatDate(a.ende)}`
      : null;
    const totals = this.calculateCampaignTotals(normalizeCampaignBlocks(d));

    return `
      <div class="projekt-erstellen-summary-metrics">
        ${this.renderSummaryMetric('Kampagnenname', this.escapeHtml(name || ''), !name)}
        ${this.renderSummaryMetric('Zeitraum', dreh, !dreh)}
        ${this.renderSummaryMetric('Creator gesamt', formatNumber(totals.creators), false)}
        ${this.renderSummaryMetric('Videos gesamt', formatNumber(totals.videos), false)}
      </div>
      ${this.buildStep3Kampagnenarten(formData)}
    `;
  }

  calculateCampaignTotals(blocks) {
    return (blocks || []).reduce((sum, block) => {
      sum.videos += parseInt(block.video_anzahl, 10) || 0;
      sum.creators += parseInt(block.creator_anzahl, 10) || 0;
      return sum;
    }, { videos: 0, creators: 0 });
  }
}
