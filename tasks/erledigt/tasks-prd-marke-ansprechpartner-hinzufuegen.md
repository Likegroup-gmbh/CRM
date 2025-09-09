# Tasks: Ansprechpartner zu Marke hinzufügen

Basierend auf [prd-marke-ansprechpartner-hinzufuegen.md](prd-marke-ansprechpartner-hinzufuegen.md)

## Status
- **Erstellt**: 2024-12-09
- **Status**: Refactored (Ansprechpartner auswählen statt erstellen)
- **Priorität**: Normal

## Parent Tasks

### 1.0 ActionsDropdown erweitern
- [x] 1.1 Neue Methode `openAddAnsprechpartnerModal(markeId)` in ActionsDropdown.js erstellen
- [x] 1.2 Modal-HTML für Ansprechpartner-Formular implementieren  
- [ ] 1.3 Auto-Suggestion/Suche für bestehende Ansprechpartner (optional)
- [x] 1.4 Form-Integration mit bestehenden FormSystem
- [x] 1.5 Speicher-Logik für neuen Ansprechpartner

### 2.0 MarkeList Action-Menü erweitern
- [x] 2.1 Action-Item "Ansprechpartner hinzufügen" zu MarkeList.js hinzufügen
- [x] 2.2 Icon für Ansprechpartner-Aktion definieren (Person-Plus)
- [x] 2.3 Event-Binding für neue Aktion implementieren
- [x] 2.4 Integration mit ActionsDropdown.openAddAnsprechpartnerModal

### 3.0 MarkeDetail Action-Menü erweitern (falls vorhanden)
- [x] 3.1 Prüfen ob MarkeDetail Action-Menü existiert
- [x] 3.2 Action-Item "Ansprechpartner hinzufügen" zu MarkeDetail.js hinzufügen
- [x] 3.3 Event-Binding für neue Aktion implementieren

### 4.0 Formular-Integration
- [x] 4.1 Ansprechpartner FormConfig prüfen und erweitern falls nötig
- [x] 4.2 Marke-Feld als readonly/vorausgefüllt implementieren
- [x] 4.3 Standard-Validierung für Ansprechpartner-Felder
- [x] 4.4 Erfolgs-/Fehler-Behandlung nach dem Speichern

### 5.0 Testing und Polish
- [ ] 5.1 Modal öffnet sich korrekt bei Action-Klick
- [ ] 5.2 Marke ist korrekt vorausgefüllt
- [ ] 5.3 Ansprechpartner wird erfolgreich erstellt
- [ ] 5.4 UI aktualisiert sich nach erfolgreichem Speichern
- [ ] 5.5 Fehlerbehandlung funktioniert korrekt

## Sub-Tasks

### 1.1 openAddAnsprechpartnerModal implementieren
- [x] Modal-HTML mit Ansprechpartner-Formular erstellen
- [x] Marken-Feld vorausfüllen und readonly setzen
- [x] Standard Ansprechpartner-Felder hinzufügen (Vorname, Nachname, Email, Telefon)
- [x] Close-Funktionalität (X-Button, Abbrechen, ESC)
- [x] Speichern-Button mit Validierung

### 1.5 Speicher-Logik implementieren
- [x] Supabase Insert in `ansprechpartner` Tabelle
- [x] Marken-ID korrekt zuweisen
- [x] Validierung vor dem Speichern
- [x] Erfolgsbenachrichtigung anzeigen
- [x] Modal schließen nach erfolgreichem Speichern
- [x] Fehlerbehandlung bei Speicher-Fehlern

### 2.1 MarkeList Action-Menü erweitern
- [x] Action-HTML in updateTable() erweitern
- [x] Icon für Ansprechpartner-Aktion hinzufügen
- [x] CSS-Klassen für neue Aktion
- [x] data-action="add_ansprechpartner" Attribut

### 4.1 FormConfig prüfen
- [x] Ansprechpartner FormConfig in FormConfig.js prüfen
- [x] Marke-Feld zur Konfiguration hinzufügen (readonly)
- [x] Erforderliche Felder definieren
- [x] Validierungsregeln überprüfen

## Abhängigkeiten
- **D1**: Bestehende ActionsDropdown-Funktionalität
- **D2**: FormSystem für Ansprechpartner
- **D3**: Supabase `ansprechpartner` Tabelle
- **D4**: CSS Modal-Klassen
- **D5**: Permissions für `ansprechpartner.can_create`

## Erfolgskriterien
- [x] Action-Menü zeigt "Ansprechpartner hinzufügen"
- [x] Modal öffnet sich mit Formular
- [x] Marke ist vorausgefüllt und readonly
- [x] Ansprechpartner wird erfolgreich erstellt
- [x] Erfolgsbenachrichtigung wird angezeigt
- [x] UI aktualisiert sich nach Speichern

## Notizen
- **REFACTORED**: Von "Ansprechpartner erstellen" zu "Ansprechpartner auswählen"
- Orientierung am bestehenden Creator→Kampagne Workflow
- Auto-Suggestion Modal mit Suche nach bestehenden Ansprechpartnern
- Junction Table `ansprechpartner_marke` für Many-to-Many Beziehung
- Bereits zugeordnete Ansprechpartner werden ausgeschlossen
- Integration in ActionsDropdown.js für Konsistenz
- **OPTIMIERT**: Dropdown zeigt Ergebnisse erst ab 1 Zeichen Eingabe (Performance)
- **ERWEITERT**: MarkeList zeigt Ansprechpartner als klickbare Tags mit Navigation zur Detail-Seite
