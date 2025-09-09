export class OptionsManager {
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
    // Prüfe ob bereits ein Tag-basiertes System existiert
    const existingContainer = selectElement.parentNode.querySelector('.searchable-select-container, .tag-based-select');
    if (existingContainer) {
      console.log('🔧 Entferne bestehenden Container für:', field.name);
      existingContainer.remove();
    }

    // Das ursprüngliche Select soll versteckt bleiben
    selectElement.style.display = 'none';
    
    // Neue Auto-Suggestion erstellen
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
        
        // Event auslösen
        selectElement.dispatchEvent(new Event('change'));
        
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
    
    // Container für das neue Element
    const container = document.createElement('div');
    container.className = 'searchable-select-container tag-based-select';
    
    // Input-Feld für Suche
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'searchable-select-input';
    input.placeholder = field.placeholder || selectElement.dataset?.placeholder || 'Suchen und Tags hinzufügen...';
    // Styling via CSS-Klassen
    
    // Tags-Container
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'tags-container';
    tagsContainer.style.display = 'none'; // Initial versteckt bis Tags hinzugefügt werden
    // Styling via CSS-Klassen
    
    // Dropdown-Liste
    const dropdown = document.createElement('div');
    dropdown.className = 'searchable-select-dropdown';
    // Styling via CSS-Klassen
    
    // Verstecktes Select für Form-Submission
    const hiddenSelect = document.createElement('select');
    // Wichtig: eigener Name mit [] damit Original-Select bestehen bleiben kann
    hiddenSelect.name = `${selectElement.name}[]`;
    hiddenSelect.id = selectElement.id + '_hidden';
    hiddenSelect.multiple = true;
    hiddenSelect.style.display = 'none';
    
    // Ausgewählte Werte verwalten
    const selectedValues = new Set();
    
    // Tag erstellen (ohne Inline-Styles → CSS-Klassen verwenden)
    const createTag = (value, label) => {
      const tag = document.createElement('div');
      tag.className = 'tag';

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
    
    // Tags-Container Sichtbarkeit aktualisieren
    const updateTagsContainerVisibility = () => {
      if (selectedValues.size > 0) {
        tagsContainer.style.display = 'flex'; // Tags vorhanden → anzeigen
      } else {
        tagsContainer.style.display = 'none'; // Keine Tags → verstecken
      }
    };

    // Verstecktes Select aktualisieren
    const updateHiddenSelect = () => {
      hiddenSelect.innerHTML = '';
      selectedValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.selected = true;
        hiddenSelect.appendChild(option);
      });
      
      // Tags-Container Sichtbarkeit aktualisieren
      updateTagsContainerVisibility();
      
      // Event auslösen
      const event = new Event('change', { bubbles: true });
      hiddenSelect.dispatchEvent(event);
    };
    
    // Bereits ausgewählte Optionen laden (für Edit-Modus)
    const preselectedOptions = options.filter(opt => opt.selected);
    console.log('🎯 Bereits ausgewählte Optionen für Tag-Select:', preselectedOptions);
    
    // Preselected Tags hinzufügen
    preselectedOptions.forEach(option => {
      selectedValues.add(option.value);
      const tag = createTag(option.value, option.label);
      tagsContainer.appendChild(tag);
      console.log(`✅ Preselected Tag hinzugefügt: ${option.label}`);
    });
    
    // Initial aktualisieren
    updateHiddenSelect();
    
    // Dropdown-Optionen erstellen
    const createDropdownItems = (filteredOptions = options) => {
      dropdown.innerHTML = '';
      
      if (filteredOptions.length === 0) {
        const noResults = document.createElement('div');
        noResults.textContent = 'Keine Ergebnisse';
        noResults.className = 'searchable-select-empty';
        dropdown.appendChild(noResults);
        return;
      }
      
      filteredOptions.forEach(option => {
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
      const filteredOptions = options.filter(option => 
        option.label.toLowerCase().includes(searchTerm) && !selectedValues.has(option.value)
      );
      createDropdownItems(filteredOptions);
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
    
    // Verstecktes Select an das Formular anhängen (Original-Select bleibt verborgen erhalten)
    const form = container.closest('form');
    if (form && !form.querySelector(`select[name="${hiddenSelect.name}"]`)) {
      form.appendChild(hiddenSelect);
    }
    
    console.log(`✅ Tag-basierte Auto-Suggestion Select erstellt für ${field.name}`);
  }
} 