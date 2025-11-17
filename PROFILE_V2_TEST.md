# ProfileDetailV2 - Test Anleitung

## ✅ Implementierung abgeschlossen

Die neue Profilseite (ProfileDetailV2) wurde vollständig implementiert mit:

### Implementierte Features

1. **Zweispaltiges Layout**
   - Linke Sidebar mit Profilbild, Kontaktinfos und Activities
   - Rechte Spalte mit Tab-Navigation für alle Entitäten
   
2. **Sidebar Features**
   - Großes Profilbild/Initialen
   - Name und E-Mail
   - Action-Buttons (Mail, Call, More)
   - Letzte Aktivität
   - Tabs: Info & Activities
   - Info-Bereich zeigt: Rolle, Unterrolle, Mitarbeiter-Klasse, Sprachen, Mitglied seit
   - Activities zeigen History aus Kampagnen, Kooperationen und Tasks

3. **Main Content Tabs**
   - Unternehmen (mit Logos)
   - Marken (mit Logos)
   - Aufträge (nur für Mitarbeiter)
   - Kampagnen
   - Kooperationen
   - Videos
   - Jeder Tab zeigt relevante Daten in Tabellen mit "Details anzeigen"-Button

4. **Rollenbasierte Logik**
   - **Kunde**: Sieht nur Daten über kunde_unternehmen und kunde_marke Junctions
   - **Mitarbeiter**: Sieht Daten über mitarbeiter_unternehmen und marke_mitarbeiter

5. **CSS & Styling**
   - Moderne Card-basierte UI
   - Gradient-Hintergründe
   - Hover-Effekte
   - Responsive Design
   - Smooth Animations
   - Scrollbare Timeline für Activities

## Test-Anweisungen

### 1. Als Mitarbeiter testen

```bash
# Starte Dev-Server
npm run dev
```

1. Login als Mitarbeiter
2. Klicke auf Profil-Button (oben rechts)
3. Prüfe:
   - ✅ Linke Sidebar zeigt Profilbild/Initialen
   - ✅ Name und E-Mail korrekt
   - ✅ Letzte Aktivität angezeigt
   - ✅ Info-Tab zeigt Rolle, Mitarbeiter-Klasse, Sprachen
   - ✅ Activities-Tab zeigt deine letzten Aktionen
   - ✅ Rechte Seite zeigt alle Tabs inkl. "Aufträge"
   - ✅ Jeder Tab zeigt zugeordnete Entitäten
   - ✅ "Details anzeigen"-Buttons navigieren korrekt

### 2. Als Kunde testen

1. Login als Kunde (rolle = 'kunde')
2. Klicke auf Profil-Button
3. Prüfe:
   - ✅ Linke Sidebar funktioniert
   - ✅ Info-Tab zeigt Rolle "kunde"
   - ✅ Activities-Tab zeigt nur eigene Aktivitäten
   - ✅ Rechte Seite zeigt Tabs OHNE "Aufträge"
   - ✅ Nur zugeordnete Unternehmen/Marken/Kampagnen sichtbar
   - ✅ Navigation funktioniert

### 3. UI/UX Tests

1. **Responsive Design**
   - Browser-Fenster verkleinern
   - Bei < 1024px sollte Layout auf 1 Spalte wechseln

2. **Tab-Navigation**
   - Klicke durch alle Sidebar-Tabs (Info/Activities)
   - Klicke durch alle Main-Tabs
   - Tabs sollten smooth wechseln mit Fade-In Animation

3. **Actions**
   - Mail-Button sollte `mailto:` Link öffnen
   - Call-Button zeigt Alert (noch nicht implementiert)
   - "Details anzeigen"-Buttons navigieren zur Entity-Detailseite

4. **Scrolling**
   - Activities-Timeline sollte scrollbar sein wenn > 400px
   - Custom Scrollbar sollte sichtbar sein

## Bekannte Einschränkungen

1. **Telefon-Funktionalität**: Call-Button zeigt nur Alert, noch keine echte Integration
2. **Profil bearbeiten**: Button zeigt Alert, Edit-Modus noch nicht implementiert
3. **Sprachen**: Werden nur angezeigt wenn sprachen_ids im User-Record existiert
4. **Limits**: Entitäten sind auf 50 Items pro Tab limitiert (Performance)

## Datenbank-Voraussetzungen

Die Seite benötigt folgende DB-Strukturen:

### Für Kunden:
- `kunde_unternehmen` Junction-Tabelle
- `kunde_marke` Junction-Tabelle

### Für Mitarbeiter:
- `mitarbeiter_unternehmen` Junction-Tabelle
- `marke_mitarbeiter` (zustaendig_fuer_marke_ids)

### History-Tabellen:
- `kampagne_history`
- `kooperation_history`
- `kooperation_task_history`

## Technische Details

### Dateien erstellt/modifiziert:

1. **src/modules/admin/ProfileDetailV2.js** (NEU)
   - Komplette Komponente mit Datenladung und Rendering
   - ~1000 Zeilen

2. **assets/styles/components.css** (ERWEITERT)
   - +340 Zeilen neue CSS-Klassen
   - Sections: Layout, Sidebar, Avatar, Actions, Tabs, Timeline, etc.

3. **src/main.js** (MODIFIZIERT)
   - Import von ProfileDetailV2 statt ProfileDetail
   - Route 'profile' auf neue Komponente umgestellt

### Module-Registry:
```javascript
moduleRegistry.register('profile', profileDetailV2);
```

### Navigation:
```javascript
window.navigateTo('profile')
```

## Performance-Optimierungen

1. Limit auf 50 Items pro Entity-Tab
2. Lazy-Loading der Activities (nur letzte 30)
3. Optimierte SQL-Queries mit spezifischen Selects
4. CSS-Animationen via GPU-accelerated properties

## Nächste Schritte (Optional)

Falls weitere Funktionen gewünscht:

1. **Edit-Modus implementieren**
   - In-Place Editing von Name, Sprachen, etc.
   - Speichern via Supabase Update

2. **Telefon-Integration**
   - Click-to-Call via Browser API oder externe Dienste

3. **Avatar-Upload**
   - Drag & Drop Upload für Profilbild
   - Storage in Supabase Storage

4. **Export-Funktion**
   - PDF-Export des Profils
   - CSV-Export der zugeordneten Entitäten

5. **Erweiterte Activities**
   - Filter nach Activity-Type
   - Suche in Activities
   - Unendliches Scrolling

## Support

Bei Fragen oder Problemen:
- Prüfe Browser Console auf Fehler
- Prüfe Supabase-Verbindung
- Prüfe Benutzer-Rolle und Permissions
- Prüfe Junction-Tables in DB

