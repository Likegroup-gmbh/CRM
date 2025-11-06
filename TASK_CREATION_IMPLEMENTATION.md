# Task Creation Refactor - Implementierung Abgeschlossen

## Übersicht

Die Aufgabenerstellung wurde erfolgreich überarbeitet. Das Inline-Formular wurde entfernt und durch einen Drawer (Slide-in-Panel von rechts) ersetzt, der Kampagnen- und Kooperations-Auswahl unterstützt.

## Implementierte Änderungen

### 1. Datenbank-Migration (add_kampagne_kooperation_to_tasks.sql)

**Datei:** `add_kampagne_kooperation_to_tasks.sql`

- Neue Spalten in `kooperation_tasks`:
  - `kampagne_id` (UUID, nullable) mit Foreign Key zu `kampagne`
  - `kooperation_id` (UUID, nullable) mit Foreign Key zu `kooperationen`
- Check Constraint: Mindestens eine von `kampagne_id` oder `kooperation_id` muss gesetzt sein
- Datenmigration: Existierende Tasks werden automatisch migriert
- Indizes für Performance erstellt
- `entity_type` und `entity_id` bleiben für Backwards-Compatibility erhalten

**Wichtig:** Diese Migration muss in Supabase ausgeführt werden!

### 2. Neuer TaskCreateDrawer (src/modules/tasks/TaskCreateDrawer.js)

**Datei:** `src/modules/tasks/TaskCreateDrawer.js`

Neue Komponente mit folgenden Features:
- Drawer-UI (Slide-in von rechts) mit existierenden CSS-Klassen
- Formular mit Feldern:
  - **Kampagne** (Dropdown, optional)
  - **Kooperation** (Dropdown, optional, zeigt ALLE Kooperationen)
  - Titel (Pflichtfeld)
  - Beschreibung (Textarea, optional)
  - Priorität (Niedrig/Mittel/Hoch)
  - Fälligkeitsdatum (Date-Picker)
  - Kategorie (aus `kampagne_status`)
  - Zuweisen an (aus `v_available_assignees`)
- Client-seitige Validation: Mindestens Kampagne ODER Kooperation muss ausgewählt sein
- Speichert mit neuen `kampagne_id` und `kooperation_id` Feldern
- Setzt auch `entity_type` und `entity_id` für Backwards-Compatibility

### 3. TaskKanbanBoard Anpassungen (src/modules/tasks/TaskKanbanBoard.js)

**Datei:** `src/modules/tasks/TaskKanbanBoard.js`

Änderungen:
- Import von `TaskCreateDrawer` hinzugefügt
- `createDrawer` Instanz im Constructor erstellt
- Plus-Buttons in Spalten-Headern öffnen jetzt `TaskCreateDrawer` statt Inline-Form
- **Entfernt:** `openQuickAddForm()` Methode (Zeile 517-668)
- **Entfernt:** `handleQuickAdd()` Methode (Zeile 712-814)
- **Entfernt:** `loadCategories()` und `loadUsers()` Methoden (werden im Drawer verwendet)
- Neue Event-Handler: `handleTaskCreated()` für Refresh nach Task-Erstellung
- Query erweitert um Kampagnen- und Kooperations-Joins:
  ```javascript
  kampagne:kampagne_id(id, kampagnenname),
  kooperation:kooperation_id(id, name)
  ```

### 4. TaskDetailDrawer Anpassungen (src/modules/tasks/TaskDetailDrawer.js)

**Datei:** `src/modules/tasks/TaskDetailDrawer.js`

Änderungen:
- Query erweitert um Kampagnen- und Kooperations-Joins (analog zu TaskKanbanBoard)

### 5. TaskListPage Integration (src/modules/tasks/TaskListPage.js)

**Datei:** `src/modules/tasks/TaskListPage.js`

Änderungen:
- Import von `TaskCreateDrawer` hinzugefügt
- `createDrawer` Instanz wird im `init()` erstellt
- "Neue Aufgabe" Button öffnet jetzt `TaskCreateDrawer` statt Inline-Form
- Query erweitert um Kampagnen- und Kooperations-Joins

## Verwendung

### Aufgabe erstellen

1. **Im Kanban-Board:**
   - Klicke auf den Plus-Button (+) im Header einer Spalte (To-Do, In Progress, Completed)
   - Der TaskCreateDrawer öffnet sich von rechts
   - Der Status wird automatisch auf die gewählte Spalte gesetzt

2. **Auf der Task-Übersichtsseite:**
   - Klicke auf "Neue Aufgabe" Button oben rechts
   - Der TaskCreateDrawer öffnet sich mit Status "todo"

### Formular ausfüllen

1. **Kampagne wählen** (optional): Wähle eine Kampagne aus dem Dropdown
2. **Kooperation wählen** (optional): Wähle eine Kooperation aus dem Dropdown
   - Zeigt ALLE Kooperationen, unabhängig von der Kampagne
3. **Validation:** Mindestens eine von beiden muss ausgewählt werden
4. Weitere Felder ausfüllen (Titel ist Pflicht)
5. "Aufgabe erstellen" klicken

### Nach Erstellung

- Drawer schließt automatisch
- Success-Notification wird angezeigt
- `taskCreated` Custom Event wird gefeuert
- Kanban-Board aktualisiert sich automatisch

## Datenstruktur

### Neue Task-Felder in kooperation_tasks

```sql
kampagne_id UUID REFERENCES kampagne(id)        -- Optional
kooperation_id UUID REFERENCES kooperationen(id) -- Optional
entity_type VARCHAR                              -- Backwards compatibility
entity_id UUID                                   -- Backwards compatibility
```

### Check Constraint

```sql
CHECK (kampagne_id IS NOT NULL OR kooperation_id IS NOT NULL)
```

## Backwards Compatibility

- `entity_type` und `entity_id` werden weiterhin gesetzt:
  - Wenn `kooperation_id` gesetzt ist: `entity_type = 'kooperation'`, `entity_id = kooperation_id`
  - Sonst wenn `kampagne_id` gesetzt ist: `entity_type = 'kampagne'`, `entity_id = kampagne_id`
- Bestehende Filter und Queries funktionieren weiterhin

## Testing Checklist

### Manuelle Tests durchführen

- [ ] Migration in Supabase ausführen
- [ ] Aufgabe mit nur Kampagne erstellen
- [ ] Aufgabe mit nur Kooperation erstellen
- [ ] Aufgabe mit Kampagne + Kooperation erstellen
- [ ] Validation testen (ohne Kampagne und Kooperation)
- [ ] Aus Kanban-Board To-Do Spalte erstellen
- [ ] Aus Kanban-Board In Progress Spalte erstellen
- [ ] Aus Kanban-Board Completed Spalte erstellen
- [ ] Von Task-Übersichtsseite erstellen
- [ ] Kanban-Board Refresh nach Erstellung prüfen
- [ ] Task-Details öffnen und neue Felder prüfen

### Expected Results

- Drawer öffnet sich smooth von rechts
- Formular ist vollständig ausgefüllt möglich
- Validation verhindert Erstellung ohne Kampagne/Kooperation
- Success-Notification erscheint nach Erstellung
- Board aktualisiert sich automatisch
- Keine Linter-Fehler (bereits geprüft ✅)

## Migration Anleitung

### Schritt 1: SQL-Migration ausführen

1. Öffne Supabase SQL Editor
2. Kopiere den Inhalt von `add_kampagne_kooperation_to_tasks.sql`
3. Führe die Migration aus
4. Prüfe ob Constraint und Indizes erstellt wurden:
   ```sql
   SELECT constraint_name, constraint_type 
   FROM information_schema.table_constraints 
   WHERE table_name = 'kooperation_tasks';
   ```

### Schritt 2: Frontend deployen

1. Alle geänderten Dateien sind committed
2. Deploy durchführen (Netlify/etc.)
3. Cache leeren falls nötig

### Schritt 3: Smoke Test

1. Login ins System
2. Navigiere zu Aufgaben-Seite
3. Erstelle Test-Aufgabe mit verschiedenen Kombinationen
4. Prüfe ob alte Tasks weiterhin funktionieren

## Dateien Übersicht

### Neu erstellt
- `src/modules/tasks/TaskCreateDrawer.js` (478 Zeilen)
- `add_kampagne_kooperation_to_tasks.sql` (35 Zeilen)
- `TASK_CREATION_IMPLEMENTATION.md` (diese Datei)

### Geändert
- `src/modules/tasks/TaskKanbanBoard.js` (~300 Zeilen entfernt, Import hinzugefügt, Query erweitert)
- `src/modules/tasks/TaskDetailDrawer.js` (Query erweitert)
- `src/modules/tasks/TaskListPage.js` (Import hinzugefügt, Event-Handler aktualisiert, Query erweitert)

## Technische Details

### Verwendete CSS-Klassen (existierend)
- `.drawer-overlay` - Semi-transparenter Overlay
- `.drawer-panel` - Slide-in Panel von rechts
- `.drawer-header` - Header mit Titel und Schließen-Button
- `.drawer-body` - Scrollbarer Content-Bereich
- `.drawer-close` - Schließen-Button
- `.form-input` - Standard Input-Styling
- `.primary-btn`, `.secondary-btn` - Button-Styling

### Custom Events
- `taskCreated` - Gefeuert nach erfolgreicher Task-Erstellung
  - `detail: { taskId, kampagneId, kooperationId, entityType, entityId }`
- `taskUpdated` - Bestehendes Event für Updates
- `taskDeleted` - Bestehendes Event für Löschungen

### Dependencies
- Supabase Client (`window.supabase`)
- Notification System (`window.notificationSystem`)
- Validator System (`window.validatorSystem`)
- Current User (`window.currentUser`)

## Zukünftige Erweiterungen (Optional)

- [ ] Auto-Filterung von Kooperationen basierend auf gewählter Kampagne
- [ ] Bulk-Erstellung von Tasks
- [ ] Templates für wiederkehrende Tasks
- [ ] Rich-Text-Editor für Beschreibung
- [ ] Datei-Upload direkt bei Erstellung
- [ ] Reminder/Notifications einrichten

## Fragen & Antworten

**Q: Was passiert mit alten Tasks ohne kampagne_id/kooperation_id?**
A: Die Migration setzt automatisch die IDs basierend auf entity_type und entity_id.

**Q: Kann eine Task zu beiden (Kampagne UND Kooperation) gehören?**
A: Ja! Eine Task kann optional zu einer Kampagne, einer Kooperation oder beiden gehören.

**Q: Zeigt der Kooperationen-Dropdown nur Kooperationen der gewählten Kampagne?**
A: Nein, aktuell werden ALLE Kooperationen angezeigt (gemäß Anforderung 2b).

**Q: Funktioniert die alte Entity-basierte Filterung noch?**
A: Ja, entity_type und entity_id werden weiterhin gesetzt für Backwards-Compatibility.

## Status

✅ **Implementierung abgeschlossen**
- Alle Code-Änderungen umgesetzt
- Keine Linter-Fehler
- Dokumentation erstellt
- Bereit für Testing und Deployment

⏳ **Wartet auf:**
- SQL-Migration Ausführung in Supabase
- Manuelle Tests durch User
- Deployment








