# Temporär: Unternehmens-Scope in Konzept- und Casting-Liste zurückbauen

## Status

Offen — zurückzubauen, sobald der neue Flow aus v2 nach v1 gepusht ist.

## Warum es den Fix gibt

Konzepte (`strategie`) und Castings (`creator_auswahl`) können heute ohne `kampagne_id` angelegt werden, nur mit `unternehmen_id`. Bei Bärbel Drexel (`cc058517-cf8d-4113-8bf7-44e5d2dfc633`) existiert gar keine Kampagne, also haben alle vier Datensätze dort `kampagne_id = null`.

Die Listen im linken Menü haben für Mitarbeiter ausschließlich nach Kampagnen-Zuordnung gefiltert. Dadurch waren die Einträge nur über die Unternehmensseite erreichbar, die ohne Kampagnen-Bedingung lädt. Für Ruwen Rosenberg sah das aus wie eine fehlende Freischaltung, obwohl die Zuordnung in `mitarbeiter_unternehmen` vorhanden war.

Als Übergangslösung akzeptieren beide Listen jetzt zusätzlich Einträge des freigeschalteten Unternehmens.

## Was zurückzubauen ist

1. `src/modules/strategie/StrategieService.js` → `getAllStrategien()`: Unternehmens-Zweig und `dataScopeService`-Aufruf entfernen, zurück auf den reinen Kampagnen-Filter.
2. `src/modules/creator-auswahl/CreatorAuswahlService.js` → `getAllListen()`: gleicher Rückbau.
3. `src/__tests__/StrategieListScope.test.js`: Datei entfernen.
4. `src/__tests__/CreatorAuswahlService.test.js`: Testfall „zeigt Mitarbeitern Castings des freigeschalteten Unternehmens ohne Kampagne“ entfernen.

## Voraussetzung für den Rückbau

Der v2-Flow muss garantieren, dass Konzepte und Castings immer an eine Kampagne hängen. Vor dem Rückbau prüfen, dass es keine Altdaten ohne Zuordnung mehr gibt:

```sql
SELECT 'strategie' AS tabelle, count(*) FROM strategie WHERE kampagne_id IS NULL
UNION ALL
SELECT 'creator_auswahl', count(*) FROM creator_auswahl WHERE kampagne_id IS NULL;
```

Stand 06.10.2026: 13 Konzepte und 2 Castings ohne Kampagne. Solange diese Zahlen nicht null sind, verschwinden die Einträge beim Rückbau wieder aus den Listen.

## Commits

- `dc609b35` fix(konzepte): Unternehmens-Konzepte ohne Kampagne in der Liste zeigen
- `72380495` fix(casting): Unternehmens-Castings ohne Kampagne in der Liste zeigen
