# Kundenteilrechnungen bleiben geplant, Creatorteilrechnungen bleiben frei

Beide Richtungen heissen „Teilrechnung", werden aber bewusst unterschiedlich modelliert: kundenseitig als eigene Tabelle `auftrag_teilrechnung` mit vorab festgelegter Anzahl und festen Positionen, creatorseitig als freie Zeilen in `rechnung` ohne Planung, deren Zulässigkeit sich aus dem Restbetrag ergibt. Der Grund ist die Kontrolle über den Rechnungsanlass: Kundenrechnungen stellt die Agentur selbst und weiss vorab, dass in drei Raten fakturiert wird — Creatorrechnungen kommen herein, wie der Creator sie stellt.

## Consequences

- Creatorteilrechnungen tragen eine laufende Ordinalzahl aus der Erstellungsreihenfolge („2. Rechnung"), aber keinen Nenner. Ein „2 von 3" gibt es nur kundenseitig, wo die 3 vorab vereinbart wurde.
- Eine Vereinheitlichung in die eine oder andere Richtung wäre ein Rückschritt: die Kundenseite auf frei umzustellen zerstört eine funktionierende Planung, die Creatorseite planbar zu machen führt den Vorab-Zwang wieder ein, den ADR 0004 beseitigt hat.
