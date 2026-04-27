export class OptionsManager {
  // Verhindere mehrfache Erstellung von Tag-basierten Selects
  static createdTagBasedSelects = new Set();
  // AbortControllers für Document-Level Event-Listener (Cleanup bei Formular-Wechsel)
  static _abortControllers = [];

  // Select-Optionen aktualisieren
  updateSelectOptions(selectElement, options, field) {
    // Prüfe ob es ein searchable Select ist
    if (selectElement.dataset.searchable === 'true') {
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
    if (selectElement.dataset.tagBased === 'true' && field.tagBased) {
      if (this.createTagBasedSelect) {
        this.createTagBasedSelect(selectElement, options, field);
        return;
      }
    }

    const existingContainer = selectElement.nextElementSibling;
    if (existingContainer && (existingContainer.classList.contains('searchable-select-container') || existingContainer.classList.contains('tag-based-select'))) {
      const dropdown = existingContainer.querySelector('.searchable-select-dropdown');
      if (dropdown) {
        this.updateDropdownItems(dropdown, options, '');
      }
      
      const input = existingContainer.querySelector('.searchable-select-input');
      if (input) {
        input.disabled = false;
        input.placeholder = field.placeholder || 'Suchen...';
        input.readOnly = false;
      }
      
      return;
    }
    
    const oldContainer = selectElement.parentNode.querySelector('.searchable-select-container, .tag-based-select');
    if (oldContainer && oldContainer !== existingContainer) {
      oldContainer.remove();
    }

    selectElement.style.display = 'none';
    this.createSearchableSelect(selectElement, options, field);
  }

  // Searchable Select erstellen
  createSearchableSelect(selectElement, options, field) {
    // Diese Methode wird von außen injiziert
  }

  // Tag-basierte Dropdown-Items aktualisieren (für Multi-Select mit Tags)
  updateTagBasedDropdownItems(dropdown, options, selectElement, tagsContainer, field, filterText = '') {
    dropdown.innerHTML = '';
    
    // Bereits ausgewählte Werte sammeln
    const selectedValues = new Set(
      Array.from(tagsContainer.querySelectorAll('.tag'))
        .map(tag => tag.dataset?.value)
        .filter(Boolean)
    );
    
    // Nur nicht-ausgewählte Optionen anzeigen und nach Filtertext filtern
    const availableOptions = options.filter(opt => 
      !selectedValues.has(opt.value) && 
      opt.label.toLowerCase().includes(filterText.toLowerCase())
    );
    
    if (availableOptions.length === 0) {
      const noResults = document.createElement('div');
      noResults.textContent = 'Keine weiteren Optionen';
      noResults.className = 'searchable-select-empty';
      dropdown.appendChild(noResults);
      return;
    }
    
    availableOptions.forEach(option => {
      const item = document.createElement('div');
      item.className = 'searchable-select-item';
      item.dataset.value = option.value;
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'branch-name';
      nameSpan.textContent = option.label;
      item.appendChild(nameSpan);
      
      // Hover-Effekte
      item.addEventListener('mouseenter', () => item.classList.add('hover'));
      item.addEventListener('mouseleave', () => item.classList.remove('hover'));
      
      // Klick-Handler: Tag erstellen
      item.addEventListener('click', () => {
        // Tag erstellen
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.dataset.value = option.value;
        
        const tagText = document.createElement('span');
        tagText.textContent = option.label;
        
        const removeBtn = document.createElement('span');
        removeBtn.textContent = '×';
        removeBtn.className = 'tag-remove';
        
        // Remove-Handler
        removeBtn.addEventListener('click', () => {
          tag.remove();
          // Aus verstecktem Select entfernen
          const hiddenSelect = document.getElementById(selectElement.id + '_hidden');
          if (hiddenSelect) {
            const optToRemove = Array.from(hiddenSelect.options).find(o => o.value === option.value);
            if (optToRemove) hiddenSelect.removeChild(optToRemove);
          }
          // Dropdown aktualisieren (Option wieder verfügbar machen)
          this.updateTagBasedDropdownItems(dropdown, options, selectElement, tagsContainer, field);
          // Placeholder wenn leer
          if (tagsContainer.querySelectorAll('.tag').length === 0) {
            tagsContainer.style.display = 'none';
          }
        });
        
        tag.appendChild(tagText);
        tag.appendChild(removeBtn);
        tagsContainer.appendChild(tag);
        tagsContainer.style.display = 'flex';
        
        // Zum versteckten Select hinzufügen
        let hiddenSelect = document.getElementById(selectElement.id + '_hidden');
        if (!hiddenSelect) {
          const form = selectElement.closest('form');
          if (form) {
            hiddenSelect = document.createElement('select');
            hiddenSelect.name = selectElement.name + '[]';
            hiddenSelect.id = selectElement.id + '_hidden';
            hiddenSelect.multiple = true;
            hiddenSelect.style.display = 'none';
            form.appendChild(hiddenSelect);
          }
        }
        if (hiddenSelect) {
          const hiddenOpt = document.createElement('option');
          hiddenOpt.value = option.value;
          hiddenOpt.selected = true;
          hiddenOpt.textContent = option.label;
          hiddenSelect.appendChild(hiddenOpt);
        }
        
        // Input leeren
        const input = dropdown.parentNode?.querySelector('.searchable-select-input');
        if (input) input.value = '';
        
        // Dropdown aktualisieren (Option entfernen)
        this.updateTagBasedDropdownItems(dropdown, options, selectElement, tagsContainer, field);
        
        // Dropdown schließen
        dropdown.classList.remove('show');
      });
      
      dropdown.appendChild(item);
    });
  }

  // Dropdown-Items aktualisieren (delegiert an FormSearchableSelect via Injection)
  updateDropdownItems(dropdown, options, filterText) {
    // Stub - wird von FormSystem mit der kanonischen Implementierung überschrieben
    dropdown.innerHTML = '';
    try { dropdown.parentNode.dataset.options = JSON.stringify(options || []); } catch (_) { }
  }

  // Tag-basierte Select-Optionen verwalten
  createTagBasedSelect(selectElement, options, field) {
    // Verhindere mehrfache Erstellung - ABER erlaube Re-Initialisierung mit neuen Optionen
    const selectId = selectElement.id;
    if (this.constructor.createdTagBasedSelects.has(selectId)) {
      // Prüfe ob ein Container existiert und funktional ist
      const existingContainer = selectElement.parentNode.querySelector('.tag-based-select');
      const existingInput = existingContainer?.querySelector('.searchable-select-input');
      
      if (existingContainer && existingInput) {
        // System existiert - aktualisiere die Optionen VOLLSTÄNDIG
        
        // 1. Optionen-Dataset aktualisieren
        try { 
          existingContainer.dataset.options = JSON.stringify(options); 
        } catch (err) { }
        
        // 2. Original Select aktualisieren
        selectElement.innerHTML = '<option value="">Bitte wählen...</option>';
        options.forEach(option => {
          const optionElement = document.createElement('option');
          optionElement.value = option.value;
          optionElement.textContent = option.label;
          selectElement.appendChild(optionElement);
        });
        
        // 3. Dropdown für Tag-basierte Selects aktualisieren (mit korrekten Handlern!)
        const dropdown = existingContainer.querySelector('.searchable-select-dropdown');
        const tagsContainer = existingContainer.querySelector('.tags-container');
        if (dropdown && tagsContainer) {
          // Für Tag-basierte Selects: Spezielle Update-Logik mit Tag-Erstellung
          this.updateTagBasedDropdownItems(dropdown, options, selectElement, tagsContainer, field);
        } else if (dropdown) {
          this.updateDropdownItems(dropdown, options, '');
        }
        
        // 4. Ungültige Tags entfernen (Tags deren Optionen nicht mehr verfügbar sind)
        const optionValues = new Set(options.map(opt => opt.value));
        const tags = existingContainer.querySelectorAll('.tag');
        const tagsToRemove = [];
        
        tags.forEach(tag => {
          const tagValue = tag.dataset?.value;
          if (tagValue && !optionValues.has(tagValue)) {
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
        }
        
        // 5. NEU: Tags für vorausgewählte Optionen erstellen (Prefill bei Waterfall)
        const preselectedOptions = options.filter(opt => opt.selected);
        if (preselectedOptions.length > 0) {
          const tagsContainer = existingContainer.querySelector('.tags-container');
          // WICHTIG: hiddenSelect über ID finden, da es im Formular liegt, nicht im Container
          let hiddenSelect = document.getElementById(selectElement.id + '_hidden');
          
          // Falls hiddenSelect nicht existiert, erstelle es
          if (!hiddenSelect) {
            const form = selectElement.closest('form');
            if (form) {
              hiddenSelect = document.createElement('select');
              hiddenSelect.name = selectElement.name + '[]';
              hiddenSelect.id = selectElement.id + '_hidden';
              hiddenSelect.multiple = true;
              hiddenSelect.style.display = 'none';
              form.appendChild(hiddenSelect);
            }
          }
          
          if (tagsContainer && hiddenSelect) {
            // Bestehende Tag-Werte sammeln
            const existingTagValues = new Set(
              Array.from(tagsContainer.querySelectorAll('.tag'))
                .map(tag => tag.dataset?.value)
                .filter(Boolean)
            );
            
            // Placeholder entfernen falls vorhanden
            const placeholder = tagsContainer.querySelector('.tags-placeholder');
            if (placeholder) placeholder.remove();
            
            // Tags für neue vorausgewählte Optionen erstellen
            preselectedOptions.forEach(option => {
              if (!existingTagValues.has(option.value)) {
                // Tag erstellen
                const tag = document.createElement('div');
                tag.className = 'tag';
                tag.dataset.value = option.value;
                
                const tagText = document.createElement('span');
                tagText.textContent = option.label;
                
                const removeBtn = document.createElement('span');
                removeBtn.textContent = '×';
                removeBtn.className = 'tag-remove';
                
                // Remove-Handler
                removeBtn.addEventListener('click', () => {
                  tag.remove();
                  // Aus verstecktem Select entfernen
                  const optToRemove = Array.from(hiddenSelect.options).find(o => o.value === option.value);
                  if (optToRemove) hiddenSelect.removeChild(optToRemove);
                  // Aus Original-Select entfernen
                  const origOpt = Array.from(selectElement.options).find(o => o.value === option.value);
                  if (origOpt) selectElement.removeChild(origOpt);
                  // Event auslösen
                  hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
                  // Placeholder wenn leer
                  if (tagsContainer.querySelectorAll('.tag').length === 0) {
                    const ph = document.createElement('span');
                    ph.className = 'tags-placeholder';
                    ph.textContent = 'Keine Auswahl';
                    tagsContainer.appendChild(ph);
                  }
                });
                
                tag.appendChild(tagText);
                tag.appendChild(removeBtn);
                tagsContainer.appendChild(tag);
                
                // Zum versteckten Select hinzufügen
                const hiddenOpt = document.createElement('option');
                hiddenOpt.value = option.value;
                hiddenOpt.selected = true;
                hiddenOpt.textContent = option.label;
                hiddenSelect.appendChild(hiddenOpt);
                
                // Auch zum Original-Select hinzufügen (für Fallback)
                const origOpt = document.createElement('option');
                origOpt.value = option.value;
                origOpt.selected = true;
                origOpt.textContent = option.label;
                selectElement.appendChild(origOpt);
              }
            });
            
            // WICHTIG: tagsContainer sichtbar machen!
            tagsContainer.style.display = 'flex';
            
            // Change-Event auslösen für korrekte Form-Submission
            hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        
        // 6. Input wieder aktivieren falls deaktiviert (auch bei 0 Optionen!)
        existingInput.disabled = options.length === 0;
        if (options.length === 0 && field.filterBy) {
          const filterByLabel = field.filterBy.replace('_id', '').replace(/_/g, ' ');
          const capitalizedLabel = filterByLabel.charAt(0).toUpperCase() + filterByLabel.slice(1);
          existingInput.placeholder = `Erst ${capitalizedLabel} auswählen...`;
        } else if (options.length === 0) {
          existingInput.placeholder = 'Keine Optionen verfügbar';
        } else {
          existingInput.placeholder = field.placeholder || 'Suchen und Tags hinzufügen...';
        }
        
        return;
      } else {
        // System ist kaputt oder unvollständig - entferne und neu erstellen
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
      // Bestehende Werte aus dem versteckten Select übernehmen
      Array.from(existingHiddenSelect.selectedOptions).forEach(option => {
        selectedValues.add(option.value);
      });
    }

    // Ausgewählte Werte verwalten (bereits oben definiert)

    // Bestehende Tag-basierte Container entfernen
    const existingContainer = selectElement.parentNode.querySelector('.tag-based-select');
    if (existingContainer) {
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
    
    // Placeholder: Wenn filterBy gesetzt und keine Optionen, dann Hinweis anzeigen
    if (field.filterBy && (!options || options.length === 0)) {
      const filterByLabel = field.filterBy.replace('_id', '').replace(/_/g, ' ');
      const capitalizedLabel = filterByLabel.charAt(0).toUpperCase() + filterByLabel.slice(1);
      input.placeholder = `Erst ${capitalizedLabel} auswählen...`;
      input.disabled = true;
    } else {
      input.placeholder = field.placeholder || selectElement.dataset?.placeholder || 'Suchen und Tags hinzufügen...';
    }

    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'tags-container';

    // Dropdown-Liste
    const dropdown = document.createElement('div');
    dropdown.className = 'searchable-select-dropdown';
    // Styling via CSS-Klassen

    // Verstecktes Select für Form-Submission
    let hiddenSelect;
    if (existingHiddenSelect) {
      hiddenSelect = existingHiddenSelect;
    } else {
      hiddenSelect = document.createElement('select');
      hiddenSelect.name = selectElement.name + '[]'; // Name mit [] für korrekte Multi-Value Form-Submission
      hiddenSelect.id = selectElement.id + '_hidden';
      hiddenSelect.multiple = true;
      hiddenSelect.style.display = 'none';
      existingHiddenSelect = hiddenSelect;
    }
    
    // Tag erstellen (ohne Inline-Styles → CSS-Klassen verwenden)
    const createTag = (value, label) => {
      const tag = document.createElement('div');
      tag.className = 'tag';
      // Wichtig: Wert am Tag speichern, damit abhängige Refreshes ungültige Tags entfernen können
      try { tag.dataset.value = value; } catch (err) { }

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
      if (selectedValues.size > 0) {
        tagsContainer.classList.remove('tags-container--empty');
      } else {
        tagsContainer.classList.add('tags-container--empty');
        // Optional: Placeholder-Text hinzufügen wenn leer
        if (tagsContainer.children.length === 0) {
          const placeholder = document.createElement('span');
          placeholder.className = 'tags-placeholder';
          placeholder.textContent = 'Keine Auswahl';
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
      hiddenSelect.innerHTML = '';
      selectedValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.selected = true;
        // WICHTIG: Textinhalt setzen für bessere Debugging-Sichtbarkeit
        option.textContent = value;
        hiddenSelect.appendChild(option);
      });

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
      } catch (e) { }
      
      // Tags-Container Sichtbarkeit aktualisieren
      updateTagsContainerVisibility();
      
      // Event auslösen
      const event = new Event('change', { bubbles: true });
      hiddenSelect.dispatchEvent(event);
    };
    
    // Bereits ausgewählte Optionen laden (für Edit-Modus)
    const preselectedOptions = options.filter(opt => opt.selected);
    
    // Preselected Tags hinzufügen (nur wenn noch nicht vorhanden)
    preselectedOptions.forEach(option => {
      if (!selectedValues.has(option.value)) {
        selectedValues.add(option.value);
        const tag = createTag(option.value, option.label);
        tagsContainer.appendChild(tag);
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
      
      // WICHTIG: Auch Tags aus dem DOM berücksichtigen (für Tags die via Update-Zweig erstellt wurden)
      const tagValuesInDOM = new Set(
        Array.from(tagsContainer.querySelectorAll('.tag'))
          .map(tag => tag.dataset?.value)
          .filter(Boolean)
      );
      
      base.forEach(option => {
        // Prüfe ob bereits ausgewählt (entweder im Set ODER als Tag im DOM)
        if (selectedValues.has(option.value) || tagValuesInDOM.has(option.value)) {
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
          selectedValues.add(option.value);

          // Tag erstellen und hinzufügen
          const tag = createTag(option.value, option.label);
          tagsContainer.appendChild(tag);

          // Input leeren
          input.value = '';

          // Dropdown schließen
          dropdown.classList.remove('show');

          // Verstecktes Select aktualisieren
          updateHiddenSelect();
        });
        
        dropdown.appendChild(item);
      });
    };
    
    // Input-Events
    input.addEventListener('focus', () => {
      // WICHTIG: Inline-Style entfernen falls vorhanden (Sicherheitsnetz)
      dropdown.style.removeProperty('display');
      dropdown.classList.add('show');
      createDropdownItems();
    });
    
    let tagDebounceTimer = null;
    input.addEventListener('input', (e) => {
      clearTimeout(tagDebounceTimer);
      tagDebounceTimer = setTimeout(() => {
        const searchTerm = e.target.value.toLowerCase();
        const list = getOptions();
        const tagValuesInDOM = new Set(
          Array.from(tagsContainer.querySelectorAll('.tag'))
            .map(tag => tag.dataset?.value)
            .filter(Boolean)
        );
        const filtered = list.filter(option => 
          option.label.toLowerCase().includes(searchTerm) && 
          !selectedValues.has(option.value) &&
          !tagValuesInDOM.has(option.value)
        );
        createDropdownItems(filtered);
      }, 150);
    });
    
    // Click-Outside Handler (mit AbortController für Cleanup)
    const abortController = new AbortController();
    OptionsManager._abortControllers.push(abortController);
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    }, { signal: abortController.signal });
    
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
      if (!existingHiddenInForm) {
        form.appendChild(hiddenSelect);
      }
    }
  }

  static cleanup() {
    for (const controller of OptionsManager._abortControllers) {
      controller.abort();
    }
    OptionsManager._abortControllers = [];
    OptionsManager.createdTagBasedSelects.clear();
  }
}
