# Grid-Tabellen Feature

## Übersicht
Excel-ähnliches Grid-System für flexible Tabellen im CRM. Mitarbeiter können eigene Tabellen erstellen und verwalten.

## Installation

### 1. Migration ausführen
Die Datenbank-Tabellen müssen in Supabase erstellt werden:

```sql
-- Führe aus: migrations/create_grid_tables.sql
```

Dies erstellt:
- `grid_documents` - Tabellen-Metadaten
- `grid_cells` - Zellendaten
- RLS Policies für Sicherheit
- Indexes für Performance

### 2. Verifizierung
Nach der Migration sollten folgende Tabellen existieren:
- `grid_documents`
- `grid_cells`

## Features

### Übersichtsseite (`/tabellen`)
- Liste aller eigenen Tabellen
- Neue Tabelle erstellen
- Tabellen öffnen/löschen
- Letzte Änderung sichtbar

### Grid-Editor
- **Zellen editieren**: Doppelklick oder Enter
- **Keyboard-Navigation**: Arrow Keys, Tab, Enter
- **Zeilen/Spalten**: Hinzufügen über Toolbar oder Kontextmenü
- **Auto-Save**: Automatisches Speichern nach 500ms
- **Kontextmenü**: Rechtsklick auf Zeilen-/Spalten-Header

### Keyboard-Shortcuts
- `Enter` - Zelle editieren
- `Escape` - Edit abbrechen
- `Tab` - Nächste Zelle (rechts)
- `Shift+Tab` - Vorherige Zelle (links)
- `Arrow Keys` - Navigation
- `Delete/Backspace` - Zelle leeren

## Technische Details

### Architektur
```
TabellenModule.js (Übersicht + Router)
├── GridEditor.js (Hauptkomponente)
│   ├── GridRenderer.js (HTML Table Rendering)
│   ├── GridController.js (Event-Handling)
│   └── AutoSaveManager.js (Supabase Auto-Save)
```

### Datenbankstruktur

**grid_documents**
- `id` - UUID
- `name` - Tabellenname
- `created_by` - Mitarbeiter-ID
- `created_at`, `updated_at` - Timestamps
- `metadata` - JSONB (für zukünftige Features)

**grid_cells**
- `id` - UUID
- `document_id` - Referenz zu grid_documents
- `row`, `col` - Position (0-basiert)
- `value` - Zelleninhalt (Text)
- `style` - JSONB (für Formatierung)
- Unique Index: `(document_id, row, col)`

### Auto-Save
- Debounce: 500ms nach letzter Änderung
- Nur geänderte Zellen werden gespeichert (Upsert)
- Retry bei Fehlern nach 2 Sekunden
- Status-Indikator: Speichert/Gespeichert/Fehler

### Sicherheit (RLS)
- Mitarbeiter sehen nur eigene Tabellen
- Alle CRUD-Operationen über RLS geschützt
- Zellen-Zugriff nur wenn Dokument gehört

## Zukünftige Erweiterungen

### Phase 2 (geplant)
- [ ] Tabellen mit Kampagnen verknüpfen
- [ ] Tabellen teilen (Multi-User)
- [ ] Live-Updates bei gleichzeitiger Bearbeitung
- [ ] Zellen zusammenführen (merge cells)
- [ ] Datentypen (Text, Zahl, Datum, Dropdown)
- [ ] Formatierung (Bold, Farben, Ausrichtung)
- [ ] Formeln/Berechnungen
- [ ] Export (CSV, Excel)
- [ ] Spaltenbreite anpassen
- [ ] Zeilen/Spalten verschieben

### Phase 3 (Ideen)
- [ ] Vorlagen-System
- [ ] Kommentare in Zellen
- [ ] Versionshistorie
- [ ] Berechtigungsstufen beim Teilen
- [ ] Benachrichtigungen bei Änderungen

## Testing

### Manuelle Tests
1. **Tabelle erstellen**
   - Gehe zu `/tabellen`
   - Klicke "Neue Tabelle"
   - Gib Namen ein → Bestätigen
   - Sollte Editor öffnen

2. **Zellen editieren**
   - Doppelklick auf Zelle
   - Text eingeben
   - Enter drücken
   - Prüfe: "Gespeichert" Indikator

3. **Navigation**
   - Arrow Keys zum Navigieren
   - Tab zum Springen
   - Enter zum Editieren

4. **Zeilen/Spalten**
   - Toolbar: "Zeile hinzufügen"
   - Kontextmenü: Rechtsklick auf Header
   - Löschen: Bestätigung notwendig

5. **Persistence**
   - Daten eingeben
   - Zurück zur Liste (`/tabellen`)
   - Tabelle erneut öffnen
   - Prüfe: Daten noch da

6. **Auto-Save**
   - Schnell mehrere Zellen editieren
   - Prüfe: Nur 1-2 Save-Requests (nicht für jede Änderung)
   - Warte 500ms zwischen Änderungen

## Troubleshooting

### Tabellen laden nicht
- Prüfe Browser Console auf Fehler
- Prüfe Supabase RLS Policies
- Prüfe: `window.currentUser.id` existiert

### Auto-Save funktioniert nicht
- Prüfe Network Tab: Supabase Requests
- Prüfe Console: "💾 Speichere X Zellen..."
- Prüfe: Supabase Permissions

### Performance-Probleme
- Bei > 1000 Zellen: Virtualisierung implementieren
- Indexes prüfen in Supabase
- Browser DevTools Performance Tab nutzen

## Navigation
Das Feature ist im Menü unter **Tools → Tabellen** verfügbar.

Alle Mitarbeiter mit Dashboard-Berechtigung können das Feature nutzen.



