# Casting-Bestand zeigt auch Einträge ohne Creator-Datensatz

Nicht alle Personen auf Castings haben einen Creator-Datensatz. Der Casting-Bestand soll sichtbar machen, wer schon in der Datenbank steht und wer nicht, wie der Punkt am Bild im Casting einer Produktion.

## Entscheidung

Die Zeile „Einträge ohne Stammdaten-Identität zählen nicht“ aus ADR 0044 entfällt. Jede Person auf einem Casting steht in der Liste, eine Zeile pro Person. Schlüssel, in dieser Reihenfolge:

1. `creator_id` am Eintrag: die Zeile des Creators.
2. Kein `creator_id`, aber der Instagram-Handle aus `link_instagram` gehört zu einem Creator (`creator.instagram` oder `link_instagram` eines verknüpften Eintrags): der Eintrag zählt auf dessen Zeile, es entsteht keine zweite.
3. Sonst der Handle: eine Zeile ohne Creator.
4. Sonst der normalisierte Name (`lower(btrim(name))`): eine Zeile ohne Creator. Zwei verschiedene Personen mit demselben Namen und ohne Handle fallen zusammen.
5. Weder Handle noch Name: keine Zeile.

Zeilen ohne Creator zeigen Name, Bild, Follower und Stadt vom jüngsten Eintrag, der den Wert hat. Branchen und Typen sind leer, Produktion ist 0. Zähler und „Zuletzt“ laufen über die ganze Gruppe wie bei Creatorn. Casting-Filter treffen weiter denselben Eintrag. Creator-Filter schließen Zeilen ohne Creator aus, die Namenssuche matcht bei ihnen Name und Handle.

Der Punkt am Bild ist zweiwertig und immer sichtbar: grün „Als Creator angelegt“, rot „Noch kein Creator“. Im Casting einer Produktion ist Rot dagegen an das Umsetzungsgate gebunden. Nur grüne Zeilen verlinken auf den Creator.

Die RPC `get_casting_bestand` liefert dazu `hat_creator` und `id = null` bei Zeilen ohne Creator.

## Verworfene Alternativen

- Nur ein grüner Punkt auf der alten Liste. Sie enthält nur Creator mit Datensatz, der Punkt wäre immer grün und ohne Aussage.
- Eine Zeile pro Eintrag. Dieselbe Person stünde pro Casting einmal da, die Zähler zerfielen.
- Einträge ohne Handle über den Namen einem Creator zuordnen. Namen sind nicht eindeutig, eine falsche Zuordnung fiele in den Zählern nicht auf.
