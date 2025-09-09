# PRD: Ansprechpartner zu Marke hinzufügen

## Problem
Aktuell gibt es keine direkte Möglichkeit, über das Action-Menü bei Marken einen neuen Ansprechpartner hinzuzufügen. Dies erschwert den Workflow, da Nutzer erst zur Ansprechpartner-Seite navigieren und dort manuell die Marke auswählen müssen.

## Ziel
Implementierung einer "Ansprechpartner hinzufügen" Funktion im Action-Menü der Marken-Liste und Marken-Detail-Seite, analog zur bestehenden "Zu Kampagne hinzufügen" Funktion bei Creators.

## User Stories

### Als Mitarbeiter möchte ich:
- **US1**: Über das Action-Menü bei einer Marke direkt einen neuen Ansprechpartner erstellen können
- **US2**: Ein Modal öffnen, das ein Ansprechpartner-Erstellungsformular enthält
- **US3**: Die Marke automatisch im Formular vorausgefüllt haben
- **US4**: Nach dem Speichern eine Bestätigung erhalten und zur ursprünglichen Seite zurückkehren

## Funktionale Anforderungen

### F1: Action-Menü Erweiterung
- **F1.1**: Neuer Menüpunkt "Ansprechpartner hinzufügen" in MarkeList Action-Dropdown
- **F1.2**: Neuer Menüpunkt "Ansprechpartner hinzufügen" in MarkeDetail Action-Dropdown
- **F1.3**: Icon für die neue Aktion (Person-Plus oder ähnlich)

### F2: Modal-Implementierung
- **F2.1**: Modal mit Ansprechpartner-Erstellungsformular öffnen
- **F2.2**: Marken-Feld vorausgefüllt und readonly
- **F2.3**: Standard Ansprechpartner-Felder (Vorname, Nachname, Email, Telefon, etc.)
- **F2.4**: Validierung der Eingaben vor dem Speichern
- **F2.5**: Schließen-Funktionalität (X-Button, Abbrechen-Button, ESC-Taste)

### F3: Speicher-Logik
- **F3.1**: Ansprechpartner in Supabase erstellen mit Marken-Referenz
- **F3.2**: Erfolgs-/Fehler-Benachrichtigung anzeigen
- **F3.3**: Bei Erfolg: Modal schließen und Daten aktualisieren
- **F3.4**: Bei Fehler: Fehlermeldung anzeigen, Modal offen lassen

### F4: Integration
- **F4.1**: Verwendung des bestehenden FormSystem für Konsistenz
- **F4.2**: Integration in ActionsDropdown.js
- **F4.3**: Verwendung bestehender CSS-Klassen für Modal-Styling

## Nicht-Ziele
- **N1**: Bearbeitung bestehender Ansprechpartner (separate Funktion)
- **N2**: Bulk-Erstellung von Ansprechpartnern
- **N3**: Import/Export Funktionen
- **N4**: Erweiterte Ansprechpartner-Felder (nur Standard-Felder)

## Design/Technische Überlegungen

### Ähnlichkeit zu Creator→Kampagne Workflow:
1. **Action-Menü**: Gleiche Struktur wie "Zu Kampagne hinzufügen"
2. **Modal**: Ähnliches Design wie `openAddToCampaignModal`
3. **Form**: Nutzung des FormSystem wie bei anderen Create-Formularen
4. **Validierung**: Standard-Validierungslogik
5. **Speichern**: Direkte Supabase-Integration

### Datenbankstruktur:
- Tabelle: `ansprechpartner`
- Referenz: `marke_id` (Foreign Key zu `marke.id`)
- Felder: Standard Ansprechpartner-Felder aus FormConfig

### Code-Struktur:
- **ActionsDropdown.js**: Neue Methode `openAddAnsprechpartnerModal(markeId)`
- **MarkeList.js**: Action-Menü erweitern
- **MarkeDetail.js**: Action-Menü erweitern (falls vorhanden)
- **CSS**: Nutzung bestehender Modal- und Form-Styles

## Erfolgsmetriken
- **M1**: Modal öffnet sich korrekt bei Klick auf Action-Item
- **M2**: Marke ist korrekt vorausgefüllt und readonly
- **M3**: Ansprechpartner wird erfolgreich erstellt und gespeichert
- **M4**: Erfolgsbenachrichtigung wird angezeigt
- **M5**: Marken-Liste/Detail-Seite zeigt neuen Ansprechpartner an

## Implementierungsstrategie
1. **Phase 1**: ActionsDropdown erweitern um `openAddAnsprechpartnerModal`
2. **Phase 2**: MarkeList Action-Menü erweitern
3. **Phase 3**: Modal-HTML und Formular-Integration
4. **Phase 4**: Speicher-Logik und Validierung
5. **Phase 5**: Testing und UI-Polish

## Abhängigkeiten
- **D1**: Bestehende FormSystem-Konfiguration für Ansprechpartner
- **D2**: ActionsDropdown-System
- **D3**: Modal-CSS-Klassen
- **D4**: Supabase-Tabelle `ansprechpartner`
- **D5**: Permissions-System (can_create ansprechpartner)

## Risiken
- **R1**: FormSystem-Integration könnte komplex werden
- **R2**: Modal-Styling könnte nicht konsistent sein
- **R3**: Permissions-Probleme bei der Erstellung

## Akzeptanzkriterien
- [ ] Action-Menü zeigt "Ansprechpartner hinzufügen" Option
- [ ] Modal öffnet sich mit korrektem Formular
- [ ] Marke ist vorausgefüllt und nicht editierbar
- [ ] Alle Standard-Ansprechpartner-Felder sind verfügbar
- [ ] Validierung funktioniert korrekt
- [ ] Speichern erstellt Ansprechpartner in Datenbank
- [ ] Erfolgsbenachrichtigung wird angezeigt
- [ ] Modal schließt sich nach erfolgreichem Speichern
- [ ] Marken-Liste zeigt neuen Ansprechpartner an
