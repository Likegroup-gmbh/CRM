# 0078 Posts erfassen per Link oder Insights-Screenshot

Die Auswertung (ADR 0076, 0077) braucht je Post bestätigte Zahlen. Bisher gab es nur den Live-Link am Kooperationsvideo: die Instagram-API (Business Discovery) holte Views, Likes und Kommentare nach `stats_*`. Stories liefert diese API gar nicht, Reichweite, Shares, Saves und Watchtime auch nicht für Reels. Die vollständigen Zahlen stehen nur in den Insights, die der Creator als Screenshot schickt.

## Entscheidung

- **Zwei Wege im Unterreiter „Erfassen“:** Link einfügen und „Abrufen“ oder den Insights-Screenshot ablegen (Ziehen, ⌘V, Dateiauswahl). Der Screenshot hängt an dem Post, der in der Arbeitsliste gewählt ist. Gibt es für die Einheit noch keinen, legt das Ablegen ihn an. Mehrere Screenshots desselben Posts liest die KI zusammen (höchstens 6).
- **Link = bestätigt:** Zahlen aus der API gelten sofort als erfasst (`source = api`, `status = confirmed`). Sie kommen aus dem öffentlichen Zähler und brauchen kein Prüfen.
- **Screenshot = Entwurf:** Die KI (Claude mit Bild, `post-screenshot-background`) füllt die Felder und meldet je Feld eine Sicherheit. Unter 0,8 ist das Feld als „bitte prüfen“ markiert. Der Post steht auf „Prüfen“, bis jemand mit Enter bestätigt.
- **Konflikt: der Screenshot gewinnt.** Die Insights sind die Quelle von Instagram selbst, der öffentliche Zähler läuft hinterher. Liest die KI einen Wert, den der Abruf schon gesetzt hat, überschreibt sie ihn. Ein späterer Abruf füllt nur Felder, die kein Screenshot gesetzt hat. Bei einem noch offenen Screenshot-Entwurf ergänzt er nur, der Post bleibt auf „Prüfen“. Erkannt wird das an den Schlüsseln in `confidence`: beim Bestätigen bleiben sie mit dem Wert 1 stehen, statt gelöscht zu werden.
- **Stories und TikTok:** Der Link wird gespeichert, „Abrufen“ bleibt aus und nennt den Grund. Erfasst wird per Screenshot oder von Hand.
- **Story-Felder:** Aufrufe, Betrachter, Link-Klicks, Sticker-Taps („Auf Sticker getippt“, die Summe, nicht je Sticker), Likes, Antworten, Geteilt, Verlassen. Story-Insights passen selten auf einen Screenshot, meist kommen zwei (oben Übersicht und Aufrufe, unten Betrachter und Interaktionen). Link-Klicks und Sticker-Taps sind getrennte Felder, der Link-Sticker zählt nur bei den Link-Klicks.
- **Aufrufe ≠ Betrachter:** Aufrufe zählen jede Wiedergabe, Betrachter jedes Konto einmal (`reach`, bei Instagram früher „Erreichte Konten“). Der Prompt verbietet, eins für das andere einzusetzen, und benennt die gerundete Betrachter-Zahl neben dem Personen-Symbol der Story-Ansicht sowie die Zahlen unter den Vorschaubildern anderer Stories. Über mehrere Screenshots schlägt die genaue Zahl die gerundete („75,404“ vor „76,1 Tsd.“), erst danach zählt die Konfidenz.
- **Bestand übernommen:** Videos mit `stats_views` wurden zu bestätigten Posts (`api`, wenn `stats_fetched_at` gesetzt war, sonst `manuell`). Videos mit Live-Link ohne Zahlen wurden zu offenen Posts mit Link. `link_live` und `stats_*` am Video bleiben als Altfelder stehen, bis sie in einem späteren Schritt fallen.
- **Live-Performance:** Die Kachel der Kampagnenseite summiert die bestätigten Posts, nicht mehr `stats_*`. Ein Video mit Reel und TikTok zählt mit beiden Posts.
- **Wer:** Admin und Mitarbeiter sehen live und erfassen. Kunde und Gast lesen `kooperation_post` nicht (RLS). Sie sehen die Report-Freigabe, und die Kachel Live-Performance bleibt für sie weg.

## Ablauf des KI-Laufs

- Der Browser verkleinert jeden Screenshot vor dem Upload auf höchstens 1568 px Kante als JPEG. Mehr nutzt Claude nicht, und die Function kommt ohne natives Bildmodul aus. sharp hatte die Function auf einem lokal gebauten Deploy (macOS-Binaries auf der Linux-Lambda) schon beim Laden abstürzen lassen, nachdem Netlify dem Browser längst 202 gemeldet hatte.
- Der Client lädt die Bilder in den privaten Bucket `post-screenshots` (`{kampagne_id}/{post_id}/…`), setzt `ki_status = 'laeuft'` und startet die Background-Function. Ein Trigger setzt dabei `ki_gestartet_at` und `ki_schritt = 'wartet'`. Die Function arbeitet nur, wenn der Post auf `laeuft` steht (sonst 409). So startet ein Doppelklick keinen zweiten Lauf.
- Die Function liest den Post mit dem JWT des Aufrufers (RLS entscheidet über den Zugriff) und meldet jeden Schritt in `ki_schritt`: `gestartet`, `bilder`, `ki`, `speichern`. Am Ende schreibt sie mit `service_role` Felder, `confidence`, `source = ki`, `status = draft` und `ki_status = null`. Scheitert der Lauf, steht `ki_status = 'fehler'` mit Text am Post, und `ki_schritt` zeigt, wo es passiert ist. Die Arbeitsliste zeigt „Fehler“ mit „Erneut versuchen“ und „Manuell eintragen“.
- **Lauf-Token:** Die Function schreibt nur, solange `ki_status = 'laeuft'` und `ki_gestartet_at` unverändert sind. Ein Abbruch, ein weiterer Screenshot oder „Erneut versuchen“ (der Client leert `ki_gestartet_at`, der Trigger setzt einen neuen Start) beendet den alten Lauf. Sein spätes Ergebnis fällt weg, vor dem Claude-Call hört er ganz auf.
- **Fristen:** Der Client fragt den Post alle 2 s ab. Steht er 20 s auf `wartet`, hat sich die Function nie gemeldet (Crash beim Laden, Sitzung weg), und der Lauf gilt als nicht gestartet. Nach 120 s gilt er als gescheitert. In beiden Fällen schreibt der Client den Fehler an den Post, aber nur, solange der Lauf noch läuft. Der Claude-Call selbst bricht nach 60 s ab. Steht ein Post beim Laden länger als 3 Minuten seit `ki_gestartet_at` auf `laeuft`, gilt er als Fehler.
- **Abbrechen:** Solange die KI liest, zeigt der Prüfbereich den Schritt, die Sekunden und „Abbrechen“. Abbrechen setzt `ki_status = 'fehler'` mit „Abgebrochen.“. War die Function schneller, bleibt ihr Ergebnis.
- **Konsole:** Der Client loggt jeden Lauf mit `[Auswertung KI <post-id>]`: Upload mit Größe vorher und nachher, HTTP-Status des Starts, jeden Schrittwechsel mit Zeit, Ende oder Fehler mit Schritt. Die Function loggt ihre Schritte mit Millisekunden in die Netlify-Logs.

## Verworfen

- **KI-Werte direkt bestätigen.** Die Bilder sind oft abgeschnitten oder zeigen ältere Stände. Eine falsch gelesene Ziffer ginge unbemerkt in den Report.
- **API gewinnt.** Die API kennt für Stories nichts, für Reels nur drei Felder, und ihr Zähler hinkt hinterher. Hätte sie Vorrang, würde ein späterer Abruf geprüfte Screenshot-Werte überschreiben.
- **Function setzt `laeuft` selbst.** Dann gäbe es zwischen Upload und Start keinen sichtbaren Zustand, und ein zweiter Start ließe sich nur über eine Sperre in der Function verhindern.
- **sharp in der Function behalten und beim lokalen Deploy Linux-Binaries nachinstallieren.** Jeder Deploy vom Mac müsste daran denken, sonst hängt der Lauf wieder still. Das Verkleinern im Browser macht zusätzlich den Upload kleiner.

## Folgen

- `confidence` heißt nach dem Bestätigen „aus dem Screenshot“, nicht mehr „unsicher“. Unsicher sind nur Werte unter 0,8 an einem Entwurf.
- Die Creator-Übersicht (`creatorSheetVideos.js`) zeigt noch `stats_views` vom Video, also den übernommenen Stand. Sie zieht um, wenn die Altfelder fallen.
