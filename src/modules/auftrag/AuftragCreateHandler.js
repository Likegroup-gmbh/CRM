// AuftragCreateHandler.js
// Verantwortlich für das Anlegen neuer Aufträge inkl. optionalem
// Split-View zum gleichzeitigen Erstellen der Auftragsdetails.
// Wurde aus AuftragList.js ausgelagert, um die Listen-Logik schlank zu halten.

import { generatePoNummer } from './logic/PoNummerGenerator.js';
import { getCurrentBenutzerId } from '../auth/CurrentUser.js';

export class AuftragCreateHandler {
  constructor() {
    this.embeddedKampagnenartTypen = [];
    this.embeddedSelectedKampagnenarten = [];
    this.embeddedSelectedKampagnenartIds = [];
    this._auftragsdetailsToggleHandler = null;
    this._updateToggleState = null;
  }

  // Einstiegspunkt, wird vom Router / ModuleRegistry aufgerufen
  showCreateForm() {
    window.setHeadline('Neuen Auftrag anlegen');

    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateDetailLabel('Neuer Auftrag');
    }

    const formHtml = window.formSystem.renderFormOnly('auftrag');
    const html = `
      <div class="form-split-container">
        <div class="form-split-left">
          <div class="form-page">
            ${formHtml}
          </div>
        </div>
        <div class="form-split-right hidden" id="auftragsdetails-split-container">
          <div class="form-split-header">
            <h2>Auftragsdetails</h2>
            <p class="form-hint">Die Auftragsdetails werden zusammen mit dem Auftrag gespeichert.</p>
          </div>
          <div id="auftragsdetails-embedded-form"></div>
        </div>
      </div>
    `;

    window.content.innerHTML = html;

    console.log('🔍 Nach innerHTML - Split-Container:', document.getElementById('auftragsdetails-split-container'));
    console.log('🔍 Nach innerHTML - form-split-container:', document.querySelector('.form-split-container'));

    window.formSystem.bindFormEvents('auftrag', null);

    console.log('🔍 Nach bindFormEvents - Split-Container:', document.getElementById('auftragsdetails-split-container'));

    setTimeout(() => {
      this.bindAuftragsdetailsToggle();
      this.setupFieldSynchronization();
    }, 100);

    const form = document.getElementById('auftrag-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      };
    }
  }

  /**
   * Bindet den Toggle Event-Handler für das Auftragsdetails Split-View
   */
  bindAuftragsdetailsToggle() {
    console.log('🎯 bindAuftragsdetailsToggle wird aufgerufen...');

    const toggle = document.getElementById('field-create_auftragsdetails');
    const splitContainer = document.getElementById('auftragsdetails-split-container');

    console.log('🔍 Toggle gefunden:', toggle);
    console.log('🔍 SplitContainer gefunden:', splitContainer);

    if (!toggle || !splitContainer) {
      console.warn('⚠️ Auftragsdetails Toggle oder Split-Container nicht gefunden');
      const allInputs = document.querySelectorAll('input[type="checkbox"]');
      console.log('📋 Alle Checkboxen im DOM:', Array.from(allInputs).map(i => ({ id: i.id, name: i.name })));
      return;
    }

    toggle.disabled = true;
    const toggleContainer = toggle.closest('.form-field');
    if (toggleContainer) {
      toggleContainer.style.opacity = '0.5';
      toggleContainer.title = 'Bitte zuerst ein Unternehmen auswählen';

      if (!document.getElementById('auftragsdetails-toggle-hint')) {
        const hint = document.createElement('small');
        hint.className = 'form-hint auftragsdetails-toggle-hint';
        hint.id = 'auftragsdetails-toggle-hint';
        hint.textContent = 'Erst Unternehmen auswählen, um Auftragsdetails direkt zu erstellen.';
        hint.style.color = 'var(--gray-500)';
        toggleContainer.appendChild(hint);
      }
    }

    console.log('✅ Toggle Setup abgeschlossen, disabled:', toggle.disabled);

    const handleToggleChange = async () => {
      const isActive = toggle.checked;
      console.log('🔄 Auftragsdetails Toggle geändert:', isActive);

      const unternehmenHidden = document.getElementById('field-unternehmen_id_value');
      const unternehmenSelect = document.getElementById('field-unternehmen_id');
      const unternehmenId = unternehmenHidden?.value || unternehmenSelect?.value;

      const markeHidden = document.getElementById('field-marke_id_value');
      const markeSelect = document.getElementById('field-marke_id');
      const markeId = markeHidden?.value || markeSelect?.value;

      const hatMarkenOptionen = markeSelect && markeSelect.options.length > 1;

      console.log('🔍 Unternehmen-ID:', unternehmenId, ', Marke-ID:', markeId, ', Hat Marken:', hatMarkenOptionen);

      if (isActive && !unternehmenId) {
        window.toastSystem?.show('Bitte zuerst ein Unternehmen auswählen', 'warning');
        toggle.checked = false;
        return;
      }

      if (isActive && hatMarkenOptionen && !markeId) {
        window.toastSystem?.show('Bitte zuerst eine Marke auswählen', 'warning');
        toggle.checked = false;
        return;
      }

      if (isActive) {
        console.log('📋 Aktiviere Split-View...');
        splitContainer.classList.remove('hidden');

        try {
          await this.renderEmbeddedAuftragsdetailsForm();
          console.log('✅ Embedded Form gerendert');
        } catch (err) {
          console.error('❌ Fehler beim Rendern des Embedded Forms:', err);
        }

        this.syncToAuftragsdetails();

        setTimeout(() => {
          const formContainer = document.querySelector('.form-split-container');
          if (formContainer) {
            formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }, 100);
      } else {
        console.log('📋 Deaktiviere Split-View...');
        splitContainer.classList.add('hidden');
      }
    };

    toggle.addEventListener('change', (e) => {
      console.log('🎯 Toggle change Event gefeuert, checked:', e.target.checked);
      handleToggleChange();
    });

    this._auftragsdetailsToggleHandler = handleToggleChange;
  }

  /**
   * Setup der Feld-Synchronisation zwischen Auftrag und Auftragsdetails
   */
  setupFieldSynchronization() {
    console.log('🔧 setupFieldSynchronization wird aufgerufen...');

    const updateToggleState = () => {
      const unternehmenHidden = document.getElementById('field-unternehmen_id_value');
      const unternehmenSelect = document.getElementById('field-unternehmen_id');
      const unternehmenId = unternehmenHidden?.value || unternehmenSelect?.value;

      const markeHidden = document.getElementById('field-marke_id_value');
      const markeSelect = document.getElementById('field-marke_id');
      const markeId = markeHidden?.value || markeSelect?.value;

      const hatMarkenOptionen = markeSelect && markeSelect.options.length > 1;

      console.log('🔄 updateToggleState:', { unternehmenId, markeId, hatMarkenOptionen });

      const toggle = document.getElementById('field-create_auftragsdetails');
      const toggleContainer = toggle?.closest('.form-field');
      const hint = document.getElementById('auftragsdetails-toggle-hint');

      if (!toggle) {
        console.warn('⚠️ Toggle nicht gefunden');
        return;
      }

      // Logik: Toggle aktivieren wenn:
      // 1. Unternehmen gewählt UND keine Marken verfügbar, ODER
      // 2. Unternehmen gewählt UND Marke gewählt
      const kannAktivieren = unternehmenId && (!hatMarkenOptionen || markeId);

      if (kannAktivieren) {
        toggle.disabled = false;
        if (toggleContainer) {
          toggleContainer.style.opacity = '1';
          toggleContainer.title = '';
        }
        if (hint) {
          hint.textContent = 'Auftragsdetails können jetzt erstellt werden.';
          hint.style.color = 'var(--primary-600)';
        }
        console.log('✅ Toggle aktiviert');
      } else if (unternehmenId && hatMarkenOptionen && !markeId) {
        toggle.disabled = true;
        toggle.checked = false;
        if (toggleContainer) {
          toggleContainer.style.opacity = '0.5';
          toggleContainer.title = 'Bitte zuerst eine Marke auswählen';
        }
        if (hint) {
          hint.textContent = 'Erst Marke auswählen, um Auftragsdetails direkt zu erstellen.';
          hint.style.color = 'var(--gray-500)';
        }
        const splitContainer = document.getElementById('auftragsdetails-split-container');
        if (splitContainer) splitContainer.classList.add('hidden');
        console.log('⏳ Toggle deaktiviert (Marke fehlt)');
      } else {
        toggle.disabled = true;
        toggle.checked = false;
        if (toggleContainer) {
          toggleContainer.style.opacity = '0.5';
          toggleContainer.title = 'Bitte zuerst ein Unternehmen auswählen';
        }
        if (hint) {
          hint.textContent = 'Erst Unternehmen auswählen, um Auftragsdetails direkt zu erstellen.';
          hint.style.color = 'var(--gray-500)';
        }
        const splitContainer = document.getElementById('auftragsdetails-split-container');
        if (splitContainer) splitContainer.classList.add('hidden');
        console.log('⏳ Toggle deaktiviert (Unternehmen fehlt)');
      }

      this.syncToAuftragsdetails();
    };

    const unternehmenSelect = document.getElementById('field-unternehmen_id');
    if (unternehmenSelect) {
      unternehmenSelect.addEventListener('change', updateToggleState);
      console.log('✅ Unternehmen Select Listener registriert');

      const unternehmenHidden = document.getElementById('field-unternehmen_id_value');
      if (unternehmenHidden) {
        const observer = new MutationObserver(updateToggleState);
        observer.observe(unternehmenHidden, { attributes: true, attributeFilter: ['value'] });
        unternehmenHidden.addEventListener('input', updateToggleState);
        console.log('✅ Unternehmen Hidden Input Observer registriert');
      }
    } else {
      console.warn('⚠️ Unternehmen Select nicht gefunden');
    }

    const markeSelect = document.getElementById('field-marke_id');
    if (markeSelect) {
      markeSelect.addEventListener('change', updateToggleState);
      console.log('✅ Marke Select Listener registriert');

      const markeHidden = document.getElementById('field-marke_id_value');
      if (markeHidden) {
        const observer = new MutationObserver(updateToggleState);
        observer.observe(markeHidden, { attributes: true, attributeFilter: ['value'] });
        markeHidden.addEventListener('input', updateToggleState);
        console.log('✅ Marke Hidden Input Observer registriert');
      }
    }

    const kampagnenanzahlInput = document.getElementById('field-kampagnenanzahl');
    if (kampagnenanzahlInput) {
      kampagnenanzahlInput.addEventListener('input', () => {
        this.syncToAuftragsdetails();
      });
    }

    this._updateToggleState = updateToggleState;
  }

  /**
   * Synchronisiert Werte vom Auftragsformular zum Auftragsdetails-Formular
   */
  syncToAuftragsdetails() {
    const splitContainer = document.getElementById('auftragsdetails-split-container');
    if (!splitContainer || splitContainer.classList.contains('hidden')) return;

    const unternehmenHidden = document.getElementById('field-unternehmen_id_value');
    const unternehmenSelect = document.getElementById('field-unternehmen_id');
    const unternehmenId = unternehmenHidden?.value || unternehmenSelect?.value;

    let firmenname = 'Kein Unternehmen ausgewählt';
    if (unternehmenSelect && unternehmenId) {
      const selectedOption = unternehmenSelect.querySelector(`option[value="${unternehmenId}"]`);
      firmenname = selectedOption?.textContent || firmenname;
    }

    const markeHidden = document.getElementById('field-marke_id_value');
    const markeSelect = document.getElementById('field-marke_id');
    const markeId = markeHidden?.value || markeSelect?.value;

    let markenname = '';
    if (markeSelect && markeId) {
      const selectedOption = markeSelect.querySelector(`option[value="${markeId}"]`);
      markenname = selectedOption?.textContent || '';
    }

    const unternehmenDisplay = document.getElementById('auftragsdetails-unternehmen-display');
    if (unternehmenDisplay) {
      const displayText = markenname ? `${firmenname} (${markenname})` : firmenname;
      unternehmenDisplay.textContent = displayText;
      unternehmenDisplay.dataset.unternehmenId = unternehmenId || '';
      unternehmenDisplay.dataset.markeId = markeId || '';
    }

    const kampagnenanzahlInput = document.getElementById('field-kampagnenanzahl');
    const kampagnenanzahlDisplay = document.getElementById('auftragsdetails-kampagnenanzahl');
    if (kampagnenanzahlDisplay && kampagnenanzahlInput) {
      kampagnenanzahlDisplay.value = kampagnenanzahlInput.value || '';
    }

    console.log('🔄 Felder synchronisiert:', { unternehmenId, firmenname, markeId, markenname, kampagnenanzahl: kampagnenanzahlInput?.value });
  }

  /**
   * Rendert das Embedded Auftragsdetails-Formular
   */
  async renderEmbeddedAuftragsdetailsForm() {
    const container = document.getElementById('auftragsdetails-embedded-form');
    if (!container) return;

    let kampagnenartTypen = [];
    try {
      const { data, error } = await window.supabase
        .from('kampagne_art_typen')
        .select('id, name')
        .order('sort_order, name');

      if (!error && data) {
        kampagnenartTypen = data;
      }
    } catch (e) {
      console.warn('⚠️ Kampagnenart-Typen konnten nicht geladen werden:', e);
    }

    const unternehmenHidden = document.getElementById('field-unternehmen_id_value');
    const unternehmenSelect = document.getElementById('field-unternehmen_id');
    const unternehmenId = unternehmenHidden?.value || unternehmenSelect?.value;
    let firmenname = 'Kein Unternehmen ausgewählt';
    if (unternehmenSelect && unternehmenId) {
      const selectedOption = unternehmenSelect.querySelector(`option[value="${unternehmenId}"]`);
      firmenname = selectedOption?.textContent || firmenname;
    }

    const markeHidden = document.getElementById('field-marke_id_value');
    const markeSelect = document.getElementById('field-marke_id');
    const markeId = markeHidden?.value || markeSelect?.value;
    let markenname = '';
    if (markeSelect && markeId) {
      const selectedOption = markeSelect.querySelector(`option[value="${markeId}"]`);
      markenname = selectedOption?.textContent || '';
    }

    const displayText = markenname ? `${firmenname} (${markenname})` : firmenname;

    const kampagnenanzahl = document.getElementById('field-kampagnenanzahl')?.value || '';

    const formHtml = `
      <div class="auftragsdetails-embedded">
        <div class="auftragsdetails-sync-info">
          <div class="sync-info-item">
            <span class="sync-info-label">Unternehmen:</span>
            <span class="sync-info-value" id="auftragsdetails-unternehmen-display" data-unternehmen-id="${unternehmenId || ''}" data-marke-id="${markeId || ''}">${displayText}</span>
          </div>
          <div class="sync-info-item">
            <span class="sync-info-label">Kampagnenanzahl:</span>
            <input type="number" id="auftragsdetails-kampagnenanzahl" class="sync-info-input" value="${kampagnenanzahl}" readonly>
          </div>
        </div>

        <div class="form-field">
          <label for="auftragsdetails-kampagnenart">Art der Kampagne</label>
          <select id="auftragsdetails-kampagnenart"
                  name="auftragsdetails_art_der_kampagne"
                  multiple
                  data-searchable="true"
                  data-tag-based="true"
                  data-placeholder="Kampagnenart suchen und auswählen...">
            ${kampagnenartTypen.map(typ => `<option value="${typ.id}">${typ.name}</option>`).join('')}
          </select>
          <small class="form-hint">Wählen Sie die Kampagnenarten und klicken Sie auf "Aktivieren".</small>
        </div>

        <div class="kampagnenart-activate-actions">
          <button type="button" id="auftragsdetails-activate-btn" class="mdc-btn mdc-btn--secondary">
            <span class="mdc-btn__label">Aktivieren</span>
          </button>
        </div>

        <div id="auftragsdetails-budget-sections">
          <div class="alert alert-info">
            <p>Wählen Sie oben die Kampagnenarten aus und klicken Sie auf "Aktivieren", um die Budget-Felder anzuzeigen.</p>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = formHtml;

    const selectElement = document.getElementById('auftragsdetails-kampagnenart');
    if (selectElement && window.formSystem?.optionsManager?.createTagBasedSelect) {
      const options = kampagnenartTypen.map(typ => ({
        value: typ.id,
        label: typ.name,
        selected: false
      }));

      const field = {
        name: 'auftragsdetails_art_der_kampagne',
        tagBased: true,
        placeholder: 'Kampagnenart suchen und auswählen...'
      };

      window.formSystem.optionsManager.createTagBasedSelect(selectElement, options, field);
      console.log('✅ TagBased-Multiselect für embedded Auftragsdetails initialisiert');
    }

    const activateBtn = document.getElementById('auftragsdetails-activate-btn');
    if (activateBtn) {
      activateBtn.addEventListener('click', async () => {
        await this.activateEmbeddedKampagnenarten();
      });
    }

    this.embeddedKampagnenartTypen = kampagnenartTypen;
  }

  /**
   * Aktiviert die ausgewählten Kampagnenarten im Embedded Form
   */
  async activateEmbeddedKampagnenarten() {
    const activateBtn = document.getElementById('auftragsdetails-activate-btn');
    if (activateBtn) {
      activateBtn.disabled = true;
      const labelEl = activateBtn.querySelector('.mdc-btn__label');
      if (labelEl) labelEl.textContent = 'Aktiviere...';
    }

    try {
      const selectedIds = this.getEmbeddedSelectedKampagnenartIds();

      if (selectedIds.length === 0) {
        window.toastSystem?.show('Bitte wählen Sie mindestens eine Kampagnenart aus.', 'warning');
        return;
      }

      const selectedArten = this.embeddedKampagnenartTypen
        .filter(typ => selectedIds.includes(typ.id))
        .map(typ => typ.name);

      const { KAMPAGNENARTEN_MAPPING, generateBudgetOnlyFieldsHtml } = await import('./logic/KampagnenartenMapping.js');

      const container = document.getElementById('auftragsdetails-budget-sections');
      if (container) {
        let sectionsHtml = '';
        selectedArten.forEach(artName => {
          const config = KAMPAGNENARTEN_MAPPING[artName];
          if (config) {
            sectionsHtml += generateBudgetOnlyFieldsHtml(artName, {});
          } else {
            console.warn(`⚠️ Unbekannte Kampagnenart: "${artName}"`);
          }
        });

        if (sectionsHtml) {
          container.innerHTML = sectionsHtml;
          const { kampagnenartenService } = await import('./services/KampagnenartenService.js');
          kampagnenartenService.bindVideoToggleEvents(container);
        } else {
          container.innerHTML = `
            <div class="alert alert-warning">
              <p>Keine Budget-Felder für die ausgewählten Kampagnenarten verfügbar.</p>
            </div>
          `;
        }
      }

      this.embeddedSelectedKampagnenarten = selectedArten;
      this.embeddedSelectedKampagnenartIds = selectedIds;

      window.toastSystem?.show(`${selectedArten.length} Kampagnenart(en) aktiviert.`, 'success');
    } catch (error) {
      console.error('❌ Fehler beim Aktivieren der Kampagnenarten:', error);
      window.toastSystem?.show('Fehler beim Aktivieren der Kampagnenarten.', 'error');
    } finally {
      if (activateBtn) {
        activateBtn.disabled = false;
        const labelEl = activateBtn.querySelector('.mdc-btn__label');
        if (labelEl) labelEl.textContent = 'Aktivieren';
      }
    }
  }

  /**
   * Holt die ausgewählten Kampagnenart-IDs aus dem Embedded Multiselect
   */
  getEmbeddedSelectedKampagnenartIds() {
    const selectedIds = [];

    const hiddenSelect = document.getElementById('auftragsdetails-kampagnenart_hidden');
    if (hiddenSelect) {
      Array.from(hiddenSelect.selectedOptions).forEach(option => {
        if (option.value) selectedIds.push(option.value);
      });
    }

    if (selectedIds.length === 0) {
      const selectElement = document.getElementById('auftragsdetails-kampagnenart');
      if (selectElement) {
        Array.from(selectElement.selectedOptions).forEach(option => {
          if (option.value) selectedIds.push(option.value);
        });
      }
    }

    if (selectedIds.length === 0) {
      const tags = document.querySelectorAll('#auftragsdetails-embedded-form .tag[data-value]');
      tags.forEach(tag => {
        const value = tag.dataset?.value;
        if (value) selectedIds.push(value);
      });
    }

    console.log('📋 Embedded ausgewählte Kampagnenart-IDs:', selectedIds);
    return selectedIds;
  }

  // Handle Form Submit für Seiten-Formular
  async handleFormSubmit() {
    const form = document.getElementById('auftrag-form');
    const btn = form?.querySelector('.mdc-btn.mdc-btn--create');

    if (btn?.dataset.locked === 'true') return;
    if (btn) {
      btn.dataset.locked = 'true';
      btn.classList.add('is-loading');
      const labelEl = btn.querySelector('.mdc-btn__label');
      if (labelEl) labelEl.textContent = 'Wird angelegt…';
    }

    try {
      const formData = new FormData(form);
      const submitData = {};

      const processedFields = new Set();
      const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
      tagBasedSelects.forEach(select => {
        const fieldName = select.name;
        const selectId = select.id;

        if (processedFields.has(fieldName)) {
          return;
        }
        processedFields.add(fieldName);

        let hiddenSelect = document.getElementById(`${selectId}_hidden`);

        if (!hiddenSelect) {
          hiddenSelect = form.querySelector(`select[name="${fieldName}[]"]`);
        }

        if (!hiddenSelect) {
          const tagContainer = select.closest('.form-field')?.querySelector('.tag-based-select');
          if (tagContainer) {
            hiddenSelect = tagContainer.querySelector('select[multiple]');
          }
        }

        if (!hiddenSelect) {
          const tagContainer = select.closest('.form-field')?.querySelector('.tag-based-select');
          if (tagContainer) {
            const tags = tagContainer.querySelectorAll('.tag[data-value]');
            const tagValues = [...new Set(Array.from(tags).map(tag => tag.dataset.value).filter(Boolean))];
            if (tagValues.length > 0) {
              submitData[fieldName] = tagValues;
              return;
            }
          }
        }

        if (hiddenSelect) {
          const values = [...new Set(Array.from(hiddenSelect.selectedOptions).map(opt => opt.value).filter(Boolean))];
          if (values.length > 0) {
            submitData[fieldName] = values;
          }
        }
      });

      const isEmpty = (v) => v === undefined || v === null || v === '' || (typeof v === 'string' && v.trim() === '');
      for (const [key, value] of formData.entries()) {
        if (key.includes('[]')) {
          const cleanKey = key.replace('[]', '');
          if (!submitData.hasOwnProperty(cleanKey)) {
            submitData[cleanKey] = [];
          }
          if (!submitData[cleanKey].includes(value)) {
            submitData[cleanKey].push(value);
          }
        } else {
          if (!submitData.hasOwnProperty(key) || !Array.isArray(submitData[key])) {
            const existing = submitData[key];
            if (existing === undefined) {
              submitData[key] = value;
            } else if (isEmpty(existing) && !isEmpty(value)) {
              submitData[key] = value;
            }
          }
        }
      }

      for (const key of Object.keys(submitData)) {
        if (Array.isArray(submitData[key])) {
          submitData[key] = [...new Set(submitData[key])];
        }
      }

      const validationResult = window.validatorSystem.validateForm(submitData, {
        auftragsname: { type: 'text', minLength: 2, required: true },
        angebotsnummer: { type: 'text', required: true }
      });

      if (!validationResult.isValid) {
        window.toastSystem?.show('Bitte füllen Sie alle Pflichtfelder aus', 'error');
        window.unlockSubmit?.();
        return;
      }

      const poResult = await generatePoNummer(submitData.unternehmen_id);
      if (!poResult.success) {
        if (btn) {
          btn.classList.remove('is-loading');
          btn.dataset.locked = 'false';
          btn.dataset.submitLocked = 'false';
          btn.classList.remove('is-submit-locked');
          const labelEl = btn.querySelector('.mdc-btn__label');
          if (labelEl) labelEl.textContent = 'Erstellen';
        }
        window.unlockSubmit?.();
        window.toastSystem?.show(poResult.error, 'error');
        return;
      }
      submitData.po = poResult.poNummer;
      console.log('📋 Generierte PO-Nummer:', poResult.poNummer);

      const currentBenutzerId = await getCurrentBenutzerId();
      submitData.created_by_id = currentBenutzerId;
      if (!submitData.status) submitData.status = 'Beauftragt';

      const result = await window.dataService.createEntity('auftrag', submitData);

      if (result.success) {
        if (btn) {
          btn.classList.remove('is-loading');
          btn.classList.add('is-success');
          const labelEl = btn.querySelector('.mdc-btn__label');
          if (labelEl) labelEl.textContent = 'Auftrag angelegt';
        }

        try {
          const auftragId = result.id;
          await window.formSystem.relationTables.handleRelationTables('auftrag', auftragId, submitData, form);
        } catch (e) {
          console.warn('⚠️ Many-to-Many Zuordnungen konnten nicht gespeichert werden', e);
        }

        try {
          const auftragId = result.id;
          await this.handleAuftragsbestaetigungUpload(auftragId, form);
        } catch (e) {
          console.warn('⚠️ Auftragsbestätigung Upload fehlgeschlagen', e);
        }

        const createDetailsToggle = document.getElementById('field-create_auftragsdetails');
        const detailsCreated = await this.handleAuftragsdetailsCreation(result.id, createDetailsToggle?.checked, currentBenutzerId);

        if (detailsCreated) {
          window.toastSystem?.show('Auftrag und Auftragsdetails erfolgreich angelegt', 'success');
        } else {
          window.toastSystem?.show('Auftrag erfolgreich angelegt', 'success');
        }

        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'auftrag', action: 'created', id: result.id }
        }));

        if (detailsCreated) {
          window.dispatchEvent(new CustomEvent('entityUpdated', {
            detail: { entity: 'auftrag_details', action: 'created' }
          }));
        }

        setTimeout(() => {
          window.navigateTo('/auftrag');
        }, 1500);
      } else {
        if (btn) {
          btn.classList.remove('is-loading');
          btn.dataset.locked = 'false';
          btn.dataset.submitLocked = 'false';
          btn.classList.remove('is-submit-locked');
          const labelEl = btn.querySelector('.mdc-btn__label');
          if (labelEl) labelEl.textContent = 'Erstellen';
        }
        window.unlockSubmit?.();
        window.toastSystem?.show(`Fehler beim Erstellen: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('❌ Fehler beim Erstellen des Auftrags:', error);
      if (btn) {
        btn.classList.remove('is-loading');
        btn.dataset.locked = 'false';
        btn.dataset.submitLocked = 'false';
        btn.classList.remove('is-submit-locked');
        const labelEl = btn.querySelector('.mdc-btn__label');
        if (labelEl) labelEl.textContent = 'Erstellen';
      }
      window.unlockSubmit?.();
      window.toastSystem?.show('Ein unerwarteter Fehler ist aufgetreten', 'error');
    }
  }

  /**
   * Erstellt Auftragsdetails wenn der Toggle aktiv ist
   * @param {string} auftragId - ID des gerade erstellten Auftrags
   * @param {boolean} shouldCreate - Ob Auftragsdetails erstellt werden sollen (Toggle-Status)
   * @param {string|null} createdById - Interne benutzer.id des Erstellers
   * @returns {Promise<boolean>} - True wenn Auftragsdetails erstellt wurden
   */
  async handleAuftragsdetailsCreation(auftragId, shouldCreate, createdById = null) {
    if (!shouldCreate || !auftragId) {
      return false;
    }

    console.log('📋 Erstelle Auftragsdetails für Auftrag:', auftragId);

    try {
      if (!this.embeddedSelectedKampagnenartIds || this.embeddedSelectedKampagnenartIds.length === 0) {
        console.log('ℹ️ Keine Kampagnenarten aktiviert, überspringe Auftragsdetails');
        return false;
      }

      const detailsData = {
        auftrag_id: auftragId,
        created_by_id: createdById ?? await getCurrentBenutzerId(),
        kampagnenanzahl: parseInt(document.getElementById('auftragsdetails-kampagnenanzahl')?.value) || null
      };

      const budgetContainer = document.getElementById('auftragsdetails-budget-sections');
      if (budgetContainer) {
        const inputs = budgetContainer.querySelectorAll('input, textarea');
        inputs.forEach(input => {
          const name = input.name;
          if (!name) return;

          let value = input.value;

          if (value === '' || value === null) {
            detailsData[name] = null;
          } else if (name.endsWith('_anzahl') || name.includes('_preis_') || name.includes('preis_netto')) {
            detailsData[name] = parseFloat(value) || null;
          } else {
            detailsData[name] = value;
          }
        });

        // Toggle-Hilfsfelder nicht persistieren; bei deaktiviertem Toggle Zahl explizit nullen
        const videoToggleInputs = budgetContainer.querySelectorAll('input[data-video-toggle="true"]');
        videoToggleInputs.forEach(toggleInput => {
          const toggleName = toggleInput.name;
          if (toggleName && Object.prototype.hasOwnProperty.call(detailsData, toggleName)) {
            delete detailsData[toggleName];
          }
          const videoFieldName = toggleInput.dataset.target;
          if (!videoFieldName) return;
          if (!toggleInput.checked) {
            detailsData[videoFieldName] = null;
          }
        });
      }

      console.log('📤 Auftragsdetails-Daten:', detailsData);

      const { data: createdDetails, error: detailsError } = await window.supabase
        .from('auftrag_details')
        .insert([detailsData])
        .select()
        .single();

      if (detailsError) {
        console.error('❌ Fehler beim Erstellen der Auftragsdetails:', detailsError);
        window.toastSystem?.show('Auftrag erstellt, aber Auftragsdetails konnten nicht gespeichert werden.', 'warning');
        return false;
      }

      console.log('✅ Auftragsdetails erstellt:', createdDetails);

      if (this.embeddedSelectedKampagnenartIds.length > 0) {
        const junctionData = this.embeddedSelectedKampagnenartIds.map(kampagneArtId => ({
          auftrag_id: auftragId,
          kampagne_art_id: kampagneArtId
        }));

        const { error: junctionError } = await window.supabase
          .from('auftrag_kampagne_art')
          .insert(junctionData);

        if (junctionError) {
          console.error('❌ Fehler beim Speichern der Kampagnenarten:', junctionError);
        } else {
          console.log('✅ Kampagnenarten in Junction-Tabelle gespeichert');
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Fehler bei handleAuftragsdetailsCreation:', error);
      window.toastSystem?.show('Auftrag erstellt, aber Auftragsdetails konnten nicht gespeichert werden.', 'warning');
      return false;
    }
  }

  /**
   * Auftragsbestätigung Upload Handling
   * @param {string} auftragId - ID des Auftrags
   * @param {HTMLFormElement} form - Das Formular
   */
  async handleAuftragsbestaetigungUpload(auftragId, form) {
    const uploaderRoot = form.querySelector('.uploader[data-name="auftragsbestaetigung_file"]');

    if (!uploaderRoot || !uploaderRoot.__uploaderInstance || !uploaderRoot.__uploaderInstance.files.length) {
      console.log('📁 Keine Auftragsbestätigung zum Hochladen');
      return;
    }

    if (!window.supabase) {
      console.warn('⚠️ Supabase nicht verfügbar');
      return;
    }

    const file = uploaderRoot.__uploaderInstance.files[0];
    const bucket = 'auftragsbestaetigung';

    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '_')
      .substring(0, 200);

    const path = `${auftragId}/${Date.now()}_${sanitizedName}`;

    console.log(`📤 Uploading Auftragsbestätigung: ${file.name} -> ${path}`);

    const { error: upErr } = await window.supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });

    if (upErr) {
      console.error('❌ Upload-Fehler:', upErr);
      throw upErr;
    }

    const { data: urlData } = window.supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    const { error: dbErr } = await window.supabase
      .from('auftrag')
      .update({
        auftragsbestaetigung_url: urlData?.publicUrl || '',
        auftragsbestaetigung_path: path
      })
      .eq('id', auftragId);

    if (dbErr) {
      console.error('❌ DB-Fehler beim Speichern der URL:', dbErr);
      throw dbErr;
    }

    console.log('✅ Auftragsbestätigung erfolgreich hochgeladen');
  }
}

const auftragCreateHandlerInstance = new AuftragCreateHandler();
export { auftragCreateHandlerInstance as auftragCreateHandler };
