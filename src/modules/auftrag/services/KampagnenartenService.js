import { getKampagnenartConfig, resolveKampagnenartName, generateBudgetOnlyFieldsHtml } from '../logic/KampagnenartenMapping.js';

export class KampagnenartenService {
  getSelectedKampagnenartIds() {
    const selectedIds = [];

    const hiddenSelect = document.getElementById('kampagnenart-select_hidden');
    if (hiddenSelect) {
      Array.from(hiddenSelect.selectedOptions).forEach(option => {
        if (option.value) selectedIds.push(option.value);
      });
    }

    if (selectedIds.length === 0) {
      const selectElement = document.getElementById('kampagnenart-select');
      if (selectElement) {
        Array.from(selectElement.selectedOptions).forEach(option => {
          if (option.value) selectedIds.push(option.value);
        });
      }
    }

    if (selectedIds.length === 0) {
      const tags = document.querySelectorAll('#kampagnenart-selection-section .tag');
      tags.forEach(tag => {
        const value = tag.dataset?.value;
        if (value) selectedIds.push(value);
      });
    }

    return selectedIds;
  }

  renderDynamicSections(kampagnenarten, existingValues = {}) {
    const container = document.getElementById('kampagnenart-sections-container');
    if (!container) return;

    if (!kampagnenarten || kampagnenarten.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <p>Wählen Sie oben die Kampagnenarten aus und klicken Sie auf "Aktivieren", um die Budget-Felder anzuzeigen.</p>
        </div>
      `;
      return;
    }

    let sectionsHtml = '';
    const renderedPrefixes = new Set();
    kampagnenarten.forEach(artName => {
      const config = getKampagnenartConfig(artName);
      if (config) {
        // Legacy-Namen können auf dieselbe kanonische Art zeigen – Sections deduplizieren
        if (renderedPrefixes.has(config.prefix)) return;
        renderedPrefixes.add(config.prefix);
        sectionsHtml += generateBudgetOnlyFieldsHtml(resolveKampagnenartName(artName), existingValues);
      } else {
        console.warn(`⚠️ Unbekannte Kampagnenart: "${artName}"`);
      }
    });

    container.innerHTML = sectionsHtml;
    this.bindVideoToggleEvents(container);
  }

  bindVideoToggleEvents(container) {
    container.querySelectorAll('input[data-video-toggle="true"]').forEach(toggle => {
      const targetId = toggle.dataset.target;
      const targetInput = targetId ? document.getElementById(targetId) : null;
      if (!targetInput) return;

      const fieldset = toggle.closest('fieldset[data-prefix]');
      const prefix = fieldset?.dataset?.prefix;
      const wrapper = prefix
        ? container.querySelector(`[data-video-anzahl-wrapper="${prefix}"]`)
        : targetInput.closest('[data-video-anzahl-wrapper]');

      const syncUi = () => {
        const isEnabled = Boolean(toggle.checked);
        if (wrapper) {
          wrapper.style.display = isEnabled ? '' : 'none';
        }
        if (!isEnabled) {
          targetInput.value = '';
        } else {
          targetInput.focus();
        }
      };

      toggle.addEventListener('change', syncUi);
      syncUi();
    });
  }
}

export const kampagnenartenService = new KampagnenartenService();
