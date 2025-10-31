# Task-Zuweisung: Separate Mitarbeiter- und Kunden-Felder

## Datum: 2025-10-31

## Übersicht

Das Task-System wurde erweitert, damit Aufgaben **gleichzeitig** an einen Mitarbeiter UND einen Kunden zugewiesen werden können. Es gibt nun zwei separate Dropdown-Felder:

1. **Zuweisen an Mitarbeiter** - Zeigt nur Mitarbeiter/Admins
2. **Zuweisen an Kunde** - Zeigt nur Kunden (nur für Admins/Mitarbeiter sichtbar)

## Änderungen

### 1. Datenbank-Migrationen

#### Migration 1: Neue Spalte `assigned_to_kunde_id`

**Datei**: `add_kunde_assignment_to_tasks.sql`

- Fügt Spalte `assigned_to_kunde_id` zu `kooperation_tasks` hinzu
- Index für Performance erstellt
- Trigger für History-Tracking bei Kunden-Zuweisung
- RLS Policy erweitert, damit Kunden Tasks sehen, die ihnen zugewiesen sind

#### Migration 2: Separate Views für Mitarbeiter und Kunden

**Datei**: `create_mitarbeiter_kunden_views.sql`

Erstellt zwei neue Views:

**`v_available_mitarbeiter`**:
- Admins/Mitarbeiter sehen alle Mitarbeiter/Admins
- Kunden sehen nur verknüpfte Mitarbeiter (über Marken/Kampagnen/Aufträge)

**`v_available_kunden`**:
- Nur für Admins/Mitarbeiter zugänglich
- Zeigt alle Kunden im System

### 2. Frontend-Änderungen

#### TaskCreateDrawer.js

**Konstruktor** (Zeile 5-11):
- `this.mitarbeiter = []` statt `this.users = []`
- `this.kunden = []` hinzugefügt

**Initialisierung** (Zeile 21-22):
- Lädt nur Kampagnen beim Öffnen
- Mitarbeiter/Kunden werden erst nach Kampagnenauswahl geladen

**Load-Methoden** (Zeile 131-211):
- `loadMitarbeiter(kampagneId)` - lädt Mitarbeiter **für die ausgewählte Kampagne** über `kampagne_mitarbeiter`
- `loadKunden(kampagneId)` - lädt Kunden **für die ausgewählte Kampagne** über Marke → `kunde_marke`
- Beide Methoden geben leere Arrays zurück wenn keine Kampagne ausgewählt ist

**Kampagnen-Auswahl Event** (Zeile 366-389):
- Listener auf Kampagnen-Dropdown
- Bei Änderung: Lädt kampagnenspezifische Mitarbeiter und Kunden
- Re-rendert das Formular mit den neuen Dropdowns

**Formular** (Zeile 269-299):
- Zwei separate Dropdowns
- Kunden-Dropdown nur sichtbar wenn `this.kunden.length > 0`
- Dropdowns werden nur mit Daten gefüllt NACHDEM eine Kampagne ausgewählt wurde
- Feldnamen: `assigned_to_user_id` und `assigned_to_kunde_id`

**Submit** (Zeile 386):
- Beide IDs werden gespeichert

#### TaskDetailDrawer.js

**Konstruktor** (Zeile 5-15):
- `this.availableMitarbeiter = []` und `this.availableKunden = []`

**Load-Methoden** (Zeile 113-217):
- `loadTaskData()` lädt auch `assigned_kunde` Relation
- `loadAvailableMitarbeiter()` - entity-spezifische Filterung
- `loadAvailableKunden()` - aus View

**Editierbares Formular** (Zeile 388-412):
- Zwei separate Dropdowns
- Kunden-Dropdown bedingt angezeigt

**Read-Only Ansicht** (Zeile 514-530):
- Zeigt beide Zuweisungen (falls vorhanden)
- Kunden-Zuweisung bedingt angezeigt

**Update Handler** (Zeile 712):
- `assigned_to_kunde_id` wird mitgespeichert

### 3. Berechtigungslogik

| Benutzerrolle | Sieht Mitarbeiter-Dropdown | Sieht Kunden-Dropdown | Filterung |
|---------------|---------------------------|----------------------|-----------|
| Admin         | ✅ Kampagnen-Mitarbeiter | ✅ Kunden der Marke | Kampagnenspezifisch |
| Mitarbeiter   | ✅ Kampagnen-Mitarbeiter | ✅ Kunden der Marke | Kampagnenspezifisch |
| Kunde         | ✅ Kampagnen-Mitarbeiter | ❌ Nicht sichtbar | Kampagnenspezifisch |

**Wichtig**: Die Dropdowns werden erst gefüllt NACHDEM eine Kampagne ausgewählt wurde. Dies stellt sicher, dass nur relevante Mitarbeiter und Kunden angezeigt werden.

### 4. Datenbank-Schema

**Neue Spalte in `kooperation_tasks`**:
```sql
assigned_to_kunde_id uuid REFERENCES benutzer(id)
```

**Neue Trigger-Historie**:
- Change-Type: `kunde_assigned`
- Tracked bei Änderungen von `assigned_to_kunde_id`

## Deployment

### Schritt 1: Datenbank-Migrationen ausführen

```bash
# Migration 1: Spalte hinzufügen
# Inhalt von add_kunde_assignment_to_tasks.sql im Supabase SQL Editor ausführen

# Migration 2: Views erstellen
# Inhalt von create_mitarbeiter_kunden_views.sql im Supabase SQL Editor ausführen
```

### Schritt 2: Frontend deployen

Das Frontend ist bereits angepasst und nutzt automatisch die neuen Views und Felder.

## Testing

### Test als Admin/Mitarbeiter
1. Als Admin oder Mitarbeiter einloggen
2. Task erstellen
3. **Schritt 1**: Kampagne auswählen
4. **Erwartetes Ergebnis nach Schritt 1**: 
   - Dropdown "Zuweisen an Mitarbeiter" erscheint mit Mitarbeitern der Kampagne
   - Dropdown "Zuweisen an Kunde" erscheint mit Kunden der Marke
5. Beide Felder können gleichzeitig befüllt werden

### Test als Kunde
1. Als Kunde einloggen
2. Task erstellen
3. **Schritt 1**: Kampagne auswählen
4. **Erwartetes Ergebnis nach Schritt 1**:
   - Dropdown "Zuweisen an Mitarbeiter" erscheint mit Mitarbeitern der Kampagne
   - Dropdown "Zuweisen an Kunde" ist NICHT sichtbar

### Test: Kampagnenspezifische Filterung
1. Als Admin Task erstellen
2. Kampagne A auswählen → Mitarbeiter-Liste zeigt nur Mitarbeiter von Kampagne A
3. Kampagne auf B ändern → Mitarbeiter-Liste aktualisiert sich mit Mitarbeitern von Kampagne B
4. **Erwartetes Ergebnis**: Listen sind kampagnenspezifisch und aktualisieren sich dynamisch

### Test: Gleichzeitige Zuweisung
1. Als Admin Task erstellen
2. Mitarbeiter UND Kunde zuweisen
3. Task speichern
4. Task wieder öffnen
5. **Erwartetes Ergebnis**: Beide Zuweisungen sind gespeichert und werden angezeigt

## Technische Details

### Kampagnenspezifische Filterung

**Mitarbeiter**:
- Geladen über `kampagne_mitarbeiter` Junction-Tabelle
- Query: `SELECT mitarbeiter WHERE kampagne_id = [selected_kampagne]`

**Kunden**:
- **Fall 1**: Kampagne hat eine Marke (`marke_id` ist gesetzt)
  1. Lade `marke_id` der ausgewählten Kampagne
  2. Lade Kunden über `kunde_marke` Junction-Tabelle
  3. Query: `SELECT kunde WHERE marke_id = [kampagne.marke_id]`

- **Fall 2**: Kampagne hat keine Marke (direkt mit Unternehmen verknüpft)
  1. Lade `unternehmen_id` der ausgewählten Kampagne
  2. Lade Kunden über `kunde_unternehmen` Junction-Tabelle
  3. Query: `SELECT kunde WHERE unternehmen_id = [kampagne.unternehmen_id]`

**Wichtig**: Nicht alle Unternehmen haben Marken. Manche Unternehmen operieren direkt ohne Marken-Struktur, daher prüft der Code beide Fälle.

### Dynamisches Nachladen

- Initial werden KEINE Mitarbeiter/Kunden geladen
- Erst nach Kampagnenauswahl werden die Listen gefüllt
- Bei Kampagnenwechsel werden die Listen neu geladen
- Form wird dynamisch re-rendert um neue Dropdowns anzuzeigen

### History-Tracking

Der neue Trigger `trigger_track_task_kunde_assignment` tracked alle Änderungen an der Kunden-Zuweisung automatisch in `kooperation_task_history`.

## Rollback

Falls ein Rollback nötig ist:

```sql
-- Spalte entfernen
ALTER TABLE kooperation_tasks DROP COLUMN IF EXISTS assigned_to_kunde_id;

-- Trigger entfernen
DROP TRIGGER IF EXISTS trigger_track_task_kunde_assignment ON kooperation_tasks;
DROP FUNCTION IF EXISTS track_task_kunde_assignment();

-- Views entfernen
DROP VIEW IF EXISTS v_available_mitarbeiter;
DROP VIEW IF EXISTS v_available_kunden;
```

Frontend muss entsprechend zurückgesetzt werden (Git Revert).

## Weiterführende Dokumentation

- `MITARBEITER_SICHTBARKEIT_IMPLEMENTATION.md` - Ursprüngliche View-Dokumentation
- `TASK_CREATION_IMPLEMENTATION.md` - Task-System Dokumentation
- `TASK_SIMPLIFICATION_FINAL.md` - Task-Vereinfachungen

