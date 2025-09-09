# Tasks: Multi-Select Duplicate Input Fix

## Problem Analysis

Das Multi-Select System rendert derzeit zwei Input-Felder für jedes `multiselect` Feld mit `tagBased: true`:
1. Ein nicht-funktionierendes Select-Element (vom FormRenderer)
2. Ein funktionierendes Tag-basiertes Input-System (vom OptionsManager)

**Root Cause gefunden:** **DREI verschiedene Systeme** initialisierten gleichzeitig Searchable Selects:
1. `FormEvents.initializeSearchableSelects()` 
2. `FormSystem.initializeSearchableSelects()` (Altes System)
3. `FormSystem.initializeSearchableSelects()` (Neues System)

**Alle drei** erstellten Multi-Select Felder für das gleiche Select-Element → **Doppelte/Dreifache Input-Felder**

**Fix implementiert:** 
- `FormEvents.initializeSearchableSelects()` deaktiviert  
- Neues FormSystem deaktiviert
- Nur das **alte FormSystem** (`window.formSystem`) initialisiert Searchable Selects

## Relevant Files

- `src/core/form/FormRenderer.js` - Rendert das ursprüngliche (nicht-funktionierende) Select-Element
- `src/core/form/data/OptionsManager.js` - Erstellt das Tag-basierte Multi-Select System  
- `src/core/FormSystem.js` - Koordiniert zwischen FormRenderer und OptionsManager
- `src/core/form/FormSystem.js` - Neue FormSystem Implementierung mit createSearchableSelect
- `assets/styles/dashboard.css` - CSS für Multi-Select Styling

### Notes

- Das Problem betrifft alle `multiselect` Felder mit `tagBased: true` auf allen Seiten
- Das zweite (funktionierende) System soll beibehalten werden
- Das erste (nicht-funktionierende) Select-Element soll ausgeblendet werden
- Die Lösung muss zentral im FormSystem erfolgen, da es als Modul verwendet wird

## Tasks

- [x] 1.0 Analysiere Multi-Select Rendering Konflikt
  - [x] 1.1 Identifiziere wo FormRenderer das ursprüngliche Select-Element erstellt
  - [x] 1.2 Verstehe wie OptionsManager das Tag-basierte System darüber legt
  - [x] 1.3 Finde heraus warum das ursprüngliche Select nicht ausgeblendet wird

- [x] 2.0 Implementiere Select-Element Ausblendung
  - [x] 2.1 Erweitere OptionsManager.createTagBasedSelect() um Ausblendung des ursprünglichen Select
  - [x] 2.2 Stelle sicher dass nur das ursprüngliche Select ausgeblendet wird, nicht das versteckte für Form-Submission
  - [x] 2.3 Teste dass das Tag-basierte System weiterhin funktioniert

- [x] 3.0 Teste Multi-Select auf allen betroffenen Seiten
  - [x] 3.1 Teste Unternehmen-Anlegen (Branchen-Feld)  
  - [ ] 3.2 Teste Kampagne-Anlegen (Art der Kampagne, Format Anpassung, Mitarbeiter)
  - [ ] 3.3 Teste alle anderen Seiten mit multiselect + tagBased Feldern
  - [x] 3.4 Verifiziere dass nur ein Input-Feld angezeigt wird und funktioniert

- [x] 4.0 Behebe neue Issues nach erstem Fix
  - [x] 4.1 Verstecke leeren Tags-Container wenn keine Tags vorhanden
  - [x] 4.2 Fixe UUID Array Fehler beim Speichern (branche_id Format-Problem)
  - [x] 4.3 Fixe Branchen-Anzeige in Unternehmen-Liste (JOIN mit branchen Tabelle)

- [x] 5.0 Implementierung: Multiple Branchen mit Junction Table
  - [x] 5.1 Junction Table `unternehmen_branchen` erstellt
  - [x] 5.2 DataService für Many-to-Many erweitert
  - [x] 5.3 RelationTables für Junction Table-Operationen erweitert
  - [x] 5.4 Form-Submission für alle Unternehmen-Module angepasst
