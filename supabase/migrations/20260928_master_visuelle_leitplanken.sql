-- Visuelle Leitplanken an die aktive Basis anhaengen.
-- Kein Vollersatz: manuelle Aenderungen im Regelwerk bleiben.
-- Keine neue Version: die aktive Zeile wird erweitert.

UPDATE skript_master
SET inhalt = rtrim(inhalt, E'\n') || $leit$

## Visuelle Leitplanken für die Creator-Spalte

Das Produktionsformat der Spalte „Was zu sehen ist“ bleibt verbindlich (Zeitmarker,
Text Overlay, Visual, B-Roll). Diese Leitplanken steuern zusätzlich Inhalt und Ton
jeder visuellen Anweisung: authentisch, im Alltag, Produkt in der Anwendung.

### Formulierungen

Für „Was zu sehen ist“ reichen einfache Hinweise. Der Generator wählt pro Beat die
passende Leitplanke und schreibt sie im bestehenden Produktionsformat aus:

- Creator spricht direkt in die Kamera.
- Produkt ist bereits im ersten Bild sichtbar.
- In einer echten Alltagssituation filmen.
- Anwendung aus der Perspektive des Creators zeigen.
- Zwischendurch Detailaufnahme des Produkts einbauen.
- Problem konkret im Alltag darstellen.
- Ergebnis beziehungsweise Veränderung zeigen.
- Kurzer Split Screen mit Problem und Lösung.
- Bildschirmaufnahme oder Website passend einblenden.
- Natürliches Setting verwenden, beispielsweise Küche, Bad oder Wohnzimmer.
- Keine gestellten Reaktionen – lieber eine echte persönliche Einschätzung.
- Unterschiedliche Perspektiven filmen, damit im Schnitt Auswahl besteht.

### Fester Text unter dem Creator-Skript

Diesen Absatz setzt der Generator unter jedes Creator-Skript, in die Zusatzinfos
(`inhalt_md`), nicht in die Visual-Felder:

Bitte setze das Video natürlich und in deinem eigenen Stil um. Filme in einem
echten, zum Thema passenden Alltagsszenario und zeige das Produkt aktiv in der
Anwendung. Der Content soll sich wie ein authentisches Creator-Video anfühlen und
nicht wie klassische Werbung oder austauschbares Stockmaterial.
Nutze unterschiedliche, aber einfache Perspektiven: direkte Ansprache in die Kamera,
Detailaufnahmen des Produkts und kurze Anwendungsszenen. Achte auf einen ruhigen
Hintergrund, gutes Licht und verständlichen Ton. Lass oben und unten ausreichend
Platz für Untertitel und Plattformelemente.

### Was vermieden werden soll

- unpassendes Stockmaterial
- rein dekorative Szenen ohne Bezug zum Gesagten
- übertrieben gestellte Reaktionen
- künstliche Werbesprache
- sterile Produktaufnahmen ohne Creator
- dauerhaft dieselbe Kameraeinstellung
- Lifestyle-Bilder, die das Produkt oder Problem nicht erklären
- Szenen, die nur „schön“ aussehen, aber keine Funktion für die Story haben

### Abgrenzung zum Schnitt

Cuts, Zooms und Übergänge bleiben im Schnittteil der Zusatzinfos. In der
Creator-Spalte reicht pro Beat eine klare visuelle Leitplanke, weiter im
bestehenden Produktionsformat. Die genaue Schnittregie gehört nicht in die Felder
für „Was zu sehen ist“.
$leit$
WHERE bereich = 'basis'
  AND status = 'aktiv'
  AND inhalt NOT LIKE '%## Visuelle Leitplanken für die Creator-Spalte%';
