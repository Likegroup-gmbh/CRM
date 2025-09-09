# PRD: Ansprechpartner zu Kampagne hinzufügen

## Einführung/Überblick

Dieses Feature ermöglicht es Benutzern, bestehende Ansprechpartner direkt zu einer Kampagne hinzuzufügen, ähnlich dem bereits implementierten Workflow für Marken→Ansprechpartner. Die Funktionalität nutzt die bestehende Junction Table `ansprechpartner_kampagne` und orientiert sich am bewährten Creator→Kampagne Workflow.

**Problem:** Aktuell können Ansprechpartner nicht direkt zu Kampagnen zugeordnet werden, was die Verwaltung von Kampagnen-Stakeholdern erschwert.

**Ziel:** Eine intuitive, konsistente Möglichkeit schaffen, um bestehende Ansprechpartner zu Kampagnen hinzuzufügen und diese übersichtlich anzuzeigen.

## Goals

1. **Konsistenter Workflow:** Orientierung am bereits implementierten Marke→Ansprechpartner Workflow
2. **Performance-optimiert:** Auto-Suggestion mit intelligenter Dropdown-Anzeige (erst ab Texteingabe)
3. **Intuitive Bedienung:** Integration in bestehende Action-Menüs für nahtlose UX
4. **Übersichtliche Anzeige:** Ansprechpartner als klickbare Tags auf Listen- und Detailseiten
5. **Datenintegrität:** Nutzung der bestehenden Junction Table `ansprechpartner_kampagne`

## User Stories

**Als Projektmanager** möchte ich bestehende Ansprechpartner zu einer Kampagne hinzufügen können, damit ich alle relevanten Stakeholder einer Kampagne übersichtlich verwalten kann.

**Als Benutzer** möchte ich beim Hinzufügen von Ansprechpartnern zu einer Kampagne eine Auto-Suggestion verwenden können, damit ich schnell den richtigen Ansprechpartner finden kann ohne durch lange Listen scrollen zu müssen.

**Als Benutzer** möchte ich die zugeordneten Ansprechpartner sowohl auf der Kampagnen-Liste als auch auf der Detail-Seite sehen können, damit ich auf einen Blick erkenne, wer zu welcher Kampagne gehört.

**Als Benutzer** möchte ich durch Klick auf einen Ansprechpartner-Tag direkt zur Detail-Seite des Ansprechpartners gelangen können, damit ich schnell auf die Kontaktdaten zugreifen kann.

## Funktionale Anforderungen

### 1. Action-Menü Integration
1.1. Das Action-Menü auf der Kampagnen-Liste und -Detail-Seite muss einen neuen Eintrag "Ansprechpartner hinzufügen" enthalten
1.2. Der Action-Menü-Eintrag muss nur verfügbare (noch nicht zugeordnete) Ansprechpartner berücksichtigen

### 2. Auto-Suggestion Modal
2.1. Beim Klick auf "Ansprechpartner hinzufügen" muss sich ein Modal mit Auto-Suggestion Eingabefeld öffnen
2.2. Das Modal muss initial einen Hinweis "Beginnen Sie zu tippen, um Ansprechpartner zu suchen..." anzeigen
2.3. Die Dropdown-Liste muss erst ab 1 Zeichen Eingabe erscheinen (Performance-Optimierung)
2.4. Die Suche muss nach Vorname, Nachname, E-Mail und Firmenname (Unternehmen) filtern
2.5. Jeder Dropdown-Eintrag muss Name, E-Mail, Unternehmen und Position anzeigen
2.6. Bereits zugeordnete Ansprechpartner müssen aus der Auswahl ausgeschlossen werden

### 3. Datenbank-Integration
3.1. Das System muss die bestehende Junction Table `ansprechpartner_kampagne` nutzen
3.2. Beim Hinzufügen muss ein neuer Eintrag in `ansprechpartner_kampagne` erstellt werden
3.3. Das System muss bereits bestehende Zuordnungen berücksichtigen (keine Duplikate)

### 4. UI-Updates
4.1. Nach erfolgreichem Hinzufügen muss ein `entityUpdated` Event ausgelöst werden
4.2. Die Kampagnen-Detail-Seite muss automatisch aktualisiert werden
4.3. Eine Bestätigung "Ansprechpartner wurde erfolgreich zur Kampagne hinzugefügt!" muss angezeigt werden

### 5. Anzeige auf Kampagnen-Seiten
5.1. Die Kampagnen-Liste muss eine neue Spalte "Ansprechpartner" enthalten
5.2. Die Ansprechpartner müssen als klickbare Tags angezeigt werden (ähnlich Branchen-Tags)
5.3. Die Tags müssen die CSS-Klasse `.tag--ansprechpartner` verwenden
5.4. Beim Klick auf einen Tag muss zur Ansprechpartner-Detail-Seite navigiert werden
5.5. Die Kampagnen-Detail-Seite muss die zugeordneten Ansprechpartner ebenfalls als Tags anzeigen

### 6. DataService-Integration
6.1. Die `kampagne` Entity-Konfiguration in `DataService.js` muss um `ansprechpartner` Many-to-Many Beziehung erweitert werden
6.2. Die `loadEntities` Methode muss automatisch die Ansprechpartner über die Junction Table laden
6.3. Die Ansprechpartner-Daten müssen `id`, `vorname`, `nachname`, `email` enthalten

## Non-Goals (Out of Scope)

- **Neue Ansprechpartner erstellen:** Es können nur bestehende Ansprechpartner hinzugefügt werden
- **Ansprechpartner bearbeiten:** Änderungen an Ansprechpartner-Daten erfolgen über die Ansprechpartner-Detail-Seite
- **Ansprechpartner entfernen:** Das Entfernen von Ansprechpartnern aus Kampagnen ist nicht Teil dieses Features
- **Bulk-Operationen:** Mehrere Ansprechpartner gleichzeitig hinzufügen
- **Benachrichtigungen:** Keine E-Mail-Benachrichtigungen an hinzugefügte Ansprechpartner

## Design-Überlegungen

### UI/UX-Konsistenz
- **Modal-Design:** Nutzt bestehende Modal-Styles und -Struktur
- **Auto-Suggestion:** Orientiert sich am Creator→Kampagne Workflow
- **Tag-System:** Verwendet bestehende Tag-Styles mit angepasster Farbgebung
- **Action-Menü:** Konsistente Integration in bestehende Dropdown-Struktur

### CSS-Klassen
- `.tag--ansprechpartner`: Spezielle Farbgebung für Ansprechpartner-Tags (blau)
- `.auto-suggest-dropdown`: Bestehende Dropdown-Styles
- `.modal`: Bestehende Modal-Styles

## Technische Überlegungen

### Bestehende Infrastruktur nutzen
- **Junction Table:** `ansprechpartner_kampagne` ist bereits vorhanden
- **DataService:** Erweitert bestehende Many-to-Many Logik
- **ActionsDropdown:** Nutzt bestehende Modal-Infrastruktur
- **FormSystem:** Auto-Suggestion nutzt bewährte Patterns

### Performance
- **Lazy Loading:** Dropdown-Inhalte erst bei Bedarf laden
- **Debounced Search:** 200ms Verzögerung bei Sucheingabe
- **Excluded IDs:** Bereits zugeordnete Ansprechpartner werden per SQL ausgeschlossen

### Datenintegrität
- **Foreign Key Constraints:** Bestehende Constraints in `ansprechpartner_kampagne` nutzen
- **Duplicate Prevention:** Unique Constraint auf `(ansprechpartner_id, kampagne_id)`

## Success Metrics

1. **Funktionale Vollständigkeit:** Alle User Stories sind implementiert und getestet
2. **Performance:** Dropdown erscheint in <200ms nach Texteingabe
3. **UI-Konsistenz:** Design entspricht bestehenden Marke→Ansprechpartner Patterns
4. **Datenintegrität:** Keine Duplikate oder fehlerhafte Zuordnungen in Junction Table
5. **Benutzerfreundlichkeit:** Modal kann intuitiv bedient werden ohne Anleitung

## Implementation Strategy

### Phase 1: DataService erweitern
- `kampagne` Entity um `ansprechpartner` Many-to-Many Konfiguration erweitern
- Testen der automatischen Junction Table Loading-Logik

### Phase 2: ActionsDropdown erweitern
- `openAddAnsprechpartnerToKampagneModal()` Methode implementieren
- Auto-Suggestion mit Performance-Optimierungen
- Junction Table Insert-Logik

### Phase 3: UI-Integration
- KampagneList um Ansprechpartner-Spalte erweitern
- KampagneDetail um Ansprechpartner-Anzeige erweitern
- CSS-Styles für `.tag--ansprechpartner` hinzufügen

### Phase 4: Testing & Polishing
- End-to-End Testing des kompletten Workflows
- Edge Cases (keine verfügbaren Ansprechpartner, bereits alle zugeordnet)
- UI/UX-Feinschliff

## Open Questions

1. **Sortierung:** In welcher Reihenfolge sollen die Ansprechpartner in der Auto-Suggestion angezeigt werden? (Alphabetisch nach Nachname?)
2. **Limit:** Soll es ein Maximum für die Anzahl zugeordneter Ansprechpartner pro Kampagne geben?
3. **Berechtigung:** Sollen alle Benutzer Ansprechpartner zu Kampagnen hinzufügen können oder nur bestimmte Rollen?

---

**Erstellt:** $(date)
**Version:** 1.0
**Status:** Bereit für Implementierung
