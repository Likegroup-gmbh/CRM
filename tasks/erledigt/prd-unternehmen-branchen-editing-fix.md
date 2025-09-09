# PRD: Fix für Branchen-Bearbeitung bei Unternehmen

## Introduction/Overview

Beim Bearbeiten von bestehenden Unternehmen werden die bereits zugewiesenen Branchen nicht im Multiselect-Feld angezeigt. Nutzer können daher bestehende Branchen nicht sehen oder entfernen und neue Branchen werden nicht korrekt zu den bestehenden hinzugefügt, sondern überschreiben diese. Das Problem betrifft das Auto-Suggestion Modul, das beim Erstellen funktioniert, aber beim Bearbeiten bestehender Daten versagt.

**Ziel:** Bestehende Branchen beim Bearbeiten von Unternehmen korrekt anzeigen und bearbeitbar machen.

## Goals

1. Bestehende Branchen-Zuweisungen beim Laden eines Unternehmens zur Bearbeitung anzeigen
2. Einzelne Branchen über X-Button entfernen können
3. Neue Branchen über Suchfeld hinzufügen können (zusätzlich zu bestehenden)
4. Junction Table `unternehmen_branchen` korrekt aktualisieren beim Submit
5. Identisches Verhalten wie beim Erstellen von Unternehmen gewährleisten

## User Stories

**Als CRM-Nutzer möchte ich:**
- Beim Öffnen eines Unternehmens zur Bearbeitung alle bereits zugewiesenen Branchen als Tags/Chips sehen
- Bestehende Branchen einzeln entfernen können (X-Button)
- Neue Branchen über das Suchfeld hinzufügen können, ohne bestehende zu verlieren
- Die Änderungen beim Formular-Submit korrekt gespeichert bekommen

**Als System möchte ich:**
- Bestehende Branchen aus der Junction Table `unternehmen_branchen` laden
- Die geladenen Branchen im Tag-basierten Multiselect anzeigen
- Beim Submit die Junction Table korrekt aktualisieren (bestehende entfernen, neue hinzufügen)

## Functional Requirements

1. **Datenladung beim Edit-Modus:**
   - Das System muss beim Laden eines Unternehmens zur Bearbeitung die verknüpften Branchen aus `unternehmen_branchen` laden
   - Die geladenen Branchen-IDs müssen im DynamicDataLoader als "selected" markiert werden
   - Die Branchen müssen als Tags/Chips im Frontend angezeigt werden

2. **Tag-basierte Anzeige:**
   - Bestehende Branchen müssen als entfernbare Tags angezeigt werden (mit X-Button)
   - Das Suchfeld muss funktionsfähig bleiben für neue Branchen
   - Die UI muss identisch zum Erstellen-Modus sein

3. **Datenverarbeitung beim Submit:**
   - Bestehende Branchen-Verknüpfungen in Junction Table müssen entfernt werden
   - Neue Branchen-Verknüpfungen müssen korrekt erstellt werden
   - Das Array `branche_id` muss alle aktuell ausgewählten Branchen enthalten

4. **Fehlerbehandlung:**
   - Bei Fehlern beim Laden der Branchen soll eine Warnung ausgegeben werden
   - Das Formular soll trotzdem funktionsfähig bleiben

## Non-Goals (Out of Scope)

- Änderung der Junction Table Struktur
- Änderung des grundlegenden Tag-basierten Multiselect Systems
- Sofortiges Speichern bei Tag-Änderungen (bleibt bei Submit)
- Änderung anderer Multiselect-Felder

## Design Considerations

- **UI/UX:** Identisch zum Unternehmen-Erstellen Modul
- **Komponenten:** Wiederverwendung des bestehenden Tag-basierten Multiselect Systems
- **Datenfluss:** Nutzung der bestehenden DynamicDataLoader und RelationTables Logik

## Technical Considerations

- **Abhängigkeiten:** DynamicDataLoader, OptionsManager, RelationTables, FormSystem
- **Datenbank:** Junction Table `unternehmen_branchen` bereits vorhanden
- **Integration:** Muss mit bestehendem FormConfig und UnternehmenDetail System arbeiten
- **Debugging:** Console-Logs zeigen, dass Daten geladen aber nicht angezeigt werden

## Success Metrics

- Bestehende Branchen werden beim Öffnen zur Bearbeitung angezeigt (100% der Fälle)
- Branchen können einzeln entfernt werden (funktionale Validierung)
- Neue Branchen können hinzugefügt werden ohne bestehende zu verlieren
- Junction Table wird korrekt aktualisiert (Datenbank-Validierung)
- Keine Regression bei anderen Multiselect-Feldern

## Open Questions

- Soll die Branchenladung asynchron erfolgen oder beim initialen Laden?
- Wie sollen Konflikte behandelt werden, wenn Branchen in der Zwischenzeit gelöscht wurden?
- Soll eine Bestätigung bei Entfernen von Branchen angezeigt werden?

## Current Technical Analysis

**Problem identifiziert in:**
- `DynamicDataLoader.js:358-391` - Logik zum Laden bestehender Branchen vorhanden aber greift nicht
- `UnternehmenDetail.js:54-72` - Branchen werden geladen aber nicht an FormSystem weitergegeben
- Tag-basiertes System funktioniert, aber bestehende Werte werden nicht initialisiert

**Log-Analyse zeigt:**
- Branchen werden aus Junction Table geladen
- Submit funktioniert und aktualisiert korrekt
- Problem liegt in der initialen Anzeige der bestehenden Tags im Frontend
