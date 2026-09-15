# Casting-Vorschläge: Ranking nach Matching statt Slot-Portfolio

Vorschläge waren ein kuratiertes Portfolio: Slot-Quoten (proven/tight/adjacent/explore)
bestimmten die Auswahl, die LLM-Antwort die Reihenfolge. In der Praxis liefen die
Quoten leer (zu dünne Historie für „proven") und das LLM setzte den besten Kandidaten
auf Platz 10. Jetzt gilt ein finaler Score: Matching = 0.80·Fit + 0.15·Track +
0.05·Fresh, persistiert als `casting_vorschlag.matching_score`; Auswahl ist Top-N,
Anzeige streng absteigend. Cold-Start-Renorm: Creator ohne Casting-Historie bekommen
das Track-Gewicht auf Fit umverteilt, statt pauschal ~0. Das LLM bleibt
Qualitätsfilter (darf streichen, schreibt `fit_grund` ohne Score-Zahlen), rankt aber
nicht — ADR 0013 (retrieve-then-explain) bleibt die Grundlage.

**Consequences**: Fresh straft die erste Marken-Wiederholung nicht (Stufen 0/0/10/25/40).
Unbelegte Fit-Dimensionen geben bewusst 0 Punkte — das ist ein gewollter Anreiz zur
Profilpflege, keine Score-Schwäche. `position` und `slot` sind Legacy (LLM-Interna
bzw. NOT NULL-Default), nicht Anzeige-Logik. Der Standort-Fit matcht jetzt auch das
Creator-Land (Bug: „Deutschland"-Bedarf vs. `lieferadresse_land` fiel durch).
