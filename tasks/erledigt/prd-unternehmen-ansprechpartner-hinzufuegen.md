# PRD: Ansprechpartner zu Unternehmen hinzufügen

## Einleitung/Übersicht

Aktuell gibt es keine direkte Möglichkeit, über das Aktionsmenü bei Unternehmen Ansprechpartner hinzuzufügen oder zu entfernen. Diese Funktion soll analog zur bestehenden Marken-Ansprechpartner-Implementierung entwickelt werden, um einen konsistenten Workflow zu gewährleisten.

**Ziel:** Implementierung einer vollständigen Ansprechpartner-Verwaltung für Unternehmen mit identischer UX wie bei Marken.

## Ziele

1. **Konsistente UX:** Identischer Workflow wie bei Marken-Ansprechpartner-Verwaltung
2. **Effiziente Verwaltung:** Direkte Zuordnung/Entfernung von Ansprechpartnern über Aktionsmenü
3. **Verbesserte Darstellung:** Modernisierung der Ansprechpartner-Anzeige in Unternehmen-Details
4. **Many-to-Many Beziehung:** Ein Ansprechpartner kann mehreren Unternehmen zugeordnet werden

## User Stories

### Als Mitarbeiter möchte ich:
- **US1**: Über das Aktionsmenü bei einem Unternehmen bestehende Ansprechpartner hinzufügen können
- **US2**: Ein Auto-Suggest Modal öffnen, das verfügbare Ansprechpartner zur Auswahl anzeigt
- **US3**: Bereits zugeordnete Ansprechpartner aus der Auswahl ausgeschlossen sehen
- **US4**: Ansprechpartner über das Aktionsmenü wieder entfernen können
- **US5**: Ansprechpartner in der Unternehmen-Liste als klickbare Tags sehen (wie bei Marken)
- **US6**: Eine modernisierte Ansprechpartner-Darstellung in der Unternehmen-Detail-Seite haben

## Funktionale Anforderungen

### F1: Datenbank-Struktur
- **F1.1**: Neue Junction Table `ansprechpartner_unternehmen` erstellen
- **F1.2**: Many-to-Many Beziehung zwischen Ansprechpartner und Unternehmen implementieren
- **F1.3**: Felder: `ansprechpartner_id`, `unternehmen_id`, `created_at`

### F2: Aktionsmenü-Erweiterung
- **F2.1**: Neuer Menüpunkt "Ansprechpartner hinzufügen" in UnternehmenList
- **F2.2**: Neuer Menüpunkt "Ansprechpartner entfernen" in UnternehmenList  
- **F2.3**: Icons für beide Aktionen (Person-Plus, Person-Minus)
- **F2.4**: Integration in ActionsDropdown.js

### F3: Modal-Implementierung (Hinzufügen)
- **F3.1**: Modal mit Auto-Suggest für verfügbare Ansprechpartner
- **F3.2**: Suche nach Vorname, Nachname, Email, Unternehmen
- **F3.3**: Bereits zugeordnete Ansprechpartner ausschließen
- **F3.4**: Dropdown-Einträge zeigen: Name, Email, Unternehmen, Position
- **F3.5**: Schließen-Funktionalität (X, Abbrechen, ESC)

### F4: Modal-Implementierung (Entfernen)
- **F4.1**: Modal mit Liste der zugeordneten Ansprechpartner
- **F4.2**: Auswahl zur Entfernung mit Bestätigung
- **F4.3**: Warnung vor Entfernung anzeigen

### F5: Speicher-/Lösch-Logik
- **F5.1**: Zuordnung in Junction Table `ansprechpartner_unternehmen` speichern
- **F5.2**: Entfernung aus Junction Table mit Bestätigung
- **F5.3**: Erfolgs-/Fehler-Benachrichtigungen
- **F5.4**: UI-Updates nach Änderungen (`entityUpdated` Events)

### F6: Anzeige in Unternehmen-Liste
- **F6.1**: Ansprechpartner als klickbare Tags anzeigen (`.tag--ansprechpartner`)
- **F6.2**: Navigation zu Ansprechpartner-Detail bei Tag-Klick
- **F6.3**: Kompakte Tags-Darstellung wie bei Marken

### F7: Unternehmen-Detail-Seite Modernisierung
- **F7.1**: Bestehende Ansprechpartner-Anzeige modernisieren
- **F7.2**: Einheitliches Tabellen-Design implementieren
- **F7.3**: "Ansprechpartner hinzufügen" Button in Detail-Seite
- **F7.4**: Entfernen-Funktionalität in Detail-Seite

## Nicht-Ziele (Out of Scope)

- Erstellung neuer Ansprechpartner über das Modal
- Bearbeitung von Ansprechpartner-Daten
- Bulk-Operationen für Ansprechpartner-Zuordnungen
- Mobile-spezifische Optimierungen

## Design-Überlegungen

- **Konsistenz:** Exakt gleiche Implementierung wie Marken-Ansprechpartner
- **CSS-Wiederverwendung:** Bestehende `.tag--ansprechpartner` Klassen nutzen
- **Modal-Styling:** Bestehende Modal-Komponenten und CSS verwenden
- **Icons:** Gleiche Icon-Sets wie bei anderen Aktionsmenü-Einträgen

## Technische Überlegungen

- **Junction Table:** Neue Migration für `ansprechpartner_unternehmen` erforderlich
- **ActionsDropdown.js:** Neue Methoden `openAddAnsprechpartnerToUnternehmenModal()` und `openRemoveAnsprechpartnerFromUnternehmenModal()`
- **DataService.js:** Erweiterte Entity-Definition für Unternehmen mit Many-to-Many Beziehung
- **UnternehmenList.js:** Erweiterte `renderAnsprechpartner()` Methode
- **UnternehmenDetail.js:** Modernisierte Ansprechpartner-Sektion

## Erfolgs-Metriken

- Konsistente UX zwischen Marken- und Unternehmen-Ansprechpartner-Verwaltung
- Reduzierte Klicks zur Ansprechpartner-Zuordnung (von 3+ auf 2 Klicks)
- Verbesserte Übersichtlichkeit in Unternehmen-Listen und -Details
- Fehlerfreie Zuordnung/Entfernung ohne Duplikate

## Offene Fragen

- Sollen historische Daten migriert werden (bestehende `ansprechpartner.unternehmen_id` → Junction Table)?
- Priorität der Detail-Seiten-Modernisierung vs. Aktionsmenü-Implementierung?
- Benachrichtigungen für andere Benutzer bei Ansprechpartner-Änderungen?
