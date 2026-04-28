// StepKampagnenarten.js
// Step 3 des Projekt-Erstellen-Flows:
// Kampagnenname + wiederholbare Kampagnenart-Bloecke.

import { CAMPAIGN_TYPES } from '../constants.js';
import {
  aggregateCampaignBlocksForLegacy,
  createCampaignBlock,
  generateBudgetBlockHtml,
  getCampaignTypesFromBlocks,
  normalizeCampaignBlocks,
  readBudgetValuesFromDom,
  CAMPAIGN_BLOCK_FIELD_SUFFIXES
} from '../logic/CampaignBudgetFields.js';

export class StepKampagnenarten {
  constructor(wizard) {
    this.wizard = wizard;
    this.host = null;
  }

  render(host) {
    this.host = host;
    const d = this.wizard.formData.details || {};
    const k = this.wizard.formData.kampagne || {};
    const a = this.wizard.formData.auftrag || {};
    const kampagnenname = k.kampagnenname || a.titel || '';
    if (!k.kampagnenname && kampagnenname) {
      this.wizard.formData.kampagne = { ...k, kampagnenname };
    }
    const blocks = normalizeCampaignBlocks(d);
    this.syncBlocksIntoState(blocks);

    host.innerHTML = `
      <div class="form-section projekt-erstellen-section-stack">
        <div class="form-field">
          <label for="field-pe-kampagnenname">Kampagnenname <span class="required">*</span></label>
          <input type="text" id="field-pe-kampagnenname" name="kampagnenname" value="${this.escape(kampagnenname)}" placeholder="z.B. Kampagnenname" autocomplete="off">
        </div>
        <div>
          <h5 class="section-subtitle" style="margin-bottom: var(--space-sm);">Kampagnenarten</h5>
          <div class="projekt-erstellen-campaign-add-row">
            <div class="form-field">
              <label for="pe-campaign-type-add">Kampagnenart hinzufügen</label>
              <select id="pe-campaign-type-add">
                ${CAMPAIGN_TYPES.map(ct => `<option value="${ct.value}">${ct.label}</option>`).join('')}
              </select>
            </div>
            <button type="button" class="secondary-btn" id="pe-add-campaign-block-btn">Hinzufügen</button>
          </div>
          <div id="pe-campaign-budgets-host" class="projekt-erstellen-budget-host"></div>
        </div>
      </div>
    `;
  }

  escape(v) {
    if (v == null) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  async onEnter() {}

  bindEvents() {
    const kampagnennameInput = document.getElementById('field-pe-kampagnenname');
    if (kampagnennameInput) {
      kampagnennameInput.addEventListener('input', (e) => {
        if (!this.wizard.formData.kampagne) this.wizard.formData.kampagne = {};
        this.wizard.formData.kampagne.kampagnenname = e.target.value || '';
        this.wizard.updateFeedback();
      });
    }

    const addBtn = document.getElementById('pe-add-campaign-block-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.addCampaignBlock());
    }

    this.renderBudgetSections();
    this.bindBudgetEvents();
  }

  attachLiveUpdate(handler) {
    // Updates laufen direkt ueber bindBudgetEvents + toggleChip.
  }

  addCampaignBlock() {
    this.collectBudgetsIntoState();
    const select = document.getElementById('pe-campaign-type-add');
    const campaignType = select?.value || CAMPAIGN_TYPES[0]?.value || 'ugc_paid';
    const blocks = normalizeCampaignBlocks(this.wizard.formData.details);
    blocks.push(createCampaignBlock(campaignType));
    this.syncBlocksIntoState(blocks);

    this.renderBudgetSections();
    this.bindBudgetEvents();
    this.wizard.updateFeedback();
  }

  removeCampaignBlock(blockId) {
    this.collectBudgetsIntoState();
    const blocks = normalizeCampaignBlocks(this.wizard.formData.details).filter(block => block.id !== blockId);
    this.syncBlocksIntoState(blocks);

    this.renderBudgetSections();
    this.bindBudgetEvents();
    this.wizard.updateFeedback();
  }

  syncBlocksIntoState(blocks) {
    if (!this.wizard.formData.details) this.wizard.formData.details = {};
    const normalized = (blocks || []).map(block => ({ ...block }));
    this.wizard.formData.details.campaign_blocks = normalized;
    this.wizard.formData.details.campaign_type = getCampaignTypesFromBlocks(normalized);
    this.wizard.formData.details.campaign_budgets = aggregateCampaignBlocksForLegacy(normalized);
  }

  renderBudgetSections() {
    const host = document.getElementById('pe-campaign-budgets-host');
    if (!host) return;

    const blocks = normalizeCampaignBlocks(this.wizard.formData.details);

    if (!blocks.length) {
      host.innerHTML = '<div class="projekt-erstellen-empty-note">Noch keine Kampagnenart hinzugefügt.</div>';
      return;
    }

    const html = blocks.map((block, index) => generateBudgetBlockHtml(block, CAMPAIGN_TYPES, index)).join('');

    host.innerHTML = html;
  }

  bindBudgetEvents() {
    const host = document.getElementById('pe-campaign-budgets-host');
    if (!host) return;

    const removeButtons = host.querySelectorAll('[data-action="remove-campaign-block"]');
    removeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const blockId = btn.dataset.blockId;
        if (blockId) this.removeCampaignBlock(blockId);
      });
    });

    const inputs = host.querySelectorAll('[data-block-id][data-field]');
    inputs.forEach(el => {
      const evt = el.tagName === 'TEXTAREA' || el.type === 'text' || el.type === 'number' ? 'input' : 'change';
      el.addEventListener(evt, () => {
        const blockId = el.dataset.blockId;
        const field = el.dataset.field;
        if (!blockId || !field) return;

        const blocks = normalizeCampaignBlocks(this.wizard.formData.details);
        const block = blocks.find(item => item.id === blockId);
        if (!block) return;

        if (field === 'budget_info' || field === 'kooperations_deadline') {
          block[field] = el.value || (field === 'budget_info' ? '' : null);
        } else {
          const raw = el.value;
          block[field] = raw === '' || raw == null ? null : (isNaN(parseFloat(raw)) ? null : parseFloat(raw));
        }

        this.syncBlocksIntoState(blocks);
        this.wizard.updateFeedback();
      });
    });
  }

  collectBudgetsIntoState() {
    const blocks = normalizeCampaignBlocks(this.wizard.formData.details);
    const nextBlocks = blocks.map(block => {
      const hasDom = CAMPAIGN_BLOCK_FIELD_SUFFIXES.some(s => document.getElementById(`pe-budget-${block.id}-${s}`));
      if (!hasDom) return block;
      return {
        ...block,
        ...readBudgetValuesFromDom(block.id),
        status: block.status || 'offen'
      }
    });
    this.syncBlocksIntoState(nextBlocks);
  }

  hasBlocks() {
    return normalizeCampaignBlocks(this.wizard.formData.details).length > 0;
  }

  collectData() {
    this.collectBudgetsIntoState();
    const blocks = normalizeCampaignBlocks(this.wizard.formData.details);
    return {
      kampagne: {
        kampagnenname: document.getElementById('field-pe-kampagnenname')?.value || ''
      },
      details: {
        campaign_blocks: blocks,
        campaign_type: getCampaignTypesFromBlocks(blocks),
        campaign_budgets: aggregateCampaignBlocksForLegacy(blocks)
      }
    };
  }

  destroy() {}
}
