# Tasks: Ansprechpartner zu Unternehmen hinzufügen

Basierend auf [prd-unternehmen-ansprechpartner-hinzufuegen.md](prd-unternehmen-ansprechpartner-hinzufuegen.md)

## Relevant Files

- `src/core/DataService.js` - Erweiterte Entity-Definition für Unternehmen mit Many-to-Many Beziehung zu Ansprechpartnern
- `src/core/ActionsDropdown.js` - Neue Methoden für Ansprechpartner-Modals bei Unternehmen (hinzufügen/entfernen)
- `src/modules/unternehmen/UnternehmenList.js` - Erweiterte Ansprechpartner-Darstellung mit klickbaren Tags
- `src/modules/unternehmen/UnternehmenDetail.js` - Modernisierte Ansprechpartner-Sektion mit Tabellen-Design
- `create_ansprechpartner_unternehmen_junction.sql` - Neue Junction Table für Many-to-Many Beziehung
- `migrate_existing_ansprechpartner_data.sql` - Migration bestehender Daten zur neuen Junction Table

### Notes

- Die Implementierung orientiert sich strikt an der bestehenden Marken-Ansprechpartner-Funktionalität
- Bestehende CSS-Klassen (`.tag--ansprechpartner`) werden wiederverwendet
- Junction Table ermöglicht Many-to-Many Beziehungen zwischen Ansprechpartnern und Unternehmen

## Tasks

- [x] 1.0 Datenbank-Struktur erweitern
  - [x] 1.1 Junction Table `ansprechpartner_unternehmen` Migration erstellen
  - [x] 1.2 Bestehende Daten von `ansprechpartner.unternehmen_id` zu Junction Table migrieren
  - [x] 1.3 Migration ausführen und testen
- [x] 2.0 ActionsDropdown für Unternehmen erweitern
  - [x] 2.1 `openAddAnsprechpartnerToUnternehmenModal()` Methode implementieren
  - [x] 2.2 `openRemoveAnsprechpartnerFromUnternehmenModal()` Methode implementieren
  - [x] 2.3 Aktionsmenü-Items für Unternehmen erweitern (hinzufügen/entfernen)
  - [x] 2.4 Event-Handler für neue Aktionen implementieren
- [x] 3.0 UnternehmenList Ansprechpartner-Anzeige modernisieren
  - [x] 3.1 `loadAnsprechpartnerMap()` für Junction Table anpassen
  - [x] 3.2 `renderAnsprechpartner()` Methode für Tags-Darstellung implementieren
  - [x] 3.3 Klickbare Tags mit Navigation zu Ansprechpartner-Details
  - [x] 3.4 Ansprechpartner-Spalte in Tabelle integrieren
- [x] 4.0 UnternehmenDetail Ansprechpartner-Sektion überarbeiten
  - [x] 4.1 Ansprechpartner-Daten aus Junction Table laden
  - [x] 4.2 Moderne Tabellen-Darstellung implementieren
  - [x] 4.3 "Ansprechpartner hinzufügen" Button integrieren
  - [x] 4.4 Entfernen-Funktionalität in Detail-Seite
- [x] 5.0 DataService Konfiguration erweitern
  - [x] 5.1 Unternehmen Entity um Many-to-Many Beziehung erweitern
  - [x] 5.2 Ansprechpartner Entity um Unternehmen Many-to-Many erweitern
  - [x] 5.3 Junction Table Queries implementieren
- [x] 6.0 Testing und Integration
  - [ ] 6.1 Funktionalität in UnternehmenList testen
  - [ ] 6.2 Funktionalität in UnternehmenDetail testen
  - [ ] 6.3 Modal-Funktionalitäten testen
  - [ ] 6.4 Datenbank-Integrität prüfen
