# Regressionstests: Marken-Mitarbeiter-Zuordnung

Reproduzierbare Checks für die stabilisierte Mitarbeiter- und Rechte-Logik (Override-Semantik, Persistenz, Auto-Sync).

## Voraussetzungen

- Eingeloggt als Nicht-Admin (z. B. Mitarbeiter mit eingeschränkten Rechten)
- Mindestens ein Unternehmen mit mehreren Marken und mehreren zugewiesenen Mitarbeitern

---

## Test 1: Mehrere Mitarbeiter werden vollständig übernommen

**Ziel:** 5 ausgewählte Mitarbeiter werden alle in `marke_mitarbeiter` gespeichert.

**Schritte:**

1. Marke bearbeiten (oder neue Marke mit Unternehmen anlegen)
2. In einem der Felder (Management / Lead / Mitarbeiter) genau **5** Personen auswählen
3. Speichern
4. Seite neu laden (F5)
5. In der DB prüfen: `SELECT * FROM marke_mitarbeiter WHERE marke_id = '<marke_id>' AND role = '<role>'` → **5 Zeilen**
6. Im Formular prüfen: Alle 5 wieder vorausgewählt

**Erwartung:** Alle 5 Einträge vorhanden, keine fehlenden oder doppelten Zeilen.

---

## Test 2: Entfernte Mitarbeiter bleiben weg und haben keine Markenberechtigung

**Ziel:** Nach Entfernung von der Marke hat der User keine Berechtigung mehr für diese Marke (Override).

**Schritte:**

1. Marke M1 zu Unternehmen U1; User A ist bei U1 (mitarbeiter_unternehmen) und bei M1 (marke_mitarbeiter) zugeordnet
2. Marke M1 bearbeiten, User A aus allen Rollen entfernen, speichern
3. Seite neu laden → User A darf in der Auswahl erscheinen, darf aber **nicht** in der gespeicherten Liste sein
4. Als User A einloggen (oder Berechtigungs-API prüfen): `getAllowedMarkenIds()` darf **M1 nicht** enthalten
5. In DB: `marke_mitarbeiter` hat keine Zeile mehr für (M1, User A)

**Erwartung:** User A sieht M1 nicht mehr in seiner Markenliste; Entzug bleibt erhalten.

---

## Test 3: Mitarbeiter nur auf Marke (nicht Unternehmen)

**Ziel:** User nur in `marke_mitarbeiter` für M1, nicht in `mitarbeiter_unternehmen` für U1 → hat Zugriff auf M1; Unternehmensberechtigung wird nicht verändert.

**Schritte:**

1. User B **nicht** bei Unternehmen U1 zuweisen (kein Eintrag in `mitarbeiter_unternehmen`)
2. Marke M1 (U1) bearbeiten, User B nur bei einer Rolle (z. B. Mitarbeiter) hinzufügen, speichern
3. Als User B: `getAllowedMarkenIds()` enthält M1
4. `getAllowedUnternehmenIds()` für User B: U1 kann enthalten sein (wenn Auto-Sync einen Eintrag erstellt hat) oder nicht – je nach gewünschter Regel. Aktuell: Auto-Sync legt nur an, wenn **noch keine** Zuordnung zu U1 besteht → eine neue Zeile in `mitarbeiter_unternehmen` mit role `mitarbeiter` wird erstellt, damit der User das Unternehmen kontextuell hat
5. Optional: User B von M1 wieder entfernen; in `mitarbeiter_unternehmen` bleibt die einmal angelegte Zuordnung (kein automatisches Löschen)

**Erwartung:** User B hat Zugriff auf M1; Rechte-Logik nutzt explizite Marken-Zuordnung (Override).

---

## Test 4: Paralleles Speichern (2 Tabs)

**Ziel:** Kein Datenverlust bei gleichzeitiger Bearbeitung.

**Schritte:**

1. Tab 1: Marke M1 öffnen, Bearbeiten, z. B. 2 Mitarbeiter in „Mitarbeiter“ auswählen, **noch nicht speichern**
2. Tab 2: Gleiche Marke M1 öffnen, Bearbeiten, 2 **andere** Mitarbeiter in „Mitarbeiter“ auswählen, Speichern
3. Tab 1: Speichern
4. Tab 2: Seite neu laden

**Erwartung:** Entweder Tab-1-Stand oder Tab-2-Stand (kein Mischzustand mit halb gelöschten Zeilen). Keine doppelten oder fehlenden Einträge in `marke_mitarbeiter` für M1. Bei Konflikten: Last-Write-Wins (Tab 1 überschreibt Tab 2) ist akzeptabel.

---

## Test 5: Duplikate und Rollen

**Ziel:** Dieselbe Person in mehreren Rollen (z. B. Management + Mitarbeiter) erzeugt pro Rolle genau einen Eintrag; keine Duplikate pro (marke_id, mitarbeiter_id, role).

**Schritte:**

1. Marke bearbeiten, User C in **Management** und in **Mitarbeiter** auswählen, speichern
2. DB: `SELECT * FROM marke_mitarbeiter WHERE marke_id = '<id>' AND mitarbeiter_id = '<user_c_id>'` → **2 Zeilen** (role management, role mitarbeiter)
3. Keine doppelten Zeilen mit gleichem (marke_id, mitarbeiter_id, role)

**Erwartung:** Maximal ein Eintrag pro (marke_id, mitarbeiter_id, role); mehrere Rollen pro Person möglich.

---

## Automatisierte Tests

Siehe `src/__tests__/MarkeMitarbeiterRegression.test.js` für unit-artige Checks (Rechte Admin/Kunde/kein User, Deduplizierung, Fehler bei Löschfehler). Nach `npm install` mit `npm run test:run` ausführen.
