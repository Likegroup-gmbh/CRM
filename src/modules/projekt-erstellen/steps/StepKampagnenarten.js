// StepKampagnenarten.js
// Step 3 des Projekt-Erstellen-Flows:
// Kampagnenname + wiederholbare Kampagnenart-Bloecke + Agenturleistungen (nur UGC/Vorort).

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
import { AgencyServicesBlock } from '../components/AgencyServicesBlock.js';

export class StepKampagnenarten {
  constructor(wizard) {
    this.wizard = wizard;
    this.host = null;
    this.agencyBlock = null;
  }

  render(host) {
    this.host = host;
    const d = this.wizard.formData.details || {};
    const blocks = normalizeCampaignBlocks(d);
    this.syncBlocksIntoState(blocks);

    host.innerHTML = `
      <div class="projekt-erstellen-subsection">
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

        <div id="pe-agency-host"></div>
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

  async onEnter() {
    if (!document.getElementById('projekt-erstellen-shared-styles')) {
      const style = document.createElement('style');
      style.id = 'projekt-erstellen-shared-styles';
      style.textContent = `
        .projekt-erstellen-agency-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-md);
          margin-bottom: var(--space-sm);
        }
        .projekt-erstellen-subsection {
          border-top: var(--border-xs) solid var(--gray-200);
          padding-top: var(--space-md);
          margin-top: var(--space-md);
        }
        .projekt-erstellen-subsection:first-child {
          border-top: none;
          padding-top: 0;
          margin-top: 0;
        }
        .projekt-erstellen-subsection-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-sm);
          margin-bottom: var(--space-sm);
        }
        .section-subtitle {
          font-size: var(--text-sm);
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 var(--space-xs) 0;
        }
        .projekt-erstellen-extras-toolbar {
          display: flex;
          justify-content: flex-end;
          margin-bottom: var(--space-sm);
        }
      `;
      document.head.appendChild(style);
    }
  }

  bindEvents() {
    const addBtn = document.getElementById('pe-add-campaign-block-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.addCampaignBlock());
    }

    this.renderBudgetSections();
    this.bindBudgetEvents();

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

        if (field === 'budget_info') {
          block[field] = el.value || '';
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

    const agencyData = this.agencyBlock
      ? this.agencyBlock.getValue()
      : {};

    return {
      kampagne: {},
      details: {
        ...agencyData,
        campaign_blocks: blocks,
        campaign_type: getCampaignTypesFromBlocks(blocks),
        campaign_budgets: aggregateCampaignBlocksForLegacy(blocks)
      }
    };
  }

  destroy() {
    this.agencyBlock = null;
  }
}
