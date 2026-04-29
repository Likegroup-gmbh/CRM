// TitelGenerator.js
// Auto-Generierung des Auftrag-Titels: [Kürzel] - [Startdatum] - [Art].
// Sobald der User den Titel manuell aendert, wird titel_manuell_geaendert = true
// und Auto-Update deaktiviert (stabile Persistenz).

import { AUFTRAG_TYPES } from '../constants.js';

const MONTH_NAMES_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

export function formatStartMonthYear(startDate) {
  if (!startDate) return null;
  try {
    const d = typeof startDate === 'string' ? new Date(startDate) : startDate;
    if (isNaN(d)) return null;
    return `${MONTH_NAMES_DE[d.getMonth()]} ${d.getFullYear()}`;
  } catch (_) { return null; }
}

export function generateAuftragTitle({ unternehmensname, auftragType, startDate }) {
  const parts = [];

  if (unternehmensname) parts.push(unternehmensname);

  const formatted = formatStartMonthYear(startDate);
  if (formatted) parts.push(formatted);

  const artLabel = AUFTRAG_TYPES.find(t => t.value === auftragType)?.label;
  if (artLabel) parts.push(artLabel);

  return parts.join(' - ');
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

  recompute({ unternehmensname, auftragType, startDate }) {
    if (this.manual) return;
    const generated = generateAuftragTitle({ unternehmensname, auftragType, startDate });
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
