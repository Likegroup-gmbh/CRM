# Strategie-Tool - Implementation Completed

## Übersicht

Das Strategie-Tool ermöglicht es Mitarbeitern, Content-Strategielisten mit Video-Inspirationen zu erstellen. Screenshots werden automatisch von YouTube, TikTok und Instagram generiert. Kunden können diese Strategien einsehen, Videos auswählen und Anmerkungen hinterlassen.

---

## Implementierte Features

### ✅ Backend (Datenbank)

**Tabellen:**
- `strategie` - Haupttabelle für Strategielisten
  - Verknüpfungen: Unternehmen, Marke, Kampagne, Auftrag
  - Row Level Security (RLS) für Mitarbeiter & Kunden
  
- `strategie_items` - Items innerhalb einer Strategie
  - Video-Link, Screenshot-URL, Plattform
  - Beschreibung, Kunden-Anmerkungen, Auswahl-Checkbox
  - Creator-Verknüpfung, Drag & Drop Sortierung

**Storage:**
- Bucket: `strategie-screenshots`
- Public Read, Authenticated Write
- Automatischer Upload via Netlify Function

**Migration-Dateien:**
- `migrations/create_strategie_tables.sql`
- `migrations/create_strategie_storage_bucket.sql`

---

### ✅ Screenshot-Generierung (Netlify Function)

**Funktion:** `netlify/functions/screenshot.js`

- Nutzt Puppeteer mit `@sparticuz/chromium-min`
- Erkennt Plattform automatisch (YouTube, TikTok, Instagram)
- Generiert JPEG-Screenshots (85% Qualität)
- Upload direkt zu Supabase Storage
- Timeout: 60 Sekunden

**Dependencies hinzugefügt:**
```json
{
  "@sparticuz/chromium-min": "^123.0.0",
  "@supabase/supabase-js": "^2.39.0",
  "puppeteer-core": "^22.0.0"
}
```

**Netlify Config erweitert:**
- Functions Directory: `netlify/functions`
- Node Bundler: esbuild
- External Modules: `@sparticuz/chromium-min`
- Screenshot Function Timeout: 60s

---

### ✅ Frontend-Module

**1. StrategieService.js**
- CRUD-Operationen für Strategien & Items
- Screenshot-Generierung via Fetch-API
- Creator-Suche (Autocomplete)
- Dropdown-Daten (Unternehmen, Marken, Kampagnen)

**2. StrategieList.js**
- Übersicht aller Strategien
- Tabellen-Design mit `data-table` CSS-Klassen
- Filter, Pagination
- Erstellen-Dialog mit Verknüpfungen
- Mitarbeiter & Kunden-Zugriff

**3. StrategieDetail.js**
- Items verwalten (Hinzufügen, Bearbeiten, Löschen)
- Screenshot-Generierung per Button
- Drag & Drop Sortierung
- Creator-Suchfeld mit Autocomplete
- Inline-Editing (Beschreibung, Anmerkungen)
- Unterschiedliche Views für Mitarbeiter/Kunden

**4. KundenLanding.js (erweitert)**
- Zeigt jetzt Kampagnen UND Strategien
- Automatisch gefiltert nach Kunde-Zuordnung

---

### ✅ Navigation & Routing

**Navigation erweitert:**
- Neue Sektion "Projektmanagement" > "Strategien"
- Icon: Lightbulb (💡)
- Route: `/strategie`

**Routing in main.js:**
- Liste: `/strategie` → `StrategieList`
- Detail: `/strategie/:id` → `StrategieDetail`
- Modul-Registry aktualisiert

**Permission-Mapping:**
- `strategie` → `kampagne` Permissions
- Mitarbeiter: Vollzugriff
- Kunden: Read + Anmerkungen/Auswahl

---

## Workflow

### Mitarbeiter-Perspektive

1. **Strategie erstellen**
   - Navigation → Strategien → Neue Strategie
   - Name, Beschreibung eingeben
   - Verknüpfung wählen (Unternehmen/Marke)

2. **Videos hinzufügen**
   - Video-URL eingeben (YouTube, TikTok, Instagram)
   - "Screenshot generieren" klicken
   - ~5-10 Sekunden Wartezeit beim ersten Request
   - Screenshot wird automatisch in Tabelle eingefügt

3. **Items verwalten**
   - Beschreibung inline editieren
   - Creator per Suchfeld zuordnen
   - Per Drag & Drop sortieren
   - Items löschen

### Kunden-Perspektive

1. **Strategien einsehen**
   - Kunden-Portal zeigt automatisch verknüpfte Strategien
   - Click auf Strategie öffnet Detail-View

2. **Feedback geben**
   - Videos mit Checkbox auswählen
   - Anmerkungen inline eingeben
   - Automatisches Speichern

---

## Technische Details

### Plattform-Erkennung

```javascript
function detectPlatform(url) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  return 'other';
}
```

### Screenshot-Konfiguration

```javascript
const PLATFORM_CONFIG = {
  youtube: { viewport: { width: 1280, height: 720 }, delay: 2000 },
  tiktok: { viewport: { width: 414, height: 896 }, delay: 3000 },
  instagram: { viewport: { width: 414, height: 896 }, delay: 2000 }
};
```

### Drag & Drop Implementation

- HTML5 Drag & Drop API
- Events: `dragstart`, `dragover`, `drop`, `dragend`
- Auto-Sortierung nach neuer Reihenfolge
- Speicherung via `updateItemsSortierung()`

---

## Setup & Deployment

### 1. Datenbank-Migration ausführen

```bash
# Im Supabase Dashboard SQL Editor ausführen:
migrations/create_strategie_tables.sql
migrations/create_strategie_storage_bucket.sql
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. Environment Variables (Netlify)

Im Netlify Dashboard → Site settings → Environment variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
```

### 4. Deploy

```bash
git push origin main
# Netlify deployed automatisch
```

---

## Bekannte Einschränkungen

1. **Cold-Start Latenz**
   - Erste Screenshot-Anfrage kann 5-10 Sekunden dauern
   - Nachfolgende Requests: 2-3 Sekunden
   
2. **Bot-Detection**
   - TikTok/Instagram haben aggressive Bot-Detection
   - Bei zu vielen Requests kann IP blockiert werden
   - Empfehlung: Max 10 Screenshots/Minute

3. **Timeout**
   - Netlify Free Tier: Max 26 Sekunden Function-Laufzeit
   - Bei langsamen Videos kann Timeout auftreten
   - Lösung: Retry oder Pro Plan

4. **Private Videos**
   - Funktioniert nur bei öffentlichen Videos
   - Eingeloggte/private Accounts nicht supported

---

## Zukünftige Erweiterungen

- [ ] Batch-Upload (mehrere URLs auf einmal)
- [ ] Video-Frames auswählen (statt nur Thumbnail)
- [ ] Export als PDF/Excel
- [ ] Kommentar-System für Items
- [ ] Video-Metriken (Views, Likes) automatisch abrufen
- [ ] Template-Strategien (kopieren/wiederverwenden)

---

## Kontakt & Support

Bei Problemen oder Fragen:
- Screenshots werden nicht generiert → Netlify Function Logs prüfen
- RLS-Fehler → Permissions in Supabase prüfen
- UI-Probleme → Browser-Console für Errors prüfen

---

**Status:** ✅ Vollständig implementiert und einsatzbereit
**Letzte Aktualisierung:** 26. November 2025


