<!-- b454514e-83bd-4ebd-8057-d8ee388baa56 3d4e9d68-c7ae-4293-8aa5-dfba749362d7 -->
# Task-Management-System für Kooperationen ✅ ERLEDIGT

## Datenbankstruktur

### Haupttabellen

**1. kooperation_tasks** - Kernentität für Tasks

- Felder: `id`, `title`, `description`, `status` (todo/in_progress/completed), `priority` (low/medium/high), `due_date`, `sort_order`, `category_id` (FK zu kampagne_status), `entity_type` (kooperation/kampagne/auftrag), `entity_id`, `assigned_to_user_id` (nullable), `is_public` (für alle sichtbar), `created_by`, `created_at`, `updated_at`, `completed_at`

**2. kooperation_task_comments** - Kommentare zu Tasks

- Felder: `id`, `task_id`, `author_benutzer_id`, `author_name`, `text`, `created_at`, `updated_at`, `deleted_at`, `deleted_by_benutzer_id`

**3. kooperation_task_attachments** - Dateianhänge

- Felder: `id`, `task_id`, `file_name`, `file_path`, `file_url`, `content_type`, `size`, `uploaded_by`, `created_at`

**4. kooperation_task_history** - Änderungsverlauf

- Felder: `id`, `task_id`, `changed_by`, `change_type` (created/status_changed/assigned/commented/attachment_added), `old_value`, `new_value`, `metadata` (JSONB), `created_at`

### SQL Migration

Die vollständige SQL-Migration wurde in `create_task_management_system.sql` erstellt und vom User in Supabase ausgeführt.

## Frontend-Implementierung

### Neue Module

**1. `/src/modules/tasks/TaskKanbanBoard.js`** ✅

- Kanban Board mit 3 Spalten (To-Do, In Progress, Completed)
- Native HTML5 Drag & Drop zwischen und innerhalb von Spalten
- Filter: Assignee, Priorität, Kategorie, Fälligkeitsdatum
- Quick-Add-Form für neue Tasks inline integriert
- Task-Karten zeigen: Titel, Priorität-Badge, Assignee-Avatar, Due-Date-Badge, Kategorie-Tag

**2. `/src/modules/tasks/TaskDetailDrawer.js`** ✅

- Rechts-nach-Links Slide-In Drawer (analog zur Kooperations-Schnellansicht)
- Tabs: "Details", "Kommentare", "Anhänge", "History"
- Details-Tab: Titel, Beschreibung, Status-Dropdown, Priorität, Kategorie, Due Date, Assignee-Select
- Kommentare-Tab: Chronologische Liste + Kommentar-Formular (analog zu Video-Kommentaren)
- Anhänge-Tab: Upload-Bereich + Liste mit Download-Links
- History-Tab: Timeline-Ansicht aller Änderungen mit Icons

**3. `/src/modules/tasks/TaskListPage.js`** ✅

- Übersichtsseite mit Filter nach Entity (Kooperation/Kampagne/Auftrag)
- Tabellen- UND Kanban-Ansicht umschaltbar
- Export-Funktion (optional für später)

**4. `/src/modules/tasks/TaskQuickAddForm.js`** ✅

- Kompaktes Inline-Formular im Kanban Board (integriert in TaskKanbanBoard)
- Minimale Pflichtfelder: Titel, Status
- Weitere Felder im Detail-Drawer bearbeitbar

### Integration in bestehende Views

**A. Kooperations-Detailansicht** (`/src/modules/kooperation/KooperationDetail.js`) ✅

- Neuer Tab "Aufgaben" neben "Informationen", "Videos", etc.
- Eingebettetes Kanban Board (gefiltert auf diese Kooperation)
- Quick-Add-Button prominent platziert

**B. Kooperations-Übersicht** (`/src/modules/kooperation/KooperationListPage.js`) ✅

- Quick-Action-Button "Aufgabe erstellen" in Actions-Dropdown jeder Zeile
- Zeigt Task-Quick-Add-Modal mit vorausgefüllter Kooperation

**C. Kampagnen-Detail** (analog zu Kooperationen)

- Tab "Aufgaben" mit Kanban Board (kann später hinzugefügt werden)

**D. Navigation** (`/src/core/router.js`) ✅

- Neue Route: `/tasks` → TaskListPage (globale Übersicht)
- Navigation: Neuer Menüpunkt "Aufgaben" in Hauptnavigation

### Benachrichtigungen

**Task-Notifications** (`/src/core/components/NotificationSystem.js`) ✅

- Neue Notification-Typen: `task_assigned`, `task_comment`, `task_status_changed`
- Entity-URL für Tasks hinzugefügt: `/tasks?task={id}`
- Benachrichtigungen senden:
  - Bei Task-Zuweisung → an assigned_to_user_id
  - Bei Statuswechsel → an alle beteiligten Mitarbeiter der Entity
  - Bei neuem Kommentar → an Assignee + alle Kommentatoren

### Drag & Drop UX

**DragDropSystem** ✅ (Integriert in TaskKanbanBoard)

- Native HTML5 Drag & Drop mit visuellem Feedback:
  - Drag-Shadow mit Task-Preview
  - Drop-Zones mit Highlight-Effekt
  - "Platziere hier"-Indikator
  - Smooth Animations beim Drop
- Funktionen:
  - `onDragStart`: Task-Daten speichern, visuelles Feedback
  - `onDragOver`: Drop-Zone validieren und highlighten
  - `onDrop`: Daten lesen, DB-Update (Status + sort_order), UI optimistisch aktualisieren
  - `onDragEnd`: Cleanup

### Styling

**CSS-Erweiterungen** (`/assets/styles/dashboard.css`) ✅

- `.kanban-board` Container mit Grid-Layout
- `.kanban-column` mit Scroll-Bereich
- `.task-card` mit Hover-Effekt, Priority-Border-Color
- `.task-detail-drawer` mit Slide-In-Animation
- `.priority-badge`, `.due-date-badge` mit Farb-Kodierung
- `.timeline-entry` für History-Einträge

## Technische Details

**Drag & Drop Implementierung:** ✅

Native HTML5 Drag & Drop implementiert in TaskKanbanBoard mit:
- `draggable="true"` auf Task-Karten
- `dragstart`, `dragover`, `drop`, `dragend` Events
- Datenübertragung via `dataTransfer`
- DB-Update für Status und sort_order
- UI-Refresh nach erfolgreichem Drop

**Berechtigungs-Check:** ✅

RLS Policies in Supabase implementiert für:
- Task-Sichtbarkeit basierend auf Entity-Zuordnung
- Mitarbeiter sehen Tasks ihrer zugeordneten Kooperationen/Kampagnen/Aufträge
- Kunden sehen Tasks ihrer Marken/Unternehmen
- Insert/Update/Delete Policies nach Rolle

**Due Date Highlighting:** ✅

CSS-Klassen in dashboard.css:
- `.due-date-overdue`: Rot (überfällig)
- `.due-date-soon`: Orange (innerhalb 3 Tage)
- `.due-date-upcoming`: Gelb (innerhalb 7 Tage)
- Default: Grau

## Offene Punkte / Phase 2

- Recurring Tasks (optional)
- Task-Templates (optional)
- Zeit-Tracking pro Task (optional)
- Subtasks / Checklisten (optional)
- Email-Benachrichtigungen (zusätzlich zu In-App)

### To-dos

- [x] SQL-Migration ausführen: Tabellen, Indizes, RLS Policies, Trigger erstellen
- [x] ~~Supabase Storage Bucket 'task-attachments' erstellen und konfigurieren~~ (übersprungen)
- [x] DragDropSystem utility erstellen mit Drag-Feedback und Drop-Handling (integriert in TaskKanbanBoard)
- [x] TaskDetailDrawer component mit Tabs (Details, Kommentare, Anhänge, History)
- [x] TaskKanbanBoard component mit 3 Spalten, Filter und Drag & Drop Integration
- [x] TaskQuickAddForm component für schnelles Task-Erstellen (integriert in TaskKanbanBoard)
- [x] TaskListPage mit globaler Übersicht und Filter
- [x] Kooperations-Detail: Aufgaben-Tab mit eingebettetem Kanban Board hinzufügen
- [x] Kooperations-Übersicht: Quick-Action 'Aufgabe erstellen' in Actions-Dropdown
- [x] Task-Notifications erweitern: task_assigned, task_comment, task_status_changed
- [x] Navigation und Router erweitern: /tasks Route und Menüpunkt hinzufügen
- [x] CSS für Kanban Board, Task Cards, Drawer, Priority/Due Date Badges
- [ ] RLS Policies und Berechtigungen testen (Mitarbeiter vs Kunde) - Manuelles Testing erforderlich

## Testing-Checkliste

### RLS Policies Testing

**Als Admin:**
- [ ] Kann alle Tasks sehen (kooperation/kampagne/auftrag)
- [ ] Kann Tasks erstellen, bearbeiten, löschen
- [ ] Kann Kommentare und Anhänge verwalten

**Als Mitarbeiter:**
- [ ] Sieht nur Tasks von zugeordneten Kampagnen/Kooperationen/Aufträgen
- [ ] Kann Tasks erstellen und bearbeiten
- [ ] Kann eigene zugewiesene Tasks bearbeiten
- [ ] Kann Kommentare und Anhänge zu sichtbaren Tasks hinzufügen

**Als Kunde:**
- [ ] Sieht nur Tasks von eigenen Marken/Unternehmen
- [ ] Kann Tasks sehen (read-only oder eingeschränkt)
- [ ] Kann ggf. eigene zugewiesene Tasks bearbeiten

### UI/UX Testing

- [ ] Drag & Drop funktioniert zwischen Spalten
- [ ] Drag & Drop funktioniert innerhalb von Spalten (Reordering)
- [ ] Task-Drawer öffnet sich und zeigt korrekte Daten
- [ ] Filter funktionieren (Assignee, Priority, Category, Due Date)
- [ ] Quick-Add-Form erstellt Tasks korrekt
- [ ] History-Timeline zeigt alle Änderungen an
- [ ] Kommentare können hinzugefügt und angezeigt werden
- [ ] Datei-Upload für Anhänge funktioniert (falls Storage Bucket erstellt)

### Notifications Testing

- [ ] Benachrichtigung bei Task-Zuweisung
- [ ] Benachrichtigung bei neuem Kommentar
- [ ] Benachrichtigung bei Statuswechsel
- [ ] Click auf Notification navigiert zu korrekter Task

## Implementierungs-Status: ✅ ABGESCHLOSSEN

**Datum:** 28. Oktober 2025

**Implementiert:**
- ✅ Vollständige Datenbankstruktur mit RLS Policies und Triggern
- ✅ TaskKanbanBoard mit Drag & Drop
- ✅ TaskDetailDrawer mit allen Tabs
- ✅ TaskListPage mit Filter und Ansichten
- ✅ Kooperations-Detail Integration (Tab + Kanban)
- ✅ Quick-Action in Actions-Dropdown
- ✅ Navigation Menüpunkt "Aufgaben"
- ✅ Task-Notifications Support
- ✅ CSS Styling mit bestehenden Variablen
- ✅ Icon-Registry Update (tasks Icon)

**Hinweise:**
- Storage Bucket `task-attachments` muss noch manuell in Supabase Dashboard erstellt werden
- Testing der RLS Policies sollte nach Deployment durchgeführt werden
- Die Kampagnen-Detail Integration kann analog zur Kooperations-Detail Integration später ergänzt werden

