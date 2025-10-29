# Mitarbeiter-Sichtbarkeit im Aufgabensystem - Implementation

## Problem
Kunden sahen bei der Aufgabenzuweisung die komplette Liste aller Benutzer. Sie sollten nur jene Mitarbeiter sehen, die mit ihren eigenen Projekten verknüpft sind.

## Lösung

### 1. PostgreSQL View: `v_available_assignees`
**Datei**: `create_available_assignees_view.sql`

Diese View filtert automatisch die verfügbaren Mitarbeiter basierend auf der Rolle des aktuellen Benutzers:

- **Admins & Mitarbeiter**: Sehen alle Benutzer
- **Kunden**: Sehen nur Mitarbeiter, die verknüpft sind über:
  - `marke_mitarbeiter` (Mitarbeiter der Marken des Kunden)
  - `kampagne_mitarbeiter` (Mitarbeiter der Kampagnen der Kundenmarken)
  - `auftrag_mitarbeiter` (Mitarbeiter der Aufträge der Kundenmarken)

**Vorteile**:
- Zentrale Logik (einmal definiert, überall verwendbar)
- Performant (PostgreSQL optimiert die JOINs)
- Sicher (nutzt RLS mit `security_invoker = true`)

### 2. Frontend-Anpassung: TaskKanbanBoard.js
**Datei**: `src/modules/tasks/TaskKanbanBoard.js`
**Methode**: `loadUsers()` (Zeile 674-698)

Die Methode lädt jetzt Mitarbeiter aus der View `v_available_assignees` statt direkt aus der `benutzer` Tabelle:

```javascript
async loadUsers() {
  try {
    const { data, error } = await window.supabase
      .from('v_available_assignees')
      .select('id, name, rolle, profile_image_url')
      .order('name');
    
    if (error) {
      // Fallback zur benutzer Tabelle wenn View nicht existiert
      const fallback = await window.supabase
        .from('benutzer')
        .select('id, name')
        .order('name');
      return fallback.data || [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Fehler beim Laden der Mitarbeiter:', error);
    return [];
  }
}
```

**Features**:
- Automatische Filterung durch View
- Fallback-Logik falls View nicht existiert
- Erweiterte Felder (rolle, profile_image_url) für bessere UX

## Migration/Deployment

### Schritt 1: View erstellen
```bash
psql -h <host> -U <user> -d <database> -f create_available_assignees_view.sql
```

Oder via Supabase Dashboard:
1. SQL Editor öffnen
2. Inhalt von `create_available_assignees_view.sql` einfügen
3. Ausführen

### Schritt 2: Frontend deployen
Das Frontend nutzt automatisch die neue View. Bei Deployment wird die Änderung in `TaskKanbanBoard.js` aktiviert.

## Testing

### Test als Kunde
1. Als Kunde einloggen (z.B. Test-Kunde mit verknüpften Marken)
2. Zur Aufgabenverwaltung navigieren
3. Neue Aufgabe erstellen oder bearbeiten
4. Im "Zuweisen an" Dropdown sollten nur Mitarbeiter erscheinen, die mit den Marken/Kampagnen/Aufträgen des Kunden verknüpft sind

### Test als Admin/Mitarbeiter
1. Als Admin oder Mitarbeiter einloggen
2. Zur Aufgabenverwaltung navigieren
3. Neue Aufgabe erstellen oder bearbeiten
4. Im "Zuweisen an" Dropdown sollten alle Benutzer erscheinen

## Hinweis zu TaskDetailDrawer.js
Die `loadAvailableAssignees()` Methode in `TaskDetailDrawer.js` (Zeile 167-193) verwendet bereits eine Entity-spezifische Filterung und muss nicht geändert werden. Sie filtert basierend auf dem konkreten Entity (Kooperation/Kampagne/Auftrag) der Aufgabe.

## Datenbankstruktur
```
Kunde → kunde_marke → Marke → marke_mitarbeiter → Mitarbeiter
                    ↓
                Kampagne → kampagne_mitarbeiter → Mitarbeiter
                    ↓
                Auftrag → auftrag_mitarbeiter → Mitarbeiter
```

## Sicherheit
- Die View nutzt `security_invoker = true` → RLS Policies werden angewendet
- Zugriff erfolgt immer im Kontext des aktuellen Benutzers (`auth.uid()`)
- Keine manuellen Berechtigungsprüfungen im Frontend nötig

