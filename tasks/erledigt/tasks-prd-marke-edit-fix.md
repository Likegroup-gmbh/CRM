# Tasks: Fix für Marken-Bearbeitung - Unternehmen und Branchen laden

## Relevant Files

- `src/modules/marke/MarkeDetail.js` - Hauptkomponente für Markendetails, benötigt Edit-Modus Erweiterung für Datenvorauswahl
- `src/core/form/FormConfig.js` - FormConfig für Marken, muss korrigiert werden (branchen_ids → branche_id)  
- `src/core/form/FormSystem.js` - FormSystem für Edit-Modus mit bestehenden Werten
- `src/core/form/data/DynamicDataLoader.js` - Dynamische Datenladung für Auto-Suggestion Felder im Edit-Modus
- `src/core/form/data/OptionsManager.js` - Auto-Suggestion System für einfache Select-Felder
- `src/core/form/logic/FormEvents.js` - Formular-Events mit Edit-Modus Datenweiterleitung erweitert
- `src/core/DataService.js` - Entity-Update Logik (bereits funktionsfähig)

### Notes

- Problem: FormConfig verwendet `branchen_ids` (multiselect) aber Datenbank hat `branche_id` (single select)
- Marken haben einfache Foreign Keys, keine Junction Tables wie Unternehmen
- Auto-Suggestion System funktioniert beim Erstellen, aber bestehende Werte werden nicht initialisiert
- Ähnliches Problem wie bei Unternehmen-Branchen, aber für einfache Select-Felder

### Debug-Fixes

- FormEvents.js erweitert um Edit-Mode Datenweiterleitung
- DynamicDataLoader Junction-Table Logik nur für Unternehmen
- MarkeDetail.js erweitert um Branche-Daten laden
- FormSystem.js erweitert um bestehende Werte in Auto-Suggestion setzen
- MarkeDetail.js erweitert um Tag-basierte Submit-Logik für alle Branchen
- MarkeDetail.js erweitert um Branchen aus Junction Table zu laden und anzuzeigen
- dashboard.css erweitert um .detail-tag Styles für Branchen-Tags

## Tasks

- [x] 1.0 FormConfig für Marken korrigieren
  - [x] 1.1 `branchen_ids` zu `branche_id` ändern (single select statt multiselect)
  - [x] 1.2 `tagBased: true` entfernen für Branche-Feld
  - [x] 1.3 Korrekte Tabelle und Felder für Branche-Lookup definieren
  - [x] 1.4 Unternehmen-Feld Konfiguration überprüfen und anpassen

- [ ] 2.0 MarkeDetail Edit-Modus erweitern
  - [x] 2.1 `showEditForm()` Methode erweitern für Datenformatierung
  - [x] 2.2 Edit-Mode Flags (_isEditMode, _entityId) hinzufügen
  - [x] 2.3 Bestehende unternehmen_id und branche_id als vorausgewählte Werte formatieren
  - [x] 2.4 FormSystem.bindFormEvents() mit vorbereiteten Daten aufrufen

- [ ] 3.0 DynamicDataLoader für einfache Selects im Edit-Modus erweitern
  - [x] 3.1 Edit-Modus Erkennung für einfache Select-Felder hinzufügen
  - [x] 3.2 Bestehende Werte als "selected" markieren für Auto-Suggestion
  - [x] 3.3 Unternehmen und Branchen Namen für Anzeige laden
  - [x] 3.4 Fallback-Logik für fehlende Referenzdaten implementieren

- [x] 4.0 FormSystem Edit-Modus Integration  
  - [x] 4.1 Edit-Modus Daten aus form.dataset.editModeData lesen
  - [x] 4.2 Auto-Suggestion Felder mit bestehenden Werten initialisieren
  - [x] 4.3 Sicherstellen dass Änderungen korrekt erfasst werden

- [ ] 5.0 Testing und Validierung
  - [ ] 5.1 Marke mit bestehendem Unternehmen öffnen - Unternehmen wird angezeigt
  - [ ] 5.2 Marke mit bestehender Branche öffnen - Branche wird angezeigt  
  - [ ] 5.3 Unternehmen ändern und speichern - Änderung wird korrekt gespeichert
  - [ ] 5.4 Branche ändern und speichern - Änderung wird korrekt gespeichert
  - [ ] 5.5 Marke ohne Unternehmen/Branche öffnen - Felder bleiben leer aber funktional
