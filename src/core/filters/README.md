# Modulares Filter-System

Das neue modulare Filter-System ermöglicht es, entitäts-spezifische Filter-Konfigurationen und -Logik zu definieren, die automatisch geladen und verwendet werden.

## Struktur

```
src/core/filters/
├── BaseFilterConfig.js         # Basis-Filter-Typen und gemeinsame Konfiguration
├── ModularFilterSystem.js      # Hauptsystem das alle Module orchestriert
├── FilterUI.js                 # UI-Rendering (bestehend)
├── FilterLogic.js              # Basis-Filter-Logik (bestehend)
└── README.md                   # Diese Dokumentation

src/modules/{entity}/filters/
├── {Entity}FilterConfig.js     # Entitäts-spezifische Filter-Definitionen
├── {Entity}FilterLogic.js      # Entitäts-spezifische Filter-Verarbeitung
└── {Entity}FilterUtils.js      # Entitäts-spezifische Hilfsfunktionen
```

## Verwendung

### 1. Filter-Konfiguration erstellen

```javascript
// src/modules/creator/filters/CreatorFilterConfig.js
import { createFilterConfig, COMMON_FILTER_OPTIONS } from '../../../core/filters/BaseFilterConfig.js';

export const CREATOR_FILTERS = [
  createFilterConfig('text', {
    id: 'name',
    label: 'Creator Name',
    placeholder: 'Nach Creator-Namen suchen...',
    searchFields: ['vorname', 'nachname'],
    priority: 1
  }),
  
  createFilterConfig('numberRange', {
    id: 'instagram_follower',
    label: 'Instagram Follower',
    min: 0,
    max: 10000000,
    formatter: 'followerCount',
    priority: 2
  })
];

export default {
  filters: CREATOR_FILTERS,
  groups: CREATOR_FILTER_GROUPS,
  presets: CREATOR_FILTER_PRESETS,
  entityType: 'creator'
};
```

### 2. Filter-Logik implementieren

```javascript
// src/modules/creator/filters/CreatorFilterLogic.js
export class CreatorFilterLogic {
  static processFilters(filters) {
    // Entitäts-spezifische Filter-Verarbeitung
    const processedFilters = {};
    
    for (const [key, value] of Object.entries(filters)) {
      switch (key) {
        case 'name':
          processedFilters[key] = {
            type: 'name_search',
            value: value,
            searchFields: ['vorname', 'nachname']
          };
          break;
        // ... weitere spezifische Filter
      }
    }
    
    return processedFilters;
  }

  static buildSupabaseQuery(query, filters) {
    // Supabase Query-Building
    return query;
  }

  static filterLocalData(data, filters) {
    // Lokale Daten filtern
    return data;
  }
}
```

### 3. Im List-Modul verwenden

```javascript
// src/modules/creator/CreatorList.js
import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';

export class CreatorList {
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-container');
    if (filterContainer) {
      await filterSystem.renderFilterBar('creator', filterContainer, 
        (filters) => this.onFiltersApplied(filters),
        () => this.onFiltersReset()
      );
    }
  }

  onFiltersApplied(filters) {
    filterSystem.applyFilters('creator', filters);
    this.loadAndRender();
  }
}
```

## Basis-Filter-Typen

Das System unterstützt folgende Basis-Filter-Typen:

- **text**: Einfache Textsuche
- **select**: Dropdown-Auswahl
- **multiSelect**: Mehrfach-Auswahl
- **date**: Einzelnes Datum
- **dateRange**: Datums-Bereich
- **number**: Einzelne Zahl
- **numberRange**: Zahlen-Bereich
- **boolean**: Ja/Nein Auswahl
- **tags**: Tag-Input

## Features

### Dynamische Filter-Daten
- Automatisches Laden von Optionen aus der Datenbank
- Caching für bessere Performance
- Fallback zu statischen Optionen

### Filter-Gruppen
```javascript
export const CREATOR_FILTER_GROUPS = [
  {
    id: 'basic',
    label: 'Grundlagen',
    filters: ['name', 'creator_type_id'],
    expanded: true
  }
];
```

### Filter-Presets
```javascript
export const CREATOR_FILTER_PRESETS = [
  {
    id: 'active_influencers',
    label: 'Aktive Influencer',
    filters: {
      creator_type_id: 'influencer',
      instagram_follower: { min: 10000 }
    }
  }
];
```

### Virtual Filter
Filter die nicht direkt in der Datenbank existieren:

```javascript
createFilterConfig('boolean', {
  id: 'has_email',
  label: 'Email vorhanden',
  virtual: true  // Wird in der Logik zu 'mail IS NOT NULL' verarbeitet
})
```

## Erweiterung

### Neuen Filter-Typ hinzufügen

1. In `BaseFilterConfig.js` den neuen Typ definieren:
```javascript
export const BASE_FILTER_TYPES = {
  // ... bestehende Typen
  customType: {
    type: 'custom-type',
    component: 'CustomFilter',
    defaultProps: { /* ... */ }
  }
};
```

2. In `FilterUI.js` die Rendering-Logik hinzufügen
3. In entitäts-spezifischen Configs verwenden

### Neue Entität hinzufügen

1. Ordner erstellen: `src/modules/newentity/filters/`
2. Konfiguration: `NewentityFilterConfig.js`
3. Optional Logik: `NewentityFilterLogic.js`
4. Im List-Modul verwenden

Das System lädt automatisch die entsprechenden Module basierend auf dem Entitäts-Namen.

## Debugging

```javascript
// Debug-Information abrufen
const debugInfo = await filterSystem.getDebugInfo('creator');
console.log(debugInfo);
```

## Migration

Das alte `FilterConfig.js` kann schrittweise migriert werden:
1. Neue modulare Konfigurationen erstellen
2. Import in `main.js` auf `ModularFilterSystem` ändern
3. Module einzeln auf neues System umstellen
4. Alte Konfiguration entfernen