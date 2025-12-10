// AnsprechpartnerCreate.js (ES6-Modul)
// Ansprechpartner-Erstellungsseite mit Multi-Select für Marken (wie Unternehmen/Marken)

export class AnsprechpartnerCreate {
  constructor() {
    this.formData = {};
  }

  // Initialisiere Ansprechpartner-Erstellung
  async init() {
    console.log('🎯 ANSPRECHPARTNERCREATE: Initialisiere Ansprechpartner-Erstellung');
    this.showCreateForm();
  }

  // Show Create Form
  showCreateForm() {
    console.log('🎯 ANSPRECHPARTNERCREATE: Zeige Ansprechpartner-Erstellungsformular mit FormSystem');
    console.log('🚨 ANSPRECHPARTNERCREATE: WIRD VERWENDET!');
    window.setHeadline('Neuen Ansprechpartner anlegen');
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Ansprechpartner', url: '/ansprechpartner', clickable: true },
        { label: 'Neuer Ansprechpartner', url: '/ansprechpartner/new', clickable: false }
      ]);
    }
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('ansprechpartner');
    window.content.innerHTML = `
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    // Formular-Events binden
    window.formSystem.bindFormEvents('ansprechpartner', null);
    
    // ENTFERNT: Custom Submit Handler - das neue FormSystem übernimmt die Verarbeitung
    // Das FormSystem.bindFormEvents() oben behandelt bereits den Submit korrekt
    console.log('✅ ANSPRECHPARTNERCREATE: Verwende FormSystem Submit Handler (kein Custom Handler mehr)');
  }

  // ENTFERNT: Handle Form Submit - wird jetzt vom FormSystem übernommen
  // Die Methode bleibt für Kompatibilität, wird aber nicht mehr verwendet
  async handleFormSubmit() {
    try {
      // Loading-State setzen
      const submitBtn = document.querySelector('#ansprechpartner-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.innerHTML = 'Erstelle...';
        submitBtn.disabled = true;
      }

      // Formular-Daten sammeln
      const form = document.getElementById('ansprechpartner-form');
      const formData = new FormData(form);
      const data = {};
      
      // Multi-Select Felder zuerst sammeln (Tag-basierte)
      const allFormData = {};
      
      // Tag-basierte Multi-Selects verarbeiten (genau wie im FormSystem)
      const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
      console.log('🏷️ Tag-basierte Selects gefunden:', tagBasedSelects.length);

      tagBasedSelects.forEach(select => {
        console.log(`🔍 Verarbeite Tag-basiertes Select: ${select.name}`);

        // Debug: Alle Selects mit diesem Namen finden
        const allSelects = form.querySelectorAll(`select[name^="${select.name}"]`);
        console.log(`🔍 Alle Selects für ${select.name}:`, allSelects.length, Array.from(allSelects).map(s => ({ name: s.name, hidden: s.style.display === 'none', options: s.options.length })));

        // Suche das versteckte Select mit den tatsächlichen Werten
        // Das versteckte Select hat den Namen mit '[]' (z.B. marke_ids[])
        let hiddenSelect = form.querySelector(`select[name="${select.name}[]"][style*="display: none"]`);
        console.log(`🔍 Verstecktes Select mit [] gefunden:`, !!hiddenSelect);

        // Fallback 1: Nach style="display: none" ohne [] (wie bei Unternehmen)
        if (!hiddenSelect) {
          hiddenSelect = form.querySelector(`select[name="${select.name}"][style*="display: none"]`);
          console.log(`🔍 Verstecktes Select ohne [] gefunden:`, !!hiddenSelect);
        }

        // Fallback 2: Nach allen Selects mit dem gleichen Namen (das versteckte ist das zweite)
        if (!hiddenSelect) {
          if (allSelects.length > 1) {
            hiddenSelect = allSelects[1]; // Das zweite ist das versteckte
            console.log(`🔍 Fallback: Zweites Select verwendet:`, !!hiddenSelect);
          }
        }

        if (hiddenSelect) {
          console.log(`🔍 Verstecktes Select Details für ${select.name}:`, {
            name: hiddenSelect.name,
            optionsCount: hiddenSelect.options.length,
            selectedCount: hiddenSelect.selectedOptions.length,
            allOptions: Array.from(hiddenSelect.options).map(o => ({ value: o.value, selected: o.selected }))
          });

          // ROBUSTE Array-Sammlung: Alle Optionen nehmen (nicht nur selectedOptions)
          // da bei multiple=true alle Optionen als "ausgewählt" gelten sollen
          const allValues = Array.from(hiddenSelect.options).map(option => option.value).filter(val => val !== '' && val != null);
          const selectedValues = Array.from(hiddenSelect.selectedOptions).map(option => option.value).filter(val => val !== '' && val != null);
          
          // Bevorzuge selectedOptions, fallback auf alle Options
          const finalValues = selectedValues.length > 0 ? selectedValues : allValues;
          
          console.log(`🔍 Werte-Analyse für ${select.name}:`, {
            allValues,
            selectedValues, 
            finalValues,
            using: selectedValues.length > 0 ? 'selectedOptions' : 'allOptions'
          });

          if (finalValues.length > 0) {
            allFormData[select.name] = finalValues;
            console.log(`🏷️ Tag-basiertes Multi-Select ${select.name}:`, finalValues);
          } else {
            console.log(`⚠️ Keine Werte für ${select.name} gefunden`);
          }
        } else {
          console.log(`⚠️ Verstecktes Select für ${select.name} nicht gefunden`);
        }
      });
      
      // Spezielle Behandlung für Tag-basierte Multi-Selects - versteckte Selects manuell verarbeiten
      // Das versteckte Select wird möglicherweise nicht korrekt von FormData erfasst
      const hiddenMarkenSelect = form.querySelector('select[name="marke_ids[]"]');
      if (hiddenMarkenSelect && hiddenMarkenSelect.multiple) {
        const selectedOptions = Array.from(hiddenMarkenSelect.selectedOptions);
        if (selectedOptions.length > 0) {
          const markenIds = selectedOptions.map(option => option.value).filter(val => val !== '');
          if (markenIds.length > 0) {
            allFormData['marke_ids'] = markenIds;
            console.log('🏷️ ANSPRECHPARTNERCREATE: Verstecktes Marken-Select manuell verarbeitet:', markenIds);
          }
        }
      }
      
      const hiddenSprachenSelect = form.querySelector('select[name="sprachen_ids[]"]');
      if (hiddenSprachenSelect && hiddenSprachenSelect.multiple) {
        const selectedOptions = Array.from(hiddenSprachenSelect.selectedOptions);
        if (selectedOptions.length > 0) {
          const sprachenIds = selectedOptions.map(option => option.value).filter(val => val !== '');
          if (sprachenIds.length > 0) {
            allFormData['sprachen_ids'] = sprachenIds;
            console.log('🏷️ ANSPRECHPARTNERCREATE: Verstecktes Sprachen-Select manuell verarbeitet:', sprachenIds);
          }
        }
      }

      // Standard FormData-Einträge sammeln (nur für Felder, die nicht bereits von Tag-basierten Selects verarbeitet wurden)
      for (let [key, value] of formData.entries()) {
        if (!allFormData.hasOwnProperty(key)) {
          if (key.includes('[]')) {
            // Multi-Select Array behandeln (z.B. marke_ids[])
            const cleanKey = key.replace('[]', '');
            // Nur verarbeiten wenn nicht bereits von Tag-basierten Selects verarbeitet
            if (!allFormData[cleanKey]) {
              allFormData[cleanKey] = [];
            }
            allFormData[cleanKey].push(value);
          } else {
            if (allFormData[key]) {
              if (!Array.isArray(allFormData[key])) {
                allFormData[key] = [allFormData[key]];
              }
              allFormData[key].push(value);
            } else {
              allFormData[key] = value;
            }
          }
        }
      }
      
      // Duplikate aus Array-Feldern entfernen
      for (let [key, value] of Object.entries(allFormData)) {
        if (Array.isArray(value)) {
          allFormData[key] = [...new Set(value)]; // Entfernt Duplikate
        }
      }
      
      // Finale Daten zusammenstellen
      for (let [key, value] of Object.entries(allFormData)) {
        data[key] = Array.isArray(value) ? value : value.trim();
      }
      
      console.log('📤 Finale Ansprechpartner-Daten:', data);

      // Validierung (wie bei Marken)
      const validation = window.validatorSystem.validateForm(data, {
        vorname: { type: 'text', minLength: 2, required: true },
        nachname: { type: 'text', minLength: 2, required: true }
      });
      
      if (!validation.isValid) {
        this.showValidationErrors(validation.errors);
        return;
      }

      // Ansprechpartner erstellen
      const result = await window.dataService.createEntity('ansprechpartner', data);
      
      if (result.success) {
        this.showSuccessMessage('Ansprechpartner erfolgreich erstellt!');
        
        // Event auslösen für Listen-Update statt Navigation
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'ansprechpartner', id: result.data.id, action: 'created' } 
        }));
        
        // Optional: Kurz warten, dann zur Übersicht (nur wenn gewünscht)
        // setTimeout(() => {
        //   window.navigateTo('/ansprechpartner');
        // }, 1500);
      } else {
        throw new Error(result.error || 'Fehler beim Erstellen des Ansprechpartners');
      }
      
    } catch (error) {
      console.error('❌ Fehler beim Erstellen des Ansprechpartners:', error);
      this.showErrorMessage(error.message || 'Ein unerwarteter Fehler ist aufgetreten');
    } finally {
      // Loading-State zurücksetzen
      const submitBtn = document.querySelector('#ansprechpartner-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.innerHTML = 'Ansprechpartner anlegen';
        submitBtn.disabled = false;
      }
    }
  }

  // Validierungsfehler anzeigen (kopiert von MarkeCreate)
  showValidationErrors(errors) {
    // Alte Fehler entfernen
    document.querySelectorAll('.field-error').forEach(el => el.remove());
    
    for (const [field, message] of Object.entries(errors)) {
      const fieldElement = document.querySelector(`[name="${field}"]`);
      if (fieldElement) {
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.textContent = message;
        errorElement.style.color = 'red';
        errorElement.style.fontSize = '12px';
        errorElement.style.marginTop = '4px';
        
        fieldElement.parentNode.appendChild(errorElement);
      }
    }
  }
  
  // Erfolgsmeldung anzeigen (kopiert von MarkeCreate)
  showSuccessMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Animation
    setTimeout(() => toast.style.opacity = '1', 100);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
  
  // Fehlermeldung anzeigen (kopiert von MarkeCreate)
  showErrorMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Animation
    setTimeout(() => toast.style.opacity = '1', 100);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Profilbild-Upload
  async uploadProfileImage(ansprechpartnerId, form) {
    try {
      console.log('📋 uploadProfileImage() aufgerufen für Ansprechpartner:', ansprechpartnerId);
      
      const uploaderRoot = form.querySelector('.uploader[data-name="profile_image_file"]');
      console.log('  → Uploader Root:', uploaderRoot);
      console.log('  → Uploader Instance:', uploaderRoot?.__uploaderInstance);
      console.log('  → Files:', uploaderRoot?.__uploaderInstance?.files);
      
      if (!uploaderRoot || !uploaderRoot.__uploaderInstance || !uploaderRoot.__uploaderInstance.files.length) {
        console.log('ℹ️ Kein Profilbild zum Hochladen (kein Uploader/keine Files)');
        return;
      }

      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - Profilbild-Upload übersprungen');
        return;
      }

      const files = uploaderRoot.__uploaderInstance.files;
      const file = files[0]; // Nur ein Bild erlaubt
      const bucket = 'ansprechpartner-images';
      
      // Security: Max 500 KB
      const MAX_FILE_SIZE = 500 * 1024; // 500 KB
      const ALLOWED_TYPES = ['image/png', 'image/jpeg'];
      
      // Dateigröße prüfen
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`⚠️ Profilbild zu groß: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
        alert(`Profilbild ist zu groß (max. 500 KB)`);
        return;
      }

      // Content-Type prüfen
      if (!ALLOWED_TYPES.includes(file.type)) {
        console.warn(`⚠️ Nicht erlaubter Dateityp: ${file.name} (${file.type})`);
        alert(`Nur PNG und JPG Dateien sind erlaubt`);
        return;
      }

      // Dateiendung extrahieren
      const ext = file.name.split('.').pop().toLowerCase();
      const path = `${ansprechpartnerId}/profile.${ext}`;
      
      console.log(`📤 Uploading Profilbild: ${file.name} -> ${path}`);
      
      // Altes Bild löschen (falls vorhanden)
      try {
        const { data: existingFiles } = await window.supabase.storage
          .from(bucket)
          .list(ansprechpartnerId);
        
        if (existingFiles && existingFiles.length > 0) {
          for (const existingFile of existingFiles) {
            await window.supabase.storage
              .from(bucket)
              .remove([`${ansprechpartnerId}/${existingFile.name}`]);
          }
        }
      } catch (deleteErr) {
        console.warn('⚠️ Fehler beim Löschen alter Profilbilder:', deleteErr);
      }
      
      // Upload zu Storage
      const { error: upErr } = await window.supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });
      
      if (upErr) {
        console.error(`❌ Profilbild-Upload-Fehler:`, upErr);
        throw upErr;
      }
      
      // Öffentliche URL erstellen
      const { data: publicUrlData } = window.supabase.storage
        .from(bucket)
        .getPublicUrl(path);
      
      const profile_image_url = publicUrlData?.publicUrl || '';
      
      // Profilbild-Daten in Datenbank speichern
      const { error: dbErr } = await window.supabase
        .from('ansprechpartner')
        .update({
          profile_image_url,
          profile_image_path: path
        })
        .eq('id', ansprechpartnerId);
      
      if (dbErr) {
        console.error(`❌ DB-Fehler beim Speichern der Profilbild-URL:`, dbErr);
        throw dbErr;
      }
      
      console.log(`✅ Profilbild erfolgreich hochgeladen`);
    } catch (error) {
      console.error('❌ Fehler beim Profilbild-Upload:', error);
      alert(`⚠️ Profilbild konnte nicht hochgeladen werden: ${error.message}`);
      // Nicht werfen - Ansprechpartner wurde bereits erstellt
    }
  }

  // Destroy
  destroy() {
    console.log('🎯 ANSPRECHPARTNERCREATE: Destroy');
  }

  renderKampagnen() {
    if (!this.ansprechpartner.ansprechpartner_kampagne || this.ansprechpartner.ansprechpartner_kampagne.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📢</div>
          <h3>Keine Kampagnen zugeordnet</h3>
          <p>Diesem Ansprechpartner sind noch keine Kampagnen zugeordnet.</p>
        </div>
      `;
    }

    const rows = this.ansprechpartner.ansprechpartner_kampagne.map(item => {
      const kampagne = item.kampagne;
      return `
        <tr>
          <td>
            <a href="#" class="table-link" data-table="kampagne" data-id="${kampagne.id}">
              ${kampagne.kampagnenname || 'Unbekannte Kampagne'}
            </a>
          </td>
          <td>${kampagne.unternehmen?.firmenname ? `<a href="#" class="table-link" data-table="unternehmen" data-id="${kampagne.unternehmen.id}">${kampagne.unternehmen.firmenname}</a>` : '-'}</td>
          <td>${kampagne.start ? new Date(kampagne.start).toLocaleDateString('de-DE') : '-'}</td>
          <td>${kampagne.deadline ? new Date(kampagne.deadline).toLocaleDateString('de-DE') : '-'}</td>
          <td>${kampagne.status || '-'}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Kampagne</th>
              <th>Unternehmen</th>
              <th>Start</th>
              <th>Deadline</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }
}

// Exportiere Instanz für globale Nutzung
export const ansprechpartnerCreate = new AnsprechpartnerCreate();
