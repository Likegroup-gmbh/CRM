// StepAuftragstyp.js
// Step 1 des Projekt-Erstellen-Flows:
// Visuelle Auftragstyp-Auswahl mit Radio-Cards.

import { AUFTRAG_TYPES } from '../constants.js';
import { icon } from '../../../core/icons/IconSystem.js';

const TYPE_DESCRIPTIONS = {
  'Vorortproduktion': 'Vor-Ort-Produktionen mit Videographen und Fotografen.',
  'Contracting': 'Contracting-Aufträge ohne Kampagne.',
  'UGC/Influencer': 'UGC- und Influencer-Kampagnen mit Creator-Buchungen.'
};

export class StepAuftragstyp {
  constructor(wizard) {
    this.wizard = wizard;
  }

  render(host) {
    const current = this.wizard.formData.auftrag?.auftragtype || '';

    const cards = AUFTRAG_TYPES.map(t => `
      <label class="pe-type-card ${current === t.value ? 'pe-type-card--selected' : ''}" data-value="${t.value}">
        <input type="radio" name="pe-auftragtype" value="${t.value}"
               class="pe-type-card__radio" ${current === t.value ? 'checked' : ''}>
        <div class="pe-type-card__content">
          <span class="pe-type-card__title">${t.label}</span>
          <span class="pe-type-card__desc">${TYPE_DESCRIPTIONS[t.value] || ''}</span>
        </div>
      </label>
    `).join('');

    host.innerHTML = `
      <div class="pe-type-selection">
        <h2 class="pe-type-selection__title">Art des Auftrags wählen</h2>
        <p class="pe-type-selection__subtitle">Wählen Sie den Auftragstyp, um fortzufahren.</p>
        <div class="pe-type-card-list">
          ${cards}
        </div>
        <div class="pe-type-selection__actions">
          <button type="button" class="mdc-btn" id="pe-type-next-btn" ${current ? '' : 'disabled'}>
            <span>Weiter</span>
            ${icon('arrow-right')}
          </button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const cards = document.querySelectorAll('.pe-type-card');
    const nextBtn = document.getElementById('pe-type-next-btn');

    cards.forEach(card => {
      card.addEventListener('click', () => {
        const value = card.dataset.value;
        if (!value) return;

        cards.forEach(c => c.classList.remove('pe-type-card--selected'));
        card.classList.add('pe-type-card--selected');

        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;

        this.wizard.formData.auftrag.auftragtype = value;
        this.wizard.updateStepsForAuftragtype();
        this.wizard.ensurePoReserved();
        this.wizard.updateFeedback();

        if (nextBtn) nextBtn.disabled = false;
      });
    });

    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.wizard.navigate(1));
    }

    if (this.wizard.formData.auftrag?.auftragtype) {
      this.wizard.ensurePoReserved();
    }
  }

  isMounted() {
    return Boolean(document.querySelector('input[name="pe-auftragtype"]'));
  }

  collectData() {
    const checked = document.querySelector('input[name="pe-auftragtype"]:checked');
    return {
      auftrag: {
        auftragtype: checked?.value || this.wizard.formData.auftrag.auftragtype || null
      }
    };
  }

  destroy() {}
}
