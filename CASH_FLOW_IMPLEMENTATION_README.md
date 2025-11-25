# Cash Flow Feature - Implementierungs-Anleitung

## ✅ Implementierung abgeschlossen

Alle Komponenten für das Cash Flow Feature wurden erfolgreich implementiert!

## 📋 Was wurde erstellt?

### 1. Datenbank-Migration
- **Datei:** `add_auftrag_cashflow_date_fields.sql`
- **Neue Felder:**
  - `rechnung_gestellt_am` (timestamptz)
  - `ueberwiesen_am` (timestamptz)
- **Indices für Performance**

### 2. View-Toggle in AuftragList
- **Datei:** `src/modules/auftrag/AuftragList.js`
- Neuer Property `currentView` ('list' | 'calendar')
- Toggle-Buttons (Liste / Kalender)
- Bedingte Filterbar-Anzeige

### 3. Cash Flow Kalender-Komponente
- **Datei:** `src/modules/auftrag/AuftragCashFlowCalendar.js`
- Monatliche Übersicht (Jan-Dez)
- Gruppierung nach Unternehmen > Marke
- Jahr-Navigation (vor/zurück)
- Automatische Summierung

### 4. Styling
- **Datei:** `assets/styles/components.css`
- Farbcodierung:
  - 🟢 Grün: Überwiesen (paid)
  - 🟡 Gelb/Orange: Rechnung gestellt (invoiced)
- Responsive Design
- Sticky Columns für Unternehmen/Marke

### 5. Formular-Erweiterung
- **Datei:** `src/core/form/FormConfig.js`
- Neue Datums-Felder im Auftrag-Formular
- **Datei:** `src/core/DataService.js`
- Field-Definitionen erweitert

## 🚀 Nächste Schritte

### ⚠️ WICHTIG: Datenbank-Migration ausführen

Die SQL-Migration **MUSS** manuell in Supabase ausgeführt werden:

1. Öffne Supabase Dashboard
2. Gehe zu SQL Editor
3. Öffne die Datei `add_auftrag_cashflow_date_fields.sql`
4. Führe das SQL-Script aus
5. Überprüfe, dass die neuen Spalten erstellt wurden

### Test-Schritte nach Migration

1. **Aufträge-Seite aufrufen:** `/auftrag`
2. **View-Toggle testen:**
   - Wechsel zwischen "Liste" und "Kalender"
   - Filter sollten nur in Listen-Ansicht sichtbar sein
3. **Kalender-Ansicht prüfen:**
   - Jahr-Navigation (vor/zurück)
   - Monatliche Übersicht
   - Gruppierung nach Unternehmen/Marke
4. **Formular testen:**
   - Neuen Auftrag anlegen
   - Felder "Rechnung gestellt am" und "Überwiesen am" ausfüllen
   - Auftrag speichern
5. **Kalender-Darstellung prüfen:**
   - Gespeicherte Aufträge sollten im richtigen Monat erscheinen
   - Farbcodierung: Gelb (Rechnung) vs. Grün (Überwiesen)
   - Summierung pro Monat und Jahr

## 📊 Daten-Logik

### Monatszuordnung
- Ein Auftrag wird dem Monat zugeordnet basierend auf:
  - **Priorität 1:** `ueberwiesen_am` (wenn vorhanden) → Grün
  - **Priorität 2:** `rechnung_gestellt_am` (falls nicht überwiesen) → Gelb

### Summierung
- Pro Marke pro Monat: Summe aller `nettobetrag`
- Pro Monat gesamt: Summe über alle Marken/Unternehmen
- Jahres-Total: Summe aller Monate

### Gruppierung
- Erst nach Unternehmen
- Dann nach Marke
- Aufträge werden summiert (nicht einzeln angezeigt)

## 🎨 Styling-Details

### Farben
```css
/* Rechnung gestellt (Gelb/Orange) */
.cash-flow-cell.invoiced {
  background-color: #fef3c7;
  color: #92400e;
}

/* Überwiesen (Grün) */
.cash-flow-cell.paid {
  background-color:rgb(234, 255, 244);
  color:rgb(0, 0, 0);
}
```

### Interaktivität
- Hover-Effekt auf Zellen
- Klick auf Zelle: Zeigt Auftrags-Details (aktuell: Alert, kann zu Modal erweitert werden)
- Tooltip mit Auftragsnamen und Beträgen

## 🔧 Technische Details

### Datenabfrage
```javascript
// Lädt alle Aufträge für ein Jahr
.or(`rechnung_gestellt_am.gte.${yearStart},ueberwiesen_am.gte.${yearStart}`)
.or(`rechnung_gestellt_am.lte.${yearEnd},ueberwiesen_am.lte.${yearEnd}`)
```

### Gruppierungs-Algorithmus
1. Map mit Key: `${unternehmen_id}-${marke_id}`
2. Aufträge zu Monaten zuordnen
3. Pro Monat: Summe berechnen + Status (paid/invoiced)
4. Sortierung nach Unternehmen > Marke

## 📝 Bekannte Einschränkungen

1. **Detail-Modal:** Aktuell einfaches Alert - kann zu schönem Modal erweitert werden
2. **Export-Funktion:** Noch nicht implementiert (geplant für später)
3. **Mobile-Optimierung:** Grundlegend responsive, könnte aber noch optimiert werden
4. **Filter in Kalenderansicht:** Aktuell keine Filter - können bei Bedarf hinzugefügt werden

## 🐛 Fehlersuche

### Kalender zeigt keine Daten
- Prüfe ob Migration ausgeführt wurde
- Prüfe ob Aufträge `rechnung_gestellt_am` oder `ueberwiesen_am` gesetzt haben
- Prüfe Console für Fehler

### Sticky Columns funktionieren nicht
- Prüfe Browser-Kompatibilität (position: sticky)
- Prüfe CSS-Import

### View-Toggle funktioniert nicht
- Prüfe ob Import von `AuftragCashFlowCalendar.js` funktioniert
- Prüfe Console für Fehler

## ✨ Zukünftige Erweiterungen

- Custom Modal für Zellen-Details (statt Alert)
- Export-Funktion (CSV/Excel)
- Erweiterte Filtermöglichkeiten in Kalenderansicht
- Drag & Drop für Datumsänderungen
- Erweiterte Statistiken und Charts


