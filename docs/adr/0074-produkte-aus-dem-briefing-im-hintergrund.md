# Produkte entstehen aus dem Briefing im Hintergrund

Die Sektion „Produkt & Kampagnenidee“ des Creator-Briefings fragt Produktname, Kurzbeschreibung, Eigenschaften, Nutzen und Link ab. Das ist der Inhalt der Tabelle `produkt`. Bisher galt: Beim Anlegen eines Briefings wird kein Produkt gewählt, es entsteht danach. Jetzt trägt das Team die Produkte im Briefing ein (eines oder mehrere), und das CRM legt sie dabei an.

## Entscheidung

- **Ein Eintrag ist ein Produkt, keine Kopie.** Ein Eintrag schreibt direkt in `produkt`, das Briefing hält ihn über `campaign_briefing_produkt`. Das Briefing zeigt das Produkt live: Eine Änderung dort gilt auf jeder Linie, die das Produkt hat (ADR 0052). Die Felder werden so übertragen:
  - Name → `name`
  - Kurzbeschreibung → `kurzbeschreibung`
  - Eigenschaften → `usp`
  - Problem/Nutzen → `loesung`
  - Link → `url`
- **Angelegt wird, sobald ein Eintrag einen Namen oder eine URL hat**, auch im Entwurf. Die Verknüpfung entsteht, sobald die Briefing-Zeile existiert.
- **Dublette heißt verknüpfen.** Gibt es im Unternehmen schon ein Produkt mit derselben URL (ohne Protokoll, `www`, Query und Schrägstrich am Ende) oder demselben Namen (Groß/Klein egal), wird dieses verknüpft (Produkt übernehmen) statt neu angelegt.
- **Eingabe gewinnt.** Mit URL oder Unterlage (PDF) startet das bestehende Auslesen (`extract_jobs`). Sein Ergebnis füllt nur leere Felder des Produkts.
- **Eintrag entfernen löst nur die Verknüpfung.** Das Produkt bleibt im Katalog.
- **Einladung:** Produkte, die der Kunde über eine Briefing-Einladung einträgt, entstehen erst, wenn das Team die Einreichung anlegt, mit derselben Dubletten-Regel.

## Verworfen

- **Eigene Produkttexte am Briefing.** Doppelte Wahrheit neben dem Produkt; spätestens beim Skript wüsste niemand, welche gilt.
- **Erst beim Finalisieren anlegen.** Das Auslesen von Shop und Unterlagen soll schon laufen, während das Briefing noch ausgefüllt wird.
- **Dubletten nur melden.** Bei einer Kampagne mit mehreren Linien wäre jede Linie eine Rückfrage.

## Folgen

- Der Glossar-Satz „Beim Anlegen wird kein Produkt gewählt“ gilt nicht mehr.
- Ein im Entwurf angelegtes Produkt bleibt im Katalog, auch wenn das Briefing verworfen wird.
- Das Creator-PDF liest die Produktsektion aus den verknüpften Produkten, nicht aus dem Briefing.
