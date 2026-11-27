# 0084 Preisfenster 12 statt 8 Videos, Views und Preis getrennt

Das Casting zeigte je Plattform zwei Preise aus Views: den Schnitt der letzten 8 und der letzten 30 Videos. Beide Werte standen mit Views, Preis und dem Zweitwert „ohne Trials“ in einer einzigen Zelle. Bei sechsstelligen Views und vierstelligen Preisen lief der Text in die Nachbarspalte. Außerdem verschiebt bei 8 Videos schon ein einzelnes Reel den Schnitt um ein Achtel.

## Entscheidung

- **Das kurze Fenster rechnet mit 12 Videos, das lange bleibt bei 30.** `WINDOW_SHORT = 12` in `_shared/instagram-cpm.js`. Es gelten dieselben Regeln wie bisher: Werbung, Videos jünger als 4 Tage und angepinnte TikToks zählen nicht, ein Ausreißer wird durch das nächstältere Video ersetzt.
  - Instagram holt weiter 30 Beiträge (`MEDIA_LIMIT`), TikTok 40 Videos (`PROFIL_VIDEOS`). Für den 12er bleibt damit genug Vorrat an Ersatz-Reels.
  - `CALC_VERSION` steht auf 10. Der Pool beider Plattformen gilt damit als veraltet, der nächste Klick je Creator holt frisch.
- **Sauber umbenannt, nicht nur anders gerechnet.** Alles, was 8 hieß, heißt jetzt 12:
  - Spalten `ig_views_12`, `cpm_ig_12` und `tt_views_12` an `creator_auswahl_items`, `sourcing_creator` und `sourcing_creator_tiktok`.
  - Stats-Schlüssel `views_12`, `cpm_12`, `sample_12`, `used_12` und `outliers_12`, auch in `ohne_trials`.
  - Spalten-Keys `cp-col-cpm-12` mit den Zeilen `cp-col-cpm-ig-12` und `cp-col-cpm-tt-12`.
- **Views und Preis in getrennten Spalten.** Nach Engagement folgen Ø Views 12, Preis 12 Videos, Ø Views 30 und Preis 30 Videos, jede mit Instagram- und TikTok-Zeile (`cp-col-views-12`, `cp-col-cpm-12`, `cp-col-views-30`, `cp-col-cpm-30`).
  - `renderAutoViewsInhalt` und `renderAutoCpmInhalt` in `castingPreisZellen.js` rendern je eine Zelle. Die Ausreißer stehen im Tooltip der Views, die Rechnung „N Views × T € TKP“ im Tooltip des Preises.
  - Der Kunden-Call-Blur liegt nur auf dem Preis. Views sind öffentlich.
  - Spaltenbreite 108px, jede Zeile kürzt mit Ellipsis, statt in die Nachbarspalte zu laufen.
- **Zweitwert ohne Trials als kurze zweite Zeile.** Weicht der Wert ohne Trial-Reels ab, steht darunter „o. T. 58,5K“ bzw. „o. T. 1.462,55 €“, der Tooltip schreibt es aus. Die Engagement-Zelle nutzt dasselbe Format (`ohneTrialsZeile`). Der Drawer hat Platz und behält „ohne Trials“.
- **Expand/contract für die DB.** `20261231_preisfenster_12.sql` legt die `_12`-Spalten nur an. Die `_8`-Spalten fallen erst mit `20270101_preisfenster_8_entfernen.sql`, wenn neuer Code live ist und die Bestandswerte nachgerechnet sind. Zwischen Migration und Deploy schreibt alter Code weiter in `_8`, ohne zu brechen.
- **Gespeicherte Spalteneinstellungen ziehen mit.**
  - Die Migration benennt in `hidden_columns` die 8er-Keys um und versteckt jede Views-Spalte und -Zeile, deren Preis versteckt ist. In `column_order` wird der 8er-Key zum 12er. Die neuen Views-Spalten setzt `baueBeweglicheSpalten` hinter ihren Vorgänger aus der Standardfolge.
  - `migrateHiddenColumns` macht dasselbe im Frontend, für Stände, die alte Clients während des Deploys noch schreiben. Die Views spiegeln den Preis nur, wenn der alte 8er-Key in der Liste stand. Eine schon migrierte Liste kann die Views also frei ein- und ausblenden.
- **Bestandswerte aus den gespeicherten Videos nachrechnen.** `stats.videos` ist ab Version 4 die bereinigte Liste, neueste zuerst. `fensterAusStats` in `_shared/instagram-cpm-nachrechnen.js` wählt darauf mit `evaluateWindow` das 12er-Fenster, ohne Meta oder Apify zu fragen.
  - Variante ohne Trials: Die `skipped_videos` mit `reason: 'trial_views'` fallen aus der Liste, `used` wird auf die volle Liste zurückgebildet. Ein Test vergleicht das Ergebnis mit einem frischen `computeInstagramCpm`.
  - `scripts/preisfenster-12-nachrechnen.mjs` schreibt Items und Pool beider Plattformen, ohne `--apply` nur als Dry-Run. 30er-Werte und `calc_version` fasst es nicht an.
  - Die 8er-Schlüssel in den Stats bleiben stehen, weil der alte Client daraus Ausreißer und den Wert ohne Trials liest. So darf das Script schon vor dem Deploy laufen. Die Drop-Migration räumt die Schlüssel zusammen mit den `_8`-Spalten weg.
- **Report-Teil eigenes Modul.** `formatCpmDebug` und `formatCpmReport` liegen in `_shared/instagram-cpm-report.js`. Die Aufrufer importieren ihn direkt, ein Re-Export aus `instagram-cpm.js` wäre eine zirkuläre Abhängigkeit.

## Verworfen

- **12er in die alten `_8`-Spalten schreiben.** Spart Migration und Script, aber Name und Inhalt passen dann nicht mehr zusammen. Jede Abfrage, jeder Test und jeder Debug-Log müsste das wissen.
- **Views und Preis in einer Zelle lassen, nur kleiner setzen.** Vier Werte je Plattformzeile (Views, Preis, beides ohne Trials) passen in keine vernünftige Spaltenbreite. Getrennte Spalten kann man außerdem einzeln ausblenden.
- **Bestand frisch abrufen statt nachrechnen.** Rund 1.700 Zeilen hießen ebenso viele Meta-Abfragen und Apify-Läufe. Die gespeicherten Videos reichen für dasselbe Ergebnis.
- **30er auf 12 umstellen.** Der 30er ist der ruhige Langzeitwert und bleibt, wie er ist.

## Folgen

- Deploy-Reihenfolge:
  1. Migration `20261231_preisfenster_12.sql` (nur additiv, Rollback im Kopf).
  2. `node scripts/preisfenster-12-nachrechnen.mjs` als Dry-Run, danach mit `--apply`.
  3. Functions und Client in einem Deploy.
  4. Das Script noch einmal mit `--apply`, für Zeilen, die alter Code bis zum Deploy geschrieben hat.
  5. Migration `20270101_preisfenster_8_entfernen.sql`.
- `stats.videos` endet am letzten Reel, das ein Fenster angesehen hat, mindestens 30. Hat ein Creator viele Ausreißer im 30er, kann der nachgerechnete 12er weniger Ersatz-Reels haben als ein frischer Abruf. Der nächste Abruf rechnet wieder genau.
- Zeilen vor Version 4 (rund 160) haben keine passende Videoliste und zeigen beim 12er „-“, bis jemand frisch abruft.
- Die Tabelle ist um zwei Spalten breiter. Wer die Views nicht braucht, blendet sie in „Tabelle anpassen“ aus.
