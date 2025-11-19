// FilterUI.js (ES6-Modul)
// Zentrale UI-Logik für Filterbar

export async function renderFilterBar(config, currentFilters, onApply, onReset, mountNode) {
  if (!config || !mountNode) return;

  // Ensure config is an array
  const filters = Array.isArray(config) ? config : (config.filters || []);
  
  // Dynamische Daten für Select-Felder laden
  const enhancedFilters = await loadDynamicFilterData(filters);
  
  // Filter-Felder HTML generieren
  const filterFieldsHtml = enhancedFilters.map(filter => {
    const currentValue = currentFilters[filter.id];
    return createFilterFieldHtml(filter, currentValue);
  }).join('');

  // Prüfe ob aktive Filter vorhanden sind
  const hasActiveFilters = Object.keys(currentFilters).length > 0 && 
    Object.values(currentFilters).some(value => 
      value && (Array.isArray(value) ? value.length > 0 : value !== '')
    );

  // Filterbar HTML (Button wird extern bereitgestellt)
  const filterBarHtml = `
    <div class="filter-section">
      <div class="filter-row">
        ${filterFieldsHtml}
      </div>
    </div>
  `;

  mountNode.innerHTML = filterBarHtml;

  // Event-Handler binden
  bindFilterEvents(onApply, onReset);
}

// Hilfs-Renderer für leere Ergebnisse (einheitlich für alle Listen)
export function renderEmptyState(tbodyOrContainer) {
  if (!tbodyOrContainer) return;
  const container = tbodyOrContainer.tagName === 'TBODY' ? tbodyOrContainer : null;
  const html = `
    <div class="empty-state not-found">
        <img src="https://www.dropbox.com/scl/fi/6fgrk4u4aync0qfo0mcod/noti_not_found.svg?rlkey=x0idfb8fjl6kpp7850fkp8tto&raw=1" />
      <p>Leider konnten keine Einträge gefunden werden</p>
    </div>
  `;
  if (container) {
    const colSpan = container.parentElement?.querySelector('thead tr')?.children?.length || 1;
    container.innerHTML = `<tr><td colspan="${colSpan}">${html}</td></tr>`;
  } else {
    tbodyOrContainer.innerHTML = html;
  }
}

// Dynamische Filter-Daten laden
async function loadDynamicFilterData(filters) {
  const enhancedFilters = [];
  
  for (const filter of filters) {
    if (filter.dynamic || filter.table) {
      try {
        // Dynamische Daten laden
        const options = await loadFilterOptions(filter);
        enhancedFilters.push({
          ...filter,
          options: options
        });
      } catch (error) {
        console.error(`❌ Fehler beim Laden der dynamischen Daten für Filter ${filter.id}:`, error);
        enhancedFilters.push(filter);
      }
    } else {
      enhancedFilters.push(filter);
    }
  }
  
  return enhancedFilters;
}

// Filter-Optionen laden
async function loadFilterOptions(filter) {
  if (!window.supabase) {
    console.warn('⚠️ Supabase nicht verfügbar');
    return [];
  }

  try {
    let tableName, displayField, valueField;
    
    // Tabellen-Name und Felder bestimmen
    if (filter.table) {
      tableName = filter.table;
      displayField = filter.displayField || 'name';
      valueField = filter.valueField || 'id';
    } else {
      // Fallback basierend auf Filter-ID
      switch (filter.id) {
        case 'creator_type_id':
          tableName = 'creator_type';
          displayField = 'name';
          valueField = 'id';
          break;
        case 'sprache_id':
          tableName = 'sprachen';
          displayField = 'name';
          valueField = 'id';
          break;
        case 'branche_id':
          tableName = 'branchen_creator';
          displayField = 'name';
          valueField = 'id';
          break;
        case 'unternehmen_id':
          tableName = 'unternehmen';
          displayField = 'firmenname';
          valueField = 'id';
          break;
        case 'marke_id':
          tableName = 'marke';
          displayField = 'markenname';
          valueField = 'id';
          break;
        case 'auftrag_id':
          tableName = 'auftrag';
          displayField = 'auftragsname';
          valueField = 'id';
          break;
        case 'kampagne_id':
          tableName = 'kampagne';
          displayField = 'kampagnenname';
          valueField = 'id';
          break;
        default:
          console.warn(`⚠️ Unbekannter Filter-Typ: ${filter.id}`);
          return [];
      }
    }

    // Daten aus der Datenbank laden
    const { data, error } = await window.supabase
      .from(tableName)
      .select(`${valueField}, ${displayField}`)
      .order(displayField);

    if (error) {
      console.error(`❌ Fehler beim Laden der Filter-Optionen für ${tableName}:`, error);
      return [];
    }

    // Optionen formatieren
    return data.map(item => ({
      value: item[valueField],
      label: item[displayField]
    }));

  } catch (error) {
    console.error(`❌ Fehler beim Laden der Filter-Optionen:`, error);
    return [];
  }
}

// Einzelnes Filter-Feld HTML erstellen
function createFilterFieldHtml(filter, currentValue) {
  const fieldId = `filter-${filter.id}`;
  
  switch (filter.type) {
    case 'text':
      return `
        <div class="filter-group">
          <input type="text" id="${fieldId}" name="${filter.id}" 
                 placeholder="${filter.placeholder || ''}" 
                 value="${currentValue || ''}" class="input">
        </div>
      `;
    
    case 'select':
      const options = filter.options || [];
      const selectOptions = options.map(option => {
        // Unterstütze sowohl Strings als auch {value, label} oder {id, name} Objekte
        let value, label;
        if (typeof option === 'object') {
          value = option.value || option.id;
          label = option.label || option.name;
        } else {
          value = option;
          label = option;
        }
        const isSelected = String(currentValue) === String(value);
        return `<option value="${value}" ${isSelected ? 'selected' : ''}>${label}</option>`;
      }).join('');

      // Placeholder dynamisch aus Label ableiten, falls nicht gesetzt
      const placeholder = filter.placeholder || `${filter.label} auswählen...`;

      return `
        <div class="filter-group">
          <select id="${fieldId}" name="${filter.id}" class="input">
            <option value="">${placeholder}</option>
            ${selectOptions}
          </select>
        </div>
      `;
    
    case 'tag-input':
      const tags = currentValue ? (Array.isArray(currentValue) ? currentValue : String(currentValue).split(',').map(t => t.trim()).filter(Boolean)) : [];
      const tagsHtml = tags.map(tag => 
        `<span class="tag">
          ${tag}
          <button type="button" class="tag-remove" data-tag="${tag}" data-field="${filter.id}">×</button>
        </span>`
      ).join('');
      return `
        <div class="filter-group">
          <div class="tag-input-container">
            <input type="text" id="${fieldId}" class="input" placeholder="${filter.placeholder || ''}">
            <div id="${fieldId}-tags" class="tag-container">
              ${tagsHtml}
            </div>
            <input type="hidden" name="${filter.id}" id="${fieldId}-hidden" value="${tags.join(',')}">
          </div>
        </div>
      `;
    
    case 'range':
      const rangeValue = currentValue || {};
      return `
        <div class="filter-group">
          <div class="range-container">
            <input type="range" id="${fieldId}-min" name="${filter.id}_min" 
                   min="${filter.min}" max="${filter.max}" step="${filter.step}" 
                   value="${rangeValue.min || filter.min}" class="range-input">
            <input type="range" id="${fieldId}-max" name="${filter.id}_max" 
                   min="${filter.min}" max="${filter.max}" step="${filter.step}" 
                   value="${rangeValue.max || filter.max}" class="range-input">
            <div class="range-values">
              <span id="${fieldId}-min-value">${formatRangeValue(rangeValue.min || filter.min)}</span>
              <span>bis</span>
              <span id="${fieldId}-max-value">${formatRangeValue(rangeValue.max || filter.max)}</span>
            </div>
          </div>
        </div>
      `;
    
    case 'date':
      return `
        <div class="filter-group">
          <input type="date" id="${fieldId}" name="${filter.id}" 
                 value="${currentValue || ''}" class="input">
        </div>
      `;
    
    default:
      return '';
  }
}

// Range-Werte formatieren
function formatRangeValue(value) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString('de-DE');
}

// Filter-Events binden
function bindFilterEvents(onApply, onReset) {
  // Automatisches Filtern bei Änderungen
  let autoApplyFilters = () => {
    const formData = new FormData();
    
    // Sammle alle Filter-Werte
    document.querySelectorAll('#filter-container input, #filter-container select').forEach(input => {
      if (input.value) {
        formData.append(input.name, input.value);
      }
    });
    
    // Verarbeite FormData und rufe Callback auf
    const filters = processFilterForm(formData);
    if (onApply) onApply(filters);
  };

  // Filter anwenden Button existiert nicht mehr (automatisches Filtern)

  // Filter zurücksetzen
  document.getElementById('btn-filter-reset')?.addEventListener('click', () => {
    // Formular zurücksetzen
    document.querySelectorAll('#filter-container input, #filter-container select').forEach(input => {
      input.value = '';
    });
    
    // Range-Slider zurücksetzen
    document.querySelectorAll('.range-input').forEach(slider => {
      const isMin = slider.name.includes('_min');
      const baseName = slider.name.replace('_min', '').replace('_max', '');
      const config = getFilterConfig(baseName);
      if (config && config.type === 'range') {
        slider.value = isMin ? config.min : config.max;
        const valueElement = document.getElementById(`${slider.id}-value`);
        if (valueElement) {
          valueElement.textContent = formatRangeValue(slider.value);
        }
      }
    });
    
    if (onReset) onReset();
  });

  // Range-Slider Events
  document.querySelectorAll('.range-input').forEach(slider => {
    slider.addEventListener('input', (e) => {
      const fieldId = e.target.name.replace('_min', '').replace('_max', '');
      const isMin = e.target.name.includes('_min');
      const value = parseInt(e.target.value);
      
      // Wert-Anzeige aktualisieren
      const valueElement = document.getElementById(`${fieldId}-${isMin ? 'min' : 'max'}-value`);
      if (valueElement) {
        valueElement.textContent = formatRangeValue(value);
      }
      
      // Automatisches Filtern nach kurzer Verzögerung
      clearTimeout(slider.autoFilterTimeout);
      slider.autoFilterTimeout = setTimeout(autoApplyFilters, 300);
    });
  });

  // Select-Felder Events (automatisches Filtern)
  document.querySelectorAll('#filter-container select').forEach(select => {
    select.addEventListener('change', () => {
      // Automatisches Filtern nach kurzer Verzögerung
      clearTimeout(select.autoFilterTimeout);
      select.autoFilterTimeout = setTimeout(autoApplyFilters, 100);
    });
  });

  // Text-Input Events (automatisches Filtern)
  document.querySelectorAll('#filter-container input[type="text"]').forEach(input => {
    if (!input.closest('.tag-input-container')) {
      input.addEventListener('input', () => {
        // Automatisches Filtern nach kurzer Verzögerung
        clearTimeout(input.autoFilterTimeout);
        input.autoFilterTimeout = setTimeout(autoApplyFilters, 500);
      });
    }
  });

  // Tag-Input Events
  document.querySelectorAll('input[type="text"]').forEach(input => {
    if (input.closest('.tag-input-container')) {
      // Enter-Taste für Tag-Hinzufügung
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const tag = e.target.value.trim();
          if (tag) {
            addTagToFilter(e.target, tag);
            e.target.value = '';
            // Automatisches Filtern nach Tag-Hinzufügung
            setTimeout(autoApplyFilters, 100);
          }
        }
      });
    }
  });

  // Tag-Entfernen Events
  document.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tag = e.target.dataset.tag;
      const field = e.target.dataset.field;
      removeTagFromFilter(field, tag);
      // Automatisches Filtern nach Tag-Entfernung
      setTimeout(autoApplyFilters, 100);
    });
  });

  // Kein automatisches Ein-/Ausblenden eines internen Reset-Buttons mehr
}

// Hilfsfunktionen für Tag-Input
function addTagToFilter(input, tag) {
  const fieldId = input.id;
  const tagsContainer = document.getElementById(`${fieldId}-tags`);
  const hiddenInput = document.getElementById(`${fieldId}-hidden`);
  
  if (tagsContainer && hiddenInput) {
    // Prüfe ob Tag bereits existiert
    const existingTags = Array.from(tagsContainer.querySelectorAll('.tag')).map(t => t.textContent.replace('×', '').trim());
    if (existingTags.includes(tag)) return;
    
    // Neuen Tag hinzufügen
    const tagElement = document.createElement('span');
    tagElement.className = 'tag';
    tagElement.innerHTML = `
      ${tag}
      <button type="button" class="tag-remove" data-tag="${tag}" data-field="${fieldId.replace('filter-', '')}">×</button>
    `;
    
    tagsContainer.appendChild(tagElement);
    
    // Hidden Input aktualisieren
    const currentTags = Array.from(tagsContainer.querySelectorAll('.tag')).map(t => t.textContent.replace('×', '').trim());
    hiddenInput.value = currentTags.join(',');
  }
}

function removeTagFromFilter(field, tag) {
  const fieldId = `filter-${field}`;
  const tagsContainer = document.getElementById(`${fieldId}-tags`);
  const hiddenInput = document.getElementById(`${fieldId}-hidden`);
  
  if (tagsContainer && hiddenInput) {
    // Tag-Element finden und entfernen
    const tagElements = tagsContainer.querySelectorAll('.tag');
    tagElements.forEach(element => {
      if (element.textContent.replace('×', '').trim() === tag) {
        element.remove();
      }
    });
    
    // Hidden Input aktualisieren
    const currentTags = Array.from(tagsContainer.querySelectorAll('.tag')).map(t => t.textContent.replace('×', '').trim());
    hiddenInput.value = currentTags.join(',');
  }
}

// Hilfsfunktion für Filter-Konfiguration (vereinfacht)
function getFilterConfig(fieldName) {
  // Placeholder - später aus FilterConfig importieren
  return null;
}

// FormData verarbeiten (aus FilterLogic importiert)
function processFilterForm(formData) {
  const filters = {};
  for (const [key, value] of formData.entries()) {
    if (value) {
      if (key.includes('_min') || key.includes('_max')) {
        const baseKey = key.replace('_min', '').replace('_max', '');
        if (!filters[baseKey]) filters[baseKey] = {};
        if (key.includes('_min')) {
          filters[baseKey].min = parseInt(value);
        } else {
          filters[baseKey].max = parseInt(value);
        }
      } else if (['sprachen', 'branche', 'lieferadresse_land', 'bundesland'].includes(key)) {
        const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
        if (tags.length > 0) {
          filters[key] = tags;
        }
      } else {
        filters[key] = value;
      }
    }
  }
  return filters;
}
