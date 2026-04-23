// StepKampagnenarten.js
// Step 3 des Projekt-Erstellen-Flows:
// Auswahl der Kampagnenarten (Chips) + dynamische Budget-Bloecke pro Art.

import { CAMPAIGN_TYPES } from '../constants.js';
import {
  generateBudgetBlockHtml,
  readBudgetValuesFromDom,
  BUDGET_FIELD_SUFFIXES
} from '../logic/CampaignBudgetFields.js';

export class StepKampagnenarten {
  constructor(wizard) {
    this.wizard = wizard;
    this.host = null;
  }

  render(host) {
    this.host = host;
    const d = this.wizard.formData.details || {};
    const selected = new Set(d.campaign_type || []);

    host.innerHTML = `
      <div class="form-section projekt-erstellen-section-stack">
        <div>
          <h5 class="section-subtitle" style="margin-bottom: var(--space-sm);">Kampagnenarten</h5>
          <div class="projekt-erstellen-chip-group" id="pe-campaign-type-chips">
            ${CAMPAIGN_TYPES.map(ct => `
              <div class="projekt-erstellen-chip ${selected.has(ct.value) ? 'is-active' : ''}" data-value="${ct.value}" role="button" tabindex="0">
                ${ct.label}
              </div>
            `).join('')}
          </div>
          <div id="pe-campaign-budgets-host" class="projekt-erstellen-budget-host"></div>
        </div>
      </div>
    `;
  }

  async onEnter() {}

  bindEvents() {
    const chipGroup = document.getElementById('pe-campaign-type-chips');
    if (chipGroup) {
      chipGroup.addEventListener('click', (e) => {
        const chip = e.target.closest('.projekt-erstellen-chip');
        if (!chip) return;
        this.toggleChip(chip);
      });
      chipGroup.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const chip = e.target.closest('.projekt-erstellen-chip');
          if (chip) {
            e.preventDefault();
            this.toggleChip(chip);
          }
        }
      });
    }

    this.renderBudgetSections();
    this.bindBudgetEvents();
  }

  attachLiveUpdate(handler) {
    // Updates laufen direkt ueber bindBudgetEvents + toggleChip.
  }

  toggleChip(chip) {
    const value = chip.dataset.value;
    if (!value) return;

    this.collectBudgetsIntoState();

    const list = this.wizard.formData.details.campaign_type || [];
    const idx = list.indexOf(value);
    if (idx >= 0) {
      list.splice(idx, 1);
      chip.classList.remove('is-active');
    } else {
      list.push(value);
      chip.classList.add('is-active');
    }
    this.wizard.formData.details.campaign_type = list;

    this.renderBudgetSections();
    this.bindBudgetEvents();
    this.wizard.updateFeedback();
  }

  renderBudgetSections() {
    const host = document.getElementById('pe-campaign-budgets-host');
    if (!host) return;

    const active = this.wizard.formData.details.campaign_type || [];
    const budgets = this.wizard.formData.details.campaign_budgets || {};

    if (!active.length) {
      host.innerHTML = '';
      return;
    }

    const html = active.map(chipValue => {
      const label = CAMPAIGN_TYPES.find(t => t.value === chipValue)?.label || chipValue;
      const values = budgets[chipValue] || {};
      return generateBudgetBlockHtml(chipValue, label, values);
    }).join('');

    host.innerHTML = html;
  }

  bindBudgetEvents() {
    const host = document.getElementById('pe-campaign-budgets-host');
    if (!host) return;

    const inputs = host.querySelectorAll('input[data-chip], textarea[data-chip]');
    inputs.forEach(el => {
      const evt = el.tagName === 'TEXTAREA' || el.type === 'text' || el.type === 'number' ? 'input' : 'change';
      el.addEventListener(evt, () => {
        const chipValue = el.dataset.chip;
        const suffix = el.dataset.suffix;
        if (!chipValue || !suffix) return;

        if (!this.wizard.formData.details.campaign_budgets) {
          this.wizard.formData.details.campaign_budgets = {};
        }
        if (!this.wizard.formData.details.campaign_budgets[chipValue]) {
          this.wizard.formData.details.campaign_budgets[chipValue] = {};
        }

        if (suffix === 'budget_info') {
          this.wizard.formData.details.campaign_budgets[chipValue][suffix] = el.value || '';
        } else {
          const raw = el.value;
          this.wizard.formData.details.campaign_budgets[chipValue][suffix] =
            raw === '' || raw == null ? null : (isNaN(parseFloat(raw)) ? null : parseFloat(raw));
        }

        this.wizard.updateFeedback();
      });
    });
  }

  collectBudgetsIntoState() {
    const active = this.wizard.formData.details.campaign_type || [];
    if (!this.wizard.formData.details.campaign_budgets) {
      this.wizard.formData.details.campaign_budgets = {};
    }
    active.forEach(chipValue => {
      const values = readBudgetValuesFromDom(chipValue);
      const hasDom = BUDGET_FIELD_SUFFIXES.some(s => document.getElementById(`pe-budget-${chipValue}-${s}`));
      if (hasDom) {
        this.wizard.formData.details.campaign_budgets[chipValue] = values;
      }
    });
  }

  collectData() {
    this.collectBudgetsIntoState();
    return {
      details: {
        campaign_type: (this.wizard.formData.details.campaign_type || []).slice(),
        campaign_budgets: { ...(this.wizard.formData.details.campaign_budgets || {}) }
      }
    };
  }

  destroy() {}
}
