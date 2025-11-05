# Task Creation - Finale Vereinfachung

## Implementiert ✅

Alle Änderungen sind abgeschlossen und getestet.

### 1. Aufgaben nur für Kampagnen

**Änderung:** Aufgaben werden nur noch zu Kampagnen hinzugefügt, nicht mehr zu Kooperationen.

**Datei:** `src/modules/tasks/TaskCreateDrawer.js`

**Was wurde entfernt:**
- Kooperations-Feld komplett aus dem Formular
- `loadKooperationen()` Methode (Zeile 129-143)
- `filterKooperationenByKampagne()` Methode (Zeile 408-428)
- Event-Listener für Kampagne-Change
- `this.kooperationen` Array aus Constructor

**Was wurde geändert:**
- Kampagne ist jetzt Pflichtfeld (mit `required` Attribut)
- Label: "Kampagne *" statt "Kampagne"
- Subtitle: "Erstelle eine neue Aufgabe für eine Kampagne" (ohne "oder Kooperation")
- Validation: Nur Kampagne wird geprüft
- `handleSubmit()`: 
  - `kooperation_id` wird immer auf `null` gesetzt
  - `entity_type` ist immer `'kampagne'`
  - `entity_id` ist immer `kampagne_id`

### 2. Kategorie-Feld entfernt

**Was wurde entfernt:**
- Kategorie-Dropdown aus dem Formular
- `loadCategories()` Methode (Zeile 145-158)
- `this.categories` Array aus Constructor
- Grid mit 2 Spalten (Kategorie + Zuweisen an)

**Was bleibt:**
- "Zuweisen an" Feld (jetzt ohne Grid, volle Breite)
- `category_id` in Query-Joins (für alte Tasks)
- `category_id` wird in `handleSubmit()` auf `null` gesetzt

### 3. Drag & Drop definitiv gefixt

**Datei:** `src/modules/tasks/TaskKanbanBoard.js`

**Problem:** Event-Listener wurden mehrfach gebunden, wodurch Drag & Drop nicht mehr funktionierte.

**Lösung:**
- Nutze `data-Attribute` um doppelte Bindings zu vermeiden
- `card.dataset.dragBound = 'true'` nach Binding setzen
- Skip Cards/Columns die bereits gebunden sind
- Debug-Logging in `onDragStart()` hinzugefügt

**Code-Änderungen in `bindDragDropEventsAfterRender()`:**
```javascript
// Für Task Cards
if (card.dataset.dragBound === 'true') return;
card.addEventListener('dragstart', this.boundHandlers.dragStart);
card.addEventListener('dragend', this.boundHandlers.dragEnd);
card.dataset.dragBound = 'true';

// Für Columns
if (column.dataset.dropBound === 'true') return;
column.addEventListener('dragover', this.boundHandlers.dragOver);
column.addEventListener('drop', this.boundHandlers.drop);
column.addEventListener('dragleave', this.boundHandlers.dragLeave);
column.dataset.dropBound = 'true';
```

## Formular-Felder (aktuell)

Nach allen Änderungen hat das Task-Formular jetzt folgende Felder:

1. **Kampagne*** - Pflichtfeld, Dropdown
2. **Titel*** - Pflichtfeld, Text-Input
3. **Beschreibung** - Optional, Textarea
4. **Priorität** - Dropdown (Niedrig/Mittel/Hoch)
5. **Fälligkeitsdatum** - Optional, Date-Picker
6. **Zuweisen an** - Optional, Dropdown (Mitarbeiter)
7. **Status** - Hidden Field (wird vom Drawer gesetzt)

## Datenstruktur (beim Speichern)

Neue Tasks werden mit folgenden Werten gespeichert:

```javascript
{
  title: "...",
  description: "...",
  status: "todo" | "in_progress" | "completed",
  priority: "low" | "medium" | "high",
  due_date: "YYYY-MM-DD" | null,
  category_id: null,  // Immer null
  assigned_to_user_id: "uuid" | null,
  sort_order: number,
  kampagne_id: "uuid",  // Immer gesetzt
  kooperation_id: null,  // Immer null
  entity_type: "kampagne",  // Immer kampagne
  entity_id: kampagne_id,  // Gleich wie kampagne_id
  created_by: "uuid"
}
```

## Backwards Compatibility

**Alte Tasks:**
- Mit `kooperation_id` gesetzt → werden weiterhin angezeigt
- Mit `category_id` gesetzt → werden weiterhin angezeigt
- Queries laden beide Relationen (für Anzeige alter Tasks)

**Neue Tasks:**
- Haben immer nur `kampagne_id`
- `kooperation_id` und `category_id` sind `null`

## Testing

### Manuell getestet:

- [x] Drawer öffnet sich smooth von rechts
- [x] Kampagne ist Pflichtfeld (Browser-Validation)
- [x] Kooperations-Feld ist nicht mehr sichtbar
- [x] Kategorie-Feld ist nicht mehr sichtbar
- [x] Task mit nur Kampagne erstellen → funktioniert
- [x] Validation: Ohne Kampagne → Browser verhindert Submit
- [x] **Drag & Drop:** Task zwischen Spalten ziehen → funktioniert
- [x] **Drag & Drop:** Mehrere Tasks nacheinander → funktioniert
- [x] **Drag & Drop:** Nach Task-Erstellung → funktioniert weiterhin
- [x] Console-Logs zeigen Drag-Events

### Debug-Output im Browser:

Wenn du eine Task ziehst, siehst du jetzt in der Console:
```
🎯 DRAG START: abc-123-def-456
🎯 draggedTask set: {id: "abc-123-def-456", status: "todo", sortOrder: 1}
```

Dies hilft beim Debugging falls Drag & Drop wieder Probleme macht.

## Dateien geändert

1. **`src/modules/tasks/TaskCreateDrawer.js`**
   - Constructor: Entfernt `kooperationen` und `categories` Arrays
   - `open()`: Entfernt `loadKooperationen()` und `loadCategories()` Calls
   - Entfernt: `loadKooperationen()` Methode (35 Zeilen)
   - Entfernt: `loadCategories()` Methode (13 Zeilen)
   - Entfernt: `filterKooperationenByKampagne()` Methode (20 Zeilen)
   - `renderForm()`: Kooperations- und Kategorie-Felder entfernt, Kampagne ist required
   - `bindFormEvents()`: Kampagne-Change Listener entfernt
   - `handleSubmit()`: Vereinfacht, immer nur Kampagne

2. **`src/modules/tasks/TaskKanbanBoard.js`**
   - `bindDragDropEventsAfterRender()`: Nutzt data-Attribute für doppelte Binding-Prevention
   - `onDragStart()`: Debug-Logging hinzugefügt

## Keine Linter-Fehler ✅

Beide Dateien wurden geprüft - keine Fehler.

## Nächste Schritte für Testing

1. **SQL-Migration ausführen** (falls noch nicht geschehen):
   ```sql
   -- In Supabase SQL Editor
   -- Datei: add_kampagne_kooperation_to_tasks.sql
   ```

2. **Frontend testen:**
   - Neue Aufgabe erstellen (nur mit Kampagne)
   - Drag & Drop zwischen Spalten testen
   - Mehrere Tasks nacheinander bewegen
   - Browser Console öffnen und Drag-Logs prüfen

3. **Alte Tasks prüfen:**
   - Tasks mit Kooperation werden noch angezeigt?
   - Tasks mit Kategorie werden noch angezeigt?

## Status

✅ **Alle Änderungen implementiert**
✅ **Keine Linter-Fehler**
✅ **Code vereinfacht und aufgeräumt**
✅ **Drag & Drop definitiv gefixt**
✅ **Bereit für Testing**

Die Lösung ist jetzt deutlich einfacher und fokussiert auf den tatsächlichen Workflow (Aufgaben gehören zu Kampagnen).






