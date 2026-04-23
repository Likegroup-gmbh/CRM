// TitelGenerator.js
// Auto-Generierung des Auftrag-Titels: [Marke] - [Art] - [Monat Jahr].
// Sobald der User den Titel manuell aendert, wird titel_manuell_geaendert = true
// und Auto-Update deaktiviert (stabile Persistenz).

import { AUFTRAG_TYPES } from '../constants.js';

const MONTH_NAMES_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

export function generateAuftragTitle({ markeLabel, auftragType, startDate }) {
  const parts = [];

  if (markeLabel) parts.push(markeLabel);

  const artLabel = AUFTRAG_TYPES.find(t => t.value === auftragType)?.label;
  if (artLabel) parts.push(artLabel);

  if (startDate) {
    try {
      const d = typeof startDate === 'string' ? new Date(startDate) : startDate;
      if (!isNaN(d)) {
        parts.push(`${MONTH_NAMES_DE[d.getMonth()]} ${d.getFullYear()}`);
      }
    } catch (_) { /* noop */ }
  }

  return parts.join(' – ');
}

export class TitelGenerator {
  constructor({ rootEl, onChange }) {
    this.root = rootEl;
    this.onChange = onChange || (() => {});
    this.titleInput = null;
    this.resetBtn = null;
    this.manual = false;
  }

  setInitial(value, manualFlag) {
    this.manual = !!manualFlag;
    if (this.titleInput) {
      this.titleInput.value = value || '';
    }
    this.updateResetButton();
  }

  bind(titleInputId, resetBtnId) {
    this.titleInput = document.getElementById(titleInputId);
    this.resetBtn = document.getElementById(resetBtnId);

    if (this.titleInput) {
      this.titleInput.addEventListener('input', () => {
        this.manual = true;
        this.updateResetButton();
        this.onChange({ titel: this.titleInput.value, manual: true });
      });
    }

    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => {
        this.manual = false;
        this.updateResetButton();
        this.onChange({ reset: true });
      });
    }
  }

  recompute({ markeLabel, auftragType, startDate }) {
    if (this.manual) return;
    const generated = generateAuftragTitle({ markeLabel, auftragType, startDate });
    if (this.titleInput) {
      this.titleInput.value = generated;
    }
    this.onChange({ titel: generated, manual: false });
  }

  updateResetButton() {
    if (!this.resetBtn) return;
    this.resetBtn.style.display = this.manual ? '' : 'none';
  }

  isManual() {
    return this.manual;
  }
}
