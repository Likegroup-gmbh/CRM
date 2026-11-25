# Das Briefing folgt dem Creator-Briefing-PDF

Das Briefing war ein internes Arbeitsblatt mit rund 50 Feldern in fünf Schritten (Grundlage, Casting, Aufgabe, Konzepte, Vertrag). Casting-Matching, Skript, Videoideen und Persona-Namen zogen daraus ihre Vorgaben. Der Kunde füllt aber das LikeGroup-Creator-Briefing aus, ein PDF mit drei Sektionen. Das Formular im CRM fragt ab jetzt genau diese Fragen ab, nicht mehr.

## Entscheidung

- **Schritt 1 bleibt der Typ-Baum** (Paid, Organic, Influencer) mit der Zuordnung (Unternehmen, Marke, Kampagne, Produktion). Ist der Kontext bekannt, etwa beim Anlegen aus der Produktion, ist die Zuordnung ausgeblendet und im Hintergrund gesetzt. Sichtbar ist nur, was fehlt.
- **Danach die drei Sektionen des PDFs**, in dessen Reihenfolge und Wortlaut, für alle Typen gleich:
  - Kampagnenübersicht & Rahmen
  - Produkt & Kampagnenidee
  - Deine Aufgabe & Umsetzung

  Der Typ steuert danach nur noch drei Dinge: den Skript-Ton, ob die Casting-Liste UGC oder Influencer ist, und welches Häkchen bei „Wie wird der Content verwendet?“ vorbelegt und gesperrt ist.
- **Pflichtinhalte, Do's und Don'ts sind drei Felder** (`vorgabe_pflicht`, `vorgabe_dos`, `vorgabe_donts`). Don'ts betreffen nur den Inhalt (Konzept und Skript) und sind nie ein Personenfilter. Die alten Spalten `pflichtinhalte`, `dos` und `donts` werden nicht wiederverwendet, ihr Inhalt steckt schon in `wichtige_vorgaben`.
- **Umsetzungsideen sind verbindlich oder Inspiration** (`umsetzungsideen_eintraege` als `[{ text, verbindlich }]`). Eine verbindliche Idee wird einmalig 1:1 zum Videoidee-Vorschlag. An Inspirationen darf Liky anknüpfen, schreibt sie aber nicht ab. Die alte Spalte `umsetzungsideen` bleibt Text, weil V1 sie im Parallelbetrieb weiter schreibt; die Migration übernimmt ihren Inhalt einmal als Inspirationen, danach liest der Client sie nur als Fallback.
- **Was das PDF nicht fragt, fragt das Formular nicht:**
  - Casting-Kriterien (Nische, Größe, Merkmale, Voraussetzungen, Haut- und Haartyp)
  - Funnel-Stufen und Videolänge je Stufe
  - TKP, Verhandlungshinweis, Learnings
  - Hook-Vorgaben, CTA, Ziel-URL, Hooks-Anzahl
  - Nutzungsdauer und Rohmaterial als Auswahl

  Ersatz und Umgang:
  - TKP steht nur noch an der Casting-Liste.
  - Die Funnel-Stufe steht nur noch an der Videoidee.
  - CTA und Hook gehören in die Pflichtinhalte.
  - Nutzungsrechte sind Freitext.
- **Altfelder bleiben stehen.** Keine Spalte wird gelöscht, keine Daten werden umgeschrieben. Ein befülltes Altfeld sieht nur das Team, als „Frühere Angaben“ im Briefing-Dokument. Die KI liest es als Fallback, solange das neue Feld leer ist.
- **Casting-Vorschläge sind pausiert**, für alle Castings. Ihr Bedarf lebte von den strukturierten Casting-Kriterien, die es nicht mehr gibt. Die Sperre ist dieselbe wie bei Altbestand-Linien, der Code bleibt.

## Verworfen

- **Vierter Schritt „Intern“** mit den Casting-Kriterien und dem TKP. Hätte das Matching am Leben gehalten, aber das Formular wäre wieder das alte Arbeitsblatt geworden.
- **Block „Gesucht“ am Casting** als neue Quelle für den Bedarf. Vertagt, bis das Matching neu gedacht wird.
- **Altfelder in die neuen Freitextfelder migrieren.** Verlustbehaftet und für alte Briefings ohne Nutzen, weil die KI sie ohnehin als Fallback liest.

## Folgen

- Videoidee-Vorschläge bleiben aktiv. Ihre Geschichte kommt aus Personas und Produkten, das Briefing ist die Grenze.
- Der Vertrag bleibt unberührt, er liest nichts aus dem Briefing.
- Das Namensregister neuer Personas kommt nur noch aus Produkt und Marke.
- Bei Paid wählt Liky die Funnel-Stufe einer Videoidee aus allen drei Stufen. Die Auswahl schränkt das Briefing nicht mehr ein.
- Deploy-Reihenfolge:
  1. Migration `20261221_briefing_creator_pdf.sql`
  2. Edge Function `einladung` (neue Allowlist)
  3. Client und Netlify-Functions
