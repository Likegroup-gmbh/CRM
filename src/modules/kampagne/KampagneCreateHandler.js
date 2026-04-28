// KampagneCreateHandler.js
// Kampagnen-Erstellung, Formular-Handling, Auftragsdetails-Transfer und Bulk-Delete

import { KampagneUtils } from './KampagneUtils.js';
import { deleteDropboxCascade } from '../../core/VideoDeleteHelper.js';

export class KampagneCreateHandler {
  constructor() {
    this.list = null; // Wird per init() gesetzt
  }

  /**
   * Verbindet den Handler mit der KampagneList-Instanz.
   * Muss vor Nutzung aufgerufen werden.
   */
  init(listInstance) {
    this.list = listInstance;
  }

  showCreateForm() {
    console.log('🎯 Zeige Kampagnen-Erstellungsformular');
    window.setHeadline('Neue Kampagne anlegen');
    
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateDetailLabel('Neue Kampagne');
    }
    
    const formHtml = window.formSystem.renderFormOnly('kampagne');
    window.content.innerHTML = `
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    window.formSystem.bindFormEvents('kampagne', null);

    const form = document.getElementById('kampagne-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      };
    }
  }

  async handleFormSubmit() {
    const form = document.getElementById('kampagne-form');
    const btn = form?.querySelector('.mdc-btn.mdc-btn--create');
    
    // Guard: Mehrfachklick verhindern
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

      // Tag-basierte Multi-Selects aus Hidden-Selects sammeln
      const processedFields = new Set();
      const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
      tagBasedSelects.forEach(select => {
        const fieldName = select.name;
        const selectId = select.id;
        
        if (processedFields.has(fieldName)) {
          console.log(`⏭️ Feld ${fieldName} bereits verarbeitet, überspringe`);
          return;
        }
        processedFields.add(fieldName);
        
        // Methode 1: Hidden-Select mit _hidden ID-Suffix
        let hiddenSelect = document.getElementById(`${selectId}_hidden`);
        
        // Methode 2: Name mit [] Suffix
        if (!hiddenSelect) {
          hiddenSelect = form.querySelector(`select[name="${fieldName}[]"]`);
        }
        
        // Methode 3: Tag-Container
        if (!hiddenSelect) {
          const tagContainer = select.closest('.form-field')?.querySelector('.tag-based-select');
          if (tagContainer) {
            hiddenSelect = tagContainer.querySelector('select[multiple]');
          }
        }
        
        // Methode 4: Direkt aus Tags sammeln
        if (!hiddenSelect) {
          const tagContainer = select.closest('.form-field')?.querySelector('.tag-based-select');
          if (tagContainer) {
            const tags = tagContainer.querySelectorAll('.tag[data-value]');
            const tagValues = [...new Set(Array.from(tags).map(tag => tag.dataset.value).filter(Boolean))];
            if (tagValues.length > 0) {
              submitData[fieldName] = tagValues;
              console.log(`🏷️ Tag-basiertes Feld ${fieldName} aus Tags gesammelt:`, tagValues);
              return;
            }
          }
        }
        
        if (hiddenSelect) {
          const values = [...new Set(Array.from(hiddenSelect.selectedOptions).map(opt => opt.value).filter(Boolean))];
          if (values.length > 0) {
            submitData[fieldName] = values;
            console.log(`🏷️ Tag-basiertes Feld ${fieldName} aus Hidden-Select gesammelt:`, values);
          } else {
            console.log(`ℹ️ Hidden-Select für ${fieldName} gefunden, aber keine Werte ausgewählt`);
          }
        } else {
          console.warn(`⚠️ Kein Hidden-Select oder Tags für ${fieldName} gefunden`);
        }
      });

      // FormData zu Objekt konvertieren (aber Tag-basierte Felder nicht überschreiben)
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
            submitData[key] = value;
          } else {
            console.log(`⚠️ Überspringe ${key}, bereits als Array gesetzt:`, submitData[key]);
          }
        }
      }

      // Kampagnenname manuell hinzufügen (readonly Feld nicht in FormData)
      const kampagnennameInput = form.querySelector('input[name="kampagnenname"]');
      if (kampagnennameInput && kampagnennameInput.value) {
        submitData.kampagnenname = kampagnennameInput.value;
      }

      // Dynamische Kampagnenart-Felder aus dem Stepper-Container
      const kampagnenartContainer = form.querySelector('#kampagnenart-felder-container');
      if (kampagnenartContainer) {
        const stepperInputs = kampagnenartContainer.querySelectorAll('input[type="hidden"]');
        stepperInputs.forEach(input => {
          if (input.name && input.value !== undefined) {
            const value = parseInt(input.value, 10) || 0;
            submitData[input.name] = value;
            console.log(`📊 Stepper-Feld gesammelt: ${input.name} = ${value}`);
          }
        });
        console.log('📊 Alle Stepper-Felder gesammelt:', 
          Array.from(stepperInputs).map(i => `${i.name}=${i.value}`).join(', '));
      } else {
        console.log('⚠️ Kampagnenart-Container nicht gefunden');
      }

      // Aggregiere Gesamtzahlen
      const sumBySuffix = (suffix) => Object.entries(submitData).reduce((sum, [key, val]) => {
        if (!key.endsWith(suffix)) return sum;
        return sum + (parseInt(val, 10) || 0);
      }, 0);
      submitData.videoanzahl = sumBySuffix('_video_anzahl');
      submitData.creatoranzahl = sumBySuffix('_creator_anzahl');

      // GLOBALE DEDUPLIZIERUNG
      for (const key of Object.keys(submitData)) {
        if (Array.isArray(submitData[key])) {
          const before = submitData[key].length;
          submitData[key] = [...new Set(submitData[key])];
          const after = submitData[key].length;
          if (before !== after) {
            console.log(`🧹 Dedupliziert ${key}: ${before} → ${after} Einträge`);
          }
        }
      }

      console.log('📝 Kampagne Submit-Daten:', submitData);

      // Validierung
      const validationResult = window.validatorSystem.validateForm(submitData, 'kampagne');
      if (!validationResult.isValid) {
        this.showValidationErrors(validationResult.errors);
        return;
      }

      // Erstelle Kampagne
      console.log('🚀 Erstelle Kampagne mit Daten:', JSON.stringify(submitData, null, 2));
      const result = await window.dataService.createEntity('kampagne', submitData);
      console.log('📦 DataService Ergebnis:', result);
      
      if (result.success) {
        if (btn) {
          btn.classList.remove('is-loading');
          btn.classList.add('is-success');
          const labelEl = btn.querySelector('.mdc-btn__label');
          if (labelEl) labelEl.textContent = 'Kampagne angelegt';
        }
        
        // Many-to-Many Beziehungen speichern
        try {
          const kampagneId = result.id;
          const toArray = (v) => Array.isArray(v) ? v : (v ? [v] : []);
          const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));
          const validUUIDs = (arr) => KampagneUtils.filterValidUUIDs(uniq(toArray(arr)));
          
          // Ansprechpartner-Zuordnungen
          const ansprechpartner = validUUIDs(submitData.ansprechpartner_ids);
          if (ansprechpartner.length > 0) {
            const ansprechpartnerRows = ansprechpartner.map(apId => ({
              kampagne_id: kampagneId,
              ansprechpartner_id: apId
            }));
            await window.supabase.from('ansprechpartner_kampagne').insert(ansprechpartnerRows);
          }
          
          // Mitarbeiter-Zuordnungen (alle Rollen)
          const mitarbeiter = validUUIDs(submitData.mitarbeiter_ids);
          const pm = validUUIDs(submitData.pm_ids);
          const sc = validUUIDs(submitData.scripter_ids);
          const cu = validUUIDs(submitData.cutter_ids);
          const cw = validUUIDs(submitData.copywriter_ids);
          const st = validUUIDs(submitData.strategie_ids);
          const cs = validUUIDs(submitData.creator_sourcing_ids);
          
          const mitarbeiterRows = [];
          mitarbeiter.forEach(uid => mitarbeiterRows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'projektmanager' }));
          pm.forEach(uid => mitarbeiterRows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'projektmanager' }));
          sc.forEach(uid => mitarbeiterRows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'scripter' }));
          cu.forEach(uid => mitarbeiterRows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'cutter' }));
          cw.forEach(uid => mitarbeiterRows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'copywriter' }));
          st.forEach(uid => mitarbeiterRows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'strategie' }));
          cs.forEach(uid => mitarbeiterRows.push({ kampagne_id: kampagneId, mitarbeiter_id: uid, role: 'creator_sourcing' }));
          
          if (mitarbeiterRows.length > 0 && window.supabase) {
            const { error } = await window.supabase.from('kampagne_mitarbeiter').insert(mitarbeiterRows);
            if (error) {
              console.error('❌ Fehler beim Speichern der Mitarbeiter:', error);
            }
          }
          
          // Paid-Ziele
          const paidZiele = validUUIDs(submitData.paid_ziele_ids);
          if (paidZiele.length > 0) {
            const paidZieleRows = paidZiele.map(zielId => ({
              kampagne_id: kampagneId,
              ziel_id: zielId
            }));
            await window.supabase.from('kampagne_paid_ziele').insert(paidZieleRows);
          }
          
          // Organic-Ziele
          const organicZiele = validUUIDs(submitData.organic_ziele_ids);
          if (organicZiele.length > 0) {
            const organicZieleRows = organicZiele.map(zielId => ({
              kampagne_id: kampagneId,
              ziel_id: zielId
            }));
            await window.supabase.from('kampagne_organic_ziele').insert(organicZieleRows);
          }
          
          // Plattformen
          const plattformen = validUUIDs(submitData.plattform_ids);
          if (plattformen.length > 0) {
            const plattformenRows = plattformen.map(plattformId => ({
              kampagne_id: kampagneId,
              plattform_id: plattformId
            }));
            const { error: plattformError } = await window.supabase.from('kampagne_plattformen').insert(plattformenRows);
            if (plattformError) {
              console.error('❌ Fehler beim Speichern der Plattformen:', plattformError);
            }
          }
          
          // Formate
          const formate = validUUIDs(submitData.format_ids);
          if (formate.length > 0) {
            const formateRows = formate.map(formatId => ({
              kampagne_id: kampagneId,
              format_id: formatId
            }));
            const { error: formatError } = await window.supabase.from('kampagne_formate').insert(formateRows);
            if (formatError) {
              console.error('❌ Fehler beim Speichern der Formate:', formatError);
            }
          }
          
          // Kampagnenart-Daten zu auftrag_details übertragen
          await this.transferKampagneDataToAuftragsdetails(submitData, kampagneId);
          
        } catch (e) {
          console.warn('⚠️ Many-to-Many Zuordnungen konnten nicht gespeichert werden', e);
        }

        this.showSuccessMessage('Kampagne erfolgreich erstellt!');
        
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'kampagne', action: 'created', id: result.id }
        }));
        
        setTimeout(() => {
          window.navigateTo('/kampagne');
        }, 1500);
      } else {
        if (btn) {
          btn.classList.remove('is-loading');
          btn.dataset.locked = 'false';
          const labelEl = btn.querySelector('.mdc-btn__label');
          if (labelEl) labelEl.textContent = 'Erstellen';
        }
        this.showErrorMessage(`Fehler beim Erstellen: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ Fehler beim Erstellen der Kampagne:', error);
      const btn = document.getElementById('kampagne-form')?.querySelector('.mdc-btn.mdc-btn--create');
      if (btn) {
        btn.classList.remove('is-loading');
        btn.dataset.locked = 'false';
        const labelEl = btn.querySelector('.mdc-btn__label');
        if (labelEl) labelEl.textContent = 'Erstellen';
      }
      this.showErrorMessage('Ein unerwarteter Fehler ist aufgetreten.');
    }
  }

  showValidationErrors(errors) {
    console.error('❌ Validierungsfehler:', errors);
    
    document.querySelectorAll('.validation-error').forEach(el => el.remove());
    
    Object.entries(errors).forEach(([field, message]) => {
      const fieldElement = document.querySelector(`[name="${field}"]`);
      if (fieldElement) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'validation-error';
        errorDiv.textContent = message;
        fieldElement.parentNode.appendChild(errorDiv);
      }
    });
  }

  showSuccessMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success';
    alertDiv.textContent = message;
    
    const form = document.getElementById('kampagne-form');
    if (form) {
      form.parentNode.insertBefore(alertDiv, form);
      setTimeout(() => alertDiv.remove(), 5000);
    }
  }

  showErrorMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger';
    alertDiv.textContent = message;
    
    const form = document.getElementById('kampagne-form');
    if (form) {
      form.parentNode.insertBefore(alertDiv, form);
      setTimeout(() => alertDiv.remove(), 5000);
    }
  }

  /**
   * Überträgt Kampagnenart-spezifische Daten zu auftrag_details
   */
  async transferKampagneDataToAuftragsdetails(submitData, kampagneId) {
    try {
      const auftragId = submitData.auftrag_id;
      if (!auftragId) {
        console.log('ℹ️ Keine auftrag_id - Auftragsdetails-Transfer übersprungen');
        return;
      }
      
      console.log('🔄 Starte Transfer Kampagnendaten → Auftragsdetails');
      
      const { KAMPAGNENARTEN_MAPPING } = await import('../auftrag/logic/KampagnenartenMapping.js');
      const uniqueConfigs = Object.values(KAMPAGNENARTEN_MAPPING)
        .filter((config, index, configs) => configs.findIndex(c => c.prefix === config.prefix) === index);
      
      const auftragsDetailsUpdate = {};
      let gesamtVideos = 0;
      let gesamtCreator = 0;
      
      for (const config of uniqueConfigs) {
        const { prefix, hasCreator, hasBilder, hasVideographen } = config;
        
        const videoKey = `${prefix}_video_anzahl`;
        if (submitData[videoKey] !== undefined && submitData[videoKey] !== '') {
          const videoAnzahl = parseInt(submitData[videoKey], 10) || 0;
          auftragsDetailsUpdate[videoKey] = videoAnzahl;
          gesamtVideos += videoAnzahl;
        }
        
        if (hasCreator) {
          const creatorKey = `${prefix}_creator_anzahl`;
          if (submitData[creatorKey] !== undefined && submitData[creatorKey] !== '') {
            const creatorAnzahl = parseInt(submitData[creatorKey], 10) || 0;
            auftragsDetailsUpdate[creatorKey] = creatorAnzahl;
            gesamtCreator += creatorAnzahl;
          }
        }
        
        if (hasBilder) {
          const bilderKey = `${prefix}_bilder_anzahl`;
          if (submitData[bilderKey] !== undefined && submitData[bilderKey] !== '') {
            auftragsDetailsUpdate[bilderKey] = parseInt(submitData[bilderKey], 10) || 0;
          }
        }
        
        if (hasVideographen) {
          const videographenKey = `${prefix}_videographen_anzahl`;
          if (submitData[videographenKey] !== undefined && submitData[videographenKey] !== '') {
            auftragsDetailsUpdate[videographenKey] = parseInt(submitData[videographenKey], 10) || 0;
          }
        }
      }
      
      if (Object.keys(auftragsDetailsUpdate).length === 0) {
        console.log('ℹ️ Keine Kampagnenart-Felder zu übertragen');
        return;
      }
      
      auftragsDetailsUpdate.gesamt_videos = gesamtVideos;
      auftragsDetailsUpdate.gesamt_creator = gesamtCreator;
      
      console.log('📊 Auftragsdetails-Update Daten:', auftragsDetailsUpdate);
      
      const { data: existingDetails, error: checkError } = await window.supabase
        .from('auftrag_details')
        .select('id')
        .eq('auftrag_id', auftragId)
        .maybeSingle();
      
      if (checkError) {
        console.error('❌ Fehler beim Prüfen der Auftragsdetails:', checkError);
        return;
      }
      
      if (existingDetails) {
        const { data: alleKampagnen, error: kampError } = await window.supabase
          .from('kampagne')
          .select('*')
          .eq('auftrag_id', auftragId);
        
        if (kampError) {
          console.error('❌ Fehler beim Laden aller Kampagnen:', kampError);
          return;
        }
        
        const aggregatedData = {};
        let totalVideos = 0;
        let totalCreator = 0;
        
        for (const kamp of (alleKampagnen || [])) {
          for (const config of uniqueConfigs) {
            const { prefix, hasCreator, hasBilder, hasVideographen } = config;
            
            const videoKey = `${prefix}_video_anzahl`;
            const videoVal = parseInt(kamp[videoKey], 10) || 0;
            aggregatedData[videoKey] = (aggregatedData[videoKey] || 0) + videoVal;
            totalVideos += videoVal;
            
            if (hasCreator) {
              const creatorKey = `${prefix}_creator_anzahl`;
              const creatorVal = parseInt(kamp[creatorKey], 10) || 0;
              aggregatedData[creatorKey] = (aggregatedData[creatorKey] || 0) + creatorVal;
              totalCreator += creatorVal;
            }
            
            if (hasBilder) {
              const bilderKey = `${prefix}_bilder_anzahl`;
              aggregatedData[bilderKey] = (aggregatedData[bilderKey] || 0) + (parseInt(kamp[bilderKey], 10) || 0);
            }
            
            if (hasVideographen) {
              const videographenKey = `${prefix}_videographen_anzahl`;
              aggregatedData[videographenKey] = (aggregatedData[videographenKey] || 0) + (parseInt(kamp[videographenKey], 10) || 0);
            }
          }
        }
        
        aggregatedData.gesamt_videos = totalVideos;
        aggregatedData.gesamt_creator = totalCreator;
        
        const { error: updateError } = await window.supabase
          .from('auftrag_details')
          .update(aggregatedData)
          .eq('id', existingDetails.id);
        
        if (updateError) {
          console.error('❌ Fehler beim Update der Auftragsdetails:', updateError);
        } else {
          console.log('✅ Auftragsdetails aktualisiert (aggregiert):', aggregatedData);
        }
      } else {
        const newDetails = {
          auftrag_id: auftragId,
          ...auftragsDetailsUpdate
        };
        
        const { error: insertError } = await window.supabase
          .from('auftrag_details')
          .insert(newDetails);
        
        if (insertError) {
          console.error('❌ Fehler beim Erstellen der Auftragsdetails:', insertError);
        } else {
          console.log('✅ Auftragsdetails erstellt:', newDetails);
        }
      }
      
    } catch (error) {
      console.error('❌ Fehler beim Transfer der Kampagnendaten zu Auftragsdetails:', error);
    }
  }

  // Bestätigungsdialog für Bulk-Delete
  async showDeleteSelectedConfirmation() {
    const selectedCount = this.list.selectedKampagnen.size;
    if (selectedCount === 0) {
      window.toastSystem?.warning('Keine Kampagnen ausgewählt.');
      return;
    }

    const message = selectedCount === 1
      ? 'Möchten Sie die ausgewählte Kampagne wirklich löschen?'
      : `Möchten Sie die ${selectedCount} ausgewählten Kampagnen wirklich löschen?`;

    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({
        title: 'Löschvorgang bestätigen',
        message: `${message}`,
        confirmText: 'Endgültig löschen',
        cancelText: 'Abbrechen',
        danger: true
      });
      if (res?.confirmed) {
        this.deleteSelectedKampagnen();
      }
    } else {
      const confirmed = confirm(`${message}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
      if (confirmed) this.deleteSelectedKampagnen();
    }
  }

  async deleteSelectedKampagnen() {
    if (!window.canBulkDelete()) return;

    const selectedIds = Array.from(this.list.selectedKampagnen);
    const totalCount = selectedIds.length;
    
    console.log(`🗑️ Lösche ${totalCount} Kampagnen...`);
    
    // Optimistisches UI-Update
    selectedIds.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.style.opacity = '0.5';
    });

    try {
      await Promise.allSettled(
        selectedIds.map(id => deleteDropboxCascade('kampagne', id))
      );

      const result = await window.dataService.deleteEntities('kampagne', selectedIds);
      
      if (result.success) {
        selectedIds.forEach(id => {
          document.querySelector(`tr[data-id="${id}"]`)?.remove();
        });
        
        const successMsg = result.deletedCount === 1
          ? 'Kampagne erfolgreich gelöscht.'
          : `${result.deletedCount} Kampagnen erfolgreich gelöscht.`;
        window.toastSystem?.success(successMsg);
        
        this.list.deselectAll();
        
        const tbody = document.querySelector('#kampagnen-table-body');
        if (tbody && tbody.children.length === 0) {
          await this.list.loadAndRender();
        }
        
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'kampagne', action: 'bulk-deleted', count: result.deletedCount }
        }));
      } else {
        throw new Error(result.error || 'Löschen fehlgeschlagen');
      }
    } catch (error) {
      selectedIds.forEach(id => {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) row.style.opacity = '1';
      });
      
      console.error('❌ Fehler beim Löschen:', error);
      window.toastSystem?.error(`Fehler beim Löschen: ${error.message}`);
      
      await this.list.loadAndRender();
    }
  }
}
