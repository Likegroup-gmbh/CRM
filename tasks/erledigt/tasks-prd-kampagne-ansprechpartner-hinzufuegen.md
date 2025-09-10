# Task List: Ansprechpartner zu Kampagne hinzufügen

## Relevant Files

- `src/core/DataService.js` - Entity-Konfiguration für `kampagne` um `ansprechpartner` Many-to-Many erweitern
- `src/core/ActionsDropdown.js` - Neue Methode `openAddAnsprechpartnerToKampagneModal()` implementieren  
- `src/modules/kampagne/KampagneList.js` - Ansprechpartner-Spalte und Tag-Rendering hinzufügen
- `src/modules/kampagne/KampagneDetail.js` - Ansprechpartner-Anzeige und Event-Handler hinzufügen
- `assets/styles/dashboard.css` - CSS-Styles für Kampagne-Ansprechpartner (falls spezielle Styles nötig)

### Notes

- Die bestehende Junction Table `ansprechpartner_kampagne` ist bereits in der Datenbank vorhanden
- Das Feature orientiert sich am bereits implementierten Marke→Ansprechpartner Workflow
- Auto-Suggestion und Modal-Logik können von der Marke-Implementierung adaptiert werden
- Performance-Optimierung (Dropdown erst ab 1 Zeichen) soll übernommen werden

## Tasks

- [x] 1.0 DataService für Kampagne→Ansprechpartner erweitern
  - [x] 1.1 `kampagne` Entity-Konfiguration in DataService.js um `manyToMany.ansprechpartner` erweitern
  - [x] 1.2 Junction Table Konfiguration für `ansprechpartner_kampagne` definieren
  - [x] 1.3 DisplayField für Ansprechpartner festlegen (`id,vorname,nachname,email`)
  - [x] 1.4 Testen der automatischen Many-to-Many Beziehungs-Ladung

- [x] 2.0 ActionsDropdown um Kampagne→Ansprechpartner Modal erweitern
  - [x] 2.1 `handleAction` Methode um `case 'add_ansprechpartner_kampagne'` erweitern
  - [x] 2.2 `openAddAnsprechpartnerToKampagneModal(kampagneId)` Methode implementieren
  - [x] 2.3 Auto-Suggestion Modal mit Performance-Optimierung (Dropdown erst ab 1 Zeichen)
  - [x] 2.4 Suche nach Vorname, Nachname, E-Mail und Unternehmen implementieren
  - [x] 2.5 Bereits zugeordnete Ansprechpartner aus Auswahl ausschließen
  - [x] 2.6 Junction Table Insert-Logik für `ansprechpartner_kampagne` implementieren
  - [x] 2.7 `entityUpdated` Event nach erfolgreichem Hinzufügen auslösen

- [x] 3.0 KampagneList um Ansprechpartner-Anzeige erweitern
  - [x] 3.1 `updateTable` Methode um Ansprechpartner-Spalte erweitern
  - [x] 3.2 `renderAnsprechpartner(ansprechpartner)` Methode implementieren
  - [x] 3.3 Klickbare Tags mit Navigation zu Ansprechpartner-Detail-Seite
  - [x] 3.4 Action-Menü um "Ansprechpartner hinzufügen" Eintrag erweitern
  - [x] 3.5 CSS-Klassen für Tags (`tag--ansprechpartner`) verwenden

- [x] 4.0 KampagneDetail um Ansprechpartner-Anzeige erweitern
  - [x] 4.1 `loadKampagneData` um Ansprechpartner-Loading aus Junction Table erweitern
  - [x] 4.2 `renderAnsprechpartner` Methode für Detail-Ansicht implementieren
  - [x] 4.3 "Ansprechpartner hinzufügen" Button in Ansprechpartner-Sektion hinzufügen
  - [x] 4.4 Event-Handler für `btn-add-ansprechpartner-kampagne` implementieren
  - [x] 4.5 `entityUpdated` Event-Listener für automatische Aktualisierung hinzufügen
  - [x] 4.6 Ansprechpartner als klickbare Tags mit Position und Unternehmen anzeigen

- [x] 5.0 CSS-Styles und finale Integration
  - [x] 5.1 `.tag--ansprechpartner` CSS-Styles für Kampagne-Kontext prüfen/anpassen
  - [x] 5.2 Modal-Dropdown Styles für Kampagne-Ansprechpartner-Modal testen
  - [x] 5.3 End-to-End Testing des kompletten Workflows
  - [x] 5.4 Edge Cases testen (keine verfügbaren Ansprechpartner, alle bereits zugeordnet)
  - [x] 5.5 Performance-Test mit vielen Ansprechpartnern
  - [x] 5.6 UI/UX-Konsistenz mit Marke→Ansprechpartner Workflow sicherstellen

## Status: 🔄 BUGFIXES ERFORDERLICH

### Implementierte Features:
- **DataService**: Many-to-Many Konfiguration für `kampagne.ansprechpartner`
- **ActionsDropdown**: Performance-optimiertes Modal mit Auto-Suggestion
- **KampagneList**: Ansprechpartner-Spalte mit klickbaren Tags
- **KampagneDetail**: Ansprechpartner-Sektion mit "Hinzufügen"-Button
- **CSS**: Styles für `#ansprechpartner-kampagne-dropdown` und bestehende Tags
- **Junction Table**: `ansprechpartner_kampagne` wird korrekt befüllt
- **Navigation**: Klickbare Tags führen zu Ansprechpartner-Detail-Seite
- **Auto-Update**: UI reagiert automatisch auf `entityUpdated` Events

## 🐛 BUGFIXES - User Feedback

- [x] 6.0 UI/UX Bugfixes nach User Testing
  - [x] 6.1 Action-Menü Position korrigieren - Button ist verschoben
  - [x] 6.2 Icon für "Ansprechpartner hinzufügen" korrigieren - sollte identisch zu anderen Icons sein  
  - [x] 6.3 Dropdown-Anzeige Problem beheben - Ansprechpartner wird gefunden aber nicht korrekt angezeigt
  - [x] 6.4 Marke→Ansprechpartner Dropdown-Lösung analysieren und auf Kampagne übertragen
  - [x] 6.5 Ansprechpartner-Auswahl im Modal korrekt implementieren

## Status: ✅ ALLE BUGFIXES ABGESCHLOSSEN

### Behobene Probleme:
- **Tabellen-Header**: "Ansprechpartner"-Spalte hinzugefügt, Action-Menü Position korrigiert
- **Icon-Konsistenz**: Ansprechpartner-Icon auf Outline-Style (stroke) umgestellt wie andere Icons
- **Dropdown-Anzeige**: Vollständige CSS-Styles für `#ansprechpartner-kampagne-dropdown` hinzugefügt
- **Dropdown-Positionierung**: Von `position: absolute` auf `position: relative` + `margin-top: 0.5rem` umgestellt (identisch zu Marke-Modal)
- **Dropdown-Items**: Styling für `.dropdown-item`, `.dropdown-item-main`, `.dropdown-item-details`
- **Border & Spacing**: Konsistente Border-Farbe (#e5e7eb) und Abstände wie bei Marke-Modal
- **KampagneList Ansprechpartner-Anzeige**: Many-to-Many Beziehungen werden korrekt über DataService geladen und als klickbare Tags angezeigt
- **Live-Updates implementiert**: Sowohl KampagneList als auch MarkeList aktualisieren sich automatisch nach Hinzufügung von Ansprechpartnern
- **Dual Event System**: ActionsDropdown dispatched sowohl `entity: 'ansprechpartner'` (für Detail-Seiten) als auch `entity: 'kampagne/marke'` (für Listen) Events
- **Automatische UI-Aktualisierung**: Keine manuelle Seitenaktualisierung mehr nötig - Ansprechpartner werden sofort angezeigt
