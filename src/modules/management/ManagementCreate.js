// ManagementCreate.js (ES6-Modul)
// Management-Erstellungsseite mit FormSystem + Creator-Zuordnung via Tag-Multi-Select

export class ManagementCreate {
  constructor() {
    this.formData = {};
  }

  async init() {
    console.log('🎯 MANAGEMENTCREATE: Initialisiere Management-Erstellungsseite');

    if (window.moduleRegistry?.currentModule !== this) {
      console.log('⚠️ MANAGEMENTCREATE: Nicht mehr das aktuelle Modul, breche ab');
      return;
    }

    try {
      this.showCreateForm();
      console.log('✅ MANAGEMENTCREATE: Initialisierung abgeschlossen');
    } catch (error) {
      console.error('❌ MANAGEMENTCREATE: Fehler bei der Initialisierung:', error);
      window.ErrorHandler?.handle?.(error, 'ManagementCreate.init');
    }
  }

  showCreateForm() {
    console.log('🎯 MANAGEMENTCREATE: Zeige Erstellungsformular');
    window.setHeadline('Neues Management anlegen');

    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateDetailLabel('Neues Management');
    }

    const formHtml = window.formSystem.renderFormOnly('management');
    window.content.innerHTML = `
      <div class="form-page form-page--half">
        ${formHtml}
      </div>
    `;

    window.formSystem.bindFormEvents('management', null);

    const form = document.getElementById('management-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      };
    }
  }

  async handleFormSubmit() {
    const form = document.getElementById('management-form');
    if (!form) return;

    try {
      console.log('🎯 MANAGEMENTCREATE: Verarbeite Submit');

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn?.innerHTML;
      if (submitBtn) {
        submitBtn.innerHTML = '<div class="loading-spinner"></div> Wird gespeichert...';
        submitBtn.disabled = true;
      }

      const data = this.collectFormData(form);

      // Creator-IDs separat extrahieren (werden custom in Junction geschrieben)
      const creatorIds = data.creator_ids || [];
      delete data.creator_ids;

      console.log('📋 MANAGEMENTCREATE: Daten:', { ...data, creatorIds });

      const result = await window.dataService.createEntity('management', data);

      if (!result.success) {
        throw new Error(result.error || 'Fehler beim Erstellen');
      }

      const managementId = result.id;

      // Creator-Zuordnungen in creator_management einfuegen
      if (creatorIds.length > 0) {
        const insertRows = creatorIds.map(creatorId => ({
          management_id: managementId,
          creator_id: creatorId,
          ist_aktiv: true
        }));

        const { error: junctionError } = await window.supabase
          .from('creator_management')
          .insert(insertRows);

        if (junctionError) {
          console.warn('⚠️ Creator-Zuordnung fehlgeschlagen:', junctionError);
        } else {
          console.log(`✅ ${creatorIds.length} Creator zugeordnet`);
        }
      }

      document.dispatchEvent(new CustomEvent('entityCreated', {
        detail: { entity: 'management', id: managementId }
      }));

      if (window.toastSystem) {
        window.toastSystem.success('Management erfolgreich erstellt!');
      }

      window.navigateTo(`/management/${managementId}`);

    } catch (error) {
      console.error('❌ MANAGEMENTCREATE: Fehler beim Erstellen:', error);
      if (window.toastSystem) {
        window.toastSystem.show('Fehler beim Erstellen: ' + error.message, 'error');
      }
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.innerHTML = 'Speichern';
        submitBtn.disabled = false;
      }
    }
  }

  collectFormData(form) {
    const formData = new FormData(form);
    const data = {};

    // Tag-basierte Multi-Selects zuerst
    const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
    tagBasedSelects.forEach(select => {
      const fieldName = select.name;
      let hiddenSelect = form.querySelector(`select[name="${fieldName}[]"][style*="display: none"]`);
      if (!hiddenSelect) {
        hiddenSelect = form.querySelector(`select[name="${fieldName}"][style*="display: none"]`);
      }
      if (!hiddenSelect && select.id) {
        hiddenSelect = document.getElementById(select.id + '_hidden');
      }
      if (hiddenSelect) {
        data[fieldName] = Array.from(hiddenSelect.selectedOptions)
          .map(opt => opt.value)
          .filter(Boolean);
      }
    });

    // Standard FormData
    for (const [key, value] of formData.entries()) {
      if (data.hasOwnProperty(key)) continue;
      const cleanKey = key.replace('[]', '');
      if (key.includes('[]')) {
        if (!data[cleanKey]) data[cleanKey] = [];
        data[cleanKey].push(value);
      } else {
        data[key] = typeof value === 'string' ? value.trim() : value;
      }
    }

    return data;
  }

  destroy() {
    console.log('ManagementCreate: Cleaning up...');
  }
}

export const managementCreate = new ManagementCreate();
