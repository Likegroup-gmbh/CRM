// StepKampagne.js
// Dritter Wizard-Step (Non-Contracting): Projektname + eine Kampagne
// (voller Topf + Kampagnenarten) + Agenturleistungen einmal unten.
// Edit von Altsplits zeigt die bestehenden Karten, legt aber keine neue an.

import { TitelGenerator } from '../components/TitelGenerator.js';
import { AgencyServicesBlock } from '../components/AgencyServicesBlock.js';
import { icon } from '../../../core/icons/IconSystem.js';
import { parseCurrencyInput } from '../../../core/utils/parseCurrency.js';
import {
  distributeKampagnen,
  flattenCampaignBlocks,
  kampagnenSplitHint,
  parentTotals,
  reallocateFromEdited,
  removeKampagneSlot,
  seedSlotBlocksFromDetails
} from '../logic/kampagnenSplit.js';
import {
  aggregateCampaignBlocksForLegacy,
  getCampaignTypesFromBlocks
} from '../logic/CampaignBudgetFields.js';
import {
  ensureProjektErstellenSharedStyles,
  StepKampagnenarten
} from './StepKampagnenarten.js';

export class StepKampagne {
  constructor(wizard) {
    this.wizard = wizard;
    this.host = null;
    this.titelGenerator = null;
    this.artenSteps = [];
    this.agencyBlock = null;
  }

  render(host) {
    this.host = host;
    const a = this.wizard.formData.auftrag || {};
    this._syncFromParents();

    host.innerHTML = `
      <div class="form-section projekt-erstellen-section-stack">

        <div class="projekt-erstellen-titel-wrap">
          <div class="form-field">
            <label for="field-pe-titel">Projektname <span class="required">*</span></label>
            <input type="text" id="field-pe-titel" name="titel" value="${this.escape(a.titel)}" placeholder="Wird aus Unternehmen, Art und Startdatum generiert..." autocomplete="off">
          </div>
          <button type="button" class="mdc-btn mdc-btn--secondary" id="pe-titel-reset-btn" title="Vorschlag zurücksetzen" style="display:none;">Vorschlag nutzen</button>
        </div>

        <div class="projekt-erstellen-subsection">
          <div id="pe-kampagnen-slots-host"></div>
          <div id="pe-kampagnen-split-hint" class="projekt-erstellen-umsatz-hint" style="display:none;"></div>
        </div>

        <div id="pe-agency-host"></div>

      </div>
    `;

    this._renderSlots();
  }

  escape(v) {
    if (v == null) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  _kampagnenCount() {
    const slots = this.wizard.formData.kampagnen;
    if (Array.isArray(slots) && slots.length > 0) return slots.length;
    return 1;
  }

  _setKampagnen(slots) {
    const fd = this.wizard.formData;
    if (!fd.auftrag) fd.auftrag = {};
    fd.kampagnen = slots;
    fd.auftrag.kampagnenanzahl = slots.length;
    fd._kampagnenSplitFrom = { ...parentTotals(fd) };
    this._mirrorDetails();
  }

  _syncFromParents() {
    const fd = this.wizard.formData;
    if (!fd.auftrag) fd.auftrag = {};
    const totals = parentTotals(fd);
    const slots = Array.isArray(fd.kampagnen) ? fd.kampagnen : [];

    if (!this.wizard.isEditMode && slots.length !== 1) {
      const blocks = flattenCampaignBlocks(fd);
      const first = slots[0] || {};
      this._setKampagnen([distributeKampagnen(1, totals, [{
        ...first,
        campaign_blocks: blocks.length ? blocks : (first.campaign_blocks || [])
      }])[0]]);
      return;
    }

    if (!this.wizard.isEditMode && slots.length === 1 && slots[0].volumen !== totals.volumen) {
      this._setKampagnen(distributeKampagnen(1, totals, slots));
      return;
    }

    const prev = fd._kampagnenSplitFrom;

    if (slots.length === 0) {
      this._setKampagnen(seedSlotBlocksFromDetails({
        ...fd,
        kampagnen: distributeKampagnen(1, totals)
      }));
      return;
    }

    fd.auftrag.kampagnenanzahl = slots.length;

    if (!prev) {
      fd._kampagnenSplitFrom = { ...totals };
      return;
    }

    if (prev.volumen !== totals.volumen) {
      this._setKampagnen(distributeKampagnen(slots.length, totals, slots));
    }
  }

  _addSlot() {
    return;
  }

  _removeSlot(index) {
    this._collectArten();
    this._collectSlotsFromDom();
    const fd = this.wizard.formData;
    this._setKampagnen(removeKampagneSlot(fd.kampagnen || [], index));
  }

  _mirrorDetails() {
    if (!this.wizard.formData.details) this.wizard.formData.details = {};
    const all = flattenCampaignBlocks(this.wizard.formData);
    this.wizard.formData.details.campaign_blocks = all;
    this.wizard.formData.details.campaign_type = getCampaignTypesFromBlocks(all);
    this.wizard.formData.details.campaign_budgets = aggregateCampaignBlocksForLegacy(all);
  }

  _el(selector) {
    return this.host?.querySelector(selector) || null;
  }

  _renderSlots() {
    const host = this._el('#pe-kampagnen-slots-host');
    if (!host) return;

    this._collectArten();
    this._collectSlotsFromDom();

    const slots = this.wizard.formData.kampagnen || [];
    const count = slots.length;

    host.innerHTML = slots.map((slot, i) => `
      <div class="pe-kampagne-slot" data-kampagne-index="${i}">
        <div class="projekt-erstellen-campaign-block-header">
          <h5 class="section-subtitle">Kampagne ${i + 1} von ${count}</h5>
          ${count > 1 ? `<button type="button" class="btn-icon btn-danger-icon" data-action="remove-kampagne" data-kampagne-index="${i}" title="Kampagne entfernen" aria-label="Kampagne entfernen">${icon('trash-alt')}</button>` : ''}
        </div>
        <div class="form-field">
          <label>Name</label>
          <input type="text" class="pe-kampagne-name" data-kampagne-index="${i}" value="${this.escape(slot.eigener_name)}" placeholder="Optional, sonst Projektname" autocomplete="off">
        </div>
        ${this.wizard.isEditMode && count > 1 ? `
        <div class="form-field">
          <label>Volumen (€)</label>
          <input type="text" inputmode="decimal" class="pe-kampagne-volumen" data-kampagne-index="${i}" value="${slot.volumen ?? ''}">
        </div>` : `
        <div class="form-field">
          <label>Volumen</label>
          <div class="mdc-input mdc-input--readonly">${slot.volumen ?? 0} € · gesamter Auftrags-Topf</div>
        </div>`}
        <div id="pe-slot-${i}-arten-host"></div>
      </div>
    `).join('');

    this._bindSlotEvents(host);
    this._mountArten();
    this._updateHint();
  }

  _bindSlotEvents(host) {
    host.querySelectorAll('.pe-kampagne-volumen').forEach(input => {
      input.addEventListener('paste', () => {
        setTimeout(() => {
          const parsed = parseCurrencyInput(input.value);
          if (parsed != null) input.value = parsed;
        }, 0);
      });
      input.addEventListener('input', () => {
        const idx = parseInt(input.dataset.kampagneIndex, 10);
        if (!Number.isInteger(idx)) return;
        const parsed = parseCurrencyInput(input.value) || 0;
        const totals = parentTotals(this.wizard.formData);
        const capped = totals.volumen > 0 ? Math.min(totals.volumen, Math.max(0, parsed)) : Math.max(0, parsed);
        this.wizard.formData.kampagnen = reallocateFromEdited(
          this.wizard.formData.kampagnen,
          idx,
          capped,
          totals
        );
        if (totals.volumen > 0 && parsed > totals.volumen) input.value = capped;
        this._syncOtherVolumenInputs(idx);
        this._updateHint();
        this.wizard.updateFeedback();
      });
    });

    host.querySelectorAll('.pe-kampagne-name').forEach(input => {
      input.addEventListener('input', () => {
        const idx = parseInt(input.dataset.kampagneIndex, 10);
        if (!Number.isInteger(idx)) return;
        const slots = this.wizard.formData.kampagnen || [];
        if (!slots[idx]) return;
        const name = input.value.trim();
        slots[idx].eigener_name = name || null;
        this.wizard.updateFeedback();
      });
    });

    host.querySelectorAll('[data-action="remove-kampagne"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.kampagneIndex, 10);
        if (!Number.isInteger(idx)) return;
        this._removeSlot(idx);
        this._renderSlots();
        this.wizard.updateFeedback();
      });
    });
  }

  _syncOtherVolumenInputs(keepIndex) {
    (this.wizard.formData.kampagnen || []).forEach((slot, i) => {
      if (i === keepIndex) return;
      const el = this._el(`.pe-kampagne-volumen[data-kampagne-index="${i}"]`);
      if (el) el.value = slot.volumen ?? '';
    });
  }

  _collectSlotsFromDom() {
    const slots = this.wizard.formData.kampagnen || [];
    const focused = this.host?.querySelector('.pe-kampagne-volumen:focus');
    const focusedIdx = focused ? parseInt(focused.dataset.kampagneIndex, 10) : NaN;
    slots.forEach((slot, i) => {
      const nameEl = this._el(`.pe-kampagne-name[data-kampagne-index="${i}"]`);
      if (nameEl) slot.eigener_name = nameEl.value.trim() || null;
      if (slots.length > 1 && i !== focusedIdx) return;
      const volEl = this._el(`.pe-kampagne-volumen[data-kampagne-index="${i}"]`);
      if (volEl) slot.volumen = parseCurrencyInput(volEl.value) || 0;
    });
    if (slots.length > 1 && Number.isInteger(focusedIdx)) {
      this.wizard.formData.kampagnen = reallocateFromEdited(
        slots,
        focusedIdx,
        slots[focusedIdx].volumen,
        parentTotals(this.wizard.formData)
      );
    }
  }

  _collectArten() {
    this.artenSteps.forEach(step => {
      if (step?.collectData) step.collectData();
    });
  }

  _mountArten() {
    this.artenSteps.forEach(step => {
      if (step?.destroy) step.destroy();
    });
    const slots = this.wizard.formData.kampagnen || [];
    this.artenSteps = slots.map((_, i) => {
      const artenHost = this._el(`#pe-slot-${i}-arten-host`);
      if (!artenHost) return null;
      const step = new StepKampagnenarten(this.wizard, {
        slotIndex: i,
        onBlocksChange: () => {
          this._mirrorDetails();
          this._updateHint();
          this.wizard.updateFeedback();
        }
      });
      step.render(artenHost);
      step.bindEvents();
      return step;
    }).filter(Boolean);
  }

  _updateHint() {
    const hint = this._el('#pe-kampagnen-split-hint');
    if (!hint) return;
    const result = kampagnenSplitHint(this.wizard.formData.kampagnen, parentTotals(this.wizard.formData));
    const message = typeof result === 'string' ? result : result?.message;
    if (!message) {
      hint.style.display = 'none';
      hint.textContent = '';
      hint.classList.remove('projekt-erstellen-umsatz-hint--info');
      return;
    }
    hint.style.display = '';
    hint.textContent = message;
    hint.classList.toggle('projekt-erstellen-umsatz-hint--info', result?.kind === 'info');
  }

  async onEnter() {
    ensureProjektErstellenSharedStyles();
    this.recomputeTitle();
    this._syncFromParents();
    this._renderSlots();
  }

  bindEvents() {
    this.titelGenerator = new TitelGenerator({
      rootEl: this.host,
      onChange: ({ titel, manual, reset }) => {
        if (reset) {
          this.wizard.formData.auftrag.titel_manuell_geaendert = false;
          this.recomputeTitle();
          this.wizard.updateFeedback();
          return;
        }
        this.wizard.formData.auftrag.titel = titel || '';
        this.wizard.formData.auftrag.titel_manuell_geaendert = !!manual;
        this.wizard.updateFeedback();
      }
    });
    this.titelGenerator.bind('field-pe-titel', 'pe-titel-reset-btn');
    this.titelGenerator.setInitial(
      this.wizard.formData.auftrag.titel,
      this.wizard.formData.auftrag.titel_manuell_geaendert
    );

    this._mountAgency();
  }

  _mountAgency() {
    if (!this._el('#pe-agency-host')) return;
    this.agencyBlock = new AgencyServicesBlock({
      hostId: 'pe-agency-host',
      data: this.wizard.formData.details,
      mode: 'full',
      onChange: (val) => {
        this.wizard.formData.details = { ...this.wizard.formData.details, ...val };
        this.wizard.updateFeedback();
      }
    });
    this.agencyBlock.render();
  }

  recomputeTitle() {
    if (!this.titelGenerator) return;
    const a = this.wizard.formData.auftrag;
    const basisdatenStep = this.wizard.steps?.find(s => s.constructor.name === 'StepBasisdaten');
    if (!basisdatenStep) return;
    const unternehmenOption = basisdatenStep.unternehmenOptions?.find(o => o.value === a.unternehmen_id);
    const displayName = unternehmenOption?.internes_kuerzel || unternehmenOption?.label || null;
    this.titelGenerator.recompute({
      unternehmensname: displayName,
      auftragType: a.auftragtype,
      startDate: a.start
    });
  }

  attachLiveUpdate(handler) {
    // Updates laufen direkt ueber TitelGenerator + Slots + Arten + Agency.
  }

  isMounted() {
    return Boolean(this._el('#pe-kampagnen-slots-host'));
  }

  collectData() {
    this._collectSlotsFromDom();
    this._collectArten();
    this._mirrorDetails();

    const titelInput = this._el('#field-pe-titel');
    const titel = titelInput ? titelInput.value : (this.wizard.formData.auftrag.titel || '');
    const kampagnenanzahl = this._kampagnenCount();

    const agencyData = this.agencyBlock ? this.agencyBlock.getValue() : {};
    const blocks = flattenCampaignBlocks(this.wizard.formData);

    return {
      auftrag: {
        titel,
        titel_manuell_geaendert: this.wizard.formData.auftrag.titel_manuell_geaendert,
        kampagnenanzahl
      },
      details: {
        ...agencyData,
        campaign_blocks: blocks,
        campaign_type: getCampaignTypesFromBlocks(blocks),
        campaign_budgets: aggregateCampaignBlocksForLegacy(blocks)
      },
      kampagne: {},
      kampagnen: this.wizard.formData.kampagnen || []
    };
  }

  destroy() {
    this.titelGenerator = null;
    this.artenSteps.forEach(step => {
      if (step?.destroy) step.destroy();
    });
    this.artenSteps = [];
    this.agencyBlock = null;
  }
}
