// MarkeCreate.js (ES6-Modul)
// Marke-Erstellungsseite mit Multi-Select für Branchen (wie Unternehmen)

export class MarkeCreate {
  constructor() {
    this.formData = {};
  }

  // Initialisiere Marke-Erstellung
  async init() {
    console.log('🎯 MARKECREATE: Initialisiere Marke-Erstellung');
    this.showCreateForm();
  }

  // Show Create Form
  showCreateForm() {
    console.log('🎯 MARKECREATE: Zeige Marke-Erstellungsformular mit FormSystem');
    window.setHeadline('Neue Marke anlegen');
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Marken', url: '/marke', clickable: true },
        { label: 'Neue Marke', url: '/marke/new', clickable: false }
      ]);
    }
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('marke');
    window.content.innerHTML = `
      <div class="form-page">
        ${formHtml}
        <div id="logo-preview-container" class="form-logo-preview" style="display: none;">
          <label class="form-logo-label">Logo Vorschau:</label>
          <img id="logo-preview-image" class="form-logo-image" alt="Logo Vorschau" />
        </div>
      </div>
    `;

    // Formular-Events binden
    window.formSystem.bindFormEvents('marke', null);
    
    // Custom Submit Handler für Seiten-Formular (wie bei Unternehmen)
    const form = document.getElementById('marke-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      };
      
      // Logo-Preview-Funktion
      this.setupLogoPreview(form);
      
      // Duplikat-Validierung auf Markenname
      this.setupDuplicateValidation(form);
    }
  }

  // Setup Duplikat-Validierung für Markenname
  setupDuplicateValidation(form) {
    const markennameField = form.querySelector('#markenname, input[name="markenname"]');
    if (!markennameField) {
      console.warn('⚠️ MARKECREATE: Markenname-Feld nicht gefunden');
      return;
    }

    // Container für Duplicate-Messages (falls nicht existiert)
    let messageContainer = markennameField.parentElement.querySelector('.duplicate-message-container');
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.className = 'duplicate-message-container';
      markennameField.parentElement.appendChild(messageContainer);
    }

    // Blur Event
    markennameField.addEventListener('blur', async (e) => {
      await this.validateMarkeDuplicate(e.target.value, messageContainer);
    });

    // Clear beim Tippen
    markennameField.addEventListener('input', () => {
      this.clearDuplicateMessages(messageContainer);
      this.enableSubmitButton();
    });
  }

  // Validiere Marke Duplikat
  async validateMarkeDuplicate(markenname, messageContainer) {
    if (!markenname || markenname.trim().length < 2) {
      this.clearDuplicateMessages(messageContainer);
      return;
    }

    if (!window.duplicateChecker) {
      console.warn('⚠️ MARKECREATE: DuplicateChecker nicht verfügbar');
      return;
    }

    try {
      const result = await window.duplicateChecker.checkMarke(markenname, null);

      if (result.exact) {
        // Exakt vorhanden → Button disablen, Fehler anzeigen
        this.showDuplicateError(messageContainer, result.similar);
        this.disableSubmitButton(true);
      } else if (result.similar.length > 0) {
        // Ähnlich → Info-Box (nicht blockierend)
        this.showDuplicateWarning(messageContainer, result.similar);
        this.enableSubmitButton();
      } else {
        // Alles gut
        this.clearDuplicateMessages(messageContainer);
        this.enableSubmitButton();
      }
    } catch (error) {
      console.error('❌ MARKECREATE: Fehler bei Duplikat-Validierung:', error);
    }
  }

  // Zeige Duplikat-Fehler
  showDuplicateError(container, entries) {
    container.innerHTML = `
      <div class="duplicate-error">
        <strong>Dieser Markenname existiert bereits!</strong>
        ${entries.length > 0 ? `
          <ul class="duplicate-list">
            ${entries.map(entry => `
              <li class="duplicate-list-item">
                <a href="javascript:void(0)" class="duplicate-link" data-entity-id="${entry.id}">
                  ${entry.logo_url ? `<img src="${entry.logo_url}" alt="${entry.markenname}" class="duplicate-avatar" />` : '<div class="duplicate-avatar duplicate-avatar-placeholder"></div>'}
                  <span class="duplicate-name">${entry.markenname}${entry.unternehmen_name ? ` <span class="duplicate-meta">(${entry.unternehmen_name})</span>` : ''}</span>
                </a>
              </li>
            `).join('')}
          </ul>
        ` : ''}
      </div>
    `;
    
    // Event-Listener für Links
    this.bindDuplicateLinks(container, 'marke');
  }

  // Zeige Duplikat-Warnung
  showDuplicateWarning(container, entries) {
    container.innerHTML = `
      <div class="duplicate-warning">
        <strong>Folgende ähnliche Einträge gefunden:</strong>
        <ul class="duplicate-list">
          ${entries.map(entry => `
            <li class="duplicate-list-item">
              <a href="javascript:void(0)" class="duplicate-link" data-entity-id="${entry.id}">
                ${entry.logo_url ? `<img src="${entry.logo_url}" alt="${entry.markenname}" class="duplicate-avatar" />` : '<div class="duplicate-avatar duplicate-avatar-placeholder"></div>'}
                <span class="duplicate-name">${entry.markenname}${entry.unternehmen_name ? ` <span class="duplicate-meta">(${entry.unternehmen_name})</span>` : ''}</span>
              </a>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
    
    // Event-Listener für Links
    this.bindDuplicateLinks(container, 'marke');
  }

  // Bind Click-Events für Duplikat-Links
  bindDuplicateLinks(container, entityType) {
    const links = container.querySelectorAll('.duplicate-link[data-entity-id]');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = e.currentTarget.dataset.entityId;
        if (id) {
          // Internes Routing verwenden (ohne Reload, im gleichen Tab)
          const route = `/${entityType}/${id}`;
          if (window.navigationSystem) {
            window.navigationSystem.navigateTo(route);
          }
        }
      });
    });
  }

  // Lösche Duplikat-Messages
  clearDuplicateMessages(container) {
    if (container) {
      container.innerHTML = '';
    }
  }

  // Disable Submit Button
  disableSubmitButton(disable) {
    const form = document.getElementById('marke-form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = disable;
        if (disable) {
          submitBtn.style.opacity = '0.5';
          submitBtn.style.cursor = 'not-allowed';
        }
      }
    }
  }

  // Enable Submit Button
  enableSubmitButton() {
    const form = document.getElementById('marke-form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
      }
    }
  }

  // Setup Logo Preview für Upload
  setupLogoPreview(form) {
    const uploaderRoot = form.querySelector('.uploader[data-name="logo_file"]');
    if (!uploaderRoot) return;

    // Event für File-Input (falls vorhanden)
    const fileInput = uploaderRoot.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const previewContainer = document.getElementById('logo-preview-container');
            const previewImage = document.getElementById('logo-preview-image');
            if (previewContainer && previewImage) {
              previewImage.src = event.target.result;
              previewContainer.style.display = 'block';
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }
  }

  // Handle Form Submit für Seiten-Formular (kopiert von UnternehmenCreate)
  async handleFormSubmit() {
    try {
      console.log('🎯 MARKECREATE: Verarbeite Formular-Submit');
      
      // Loading-State
      const submitBtn = document.querySelector('#marke-form button[type="submit"]');
      let originalText = 'Marke anlegen'; // Default-Text
      if (submitBtn) {
        originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<div class="loading-spinner"></div> Wird angelegt...';
        submitBtn.disabled = true;
      }

      // Formular-Daten sammeln
      const form = document.getElementById('marke-form');
      const formData = new FormData(form);
      const data = {};
      
      // Multi-Select Felder zuerst sammeln (Tag-basierte)
      const allFormData = {};
      
      // Tag-basierte Multi-Selects verarbeiten (genau wie bei Unternehmen)
      const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
      console.log('🏷️ Tag-basierte Selects gefunden:', tagBasedSelects.length);
      
      tagBasedSelects.forEach(select => {
        // Suche das versteckte Select (OHNE [] wie bei Unternehmen)
        let hiddenSelect = form.querySelector(`select[name="${select.name}"][style*="display: none"]`);
        
        // Fallback: Nach allen Selects mit dem gleichen Namen
        if (!hiddenSelect) {
          const allSelects = form.querySelectorAll(`select[name="${select.name}"]`);
          if (allSelects.length > 1) {
            hiddenSelect = allSelects[1]; // Das zweite ist das versteckte
          }
        }
        
        if (hiddenSelect) {
          const selectedValues = Array.from(hiddenSelect.selectedOptions).map(option => option.value).filter(val => val !== '');
          if (selectedValues.length > 0) {
            allFormData[select.name] = selectedValues;
            console.log(`🏷️ Tag-basiertes Multi-Select ${select.name}:`, selectedValues);
          }
        }
      });
      
      // Spezielle Behandlung für Tag-basierte Multi-Selects - versteckte Selects manuell verarbeiten
      // Das versteckte Select wird möglicherweise nicht korrekt von FormData erfasst
      const hiddenBranchenSelect = form.querySelector('select[name="branche_ids[]"]');
      if (hiddenBranchenSelect && hiddenBranchenSelect.multiple) {
        const selectedOptions = Array.from(hiddenBranchenSelect.selectedOptions);
        if (selectedOptions.length > 0) {
          const branchenIds = selectedOptions.map(option => option.value).filter(val => val !== '');
          if (branchenIds.length > 0) {
            allFormData['branche_ids'] = branchenIds;
            console.log('🏷️ MARKECREATE: Verstecktes Branchen-Select manuell verarbeitet:', branchenIds);
          }
        }
      }
      
      // Standard FormData-Einträge sammeln (nur für Felder, die nicht bereits von Tag-basierten Selects verarbeitet wurden)
      for (let [key, value] of formData.entries()) {
        if (!allFormData.hasOwnProperty(key)) {
          if (key.includes('[]')) {
            // Multi-Select Array behandeln (z.B. branche_ids[])
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
      
      console.log('📤 Finale Marke-Daten:', data);

      // Validierung (wie bei Unternehmen)
      const validation = window.validatorSystem.validateForm(data, {
        markenname: { type: 'text', minLength: 2, required: true }
      });
      
      if (!validation.isValid) {
        this.showValidationErrors(validation.errors);
        return;
      }

      // Marke erstellen
      const result = await window.dataService.createEntity('marke', data);
      
      if (result.success) {
        // Logo-Upload (falls vorhanden)
        if (result.id) {
          try {
            console.log('🔵 START: Logo-Upload für Marke', result.id);
            await this.uploadLogo(result.id, form);
            console.log('✅ Logo-Upload abgeschlossen');
          } catch (logoErr) {
            console.error('❌ Logo-Upload fehlgeschlagen:', logoErr);
            if (logoErr && logoErr.message && !logoErr.message.includes('Kein Logo')) {
              alert('Logo konnte nicht hochgeladen werden: ' + logoErr.message);
            }
          }
        }

        this.showSuccessMessage('Marke erfolgreich erstellt!');
        
        // Kurz warten, dann zur Übersicht
        setTimeout(() => {
          window.navigateTo('/marke');
        }, 1500);
      } else {
        throw new Error(result.error || 'Fehler beim Erstellen der Marke');
      }
      
    } catch (error) {
      console.error('❌ Fehler beim Erstellen der Marke:', error);
      this.showErrorMessage(error.message || 'Ein unerwarteter Fehler ist aufgetreten');
    } finally {
      // Loading-State zurücksetzen
      const submitBtn = document.querySelector('#marke-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.innerHTML = 'Marke erstellen';
        submitBtn.disabled = false;
      }
    }
  }

  // Validierungsfehler anzeigen (kopiert von Unternehmen)
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
  
  // Erfolgsmeldung anzeigen (kopiert von Unternehmen)
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
  
  // Fehlermeldung anzeigen (kopiert von Unternehmen)
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

  // Logo-Upload
  async uploadLogo(markeId, form) {
    try {
      console.log('📋 uploadLogo() aufgerufen für Marke:', markeId);
      
      const uploaderRoot = form.querySelector('.uploader[data-name="logo_file"]');
      console.log('  → Uploader Root:', uploaderRoot);
      console.log('  → Uploader Instance:', uploaderRoot?.__uploaderInstance);
      console.log('  → Files:', uploaderRoot?.__uploaderInstance?.files);
      
      if (!uploaderRoot || !uploaderRoot.__uploaderInstance || !uploaderRoot.__uploaderInstance.files.length) {
        console.log('ℹ️ Kein Logo zum Hochladen (kein Uploader/keine Files)');
        return;
      }

      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - Logo-Upload übersprungen');
        return;
      }

      const files = uploaderRoot.__uploaderInstance.files;
      const file = files[0]; // Nur ein Logo erlaubt
      const bucket = 'logos';
      
      // Security: Max 200 KB
      const MAX_FILE_SIZE = 200 * 1024; // 200 KB
      const ALLOWED_TYPES = ['image/png', 'image/jpeg'];
      
      // Dateigröße prüfen
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`⚠️ Logo zu groß: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
        alert(`Logo ist zu groß (max. 200 KB)`);
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
      const path = `marke/${markeId}/logo.${ext}`;
      
      console.log(`📤 Uploading Logo: ${file.name} -> ${path}`);
      
      // Altes Logo löschen (falls vorhanden)
      try {
        const { data: existingFiles } = await window.supabase.storage
          .from(bucket)
          .list(`marke/${markeId}`);
        
        if (existingFiles && existingFiles.length > 0) {
          for (const existingFile of existingFiles) {
            await window.supabase.storage
              .from(bucket)
              .remove([`marke/${markeId}/${existingFile.name}`]);
          }
        }
      } catch (deleteErr) {
        console.warn('⚠️ Fehler beim Löschen alter Logos:', deleteErr);
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
        console.error(`❌ Logo-Upload-Fehler:`, upErr);
        throw upErr;
      }
      
      // Öffentliche URL erstellen (permanent verfügbar)
      const { data: publicUrlData } = window.supabase.storage
        .from(bucket)
        .getPublicUrl(path);
      
      const logo_url = publicUrlData?.publicUrl || '';
      
      // Logo-Daten in Datenbank speichern
      const { error: dbErr } = await window.supabase
        .from('marke')
        .update({
          logo_url,
          logo_path: path
        })
        .eq('id', markeId);
      
      if (dbErr) {
        console.error(`❌ DB-Fehler beim Speichern der Logo-URL:`, dbErr);
        throw dbErr;
      }
      
      console.log(`✅ Logo erfolgreich hochgeladen`);
    } catch (error) {
      console.error('❌ Fehler beim Logo-Upload:', error);
      alert(`⚠️ Logo konnte nicht hochgeladen werden: ${error.message}`);
      // Nicht werfen - Marke wurde bereits erstellt
    }
  }

  // Destroy
  destroy() {
    console.log('🎯 MARKECREATE: Destroy');
  }
}

// Exportiere Instanz für globale Nutzung
export const markeCreate = new MarkeCreate();
