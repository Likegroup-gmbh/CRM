# RFC: Entity-Registry als Single Source of Truth

## Problem

Entity-Wissen ist über 3 Dateien verstreut, die unabhängig voneinander gepflegt werden:

| Datei | Zeilen | Verantwortung |
|-------|--------|---------------|
| `DataService.js` | ~3095 | Schema, Felder+Typen, Relationen, M:N, Filter, Sortierung |
| `FormConfig.js` | ~1007 | Formulartitel, Feld-Labels, Validierung, UI-Typ |
| `ActionConfig.js` | ~365 | Aktionsmenü-Einträge, Rollen-Berechtigungen |

Gemeinsame Werte wie Status-Optionen für `rechnung` existieren an **4 Stellen**: `RechnungList.statusOptions`, `FormConfig` (select options), `ActionConfig` (via staticOptions-Durchreichung), `RechnungFilterConfig`. Ein neuer Status erfordert Änderungen in 4 Dateien.

Zusätzlich importiert `FormConfig.js` (core) aus `modules/kooperation/contentArtOptions.js` — eine Schichtverletzung.

## Proposed Solution: EntityRegistry (Design 3 — Caller-optimiert)

Eine leichtgewichtige Registry (~30 Zeilen), die Entity-Definitionen zentral sammelt. Shapes bleiben 1:1 kompatibel mit bestehenden Consumers — keine Migration der Datenformate nötig.

### Interface

```javascript
class EntityRegistry {
  register(name, definition)  // Entity registrieren
  schema(name)                // → DataService-kompatibles Objekt
  form(name)                  // → FormConfig-kompatibles Objekt
  actions(name)               // → ActionConfig-kompatibles Objekt
  options(name, key)          // → Shared Values (z.B. Status-Optionen)
  has(name)                   // → boolean
  keys()                      // → string[]
  freeze()                    // → Mutation nach Bootstrap verhindern
}
```

### Entity-Definition (Beispiel: rechnung)

```javascript
// src/modules/rechnung/rechnung.entity.js
import { registry } from '../../core/EntityRegistry.js';

export const RECHNUNG_STATUS = [
  { id: 'Offen', name: 'Offen' },
  { id: 'Rückfrage', name: 'Rückfrage' },
  { id: 'Bezahlt', name: 'Bezahlt' },
  { id: 'An Qonto gesendet', name: 'An Qonto gesendet' }
];

registry.register('rechnung', {
  options: { status: RECHNUNG_STATUS },

  schema: {
    table: 'rechnung',
    displayField: 'rechnung_nr',
    fields: { status: 'string', nettobetrag: 'number', ... },
    relations: { ... },
    filters: [...],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },

  form: {
    title: 'Neue Rechnung anlegen',
    fields: [
      { name: 'status', label: 'Status', type: 'select', required: true,
        optionsRef: 'status' },
      ...
    ]
  },

  actions: {
    actions: [
      { id: 'status', type: 'submenu', ... },
      ...
    ],
    kundenActions: ['view', 'download']
  }
});
```

### Consumer-Änderungen (Backward-Compatible Adapter)

```javascript
// DataService.js
getEntityConfig(entityType) {
  return registry.schema(entityType) || this.entities[entityType];
}

// FormConfig.js
getFormConfig(entity) {
  const regForm = registry.form(entity);
  if (regForm) {
    return {
      ...regForm,
      fields: regForm.fields.map(f =>
        f.optionsRef
          ? { ...f, options: registry.options(entity, f.optionsRef).map(o => o.name) }
          : f
      )
    };
  }
  return legacyConfigs[entity] || null;
}

// ActionConfig.js
static get(entityType, userRole = null) {
  const config = registry.actions(entityType) || ActionConfigs[entityType];
  // ... role filtering bleibt identisch
}

// RechnungList.js
this.statusOptions = registry.options('rechnung', 'status');
```

## Design Decisions

- **Shapes bleiben getrennt**: Schema, Form und Actions haben völlig unterschiedliche Strukturen. Sie zu einem Mega-FieldDef zu mergen (Design 1) wäre Overengineering bei ~20 verschiedenen Form-Field-Properties (dependsOn, showWhen, dynamic, searchable, etc.)
- **Kein Hook/Plugin-System**: YAGNI bei 23 Entities. Entity-spezifische Query-Logik (z.B. Rechnung-Sortierung) bleibt wo sie ist. Hooks können später hinzugefügt werden.
- **Named Exports**: Shared Values wie `RECHNUNG_STATUS` werden zusätzlich als ES6-Export verfügbar, damit Consumer die Registry nicht mal brauchen.
- **`freeze()` nach Bootstrap**: Verhindert dass Module nach App-Start die Registry mutieren.
- **Inkrementelle Migration**: Entity für Entity, nicht Big Bang. Alte inline-Defs bleiben als Fallback.

## Migration Path

1. `EntityRegistry.js` in `src/core/` erstellen (~30 Zeilen)
2. Bootstrap-File: alle `*.entity.js` Dateien importieren, dann `registry.freeze()`
3. Adapter in DataService/FormConfig/ActionConfig (Registry first, Legacy fallback)
4. Entity für Entity migrieren — `rechnung` und `kampagne` zuerst (haben Status-Submenüs)
5. Alte inline-Defs pro Entity löschen wenn Migration verifiziert

## What Changes

| Datei | Änderung |
|-------|----------|
| `src/core/EntityRegistry.js` | NEU: ~30 Zeilen Registry-Klasse |
| `src/modules/*/xyz.entity.js` | NEU: pro Entity eine Definition (23 Dateien über Zeit) |
| `src/core/DataService.js` | `getEntityConfig()` Adapter-Methode + Aufrufe umstellen |
| `src/core/form/FormConfig.js` | `getFormConfig()` checkt Registry first |
| `src/core/actions/ActionConfig.js` | `get()` checkt Registry first |
| `src/app.js` oder Bootstrap | Entity-Imports + `registry.freeze()` |

## What Does NOT Change

- Consumer-Shapes (DataService, FormConfig, ActionConfig behalten exaktes Format)
- Supabase-Queries (DataService CRUD-Logik bleibt identisch)
- UI/UX (keine sichtbaren Änderungen)
- Bestehende Tests

## Testing

```javascript
import '../modules/rechnung/rechnung.entity.js';
import { registry } from '../core/EntityRegistry.js';

test('rechnung hat korrekte Status-Optionen', () => {
  expect(registry.options('rechnung', 'status')).toEqual([
    { id: 'Offen', name: 'Offen' },
    { id: 'Rückfrage', name: 'Rückfrage' },
    { id: 'Bezahlt', name: 'Bezahlt' },
    { id: 'An Qonto gesendet', name: 'An Qonto gesendet' }
  ]);
});

test('schema ist DataService-kompatibel', () => {
  const schema = registry.schema('rechnung');
  expect(schema.table).toBe('rechnung');
  expect(schema.fields.status).toBe('string');
});

test('form hat optionsRef aufloesbar', () => {
  const form = registry.form('rechnung');
  const statusField = form.fields.find(f => f.name === 'status');
  expect(statusField.optionsRef).toBe('status');
});
```

## Out of Scope

- Hook/Plugin-System (YAGNI)
- Entity-spezifische Query-Hooks (bleiben in DataService)
- Schema-Validation bei register() (Tests reichen)
- Custom Field Type Registry
- Aliases / Entity-Extensions
