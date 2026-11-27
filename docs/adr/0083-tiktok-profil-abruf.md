# 0083 TikTok-Profilabruf im Casting

Im Casting holte nur Instagram Follower, Engagement und die Preise für 8 und 30 Videos automatisch, aus der Schnelleingabe und über den Button an der Link-Zelle. Ein TikTok-Link legte zwar einen Eintrag an, aber ohne Zahlen. Den Zugang zu TikTok über Apify (`clockworks~tiktok-scraper`) gab es bisher nur auf der Admin-Testseite `/admin/tiktok-api`.

## Entscheidung

- **Eine Function für den Profilabruf.** `netlify/functions/tiktok-profil.js` kennt die beiden Aktionen `starten` und `stand`.
  - Ziel ist eine Casting-Zeile (`item_id`) oder ein freier Link als Vorschau (`link`). Erlaubt ist das nur Staff, die Casting-Zeile muss der Aufrufer per RLS sehen dürfen.
  - Die Bausteine liegen in `netlify/functions/_shared/tiktok/` und teilen sich Apify-Zugang, Eingabe und Auswertung mit `tiktok-scraper.js`: `profil-abruf.js` (Lauf), `pool.js`, `profil-ziel.js` (Zeile schreiben), `kennzahlen.js`.
- **Polling vom Client.** Ein Profil-Lauf dauert 20 bis 60 Sekunden, eine Function darf 26.
  - Die Function wartet je Aufruf höchstens 10 Sekunden auf Apify. Ist der Lauf bis dahin nicht fertig, gibt sie `runId` zurück, und der Client fragt alle 1,5 Sekunden `stand` ab (`src/core/tiktok/apifyLauf.js`, `laufBisFertig`).
  - Wer den fertigen Lauf zuerst sieht, übernimmt ihn: Die Function rechnet, sichert das Profilbild, schreibt Pool und Zeile. Der Client aktualisiert danach nur die Anzeige. Verlässt man die Seite, läuft das Polling weiter, und die Zahlen stehen trotzdem in der Zeile.
- **Ein Einstieg für alle Seiten.** `tiktokProfilAbrufen({ itemId | link, force })` in `src/core/tiktok/tiktokProfil.js` kapselt Start, Polling und Fehler. Masterliste, Creator-Formular und spätere TikTok-Posts nutzen diesen Aufruf. Die Admin-Testseite pollt über dasselbe `laufBisFertig`.
- **Eigener Pool `sourcing_creator_tiktok`.** Ein Eintrag je TikTok-Handle (kleingeschrieben), geteilt über alle Listen, wie `sourcing_creator` vor Meta.
  - Der erste Klick übernimmt den Pool, wenn es ihn gibt und er mit der aktuellen Rechnung (`calc_version`) entstanden ist. Hat die Zeile schon einen Stand ohne Fehler, holt der Klick frisch (`force`).
  - Eine eigene Tabelle, weil `sourcing_creator.ig_username` NOT NULL ist und sich Instagram- und TikTok-Handle desselben Creators nicht verlässlich zuordnen lassen.
- **Rechnung wie bei Instagram.** Die Videos laufen über den Adapter `alsMedia` durch `computeInstagramCpm` und `computeEngagementRate`.
  - Es gelten dieselben Regeln für Werbung, für Videos jünger als 4 Tage und für Ausreißer. So bleiben die Preise beider Plattformen vergleichbar.
  - Angepinnte TikToks zählen nicht: Sie sind alt und meist die stärksten Videos. Abgefragt werden 40 Videos, damit nach den Ausschlüssen meist ein voller 30er-Schnitt bleibt.
  - TikTok kennt keine Trial-Reels, deshalb gibt es keinen Zweitwert „ohne Trials“.
- **Engagement-Rate mit denselben Ausschlüssen wie der Preis** (`_shared/instagram-engagement.js`, eine Formel für Casting und Creator-Datenbank).
  - Werbung, Posts jünger als 4 Tage und je ein Ausreißer nach oben und unten zählen nicht. Bis Version 8 flossen sie ein: Ein virales Video hob die Rate, frische Posts drückten sie.
  - Instagram teilt Likes und Kommentare durch die Follower, TikTok durch die Views (Summe durch Summe). TikTok verteilt über den For-You-Feed weit über die Follower hinaus, je Follower kämen Raten von 30 bis 50 % heraus, die nichts über die Interaktion sagen.
  - Die Zahlen beider Plattformen sind deshalb nicht direkt vergleichbar. Die Spaltenüberschrift sagt, worauf sich jede Zeile bezieht.
- **Link-Felder erkennen die Plattform** (`linkZiel` in `sourcingProfilPlattformen.js`). Ein TikTok-Link im Instagram-Feld landet beim TikTok-Profil und umgekehrt. Video- und Share-Links werden auf den Profil-Link gekürzt, weil der Abruf nur `/@name` versteht. `_speichereLink` ist der eine Speicherweg für Zelle, Abruf-Button und Schnelleingabe.
- **Plattformzeilen folgen den Daten.** Link, Follower und Engagement einer Plattform erscheinen, sobald ein Eintrag der Liste einen Link dieser Plattform hat, auch wenn das Preset sie versteckt (`mitPlattformenDerEintraege`). Sonst legte die Schnelleingabe in UGC-Listen TikTok-Einträge an, deren Zahlen niemand sah.
- **Felder an der Zeile.** `tt_views_8`, `tt_views_30`, `tt_stats`, `tt_fetched_at` und `tt_fetch_error` sind das Gegenstück zu `ig_*`. Die Follower landen im bestehenden `follower_tiktok`.
- **Schnelleingabe nur per Profil-Link.** Ein TikTok-Link legt den Eintrag an und startet den Abruf, ohne die Eingabe zu blockieren. Ein reines `@handle` bleibt Instagram. In reinen TikTok-Listen gibt es dafür einen Hinweis.
- **Gemeinsame Spalten.** Engagement, Preis 8 Videos und Preis 30 Videos sind wie Link und Follower gemeinsame Spalten mit einer Zeile je Plattform (`cp-col-engagement`, `cp-col-cpm-8`, `cp-col-cpm-30`).
  - Die alten Schlüssel `cp-col-engagement-ig`, `cp-col-cpm-ig-8` und `cp-col-cpm-ig-30` sind jetzt Zeilenschlüssel. Gespeicherte Reihenfolgen und Anker eigener Spalten zieht `ANKER_ALIASE` um.
  - `migrateHiddenColumns` versteckt die neuen TikTok-Zeilen, wenn der TikTok-Link versteckt war, und die Instagram-Engagement-Zeile, wenn der Instagram-Link versteckt war.
- **Zelle, Toolbar und Abruf sind je Plattform beschrieben** (`sourcingProfilPlattformen.js`), nicht doppelt gebaut. `CastingDetailProfilAbruf.js` hält das gemeinsame Gerüst (Link speichern, Ladezustand, Fehler an der Zeile) und je Plattform nur den eigentlichen Abruf.
- **Creator anlegen nimmt Instagram- und TikTok-Link** (`CreatorListFormStart.js`, `creatorProfilLaden.js`).
  - Ein bekannter Handle einer der beiden Plattformen öffnet den vorhandenen Creator und ergänzt den fehlenden Handle der anderen.
  - Sonst öffnet das Formular sofort, beide Vorschauen laden parallel. Ein TikTok-Lauf kann eine Minute dauern, und Typ, Branche oder Adresse kann man währenddessen schon ausfüllen.
  - Gesperrt (`inert`) sind nur die Felder, die ein laufender Abruf noch füllen kann. Ein freigegebenes Feld fasst kein Abruf mehr an. "Nicht abwarten" gibt alles frei.
  - Name, Mail, Telefon und Stadt kommen zuerst von Instagram. TikTok füllt nur, was Instagram leer gelassen hat, auch wenn TikTok zuerst fertig ist: Der TikTok-Name ist meist ein Spitzname.
  - Gespeichert werden `tiktok` und die genaue Zahl in `tiktok_follower`. Die creator-Tabelle hat keine `tt_*`-Spalten, Views und Engagement bleiben im Pool.

## Verworfen

- **Hintergrund-Function mit Webhook.** Damit fiele das Polling weg, aber Netlify-Background-Functions liefern kein Ergebnis zurück. Der Client müsste dann über Realtime oder erneutes Laden warten. Für einen Abruf, den jemand gerade per Klick ausgelöst hat, ist Polling einfacher und zeigt den Fortschritt.
- **TikTok in `sourcing_creator`.** Eine Zeile je Creator über beide Plattformen bräuchte eine verlässliche Zuordnung der Handles. Die gibt es nicht, und `ig_username` ist Pflicht.
- **`@handle` als TikTok erkennen.** Ein Handle ist ohne Link mehrdeutig. In gemischten Listen hieße das raten oder nachfragen, beides bremst die Schnelleingabe.
- **Eigene TikTok-Spalten für Engagement und Preise.** Drei weitere Spalten neben den Instagram-Spalten widersprächen den gestapelten Plattformzeilen und machten die Tabelle breiter, ohne mehr zu zeigen.

## Folgen

- Deploy-Reihenfolge:
  1. Migration `20261230_tiktok_profil_abruf.sql` (nur additiv, Rollback im Kopf).
  2. Functions und Client in einem Deploy.
- Netlify-Env `APIFY_TOKEN` muss gesetzt sein, sonst antwortet `tiktok-profil` mit 500.
- Jeder frische Abruf ist ein Apify-Lauf und kostet. Der Pool hält das klein, solange niemand ohne Grund frisch abruft.
- Wird die Rechnung geändert, `CALC_VERSION` in `_shared/instagram-cpm.js` hochzählen. Dann gilt der Pool beider Plattformen als veraltet.
- Mit der neuen Engagement-Rate steht `CALC_VERSION` auf 9. Der nächste Klick je Creator holt deshalb frisch (Meta-Budget, Apify-Lauf). Gespeicherte Raten an Zeilen und in der Creator-Datenbank ändern sich erst beim nächsten Abruf.
- Links, die vor der Erkennung im falschen Feld gelandet sind, bleiben dort.
