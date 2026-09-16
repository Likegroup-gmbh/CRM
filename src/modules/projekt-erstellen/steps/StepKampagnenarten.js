// StepKampagnenarten.js
// Wiederholbare Kampagnenart-Bloecke, scoped auf eine Kampagne (Slot).

import { CAMPAIGN_TYPES } from '../constants.js';
import {
  aggregateCampaignBlocksForLegacy,
  createCampaignBlock,
  generateBudgetBlockHtml,
  getCampaignTypesFromBlocks,
  normalizeCampaignBlocks,
  readBudgetValuesFromDom,
  sumBlockUmsatz,
  CAMPAIGN_BLOCK_FIELD_SUFFIXES
} from '../logic/CampaignBudgetFields.js';
import { flattenCampaignBlocks } from '../logic/kampagnenSplit.js';

export function ensureProjektErstellenSharedStyles() {
  if (document.getElementById('projekt-erstellen-shared-styles')) return;
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
      border-top: var(--border-xs) solid var(--border-primary);
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
    .projekt-erstellen-umsatz-hint {
      margin-top: var(--space-sm);
      padding: var(--space-sm);
      border-radius: var(--radius-sm, 6px);
      background: var(--warning-50, #fff8e6);
      border: 1px solid var(--warning-300, #f0c869);
      color: var(--warning-800, #8a6100);
      font-size: var(--text-sm);
    }
    .projekt-erstellen-umsatz-hint--info {
      background: var(--gray-50, #f8f8f8);
      border-color: var(--border-primary, #e5e5e5);
      color: var(--gray-700, #444);
    }
  `;
  document.head.appendChild(style);
}

export class StepKampagnenarten {
  constructor(wizard, { slotIndex = 0, onBlocksChange } = {}) {
    this.wizard = wizard;
    this.slotIndex = slotIndex;
    this.scope = `pe-slot-${slotIndex}`;
    this.onBlocksChange = onBlocksChange || null;
    this.host = null;
  }

  render(host) {
    this.host = host;
    const blocks = this.getBlocks();
    this.syncBlocksIntoState(blocks);

    host.innerHTML = `
      <div class="pe-slot-arten">
        <h5 class="section-subtitle pe-kampagnenarten-subtitle">Kampagnenarten</h5>
        <div class="projekt-erstellen-campaign-add-row">
          <div class="form-field">
            <label for="${this.scope}-type-add">Kampagnenart hinzufügen</label>
            <select id="${this.scope}-type-add">
              ${CAMPAIGN_TYPES.map(ct => `<option value="${ct.value}">${ct.label}</option>`).join('')}
            </select>
          </div>
          <button type="button" class="mdc-btn mdc-btn--secondary" id="${this.scope}-add-btn">Hinzufügen</button>
        </div>
        <div id="${this.scope}-budgets" class="projekt-erstellen-budget-host"></div>
        <div id="${this.scope}-umsatz-hint" class="projekt-erstellen-umsatz-hint" style="display:none;"></div>
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
    ensureProjektErstellenSharedStyles();
  }

  getSlot() {
    return this.wizard.formData.kampagnen?.[this.slotIndex] || null;
  }

  getBlocks() {
    const slot = this.getSlot();
    return normalizeCampaignBlocks({ campaign_blocks: slot?.campaign_blocks || [] });
  }

  bindEvents() {
    const addBtn = this.host?.querySelector(`#${this.scope}-add-btn`);
    if (addBtn) {
      addBtn.addEventListener('click', () => this.addCampaignBlock());
    }

    this.renderBudgetSections();
    this.bindBudgetEvents();
  }

  attachLiveUpdate(handler) {
    // Updates laufen direkt ueber bindBudgetEvents.
  }

  addCampaignBlock() {
    this.collectBudgetsIntoState();
    const select = this.host?.querySelector(`#${this.scope}-type-add`);
    const campaignType = select?.value || CAMPAIGN_TYPES[0]?.value || 'ugc_paid';
    const blocks = this.getBlocks();
    blocks.push(createCampaignBlock(campaignType));
    this.syncBlocksIntoState(blocks);

    this.renderBudgetSections();
    this.bindBudgetEvents();
    this.wizard.updateFeedback();
    this.onBlocksChange?.();
  }

  removeCampaignBlock(blockId) {
    this.collectBudgetsIntoState();
    const blocks = this.getBlocks().filter(block => block.id !== blockId);
    this.syncBlocksIntoState(blocks);

    this.renderBudgetSections();
    this.bindBudgetEvents();
    this.wizard.updateFeedback();
    this.onBlocksChange?.();
  }

  syncBlocksIntoState(blocks) {
    const slot = this.getSlot();
    const normalized = (blocks || []).map(block => ({ ...block }));
    if (slot) {
      slot.campaign_blocks = normalized;
      const counts = normalized.reduce((sum, block) => {
        sum.videos += parseInt(block.video_anzahl, 10) || 0;
        sum.creators += parseInt(block.creator_anzahl, 10) || 0;
        return sum;
      }, { videos: 0, creators: 0 });
      slot.videoanzahl = counts.videos;
      slot.creatoranzahl = counts.creators;
    }
    this.mirrorToDetails();
    this.updateUmsatzHint(normalized);
  }

  mirrorToDetails() {
    if (!this.wizard.formData.details) this.wizard.formData.details = {};
    const all = flattenCampaignBlocks(this.wizard.formData);
    this.wizard.formData.details.campaign_blocks = all;
    this.wizard.formData.details.campaign_type = getCampaignTypesFromBlocks(all);
    this.wizard.formData.details.campaign_budgets = aggregateCampaignBlocksForLegacy(all);
  }

  updateUmsatzHint(blocks) {
    const hint = this.host?.querySelector(`#${this.scope}-umsatz-hint`);
    if (!hint) return;

    const { sum, hasAny } = sumBlockUmsatz(blocks);
    const slot = this.getSlot();
    const volumenRaw = slot?.volumen;
    const volumen = volumenRaw === '' || volumenRaw == null ? null : parseFloat(volumenRaw);

    if (!hasAny || volumen == null || isNaN(volumen) || Math.abs(sum - volumen) <= 1) {
      hint.style.display = 'none';
      hint.textContent = '';
      return;
    }

    const fmt = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    hint.style.display = '';
    hint.textContent = `Hinweis: Die Summe der Kampagnenart-Umsätze (${fmt(sum)} €) weicht vom Kampagnen-Volumen (${fmt(volumen)} €) ab.`;
  }

  renderBudgetSections() {
    const host = this.host?.querySelector(`#${this.scope}-budgets`);
    if (!host) return;

    const blocks = this.getBlocks();

    if (!blocks.length) {
      host.innerHTML = '<div class="projekt-erstellen-empty-note">Noch keine Kampagnenart hinzugefügt.</div>';
      return;
    }

    host.innerHTML = blocks.map((block, index) => generateBudgetBlockHtml(block, CAMPAIGN_TYPES, index)).join('');
  }

  bindBudgetEvents() {
    const host = this.host?.querySelector(`#${this.scope}-budgets`);
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

        const blocks = this.getBlocks();
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
        if (field === 'video_anzahl' || field === 'creator_anzahl') {
          this.onBlocksChange?.();
        }
      });
    });
  }

  collectBudgetsIntoState() {
    const blocks = this.getBlocks();
    const nextBlocks = blocks.map(block => {
      const hasDom = CAMPAIGN_BLOCK_FIELD_SUFFIXES.some(s => document.getElementById(`pe-budget-${block.id}-${s}`));
      if (!hasDom) return block;
      return {
        ...block,
        ...readBudgetValuesFromDom(block.id),
        status: block.status || 'offen'
      };
    });
    this.syncBlocksIntoState(nextBlocks);
  }

  hasBlocks() {
    return this.getBlocks().length > 0;
  }

  collectData() {
    this.collectBudgetsIntoState();
    return {
      kampagne: {},
      details: {},
      kampagnen: this.wizard.formData.kampagnen || []
    };
  }

  destroy() {
    this.host = null;
  }
}
