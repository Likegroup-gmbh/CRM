# Frontend-Anpassungen nach Creator-Migration

## 1. Formular-Updates

### Creator-Erstellungsformular anpassen:
- `creator_type` Feld: Dropdown mit Werten aus `creator_type` Tabelle
- `sprache` Feld: Dropdown mit Werten aus `sprachen` Tabelle  
- `branche` Feld: Dropdown mit Werten aus `branchen_creator` Tabelle

### Beispiel für die Dropdown-Optionen:

**Creator Types:**
- Art, Beauty, Business, Celebrity, Comedy, Education, Expert, Fitness, Food, Gaming, Influencer, Lifestyle, Macro Influencer, Micro Influencer, Music, Parenting, Sports, Tech, Travel, UGC Creator

**Sprachen:**
- Arabisch, Chinesisch, Dänisch, Deutsch, Englisch, Finnisch, Französisch, Italienisch, Japanisch, Koreanisch, Niederländisch, Norwegisch, Polnisch, Portugiesisch, Russisch, Schwedisch, Spanisch, Tschechisch, Türkisch, Ungarisch

**Branchen:**
- Art, Automotive, Beauty & Fashion, Business, Comedy, DIY & Craft, Education, Finance, Fitness & Gesundheit, Food & Lifestyle, Gaming, Music, Parenting, Pets, Politics, Real Estate, Science, Sports, Tech, Travel

## 2. API-Anpassungen

### DataService.js Updates:
```javascript
// Neue Methoden für die Dropdown-Daten
async getCreatorTypes() {
    const { data, error } = await this.supabase
        .from('creator_type')
        .select('id, name')
        .order('name');
    return { data, error };
}

async getSprachen() {
    const { data, error } = await this.supabase
        .from('sprachen')
        .select('id, name')
        .order('name');
    return { data, error };
}

async getBranchenCreator() {
    const { data, error } = await this.supabase
        .from('branchen_creator')
        .select('id, name')
        .order('name');
    return { data, error };
}
```

### Creator-Erstellung anpassen:
```javascript
// Alte Struktur:
{
    creator_type: "Influencer",
    sprachen: ["Deutsch", "Englisch"],
    branche: ["Tech", "Business"]
}

// Neue Struktur:
{
    creator_type_id: "uuid-from-creator_type-table",
    sprache_id: "uuid-from-sprachen-table", 
    branche_id: "uuid-from-branchen_creator-table"
}
```

## 3. Anzeige-Updates

### Creator-Liste und Detail-Ansicht:
- Statt direkter Werte: JOIN mit den Referenz-Tabellen
- Anzeige der Namen statt IDs

```javascript
// Query für Creator mit JOINs
const { data, error } = await this.supabase
    .from('creator')
    .select(`
        *,
        creator_type:creator_type_id(name),
        sprache:sprache_id(name),
        branche:branche_id(name)
    `)
    .order('vorname');
```

## 4. Filter-Updates

### Filter-Logik anpassen:
- Filter nach Creator Type: `creator_type_id = ?`
- Filter nach Sprache: `sprache_id = ?`
- Filter nach Branche: `branche_id = ?`

## 5. Migration der bestehenden Daten

Nach der Datenbankmigration müssen die bestehenden Creator-Einträge aktualisiert werden:
- Ben Klock und andere Creator müssen die neuen Foreign Key Felder bekommen
- Die alten Array-Felder können dann entfernt werden

## 6. Testing

1. Creator erstellen mit neuen Feldern testen
2. Creator bearbeiten testen
3. Filter-Funktionalität testen
4. Anzeige in Listen und Details testen 