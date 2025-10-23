# Fix: Telefonnummer-Länder beim Ansprechpartner-Submit

## Problem
Beim Erstellen von Ansprechpartnern wurden die Land-IDs für Telefonnummern (`telefonnummer_land_id` und `telefonnummer_office_land_id`) nicht gespeichert.

## Ursache
Das FormSystem hatte keine explizite Prüfung für Phone-Land-Felder beim Submit. Die Felder wurden zwar als Searchable Selects behandelt, aber es fehlte eine zusätzliche Sicherheitsebene.

## Lösung

### 1. FormSystem.js erweitert (Zeile 281-301)
Neue explizite Prüfung für Phone-Land-Felder:

```javascript
// FIX: Explizite Prüfung für Phone-Land-Felder (zusätzliche Sicherheit)
const phoneLandFields = form.querySelectorAll('select[data-phone-field="true"]');
if (phoneLandFields.length > 0) {
  console.log(`📱 Prüfe ${phoneLandFields.length} Phone-Land-Felder explizit`);
  phoneLandFields.forEach(select => {
    const fieldName = select.name;
    const fieldValue = select.value;
    
    // Nur setzen wenn noch nicht vorhanden oder leer
    if (fieldValue && fieldValue !== '' && (!submitData[fieldName] || submitData[fieldName] === '')) {
      submitData[fieldName] = fieldValue;
      console.log(`✅ Phone-Land-Field ${fieldName} gesetzt: ${fieldValue}`);
    }
  });
}
```

### 2. Kevin Test manuell korrigieren
SQL-Datei erstellt: `fix_kevin_test_phone.sql`

Ausführen via Supabase Dashboard → SQL Editor

## Testen
1. Neuen Ansprechpartner anlegen
2. Land für Telefon auswählen (z.B. Deutschland)
3. Telefonnummer eingeben (ohne Vorwahl, z.B. "151 234 5678")
4. Speichern
5. Prüfen in Browser Console:
   ```javascript
   // Nach Submit sollte sichtbar sein:
   ✅ Phone-Land-Field telefonnummer_land_id gesetzt: [UUID]
   ✅ Phone-Land-Field telefonnummer_office_land_id gesetzt: [UUID]
   ```

## Betroffene Dateien
- ✅ `src/core/form/FormSystem.js` - Fix hinzugefügt
- ✅ `src/modules/marke/MarkeDetail.js` - PhoneDisplay integriert
- ✅ `src/modules/unternehmen/UnternehmenDetail.js` - PhoneDisplay integriert
- ✅ `fix_kevin_test_phone.sql` - Manuelle Korrektur für bestehenden Eintrag

## Erwartetes Ergebnis
Ab jetzt werden bei neu erstellten Ansprechpartnern:
- ✅ Land-IDs korrekt gespeichert
- ✅ Telefonnummern ohne Vorwahl gespeichert
- ✅ In allen Listen & Detail-Ansichten mit Flaggen + Vorwahl angezeigt
- ✅ Anklickbare tel:-Links mit vollständiger Nummer

