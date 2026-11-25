-- Ausgabeformat-Widersprueche im aktiven Master entschaerfen (ADR: Task und Tool-Schema
-- regeln das Ausgabeformat, der Master nur Strategie und Bereichssystem).
-- Exakter Textvergleich pro Ersetzung: Wurde die Stelle im UI schon geaendert, bleibt die
-- Zeile unberuehrt. Keine neue Version, manuelle Aenderungen bleiben.

UPDATE skript_master
SET inhalt = replace(inhalt, $alt0$Das Produktionsformat der Spalte „Was zu sehen ist“ bleibt verbindlich (Zeitmarker,
Text Overlay, Visual, B-Roll). Diese Leitplanken steuern zusätzlich Inhalt und Ton
jeder visuellen Anweisung:$alt0$, $neu0$Das Ausgabeformat der Spalte „Was zu sehen ist“ legt der Generator fest (ein
schlichter Satz pro Beat, ohne Zeitmarker). Diese Leitplanken steuern Inhalt und Ton
jeder visuellen Anweisung:$neu0$)
WHERE status = 'aktiv'
  AND position($alt0$Das Produktionsformat der Spalte „Was zu sehen ist“ bleibt verbindlich (Zeitmarker,
Text Overlay, Visual, B-Roll). Diese Leitplanken steuern zusätzlich Inhalt und Ton
jeder visuellen Anweisung:$alt0$ in inhalt) > 0;

UPDATE skript_master
SET inhalt = replace(inhalt, $alt1$passende Leitplanke und schreibt sie im bestehenden Produktionsformat aus:$alt1$, $neu1$passende Leitplanke und schreibt sie als schlichten Satz aus:$neu1$)
WHERE status = 'aktiv'
  AND position($alt1$passende Leitplanke und schreibt sie im bestehenden Produktionsformat aus:$alt1$ in inhalt) > 0;

UPDATE skript_master
SET inhalt = replace(inhalt, $alt2$Cuts, Zooms und Übergänge bleiben im Schnittteil der Zusatzinfos. In der
Creator-Spalte reicht pro Beat eine klare visuelle Leitplanke, weiter im
bestehenden Produktionsformat. Die genaue Schnittregie gehört nicht in die Felder
für „Was zu sehen ist“.$alt2$, $neu2$Cuts, Zooms und Übergänge gehören nicht in die Creator-Spalte. Dort reicht pro
Beat eine klare visuelle Leitplanke als schlichter Satz. Die genaue Schnittregie
gehört nicht in die Felder für „Was zu sehen ist“.$neu2$)
WHERE status = 'aktiv'
  AND position($alt2$Cuts, Zooms und Übergänge bleiben im Schnittteil der Zusatzinfos. In der
Creator-Spalte reicht pro Beat eine klare visuelle Leitplanke, weiter im
bestehenden Produktionsformat. Die genaue Schnittregie gehört nicht in die Felder
für „Was zu sehen ist“.$alt2$ in inhalt) > 0;

UPDATE skript_master
SET inhalt = replace(inhalt, $alt3$7. Shot-/Visual-Vorschläge,$alt3$, $neu3$7. visuelle Anweisungen pro Beat,$neu3$)
WHERE status = 'aktiv'
  AND position($alt3$7. Shot-/Visual-Vorschläge,$alt3$ in inhalt) > 0;

UPDATE skript_master
SET inhalt = replace(inhalt, $alt4$9. Shot-/Text-Vorschläge,$alt4$, $neu4$9. visuelle Anweisungen und On-Screen-Texte pro Beat,$neu4$)
WHERE status = 'aktiv'
  AND position($alt4$9. Shot-/Text-Vorschläge,$alt4$ in inhalt) > 0;

UPDATE skript_master
SET inhalt = replace(inhalt, $alt5$8. visuelle Szenen und B-Roll,$alt5$, $neu5$8. visuelle Szenen pro Beat,$neu5$)
WHERE status = 'aktiv'
  AND position($alt5$8. visuelle Szenen und B-Roll,$alt5$ in inhalt) > 0;

