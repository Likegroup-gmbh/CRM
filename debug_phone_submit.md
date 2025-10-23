# Debug: Telefonnummer-Felder beim Submit

## Problem
Beim Erstellen von Ansprechpartnern werden die Land-IDs (`telefonnummer_land_id` und `telefonnummer_office_land_id`) nicht gespeichert.

## Analyse

### 1. Formular-Struktur (PhoneNumberField.js)
Das PhoneNumberField rendert **zwei separate Felder**:
```javascript
<select name="telefonnummer_land_id" data-searchable="true" data-phone-field="true">
<input type="tel" name="telefonnummer">
```

### 2. Daten-Laden (DynamicDataLoader.js)
✅ Die Länder werden korrekt geladen via `loadPhoneFieldCountries()`
✅ Optionen werden ins Select eingefügt
✅ Searchable Select wird initialisiert

### 3. Submit-Verarbeitung (FormSystem.js)
Das FormSystem sammelt Daten in dieser Reihenfolge:
1. **Tag-basierte Multi-Selects** (Zeile 189-234)
2. **Standard FormData** (Zeile 238-260)
3. **Searchable Selects** explizit (Zeile 263-279)

**PROBLEM**: Bei Searchable Selects wird das **versteckte** Original-Select gelesen, aber dessen `value` wird nur gesetzt, wenn ein Item aus dem Dropdown ausgewählt wird.

## Hypothese
Wenn der User:
1. Das Land-Dropdown öffnet ✅
2. Ein Land sucht ✅
3. Aber **NICHT klickt** sondern einfach die Nummer eingibt ❌

Dann bleibt der `value` des Select-Elements **leer**!

## Lösung
Das FormSystem muss beim Submit **beide Felder** explizit prüfen:
- `telefonnummer_land_id` → UUID des Landes
- `telefonnummer` → Nummer

Und sicherstellen, dass Searchable Selects ihr Value korrekt setzen.

## Test-Szenario
Erstelle einen Ansprechpartner und prüfe in der Browser-Console:
```javascript
// Vor Submit:
const form = document.getElementById('ansprechpartner-form');
const landSelect = form.querySelector('[name="telefonnummer_land_id"]');
console.log('Land-Select Value:', landSelect?.value);
console.log('Land-Select Selected:', landSelect?.selectedOptions[0]?.text);

// FormData auslesen:
const fd = new FormData(form);
for (let [key, value] of fd.entries()) {
  console.log(key + ':', value);
}
```

## Fix-Vorschlag
In FormSystem.js nach Zeile 279 hinzufügen:
```javascript
// Explizit Telefon-Land-Felder prüfen
const phoneLandFields = form.querySelectorAll('select[data-phone-field="true"]');
phoneLandFields.forEach(select => {
  if (select.value && select.value !== '') {
    submitData[select.name] = select.value;
    console.log(`✅ Phone-Land-Field ${select.name}: ${select.value}`);
  }
});
```

