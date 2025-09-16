# PRD: Marke-Mitarbeiter-Zuordnung über Aktionsmenü

## Introduction/Overview

Diese Funktion erweitert das bestehende Marken-Verwaltungssystem um die Möglichkeit, Mitarbeiter direkt über das Aktionsmenü einer Marke zuzuordnen. Mitarbeiter, die einer Marke zugeordnet sind, sehen automatisch nur die ihnen zugewiesenen Marken und deren zugehörige Kampagnen und Kooperationen in ihrem Dashboard.

**Problem:** Aktuell gibt es keine benutzerfreundliche Möglichkeit, Mitarbeiter einer Marke zuzuordnen, obwohl die Datenstruktur (`marke_zustaendigkeit`) bereits existiert.

**Ziel:** Vereinfachung der Marken-Mitarbeiter-Zuordnung durch Integration in das bestehende Aktionsmenü-System.

## Goals

1. **Benutzerfreundlichkeit:** Intuitive Zuordnung von Mitarbeitern zu Marken über das Aktionsmenü
2. **Mehrfachzuordnung:** Mehrere Mitarbeiter können einer Marke zugeordnet werden
3. **Dashboard-Integration:** Automatische Filterung basierend auf Zuordnungen
4. **Benachrichtigungen:** Mitarbeiter werden über neue Zuordnungen informiert
5. **Konsistenz:** Verwendung bestehender UI-Patterns und Komponenten

## User Stories

**Als Administrator möchte ich:**
- Über das Aktionsmenü einer Marke einen oder mehrere Mitarbeiter zuordnen können
- Eine Suchfunktion nutzen, um Mitarbeiter schnell zu finden
- Bestehende Zuordnungen sehen und verwalten können

**Als Mitarbeiter möchte ich:**
- Automatisch nur die mir zugeordneten Marken in meinem Dashboard sehen
- Automatisch alle Kampagnen und Kooperationen sehen, die zu meinen zugeordneten Marken gehören
- Eine Benachrichtigung erhalten, wenn mir eine neue Marke zugeordnet wird

## Functional Requirements

1. **Aktionsmenü-Integration**
   - Das Marken-Aktionsmenü erhält einen neuen Eintrag "Mitarbeiter zuordnen"
   - Klick öffnet ein Modal mit Mitarbeiter-Auswahl

2. **Mitarbeiter-Auswahl-Modal**
   - Auto-Suggestion Suchfeld für Mitarbeiter (wie bei Kampagnen)
   - Mehrfachauswahl möglich (Multi-Select mit Tags)
   - Anzeige bereits zugeordneter Mitarbeiter
   - "Speichern" und "Abbrechen" Buttons

3. **Datenbank-Integration**
   - Umbenennung der Tabelle `marke_zustaendigkeit` zu `marke_mitarbeiter`
   - Erweitern um `created_at` und `assigned_by` Felder
   - Unterstützung für mehrere Zuordnungen pro Marke

4. **Dashboard-Filterung**
   - Nicht-Admin Mitarbeiter sehen nur zugeordnete Marken
   - Automatische Filterung von Kampagnen basierend auf Marken-Zuordnung
   - Automatische Filterung von Kooperationen basierend auf Kampagnen-Zuordnung

5. **Benachrichtigungssystem**
   - Push-Benachrichtigung an zugeordnete Mitarbeiter
   - Benachrichtigungstext: "Du wurdest der Marke '[Markenname]' zugeordnet"
   - Integration in bestehendes NotificationSystem

6. **UI-Anzeige**
   - Zugeordnete Mitarbeiter in der Marken-Tabelle anzeigen (Spalte "Zuständigkeit")
   - Tooltip mit allen zugeordneten Mitarbeitern bei Hover

## Non-Goals (Out of Scope)

- Rollen-basierte Zuordnungen (z.B. "Hauptverantwortlicher" vs "Unterstützung")
- Admin-Übersicht für alle Zuordnungen
- Zeitbasierte Zuordnungen (Gültigkeitsdauer)
- Automatische Zuordnung basierend auf Kriterien
- Bulk-Zuordnung mehrerer Marken gleichzeitig

## Design Considerations

- **Modal-Design:** Wiederverwendung des bestehenden Modal-Styles aus `ActionsDropdown.js`
- **Auto-Suggestion:** Verwendung des bestehenden Auto-Suggestion Systems (wie bei Kampagne-Mitarbeiter-Zuordnung)
- **Icons:** Verwendung der bestehenden SVG-Icons für Konsistenz
- **Responsive:** Modal muss auf mobilen Geräten funktionieren

## Technical Considerations

1. **Bestehende Komponenten nutzen:**
   - `ActionsDropdown.js` erweitern
   - `NotificationSystem.js` für Benachrichtigungen
   - Bestehende Auto-Suggestion Logik aus Kampagnen-Zuordnung

2. **Datenbank-Migration:**
   - Tabelle `marke_zustaendigkeit` zu `marke_mitarbeiter` umbenennen
   - Neue Spalten hinzufügen: `created_at`, `assigned_by`

3. **Dashboard-Integration:**
   - `MarkeList.js` Filterlogik erweitern
   - `KampagneList.js` und `BriefingList.js` für kaskadierte Filterung anpassen
   - `DashboardModule.js` für Deadline-Filterung erweitern

4. **Permissions:**
   - Nur Admins und Benutzer mit entsprechenden Rechten können Zuordnungen vornehmen
   - Integration in bestehendes `PermissionSystem.js`

## Success Metrics

1. **Funktionalität:** Mitarbeiter-Zuordnung über Aktionsmenü funktioniert fehlerfrei
2. **Dashboard-Filterung:** Mitarbeiter sehen nur zugeordnete Inhalte
3. **Benachrichtigungen:** Zuordnungsbenachrichtigungen werden korrekt versendet
4. **Performance:** Keine merkbare Verlangsamung bei Dashboard-Laden
5. **UI-Konsistenz:** Neues Modal fügt sich nahtlos in bestehende UI ein

## Open Questions

1. **Migration bestehender Daten:** Wie sollen bestehende Einträge in `marke_zustaendigkeit` behandelt werden?
2. **Zuordnungs-Entfernung:** Soll es eine Möglichkeit geben, Zuordnungen wieder zu entfernen?
3. **Audit-Log:** Sollen Änderungen an Zuordnungen geloggt werden?
4. **Backup-Verhalten:** Was passiert, wenn ein zugeordneter Mitarbeiter gelöscht wird?
