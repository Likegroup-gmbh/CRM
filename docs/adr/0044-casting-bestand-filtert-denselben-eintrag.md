# Casting-Bestand filtert denselben Eintrag, die Zähler bleiben global

Creator, die schon auf Castings standen, werden beim nächsten Kunden neu eingetragen. Der Casting-Bestand ist die seitenweite Liste dafür, nicht ein weiteres Casting und nicht die aufgesplittete Historie.

> Teilweise abgelöst durch ADR 0046: Einträge ohne Stammdaten-Identität stehen jetzt ebenfalls in der Liste.

## Entscheidung

Eine Zeile pro Creator. Einträge ohne Stammdaten-Identität zählen nicht. Die Zähler (Castings, Prio 1, Prio 2, Abgelehnt, Produktion) und „Zuletzt“ (Anlegezeitpunkt des neuesten Eintrags) zeigen immer die ganze Historie. Der Filter entscheidet nur, wer in der Liste steht. Castings, Prio 1, Prio 2 und Abgelehnt zählen verschiedene Castings (`count(DISTINCT creator_auswahl_id)`), weil derselbe Creator in Altdaten doppelt im selben Casting steht. Produktion zählt die Kooperationsdatensätze des Creators, nicht Rechnungen.

Casting-Filter treffen denselben Eintrag: Prio 1, Prio 2, Abgelehnt, Prozessstatus, Kunde, Marke, Kampagnenart. Innerhalb eines Filters gilt oder. Kunde und Marke sind die des Castings, nicht eine Kooperation. Kampagnenart ist die der Kampagne, nicht die Creator-Art am Eintrag. Die Creator-Filter von `/creator` kommen dazu, ohne den Kooperations-Kunden.

Die Filter-Oberfläche ist vorerst entfernt, die Liste bietet Namenssuche und Sortierung über die Spaltenköpfe. Die RPC `get_casting_bestand` kann die Filter weiterhin; die Regel „derselbe Eintrag“ gilt, sobald sie zurückkommen.

Die Seite heißt im Menü Creator Casting und öffnet den Creator. Pin und Übernehmen ins nächste Casting sind nicht Teil davon.

## Verworfene Alternativen

- Eine Zeile pro Casting-Eintrag, oder die Historie unter der Zeile aufklappen.
- Zähler, die sich auf den aktiven Filter verengen.
- Filter, die jeder einen anderen Eintrag treffen dürfen. „Prio 1 und Gebucht“ wäre dann fast jede lange Historie.
- Kampagnenart am Eintrags-`typ` filtern. Videograf und Model sind eine andere Achse.
