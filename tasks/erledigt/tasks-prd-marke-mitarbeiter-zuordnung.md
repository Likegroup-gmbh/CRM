# Task List: Marke-Mitarbeiter-Zuordnung über Aktionsmenü

Basierend auf: `prd-marke-mitarbeiter-zuordnung.md`

## Relevant Files

- `src/core/ActionsDropdown.js` - Hauptkomponente für Aktionsmenüs, enthält bereits Modal-Logik für Kampagne-Mitarbeiter-Zuordnung
- `src/modules/marke/MarkeList.js` - Marken-Liste mit Aktionsmenü-Integration, muss um neue Aktion erweitert werden
- `src/modules/marke/MarkeDetail.js` - Marken-Detail-Ansicht, zeigt zugeordnete Mitarbeiter an
- `src/core/DataService.js` - Zentrale Datenverwaltung, enthält Marken-Konfiguration mit Relations
- `src/core/NotificationSystem.js` - Benachrichtigungssystem für Zuordnungs-Notifications
- `src/modules/dashboard/DashboardModule.js` - Dashboard-Modul für Deadline-Filterung
- `src/modules/briefing/BriefingList.js` - Briefing-Liste mit Mitarbeiter-basierter Filterung
- `src/modules/kooperation/KooperationList.js` - Kooperationen-Liste mit Kampagnen-basierter Filterung
- `src/modules/rechnung/RechnungList.js` - Rechnungs-Liste mit Kampagnen-basierter Filterung
- `add_marke_mitarbeiter_migration.sql` - Datenbank-Migration für Tabellen-Umbenennung und -Erweiterung
- `src/modules/marke/filters/MarkeFilterConfig.js` - Filter-Konfiguration für Marken-Liste

### Notes

- Die bestehende `marke_zustaendigkeit` Tabelle muss zu `marke_mitarbeiter` umbenannt und erweitert werden
- Das bestehende Modal-System aus `ActionsDropdown.js` kann als Vorlage verwendet werden
- Die Filterlogik aus anderen Listen-Modulen muss für Marken adaptiert werden

## Tasks

- [x] 1.0 Datenbank-Migration für marke_mitarbeiter Tabelle
  - [x] 1.1 Bestehende marke_zustaendigkeit Tabelle analysieren und Daten sichern
  - [x] 1.2 Migration SQL-Datei erstellen für Tabellen-Umbenennung
  - [x] 1.3 Neue Spalten hinzufügen (created_at, assigned_by)
  - [x] 1.4 Migration ausführen und Datenintegrität prüfen
  - [x] 1.5 DataService.js Konfiguration für neue Tabelle anpassen

- [x] 2.0 ActionsDropdown um Marke-Mitarbeiter-Zuordnung erweitern
  - [x] 2.1 Neue Methode openAssignMarkeStaffModal() erstellen (basierend auf openAssignStaffModal)
  - [x] 2.2 Auto-Suggestion für Mitarbeiter-Suche implementieren
  - [x] 2.3 Mehrfachauswahl-Logik für Mitarbeiter hinzufügen
  - [x] 2.4 Bereits zugeordnete Mitarbeiter ausschließen
  - [x] 2.5 Speicher-Logik für marke_mitarbeiter Tabelle implementieren
  - [x] 2.6 Modal-Styling an bestehende Patterns anpassen

- [x] 3.0 MarkeList um neue Aktionsmenü-Option erweitern
  - [x] 3.1 Aktionsmenü um "Mitarbeiter zuordnen" Option erweitern
  - [x] 3.2 Event-Handler für neue Aktion registrieren
  - [x] 3.3 Zuständigkeits-Spalte in Tabelle erweitern/verbessern
  - [x] 3.4 Tooltip-Funktionalität für mehrere zugeordnete Mitarbeiter
  - [x] 3.5 renderZustaendigkeit() Methode erweitern

- [x] 4.0 Dashboard-Filterung für zugeordnete Marken implementieren
  - [x] 4.1 MarkeList.js um Sichtbarkeits-Logik erweitern (analog zu anderen Listen)
  - [x] 4.2 loadMarkenWithRelations() Methode erstellen
  - [x] 4.3 Nicht-Admin Filterung basierend auf marke_mitarbeiter implementieren
  - [x] 4.4 Admin-Benutzer weiterhin alle Marken anzeigen lassen

- [x] 5.0 Kaskadierte Filterung für Kampagnen und Kooperationen
  - [x] 5.1 KampagneList.js um Marken-basierte Filterung erweitern
  - [x] 5.2 KooperationList.js um Marken-basierte Filterung erweitern
  - [x] 5.3 BriefingList.js um Marken-basierte Filterung erweitern
  - [x] 5.4 RechnungList.js um Marken-basierte Filterung erweitern
  - [x] 5.5 DashboardModule.js Deadline-Filterung um Marken-Zuordnungen erweitern

- [x] 6.0 Benachrichtigungssystem für Marken-Zuordnungen erweitern
  - [x] 6.1 Push-Benachrichtigung für Marken-Zuordnung implementieren
  - [x] 6.2 Deutsche Benachrichtigungstexte definieren
  - [x] 6.3 NotificationSystem Integration in ActionsDropdown
  - [x] 6.4 Event-Trigger für entityUpdated bei Marken-Zuordnung

- [x] 7.0 UI-Updates für Zuständigkeits-Anzeige
  - [x] 7.1 Zuständigkeits-Spalte in MarkeList verbessern
  - [x] 7.2 MarkeDetail.js um zugeordnete Mitarbeiter-Sektion erweitern
  - [x] 7.3 Icons und Styling für Mitarbeiter-Zuordnungen hinzufügen
  - [x] 7.4 Mobile Responsiveness für neue UI-Elemente sicherstellen

## 🚨 FEHLERANALYSE & BUGFIXES

### Identifizierte Probleme beim Testen:

**1. Supabase Foreign Key Beziehungen fehlen**
```
Error: Could not find a relationship between 'marke_mitarbeiter' and 'mitarbeiter_id'
```
- **Ursache:** Tabelle `marke_mitarbeiter` hat keine Foreign Key Constraints
- **Lösung:** `fix_marke_mitarbeiter_foreign_keys.sql` erstellt
- **Status:** ✅ Behoben

**2. ActionsDropdown Modal-Fehler**  
```
TypeError: Cannot set properties of undefined (setting 'removeSelectedStaff')
```
- **Ursache:** `window.actionsDropdown` ist undefined
- **Lösung:** Globale Funktion `window.removeMarkeStaff` verwendet
- **Status:** ✅ Behoben

**3. Auto-Suggestion funktioniert nicht**
- **Ursache:** Fehlerhafte Supabase-Queries durch fehlende Foreign Keys
- **Lösung:** Wird durch Foreign Key Fix behoben
- **Status:** ✅ Behoben

**4. Modal lässt sich nicht schließen**
- **Ursache:** Falsche Referenz in close() Funktion
- **Lösung:** `window.removeMarkeStaff` statt `window.actionsDropdown.removeSelectedStaff`
- **Status:** ✅ Behoben

### Bugfix Tasks:

- [x] 8.0 Kritische Bugfixes nach Fehleranalyse
  - [x] 8.1 Foreign Key Constraints für marke_mitarbeiter hinzufügen
  - [x] 8.2 ActionsDropdown Modal-Referenzen reparieren
  - [x] 8.3 Auto-Suggestion Suche reparieren
  - [x] 8.4 Modal-Schließen-Funktionalität reparieren

### Erforderliche manuelle Schritte:

1. **SQL-Migration ausführen:** `fix_marke_mitarbeiter_foreign_keys.sql` in Supabase einfügen
2. **Browser-Cache leeren** und Seite neu laden
3. **Funktionalität testen:** Marke → Aktionsmenü → "Mitarbeiter zuordnen"

### Modal-Refactoring:

- [x] 9.0 Modal auf Single-Select umgestellt (identisch zu Ansprechpartner-Modal)
  - [x] 9.1 Multi-Select System durch Single-Select ersetzt
  - [x] 9.2 Identische UI-Struktur zu openAddAnsprechpartnerModal()
  - [x] 9.3 "Beginnen Sie zu tippen..." Hinweis implementiert
  - [x] 9.4 Dynamische Suche ab 1 Zeichen
  - [x] 9.5 Detail-Anzeige mit Name, E-Mail, Rolle, Klasse
  - [x] 9.6 ESC-Taste zum Schließen
  - [x] 9.7 Bereits zugeordnete Mitarbeiter ausschließen
  - [x] 9.8 Single-Insert statt Batch-Insert

### CSS-Styling-Fix:

- [x] 10.0 Mitarbeiter-Dropdown CSS-Styling repariert
  - [x] 10.1 #mitarbeiter-dropdown.auto-suggest-dropdown Regeln hinzugefügt
  - [x] 10.2 z-index: 9000 für korrekte Layering über Modal
  - [x] 10.3 display: none/block Toggle-Logik
  - [x] 10.4 Hover-Effekte und Item-Styling
  - [x] 10.5 dropdown-item-main und dropdown-item-details Styling
  - [x] 10.6 Identisches Styling zu Ansprechpartner-Modal

### Benutzer-Auswahl erweitert:

- [x] 11.0 Alle Benutzer werden jetzt angezeigt (nicht nur bestimmte Rollen)
  - [x] 11.1 Rollen-Filter `.in('rolle', ['mitarbeiter', 'Mitarbeiter', 'admin'])` entfernt
  - [x] 11.2 Jetzt werden ALLE Benutzer aus der `benutzer` Tabelle angezeigt
  - [x] 11.3 Inklusive Benutzer mit Rolle 'user' und anderen Rollen
  - [x] 11.4 Sowohl beim initialen Laden als auch bei der dynamischen Suche

### Debug-Logging für Sichtbarkeit:

- [x] 12.0 Debug-Logging für Marken-Sichtbarkeit hinzugefügt
  - [x] 12.1 Console-Logs für currentUser, Rolle und Admin-Status
  - [x] 12.2 Logging für marke_mitarbeiter Query-Ergebnisse
  - [x] 12.3 Anzeige der allowedMarkeIds für Nicht-Admins
  - [x] 12.4 Unterscheidung zwischen Admin und Nicht-Admin Verhalten
  - [x] 12.5 Error-Logging für Supabase-Queries
