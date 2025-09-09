# Task List: Fix für Branchen-Bearbeitung bei Unternehmen

## Relevant Files

- `src/modules/unternehmen/UnternehmenDetail.js` - Hauptmodul für Unternehmen-Bearbeitung, enthält Datenladung und Formular-Rendering
- `src/core/form/data/DynamicDataLoader.js` - Lädt Optionen für dynamische Felder, bereits Logik für Junction Table vorhanden
- `src/core/form/data/OptionsManager.js` - Verwaltet Tag-basierte Multiselects, bereits Preselection-Logik vorhanden
- `src/core/form/FormSystem.js` - Zentrale Formular-Logik, bindet Events und verarbeitet Submissions
- `src/core/form/FormConfig.js` - Konfiguration für Unternehmen-Formular mit branche_id Multiselect
- `src/core/form/logic/FormEvents.js` - Event-Handling für Formulare, könnte erweitert werden müssen

### Notes

- Das Tag-basierte System funktioniert bereits beim Erstellen (UnternehmenCreate.js)
- OptionsManager hat bereits Preselection-Logik (Zeile 190-200)
- DynamicDataLoader hat bereits Junction Table-Logik für branche_id (Zeile 358-391)
- Problem liegt in der Verbindung zwischen Datenladung und Tag-Initialisierung

## Tasks

- [x] 1.0 Datenfluss zwischen UnternehmenDetail und FormSystem reparieren
  - [x] 1.1 UnternehmenDetail.js analysieren - wie werden geladene Branchen an FormSystem weitergegeben
  - [x] 1.2 showEditForm() Methode erweitern um Branchen-Daten für FormSystem zu formatieren
  - [x] 1.3 FormSystem.renderForm() Call mit bestehenden branche_id Werten erweitern
  - [x] 1.4 Datenübergabe zwischen UnternehmenDetail und FormSystem testen und debuggen

- [x] 2.0 Tag-basierte Initialisierung für bestehende Branchen implementieren
  - [x] 2.1 DynamicDataLoader.loadDirectQueryOptions() für branche_id im Edit-Modus erweitern
  - [x] 2.2 Bestehende Branchen-IDs aus form.dataset.entityId korrekt laden und als "selected" markieren
  - [x] 2.3 OptionsManager.createTagBasedSelect() Preselection-Logik für Junction Table Daten aktivieren
  - [x] 2.4 Tag-Container Initialisierung mit bestehenden Branchen validieren

- [x] 3.0 FormSystem für Edit-Modus mit bestehenden Werten erweitern
  - [x] 3.1 FormSystem.renderForm() erweitern um bestehende Entity-Daten zu akzeptieren
  - [x] 3.2 FormRenderer.renderField() für multiselect mit bestehenden Werten erweitern
  - [x] 3.3 Auto-Suggestion System für Edit-Modus mit vorhandenen Tags initialisieren
  - [x] 3.4 Event-Binding für Tag-Removal und neue Tag-Addition im Edit-Modus sicherstellen

- [x] 4.0 Testing und Validierung der Lösung
  - [x] 4.1 Manueller Test: Unternehmen mit bestehenden Branchen öffnen und Tags-Anzeige validieren
  - [x] 4.2 Funktionstest: Bestehende Branchen einzeln entfernen und Speichern testen
  - [x] 4.3 Funktionstest: Neue Branchen hinzufügen ohne bestehende zu verlieren
  - [x] 4.4 Datenbank-Validierung: Junction Table Updates korrekt durchgeführt
  - [x] 4.5 Regression-Test: Andere Multiselect-Felder weiterhin funktionsfähig
