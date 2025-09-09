# PRD: Fix für Marken-Bearbeitung - Unternehmen und Branchen laden

## Introduction/Overview

Beim Bearbeiten von bestehenden Marken werden die bereits zugewiesenen Werte für **Unternehmen** und **Branche** nicht in den Auto-Suggestion Feldern angezeigt. Nutzer können daher nicht sehen, welches Unternehmen und welche Branche aktuell zugewiesen sind, und müssen diese Werte neu eingeben, auch wenn sie unverändert bleiben sollen.

**Ziel:** Bestehende Unternehmen- und Branchen-Zuweisungen beim Bearbeiten von Marken korrekt anzeigen und bearbeitbar machen.

## Goals

1. Bestehendes Unternehmen beim Laden einer Marke zur Bearbeitung im Auto-Suggestion Feld anzeigen
2. Bestehende Branche beim Laden einer Marke zur Bearbeitung im Auto-Suggestion Feld anzeigen  
3. Änderungen korrekt speichern (Single-Select, nicht Many-to-Many)
4. Identisches Verhalten wie beim Erstellen von Marken gewährleisten

## User Stories

**Als CRM-Nutzer möchte ich:**
- Beim Öffnen einer Marke zur Bearbeitung das bereits zugewiesene Unternehmen im Auswahlfeld sehen
- Beim Öffnen einer Marke zur Bearbeitung die bereits zugewiesene Branche im Auswahlfeld sehen
- Die bestehenden Werte ändern können, ohne sie komplett neu eingeben zu müssen
- Die Änderungen beim Formular-Submit korrekt gespeichert bekommen

**Als System möchte ich:**
- Bestehende `unternehmen_id` und `branche_id` aus der Marke-Tabelle laden
- Die geladenen Werte in den Auto-Suggestion Feldern anzeigen
- Beim Submit die Marke-Tabelle korrekt aktualisieren (einfache Foreign Key Updates)

## Functional Requirements

1. **Datenladung beim Edit-Modus:**
   - Das System muss beim Laden einer Marke zur Bearbeitung die `unternehmen_id` und `branche_id` laden
   - Die geladenen IDs müssen im DynamicDataLoader für die entsprechenden Felder als "selected" markiert werden
   - Die Unternehmen- und Branchennamen müssen in den Auto-Suggestion Feldern angezeigt werden

2. **Auto-Suggestion Anzeige:**
   - Bestehendes Unternehmen muss im Suchfeld als vorausgewählter Wert angezeigt werden
   - Bestehende Branche muss im Suchfeld als vorausgewählter Wert angezeigt werden
   - Die Suchfelder müssen weiterhin funktionsfähig bleiben für Änderungen

3. **Datenverarbeitung beim Submit:**
   - Geänderte `unternehmen_id` muss korrekt in der Marke-Tabelle aktualisiert werden
   - Geänderte `branche_id` muss korrekt in der Marke-Tabelle aktualisiert werden
   - Keine Junction Table Updates erforderlich (einfache Foreign Keys)

4. **Fehlerbehandlung:**
   - Bei Fehlern beim Laden der Referenzdaten soll eine Warnung ausgegeben werden
   - Das Formular soll trotzdem funktionsfähig bleiben

## Non-Goals (Out of Scope)

- Änderung der Marke-Tabellen Struktur
- Implementierung von Many-to-Many Beziehungen für Marken
- Änderung des grundlegenden Auto-Suggestion Systems
- Änderung anderer Select-Felder

## Design Considerations

- **UI/UX:** Identisch zum Marke-Erstellen Modul
- **Komponenten:** Wiederverwendung des bestehenden Auto-Suggestion Systems
- **Datenfluss:** Nutzung der bestehenden DynamicDataLoader Logik

## Technical Considerations

- **Abhängigkeiten:** MarkeDetail, DynamicDataLoader, FormSystem, Auto-Suggestion System
- **Datenbank:** Einfache Foreign Key Beziehungen in `marke` Tabelle
- **Integration:** Muss mit bestehendem FormConfig und MarkeDetail System arbeiten
- **Unterschied zu Unternehmen:** Einfache Select-Felder, nicht Tag-basierte Multiselects

## Success Metrics

- Bestehendes Unternehmen wird beim Öffnen zur Bearbeitung angezeigt (100% der Fälle)
- Bestehende Branche wird beim Öffnen zur Bearbeitung angezeigt (100% der Fälle)
- Änderungen werden korrekt in der Datenbank gespeichert
- Keine Regression bei anderen Auto-Suggestion Feldern

## Current Technical Analysis

**Problem identifiziert in:**
- `MarkeDetail.js` - Marken werden geladen aber nicht an FormSystem weitergegeben
- Auto-Suggestion System funktioniert beim Erstellen, aber bestehende Werte werden nicht initialisiert
- Ähnliches Problem wie bei Unternehmen-Branchen, aber für einfache Select-Felder

**Datenbank-Struktur:**
- `marke.unternehmen_id` → `unternehmen.id` (Foreign Key)
- `marke.branche_id` → `branchen.id` (Foreign Key)
- Keine Junction Tables erforderlich

## Implementation Strategy

Basierend auf der erfolgreichen Lösung für Unternehmen-Branchen:
1. MarkeDetail.showEditForm() erweitern für Datenformatierung
2. FormSystem für Edit-Modus mit bestehenden Werten erweitern
3. DynamicDataLoader für einfache Select-Felder im Edit-Modus erweitern
4. Auto-Suggestion Initialisierung mit bestehenden Werten
