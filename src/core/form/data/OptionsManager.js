export class OptionsManager {
  // Verhindere mehrfache Erstellung von Tag-basierten Selects
  static createdTagBasedSelects = new Set();

  // Select-Optionen aktualisieren
  updateSelectOptions(selectElement, options, field) {
    console.log('🔧 Update Select-Optionen für:', field.name, 'mit', options.length, 'Optionen');
    
    // Prüfe ob es ein searchable Select ist
    if (selectElement.dataset.searchable === 'true') {
      console.log('🔧 Reinitialisiere Auto-Suggestion für:', field.name);
      this.reinitializeSearchableSelect(selectElement, options, field);
      return;
    }
    
    // Standard Select-Element aktualisieren
    selectElement.innerHTML = '';
    
    // Placeholder hinzufügen
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = field.placeholder || 'Bitte wählen...';
    selectElement.appendChild(placeholder);
    
    // Optionen hinzufügen
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      if (option.selected) {
        optionElement.selected = true;
      }
      selectElement.appendChild(optionElement);
    });
  }

  // Searchable Select reinitialisieren
  reinitializeSearchableSelect(selectElement, options, field) {
    console.log('🔧 OPTIONSMANAGER: Reinitialisiere Searchable Select für:', field.name, 'mit', options.length, 'Optionen');
    
    // Prüfe ob bereits ein Container existiert (als nextElementSibling)
    const existingContainer = selectElement.nextElementSibling;
    if (existingContainer && (existingContainer.classList.contains('searchable-select-container') || existingContainer.classList.contains('tag-based-select'))) {
      console.log('🔄 OPTIONSMANAGER: Aktualisiere bestehenden Container für:', field.name);
      
      // Dropdown aktualisieren
      const dropdown = existingContainer.querySelector('.searchable-select-dropdown');
      if (dropdown) {
        this.updateDropdownItems(dropdown, options, '');
        console.log('✅ OPTIONSMANAGER: Dropdown Items aktualisiert');
      }
      
      // Input-Feld aktivieren
      const input = existingContainer.querySelector('.searchable-select-input');
      if (input) {
        input.disabled = false;
        input.placeholder = field.placeholder || 'Suchen...';
        input.readOnly = false;
        console.log('✅ OPTIONSMANAGER: Input-Feld aktiviert für:', field.name);
      }
      
      return;
    }
    
    // Alte Container entfernen (falls an anderer Stelle)
    const oldContainer = selectElement.parentNode.querySelector('.searchable-select-container, .tag-based-select');
    if (oldContainer && oldContainer !== existingContainer) {
      console.log('🗑️ OPTIONSMANAGER: Entferne alten Container für:', field.name);
      oldContainer.remove();
    }

    // Das ursprüngliche Select soll versteckt bleiben
    selectElement.style.display = 'none';
    
    // Neue Auto-Suggestion erstellen
    console.log('🆕 OPTIONSMANAGER: Erstelle neuen Searchable Select für:', field.name);
    this.createSearchableSelect(selectElement, options, field);
  }

  // Searchable Select erstellen
  createSearchableSelect(selectElement, options, field) {
    // Diese Methode wird von außen injiziert
    console.log('🔧 Searchable Select erstellen für:', field.name);
  }

  // Dropdown-Items aktualisieren
  updateDropdownItems(dropdown, options, filterText) {
    dropdown.innerHTML = '';
    // Merke aktualisierte Optionsbasis am Container, damit spätere Suchen/Fokus die neuen Optionen verwenden
    try { dropdown.parentNode.dataset.options = JSON.stringify(options || []); } catch (_) {}
    
    const filteredOptions = options.filter(option => 
      option.label.toLowerCase().includes(filterText.toLowerCase())
    );

    filteredOptions.forEach(option => {
      const item = document.createElement('div');
      item.className = 'searchable-select-item';
      item.textContent = option.label;
      item.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #f3f4f6;
      `;

      item.addEventListener('click', () => {
        // Original Select aktualisieren
        const selectElement = dropdown.parentNode.parentNode.querySelector('select');
        selectElement.value = option.value;
        
        // Input aktualisieren
        const input = dropdown.parentNode.querySelector('input');
        input.value = option.label;
        
        // Event auslösen (mit bubbles für DependentFields)
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Dropdown schließen
        dropdown.classList.remove('show');
      });

      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = '#f3f4f6';
      });

      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'white';
      });

      dropdown.appendChild(item);
    });
  }

  // Tag-basierte Select-Optionen verwalten
  createTagBasedSelect(selectElement, options, field) {
    console.log(`🏷️ Erstelle Tag-basiertes Select für ${field.name} mit ${options.length} Optionen:`, options.slice(0, 3));
    console.log(`🏷️ Bestehendes verstecktes Select:`, document.getElementById(selectElement.id + '_hidden'));

    // Verhindere mehrfache Erstellung - ABER erlaube Re-Initialisierung mit neuen Optionen
    const selectId = selectElement.id;
    if (this.constructor.createdTagBasedSelects.has(selectId)) {
      console.log(`🔄 Tag-basiertes Select für ${field.name} bereits vorhanden - prüfe ob Update nötig`);
      
      // Prüfe ob ein Container existiert und funktional ist
      const existingContainer = selectElement.parentNode.querySelector('.tag-based-select');
      const existingInput = existingContainer?.querySelector('.searchable-select-input');
      
      if (existingContainer && existingInput) {
        // System existiert - aktualisiere die Optionen VOLLSTÄNDIG
        console.log(`🔄 Aktualisiere bestehende Optionen vollständig für ${field.name} (${options.length} Optionen)`);
        
        // 1. Optionen-Dataset aktualisieren
        try { 
          existingContainer.dataset.options = JSON.stringify(options); 
          console.log(`✅ Dataset-Optionen aktualisiert für ${field.name}`);
        } catch (_) {}
        
        // 2. Original Select aktualisieren
        selectElement.innerHTML = '<option value="">Bitte wählen...</option>';
        options.forEach(option => {
          const optionElement = document.createElement('option');
          optionElement.value = option.value;
          optionElement.textContent = option.label;
          selectElement.appendChild(optionElement);
        });
        
        // 3. Dropdown sofort aktualisieren (nicht warten bis zum nächsten Öffnen!)
        const dropdown = existingContainer.querySelector('.searchable-select-dropdown');
        if (dropdown) {
          this.updateDropdownItems(dropdown, options, '');
          console.log(`✅ Dropdown sofort aktualisiert für ${field.name}`);
        }
        
        // 4. Ungültige Tags entfernen (Tags deren Optionen nicht mehr verfügbar sind)
        const optionValues = new Set(options.map(opt => opt.value));
        const tags = existingContainer.querySelectorAll('.tag');
        const tagsToRemove = [];
        
        tags.forEach(tag => {
          const tagValue = tag.dataset?.value;
          if (tagValue && !optionValues.has(tagValue)) {
            console.log(`🗑️ Markiere ungültigen Tag zum Entfernen: ${tagValue}`);
            tagsToRemove.push({ tag, value: tagValue });
          }
        });
        
        // Tags tatsächlich entfernen
        if (tagsToRemove.length > 0) {
          const hiddenSelect = existingContainer.querySelector('select[style*="display: none"]');
          tagsToRemove.forEach(({ tag, value }) => {
            tag.remove();
            // Auch aus dem versteckten Select entfernen
            if (hiddenSelect) {
              const optionToRemove = Array.from(hiddenSelect.options).find(opt => opt.value === value);
              if (optionToRemove) {
                hiddenSelect.removeChild(optionToRemove);
              }
            }
          });
          console.log(`✅ ${tagsToRemove.length} ungültige Tag(s) entfernt`);
        }
        
        // 5. Input wieder aktivieren falls deaktiviert (auch bei 0 Optionen!)
        existingInput.disabled = options.length === 0;
        if (options.length === 0) {
          existingInput.placeholder = 'Erst Unternehmen auswählen...';
        } else {
          existingInput.placeholder = field.placeholder || 'Suchen und Tags hinzufügen...';
        }
        
        console.log(`✅ Optionen für ${field.name} vollständig aktualisiert (Input ${existingInput.disabled ? 'deaktiviert' : 'aktiviert'})`);
        return;
      } else {
        // System ist kaputt oder unvollständig - entferne und neu erstellen
        console.log(`🗑️ Entferne defektes Tag-System für ${field.name}`);
        if (existingContainer) existingContainer.remove();
        this.constructor.createdTagBasedSelects.delete(selectId);
      }
    }
    
    // Markiere als erstellt
    this.constructor.createdTagBasedSelects.add(selectId);

    // Prüfe ob bereits ein verstecktes Select existiert und übernehme die Werte
    let existingHiddenSelect = document.getElementById(selectElement.id + '_hidden');
    let selectedValues = new Set();

    if (existingHiddenSelect) {
      console.log('🔄 Übernehme bestehende Werte für:', field.name);
      console.log('🔄 Bestehende Optionen:', Array.from(existingHiddenSelect.options).map(o => ({ value: o.value, selected: o.selected })));
      // Bestehende Werte aus dem versteckten Select übernehmen
      Array.from(existingHiddenSelect.selectedOptions).forEach(option => {
        selectedValues.add(option.value);
      });
      console.log('📋 Übernommene Werte:', Array.from(selectedValues));
    }

    // Ausgewählte Werte verwalten (bereits oben definiert)

    // Bestehende Tag-basierte Container entfernen (nur wenn nicht das gleiche)
    const existingContainer = selectElement.parentNode.querySelector('.tag-based-select');
    if (existingContainer && existingContainer !== container) {
      console.log('🗑️ Entferne bestehenden Tag-basierten Container');
      existingContainer.remove();
    }

    // Container für das neue Element
    const container = document.createElement('div');
    container.className = 'searchable-select-container tag-based-select';
    // Initiale Optionsbasis speichern – wird von Updates überschrieben
    try { container.dataset.options = JSON.stringify(options || []); } catch (_) {}

    // Input-Feld für Suche
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'searchable-select-input';
    input.placeholder = field.placeholder || selectElement.dataset?.placeholder || 'Suchen und Tags hinzufügen...';
    // Explizite Styles für Sichtbarkeit
    input.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      background: white;
      display: block;
      box-sizing: border-box;
    `;

    // Tags-Container
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'tags-container';
    tagsContainer.style.display = 'flex'; // Immer sichtbar, auch wenn leer
    tagsContainer.style.flexWrap = 'wrap';
    tagsContainer.style.gap = '0.5rem';
    tagsContainer.style.minHeight = '32px';
    tagsContainer.style.padding = '0.5rem';
    tagsContainer.style.border = '1px solid #d1d5db';
    tagsContainer.style.borderRadius = '6px';
    tagsContainer.style.marginTop = '0.5rem';
    tagsContainer.style.backgroundColor = '#f9fafb';

    // Dropdown-Liste
    const dropdown = document.createElement('div');
    dropdown.className = 'searchable-select-dropdown';
    // Styling via CSS-Klassen

    // Verstecktes Select für Form-Submission
    let hiddenSelect;
    if (existingHiddenSelect) {
      hiddenSelect = existingHiddenSelect;
      console.log('🔄 Verwende bestehendes verstecktes Select für:', field.name);
      console.log('🔄 Bestehende Optionen im versteckten Select:', Array.from(hiddenSelect.options).map(o => o.value));
    } else {
      hiddenSelect = document.createElement('select');
      hiddenSelect.name = selectElement.name + '[]'; // Name mit [] für korrekte Multi-Value Form-Submission
      hiddenSelect.id = selectElement.id + '_hidden';
      hiddenSelect.multiple = true;
      hiddenSelect.style.display = 'none';
      existingHiddenSelect = hiddenSelect;
      console.log('🔄 Erstelle neues verstecktes Select für:', field.name);
    }
    
    // Tag erstellen (ohne Inline-Styles → CSS-Klassen verwenden)
    const createTag = (value, label) => {
      const tag = document.createElement('div');
      tag.className = 'tag';
      // Wichtig: Wert am Tag speichern, damit abhängige Refreshes ungültige Tags entfernen können
      try { tag.dataset.value = value; } catch (_) {}

      const tagText = document.createElement('span');
      tagText.textContent = label;

      const removeBtn = document.createElement('span');
      removeBtn.textContent = '×';
      removeBtn.className = 'tag-remove';

      removeBtn.addEventListener('click', () => {
        selectedValues.delete(value);
        tagsContainer.removeChild(tag);
        updateHiddenSelect();
      });

      tag.appendChild(tagText);
      tag.appendChild(removeBtn);

      return tag;
    };
    
    // Tags-Container Sichtbarkeit aktualisieren (immer sichtbar für bessere UX)
    const updateTagsContainerVisibility = () => {
      // Container ist immer sichtbar, zeigt aber Placeholder-Text wenn leer
      if (selectedValues.size > 0) {
        tagsContainer.style.backgroundColor = '#f9fafb';
      } else {
        tagsContainer.style.backgroundColor = '#f3f4f6';
        // Optional: Placeholder-Text hinzufügen wenn leer
        if (tagsContainer.children.length === 0) {
          const placeholder = document.createElement('span');
          placeholder.className = 'tags-placeholder';
          placeholder.textContent = 'Keine Auswahl';
          placeholder.style.color = '#6b7280';
          placeholder.style.fontStyle = 'italic';
          placeholder.style.fontSize = '14px';
          tagsContainer.appendChild(placeholder);
        }
      }
      
      // Placeholder entfernen wenn Tags hinzugefügt werden
      const placeholder = tagsContainer.querySelector('.tags-placeholder');
      if (placeholder && selectedValues.size > 0) {
        placeholder.remove();
      }
    };

    // Verstecktes Select aktualisieren
    const updateHiddenSelect = () => {
      console.log(`🔄 UPDATEHIDDENSELECT: Aktualisiere verstecktes Select für ${field.name}`);
      console.log(`🔄 UPDATEHIDDENSELECT: selectedValues enthält:`, Array.from(selectedValues));

      hiddenSelect.innerHTML = '';
      selectedValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.selected = true;
        // WICHTIG: Textinhalt setzen für bessere Debugging-Sichtbarkeit
        option.textContent = value;
        hiddenSelect.appendChild(option);
        console.log(`🔄 UPDATEHIDDENSELECT: Füge Option hinzu: ${value} (selected: ${option.selected})`);
      });

      console.log(`🔄 UPDATEHIDDENSELECT: Verstecktes Select hat jetzt ${hiddenSelect.options.length} Optionen`);
      console.log(`🔄 UPDATEHIDDENSELECT: Alle Optionen sind selected:`, Array.from(hiddenSelect.options).map(o => ({value: o.value, selected: o.selected})));

      // Spiegeln in das originale Select (damit Fallback-Collector es auch findet)
      try {
        selectElement.innerHTML = '';
        selectedValues.forEach(value => {
          const opt = document.createElement('option');
          opt.value = value;
          opt.selected = true;
          opt.textContent = value;
          selectElement.appendChild(opt);
        });
        console.log(`🔄 UPDATEHIDDENSELECT: Original Select gespiegelt mit ${selectElement.options.length} Optionen`);
      } catch (e) {
        console.warn('⚠️ UPDATEHIDDENSELECT: Fehler beim Spiegeln in Original Select:', e);
      }
      
      // Tags-Container Sichtbarkeit aktualisieren
      updateTagsContainerVisibility();
      
      // Event auslösen
      const event = new Event('change', { bubbles: true });
      hiddenSelect.dispatchEvent(event);
    };
    
    // Bereits ausgewählte Optionen laden (für Edit-Modus)
    const preselectedOptions = options.filter(opt => opt.selected);
    console.log('🎯 Bereits ausgewählte Optionen für Tag-Select:', preselectedOptions);
    
    // Preselected Tags hinzufügen (nur wenn noch nicht vorhanden)
    preselectedOptions.forEach(option => {
      if (!selectedValues.has(option.value)) {
        selectedValues.add(option.value);
        const tag = createTag(option.value, option.label);
        tagsContainer.appendChild(tag);
        console.log(`✅ Preselected Tag hinzugefügt: ${option.label}`);
      } else {
        console.log(`⚠️ Preselected Tag bereits vorhanden: ${option.label}`);
      }
    });
    
    // Initial aktualisieren
    updateHiddenSelect();
    
    // Helper: aktuelle Optionsbasis lesen (inkl. späterer Updates)
    const getOptions = () => {
      try {
        const raw = container.dataset.options || '[]';
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : (options || []);
      } catch (_) { return options || []; }
    };

    // Dropdown-Optionen erstellen
    const createDropdownItems = (list) => {
      dropdown.innerHTML = '';
      const base = Array.isArray(list) ? list : getOptions();
      
      if (base.length === 0) {
        const noResults = document.createElement('div');
        noResults.textContent = 'Keine Ergebnisse';
        noResults.className = 'searchable-select-empty';
        dropdown.appendChild(noResults);
        return;
      }
      
      base.forEach(option => {
        // Prüfe ob bereits ausgewählt
        if (selectedValues.has(option.value)) {
          return;
        }
        
        const item = document.createElement('div');
        item.className = 'searchable-select-item';
        item.dataset.value = option.value;
        
        // Hauptname
        const nameSpan = document.createElement('span');
        nameSpan.className = 'branch-name';
        nameSpan.textContent = option.label;
        item.appendChild(nameSpan);
        
        // Beschreibung falls vorhanden
        if (option.description) {
          const descSpan = document.createElement('span');
          descSpan.className = 'branch-description';
          descSpan.textContent = option.description;
          item.appendChild(descSpan);
        }
        item.classList.add('searchable-select-item');
        
        // Hover-Effekt
        item.addEventListener('mouseenter', () => item.classList.add('hover'));
        item.addEventListener('mouseleave', () => item.classList.remove('hover'));
        
        // Klick-Handler
        item.addEventListener('click', () => {
          console.log(`🖱️ Klick auf Option: ${option.value}, selectedValues vorher:`, Array.from(selectedValues));
          selectedValues.add(option.value);
          console.log(`🖱️ selectedValues nach add:`, Array.from(selectedValues));

          // Tag erstellen und hinzufügen
          const tag = createTag(option.value, option.label);
          tagsContainer.appendChild(tag);

          // Input leeren
          input.value = '';

          // Dropdown schließen
          dropdown.classList.remove('show');

          // Verstecktes Select aktualisieren
          updateHiddenSelect();

          console.log(`✅ Tag hinzugefügt: ${option.value}`);
        });
        
        dropdown.appendChild(item);
      });
    };
    
    // Input-Events
    input.addEventListener('focus', () => {
      dropdown.classList.add('show');
      createDropdownItems();
    });
    
    input.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const list = getOptions();
      const filtered = list.filter(option => 
        option.label.toLowerCase().includes(searchTerm) && !selectedValues.has(option.value)
      );
      createDropdownItems(filtered);
    });
    
    // Click-Outside Handler
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    });
    
    // Escape-Key Handler
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dropdown.classList.remove('show');
      }
    });
    
    // Elemente zusammenbauen
    container.appendChild(input);
    container.appendChild(tagsContainer);
    container.appendChild(dropdown);
    container.appendChild(hiddenSelect);
    
    // Originales Select komplett verstecken und Container davor einfügen
    selectElement.style.display = 'none';
    selectElement.parentNode.insertBefore(container, selectElement);
    
    // Verstecktes Select an das Formular anhängen (nur wenn noch nicht vorhanden)
    const form = container.closest('form');
    if (form) {
      const existingHiddenInForm = form.querySelector(`select[name="${hiddenSelect.name}"]`);
      console.log(`📋 Formular prüfen für ${hiddenSelect.name}:`, existingHiddenInForm ? 'bereits vorhanden' : 'nicht vorhanden');
      if (!existingHiddenInForm) {
        form.appendChild(hiddenSelect);
        console.log(`✅ Verstecktes Select ${hiddenSelect.name} zum Formular hinzugefügt`);
      } else {
        console.log('⚠️ Verstecktes Select bereits im Formular vorhanden');
      }
    }
    
    console.log(`✅ Tag-basierte Auto-Suggestion Select erstellt für ${field.name}`);
  }
} 