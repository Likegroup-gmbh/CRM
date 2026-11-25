# 0071 Masterliste: Einträge ohne Creator verweisen auf den Creator-Pool

Bisher stand auf einer Masterliste nur, wer schon Creator in den Stammdaten ist. Gewünscht ist, wie im Casting, Personen per Instagram-Link aufzunehmen, bevor es einen Datensatz gibt. Entschieden: `creator_list_member.creator_id` darf leer sein; eine solche Zeile trägt den normalisierten Handle (`ig_username`) und verweist auf den Pool-Eintrag (`sourcing_creator_id`). Die Tabelle zeigt Bild, Follower, Engagement und Kontakt live aus `sourcing_creator`, so wie grüne Zeilen live aus `creator` lesen.

## Entscheidung

- **Verweis statt Kopie.** Der Abruf läuft über `previewInstagramStats`, der den Pool füllt und keine Casting-Zeile schreibt. Die Masterliste speichert nur die Pool-ID; ein späterer Abruf in irgendeinem Casting aktualisiert auch die Masterliste.
- **Verknüpfung über den Handle.** Beim Einfügen und beim Laden wird eine Zeile ohne Creator verknüpft, wenn genau ein Creator denselben Handle hat und noch nicht auf der Liste steht (dieselbe Regel wie im Casting).
- **Handarbeit an der Zeile.** Der Tab „Neuer Creator“ legt Creator Art, Name, Follower, TikTok, Ort, Mail und Telefon an der Zeile ab, auch ohne Instagram. Diese Werte gehen vor dem Pool; Bild, Instagram-Follower und Engagement kommen weiter live aus dem Pool. Preis- und Vertragsfelder des Castings gibt es hier nicht, Listen-eigene Werte laufen über eigene Spalten.
- **Eindeutigkeit.** `UNIQUE (creator_id, list_id)` bleibt; dazu ein partieller Unique-Index auf `(list_id, ig_username) where creator_id is null`.

## Verworfen

- **Instagram-Werte an die Zeile kopieren** (wie `creator_auswahl_items`). Bräuchte eine eigene Netlify-Function oder Schreibrechte auf die Zeile und veraltet, sobald der Pool neu abgerufen wird.
- **Beim Einfügen automatisch einen Creator anlegen.** Name und Pflichtfelder fehlen oft; die Stammdaten würden mit halben Datensätzen gefüllt.

## Folgen

- Code, der `creator_list_member` liest, muss mit leerem `creator_id` rechnen. Entfernen läuft über die Member-ID.
- Den Pool dürfen nur Admin, Mitarbeiter und Investoren lesen. Andere Rollen sähen rote Zeilen ohne Profil; heute pflegen nur diese Rollen Masterlisten.
- Wird ein Creator über „Zur Masterliste hinzufügen“ auf eine Liste gesetzt, auf der sein Handle schon rot steht, entstehen zwei Zeilen; sie werden nicht zusammengeführt.
