// ProduktCreate.js (ES6-Modul)
// Produkt-Erstellungsseite

export class ProduktCreate {
  constructor() {
    this.formData = {};
  }

  // Initialisiere Produkt-Erstellung
  async init() {
    console.log('🎯 PRODUKTCREATE: Initialisiere Produkt-Erstellung');
    this.showCreateForm();
  }

  // Show Create Form
  showCreateForm() {
    console.log('🎯 PRODUKTCREATE: Zeige Produkt-Erstellungsformular mit FormSystem');
    window.setHeadline('Neues Produkt anlegen');
    
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateDetailLabel('Neues Produkt');
    }
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('produkt');
    window.content.innerHTML = `
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    // Formular-Events binden
    window.formSystem.bindFormEvents('produkt', null);
    
    // Custom Submit Handler für Seiten-Formular
    const form = document.getElementById('produkt-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      };
      
      // Duplikat-Validierung auf Produkt-Name + Marke
      this.setupDuplicateValidation(form);
    }
  }

  // Setup Duplikat-Validierung für Produkt-Name
  setupDuplicateValidation(form) {
    const nameField = form.querySelector('#name, input[name="name"]');
    if (!nameField) {
      console.warn('⚠️ PRODUKTCREATE: Name-Feld nicht gefunden');
      return;
    }

    // Container für Duplicate-Messages (falls nicht existiert)
    let messageContainer = nameField.parentElement.querySelector('.duplicate-message-container');
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.className = 'duplicate-message-container';
      nameField.parentElement.appendChild(messageContainer);
    }

    // Blur Event
    nameField.addEventListener('blur', async (e) => {
      await this.validateProduktDuplicate(e.target.value, messageContainer);
    });

    // Clear beim Tippen
    nameField.addEventListener('input', () => {
      this.clearDuplicateMessages(messageContainer);
      this.enableSubmitButton();
    });
  }

  // Validiere Produkt Duplikat
  async validateProduktDuplicate(name, messageContainer) {
    if (!name || name.trim().length < 2) {
      this.clearDuplicateMessages(messageContainer);
      return;
    }

    try {
      // Suche nach Produkt mit gleichem Namen
      const { data: existingProdukte, error } = await window.supabase
        .from('produkt')
        .select('id, name, marke:marke_id(markenname)')
        .ilike('name', name.trim());

      if (error) {
        console.error('❌ PRODUKTCREATE: Fehler bei Duplikat-Prüfung:', error);
        return;
      }

      if (existingProdukte && existingProdukte.length > 0) {
        // Prüfe ob exakt gleicher Name
        const exactMatch = existingProdukte.find(p => 
          p.name.toLowerCase() === name.trim().toLowerCase()
        );

        if (exactMatch) {
          this.showDuplicateWarning(messageContainer, existingProdukte);
        } else {
          this.clearDuplicateMessages(messageContainer);
        }
      } else {
        this.clearDuplicateMessages(messageContainer);
      }
    } catch (error) {
      console.error('❌ PRODUKTCREATE: Fehler bei Duplikat-Validierung:', error);
    }
  }

  // Zeige Duplikat-Warnung
  showDuplicateWarning(container, entries) {
    container.innerHTML = `
      <div class="duplicate-warning">
        <strong>Folgende ähnliche Produkte gefunden:</strong>
        <ul class="duplicate-list">
          ${entries.map(entry => `
            <li class="duplicate-list-item">
              <a href="javascript:void(0)" class="duplicate-link" data-entity-id="${entry.id}">
                <span class="duplicate-name">${entry.name}${entry.marke?.markenname ? ` <span class="duplicate-meta">(${entry.marke.markenname})</span>` : ''}</span>
              </a>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
    
    // Event-Listener für Links
    this.bindDuplicateLinks(container, 'produkt');
  }

  // Bind Click-Events für Duplikat-Links
  bindDuplicateLinks(container, entityType) {
    const links = container.querySelectorAll('.duplicate-link[data-entity-id]');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = e.currentTarget.dataset.entityId;
        if (id) {
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
    const form = document.getElementById('produkt-form');
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
    const form = document.getElementById('produkt-form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
      }
    }
  }

  // Handle Form Submit für Seiten-Formular
  async handleFormSubmit() {
    try {
      console.log('🎯 PRODUKTCREATE: Verarbeite Formular-Submit');
      
      // Loading-State
      const submitBtn = document.querySelector('#produkt-form button[type="submit"]');
      let originalText = 'Produkt anlegen';
      if (submitBtn) {
        originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<div class="loading-spinner"></div> Wird angelegt...';
        submitBtn.disabled = true;
      }

      // Formular-Daten sammeln
      const form = document.getElementById('produkt-form');
      const formData = new FormData(form);
      const data = {};
      
      // Multi-Select Felder sammeln
      const allFormData = {};
      
      // Tag-basierte Multi-Selects verarbeiten
      const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
      console.log('🏷️ Tag-basierte Selects gefunden:', tagBasedSelects.length);
      
      tagBasedSelects.forEach(select => {
        // Zuerst mit [], dann ohne (wie in FormSubmitHelper.js) - Hidden Select wird mit [] erstellt
        let hiddenSelect = form.querySelector(`select[name="${select.name}[]"][style*="display: none"]`);
        if (!hiddenSelect) {
          hiddenSelect = form.querySelector(`select[name="${select.name}"][style*="display: none"]`);
        }
        if (!hiddenSelect) {
          const allSelects = form.querySelectorAll(`select[name="${select.name}"]`);
          if (allSelects.length > 1) {
            hiddenSelect = allSelects[1];
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
      
      // Spezielle Behandlung für Pflicht-Elemente und No-Gos
      const pflichtElementeSelect = form.querySelector('select[name="pflicht_elemente_ids[]"]');
      if (pflichtElementeSelect && pflichtElementeSelect.multiple) {
        const selectedOptions = Array.from(pflichtElementeSelect.selectedOptions);
        if (selectedOptions.length > 0) {
          const ids = selectedOptions.map(option => option.value).filter(val => val !== '');
          if (ids.length > 0) {
            allFormData['pflicht_elemente_ids[]'] = ids;
            console.log('🏷️ PRODUKTCREATE: Pflicht-Elemente gesammelt:', ids);
          }
        }
      }
      
      const noGoSelect = form.querySelector('select[name="no_go_ids[]"]');
      if (noGoSelect && noGoSelect.multiple) {
        const selectedOptions = Array.from(noGoSelect.selectedOptions);
        if (selectedOptions.length > 0) {
          const ids = selectedOptions.map(option => option.value).filter(val => val !== '');
          if (ids.length > 0) {
            allFormData['no_go_ids[]'] = ids;
            console.log('🏷️ PRODUKTCREATE: No-Gos gesammelt:', ids);
          }
        }
      }
      
      // Standard FormData-Einträge sammeln
      for (let [key, value] of formData.entries()) {
        if (!allFormData.hasOwnProperty(key)) {
          if (key.includes('[]')) {
            const cleanKey = key.replace('[]', '');
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
          allFormData[key] = [...new Set(value)];
        }
      }
      
      // Finale Daten zusammenstellen
      for (let [key, value] of Object.entries(allFormData)) {
        data[key] = Array.isArray(value) ? value : (typeof value === 'string' ? value.trim() : value);
      }
      
      // URL-Felder: https:// automatisch hinzufügen
      if (data.url && data.url.trim() !== '') {
        let urlValue = data.url.trim();
        if (!urlValue.match(/^https?:\/\//i)) {
          data.url = 'https://' + urlValue;
          console.log('🔗 URL: https:// Präfix hinzugefügt ->', data.url);
        }
      }
      
      // unternehmen_id von marke übernehmen falls nicht gesetzt
      if (data.marke_id && !data.unternehmen_id) {
        try {
          const { data: markeData } = await window.supabase
            .from('marke')
            .select('unternehmen_id')
            .eq('id', data.marke_id)
            .single();
          
          if (markeData?.unternehmen_id) {
            data.unternehmen_id = markeData.unternehmen_id;
            console.log('🏢 PRODUKTCREATE: unternehmen_id von Marke übernommen:', data.unternehmen_id);
          }
        } catch (err) {
          console.warn('⚠️ PRODUKTCREATE: Konnte unternehmen_id nicht von Marke laden:', err);
        }
      }
      
      console.log('📤 Finale Produkt-Daten:', data);

      // Validierung
      const validation = window.validatorSystem.validateForm(data, {
        name: { type: 'text', minLength: 2, required: true },
        marke_id: { required: true },
        kernbotschaft: { type: 'text', minLength: 2, required: true },
        hauptproblem: { type: 'text', minLength: 2, required: true }
      });
      
      if (!validation.isValid) {
        this.showValidationErrors(validation.errors);
        return;
      }

      // Produkt erstellen
      const result = await window.dataService.createEntity('produkt', data);
      
      if (result.success) {
        // Many-to-Many Relationen speichern
        if (result.id) {
          await this.saveManyToManyRelations(result.id, data);
        }

        this.showSuccessMessage('Produkt erfolgreich erstellt!');
        
        // Kurz warten, dann zur Übersicht
        setTimeout(() => {
          window.navigateTo('/produkt');
        }, 1500);
      } else {
        throw new Error(result.error || 'Fehler beim Erstellen des Produkts');
      }
      
    } catch (error) {
      console.error('❌ Fehler beim Erstellen des Produkts:', error);
      this.showErrorMessage(error.message || 'Ein unerwarteter Fehler ist aufgetreten');
    } finally {
      // Loading-State zurücksetzen
      const submitBtn = document.querySelector('#produkt-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.innerHTML = 'Produkt erstellen';
        submitBtn.disabled = false;
      }
    }
  }
  
  // Speichere Many-to-Many Relationen
  async saveManyToManyRelations(produktId, data) {
    try {
      if (!produktId || !window.supabase) return;
      
      console.log('🔄 PRODUKTCREATE: Speichere Many-to-Many Relationen für Produkt:', produktId);
      
      // Pflicht-Elemente speichern
      const pflichtElementeIds = data['pflicht_elemente_ids[]'] || data.pflicht_elemente_ids || [];
      if (pflichtElementeIds.length > 0) {
        const pflichtElementeData = pflichtElementeIds.map(id => ({
          produkt_id: produktId,
          pflicht_element_id: id
        }));
        
        const { error } = await window.supabase
          .from('produkt_pflicht_elemente')
          .insert(pflichtElementeData);
        
        if (error) {
          console.error('❌ Fehler beim Speichern der Pflicht-Elemente:', error);
        } else {
          console.log(`✅ ${pflichtElementeData.length} Pflicht-Elemente gespeichert`);
        }
      }
      
      // No-Gos speichern
      const noGoIds = data['no_go_ids[]'] || data.no_go_ids || [];
      if (noGoIds.length > 0) {
        const noGoData = noGoIds.map(id => ({
          produkt_id: produktId,
          no_go_id: id
        }));
        
        const { error } = await window.supabase
          .from('produkt_no_gos')
          .insert(noGoData);
        
        if (error) {
          console.error('❌ Fehler beim Speichern der No-Gos:', error);
        } else {
          console.log(`✅ ${noGoData.length} No-Gos gespeichert`);
        }
      }
      
      console.log('✅ PRODUKTCREATE: Many-to-Many Relationen gespeichert');
    } catch (error) {
      console.error('❌ PRODUKTCREATE: Fehler beim Speichern der Many-to-Many Relationen:', error);
    }
  }

  // Validierungsfehler anzeigen
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
  
  // Erfolgsmeldung anzeigen
  showSuccessMessage(message) {
    if (window.toastSystem) {
      window.toastSystem.success(message);
    } else {
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
      
      setTimeout(() => toast.style.opacity = '1', 100);
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  }
  
  // Fehlermeldung anzeigen
  showErrorMessage(message) {
    if (window.toastSystem) {
      window.toastSystem.error(message);
    } else {
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
      
      setTimeout(() => toast.style.opacity = '1', 100);
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  }

  // Destroy
  destroy() {
    console.log('🎯 PRODUKTCREATE: Destroy');
  }
}

// Exportiere Instanz für globale Nutzung
export const produktCreate = new ProduktCreate();
