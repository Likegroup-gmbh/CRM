import { initializeSearchableSelects } from './events/SearchableSelects.js';
import { setupAddressesFields } from './events/AddressFields.js';
import { EditFormDataLoader } from '../data/EditFormDataLoader.js';
import { KooperationEditLoader } from '../../../modules/kooperation/KooperationEditLoader.js';

const ENTITY_EVENT_LOADERS = {
  auftrag: () => import('./events/AuftragEvents.js'),
  kampagne: () => import('./events/KampagneEvents.js'),
  kooperation: () => import('./events/KooperationEvents.js'),
  rechnung: () => import('./events/RechnungEvents.js'),
};

// Entity-spezifische Edit-Loader registrieren (Bypass für den Standard-Waterfall)
if (!EditFormDataLoader.hasLoader('kooperation')) {
  EditFormDataLoader.registerLoader('kooperation', new KooperationEditLoader());
}

export class FormEvents {
  constructor(formSystem) {
    this.formSystem = formSystem;
  }

  /**
   * Normalisiert deutsche Zahlenformate in Standard-Dezimalzahlen
   * "13.000" → 13000, "13.000,50" → 13000.50, "13,50" → 13.50
   */
  parseGermanNumber(value) {
    if (!value || typeof value !== 'string') return null;
    
    let cleaned = value.trim();
    if (!cleaned) return null;
    
    const hasThousandSeparator = /\d{1,3}(\.\d{3})+/.test(cleaned);
    const hasGermanDecimal = /,\d{1,2}$/.test(cleaned);
    
    if (hasThousandSeparator || hasGermanDecimal) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
    
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  /**
   * Bindet German Number Handler an alle number-Inputs im Formular
   */
  bindGermanNumberInputs(form) {
    if (!form) return;
    
    const numberInputs = form.querySelectorAll('input[type="number"]');
    
    numberInputs.forEach(input => {
      if (input.dataset.germanNumberBound) return;
      input.dataset.germanNumberBound = 'true';
      
      const originalType = input.type;
      
      input.addEventListener('focus', () => {
        input.type = 'text';
        input.dataset.originalValue = input.value;
      });
      
      input.addEventListener('blur', () => {
        const rawValue = input.value;
        const parsed = this.parseGermanNumber(rawValue);
        
        if (parsed !== null) {
          input.value = parsed;
        } else if (rawValue === '') {
          input.value = '';
        }
        input.type = originalType;
        
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }

  async bindFormEvents(entity, data) {
    const form = document.getElementById(`${entity}-form`);
    if (!form) return;
    
    this.bindGermanNumberInputs(form);

    form.dataset.entity = entity;

    if (data && data._isEditMode) {
      form.dataset.editModeData = JSON.stringify(data);
      form.dataset.isEditMode = 'true';
      form.dataset.entityType = entity;
      form.dataset.entityId = data._entityId;
      
      if (data.unternehmen_id) {
        form.dataset.existingUnternehmenId = data.unternehmen_id;
      }
      if (data.branche_id) {
        form.dataset.existingBrancheId = data.branche_id;
      }
    }
    
    if (entity === 'kooperation' && data && data._prefillFromKampagne) {
      form.dataset.prefillFromKampagne = 'true';
      form.dataset.prefillData = JSON.stringify(data);
      form.dataset.entityType = entity;
    }

    // Submit-Event mit UI-States
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = form.querySelector('.mdc-btn.mdc-btn--create');
      if (!btn) {
        await this.formSystem.handleFormSubmit(entity, data, form);
        return;
      }

      if (btn.dataset.locked === 'true') return;
      btn.dataset.locked = 'true';

      const initialLabel = btn.querySelector('.mdc-btn__label')?.textContent || '';
      const labelEl = btn.querySelector('.mdc-btn__label');
      const mode = btn.getAttribute('data-mode') || (data ? 'update' : 'create');
      const entityLabel = btn.getAttribute('data-entity-label') || 'Eintrag';

      btn.classList.add('is-loading');
      if (labelEl) labelEl.textContent = mode === 'update' ? 'Wird aktualisiert…' : 'Wird angelegt…';

      const before = Date.now();
      const result = await this.formSystem.handleFormSubmit(entity, data, form);
      const took = Date.now() - before;

      if (!form.isConnected) return;

      if (result && result.success === false) {
        btn.classList.remove('is-loading');
        btn.dataset.locked = 'false';
        if (labelEl) labelEl.textContent = initialLabel;
        return;
      }

      btn.classList.remove('is-loading');
      btn.classList.add('is-success');
      if (labelEl) labelEl.textContent = mode === 'update' ? 'Aktualisiert' : `${entityLabel} angelegt`;

      setTimeout(() => {
        btn.dataset.locked = 'false';
      }, Math.max(400, 900 - took));
    };

    const closeBtn = form.querySelector('.btn-close');
    if (closeBtn) {
      closeBtn.onclick = () => this.formSystem.closeForm();
    }

    // === Edit-Mode Bypass: entity-spezifischer Loader (z. B. Kooperation) ===
    // Lädt alle Daten parallel, rendert direkt, überspringt DynamicDataLoader + DependentFields + Entity-Events-Cascade.
    if (data && data._isEditMode && EditFormDataLoader.hasLoader(entity)) {
      const editLoader = EditFormDataLoader.getLoader(entity);
      try {
        const result = await editLoader.load(form, data);
        if (result && result.success !== false) {
          // Searchable-Selects initialisieren (echte Impl liegt im FormSystem, nicht im No-op oben)
          this.formSystem.initializeSearchableSelects(form);
          this.formSystem.autoCalculation.initializeAutoCalculation(form);
          // AutoGeneration im Edit NICHT aufrufen — Name ist fix, spart 3 Queries
          setupAddressesFields(form);
          await editLoader.bindEvents(form, data);
          return;
        }
        console.warn(`⚠️ EditFormDataLoader für ${entity} fehlgeschlagen, Fallback auf Standard-Flow`);
      } catch (error) {
        console.error(`❌ EditFormDataLoader für ${entity} Fehler, Fallback auf Standard-Flow:`, error);
      }
    }

    // Dynamische Daten laden (ZUERST)
    await this.formSystem.dataLoader.loadDynamicFormData(entity, form);

    // Searchable Selects (DANACH)
    initializeSearchableSelects(form);

    // Abhängige Felder einrichten
    this.formSystem.dependentFields.setupDependentFields(form);
    
    // Kooperation Prefill NACH DependentFields
    if (entity === 'kooperation' && form.dataset.prefillFromKampagne === 'true') {
      try {
        await this.formSystem.dataLoader.handleKooperationPrefill(form);
        
        const kampagneSelect = form.querySelector('select[name="kampagne_id"]');
        if (kampagneSelect && kampagneSelect.value) {
          setTimeout(() => {
            kampagneSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }, 50);
        }
      } catch (error) {
        console.error('❌ FORMEVENTS: Fehler in handleKooperationPrefill:', error);
      }
    }

    // Adressen-Felder einrichten
    setupAddressesFields(form);

    // Auto-Generierung einrichten
    this.formSystem.autoGeneration.setupAutoGeneration(form);

    // Auto-Berechnung einrichten
    this.formSystem.autoCalculation.initializeAutoCalculation(form);

    // Entity-spezifische Events via Lazy-Loading
    await this.setupEntitySpecificEvents(entity, form);
  }

  async setupEntitySpecificEvents(entity, form) {
    const loader = ENTITY_EVENT_LOADERS[entity];
    if (!loader) return;
    
    try {
      const mod = await loader();
      await mod.setup(form, { formSystem: this.formSystem });
    } catch (error) {
      console.error(`❌ Fehler beim Laden der ${entity}-Events:`, error);
    }
  }
}
