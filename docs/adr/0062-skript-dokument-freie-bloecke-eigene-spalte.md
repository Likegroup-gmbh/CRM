# Skript-Dokument: Freie Blöcke liegen in einer eigenen, unversionierten Spalte

Der Skript-Editor soll wie ein Google Doc wirken: um die Skript-Tabelle herum Text, Bilder und Tabellen (Legende, Tech-Setup, Referenzbilder, Produkttabelle). Die Skript-Tabelle bleibt unverändert an den Spalten `hook`, `hauptteil`, `cta` und `*_visuell` (Inline-Markdown). Die Freien Blöcke liegen getrennt davon in `skripte.dokument_bloecke` (jsonb, Reihenfolge inklusive Platz der Skript-Tabelle), gehören nicht zu den Skript-Versionen, und Liky sieht sie nie. Nur so bleiben Liky-Aufträge, Festgezogen, Prüfung und Versionen unberührt; eine zweite Wahrheit für Hook, Hauptteil und CTA im Dokument-JSON wäre die Alternative gewesen und hätte alle diese Pfade umgeschrieben.

## Considered Options

- **Alles ins Dokument-JSON, Skript-Tabelle als Block mit eigenen Zellen.** Eine Quelle, aber Liky, Versionen, Festgezogen und PDF müssten aus dem JSON lesen und schreiben.
- **Tiptap/ProseMirror.** Echtes Doc-Verhalten (Tabellen-Navigation, Undo, Drag-Handles), aber neue Dependency und ein zweites Datenmodell neben dem Inline-Markdown. Vanilla-Block-Editor mit `inlineFormat.js` gewählt; Block-Undo fängt das fehlende Undo ab.
- **Freie Blöcke mitversionieren.** Ein Versionswechsel würde Legende und Bilder zurücksetzen, die mit dem Text nichts zu tun haben.
- **Realtime-Sync der Blöcke.** Das Skript selbst hat keine, nur der Chat; Last-Write-Wins mit Hinweis reicht.

## Consequences

- Bestehende Skripte haben `dokument_bloecke = null` und sehen wie bisher aus (Skript-Tabelle allein).
- Bilder liegen in einem eigenen Storage-Bucket, max. 5 MB vor der Kompression (PNG/JPG/WebP), clientseitig auf ca. 1600 px verkleinert; Zugriff für Kunde, Gast und Creator hängt am Skript-Zugang.
- `SkriptPdf.js` (jsPDF, kein HTML) braucht eigene Zeichenroutinen für Text, Listen, Bilder und Tabellen; Blöcke mit „intern“ fehlen in PDF, Gast-Ansicht und Skript-Paket.
- Das Selektions-Menü in Freien Blöcken kennt nur Formatierung (Fett, Kursiv, Highlight), kein Kommentieren und keine Liky-Aktionen.
