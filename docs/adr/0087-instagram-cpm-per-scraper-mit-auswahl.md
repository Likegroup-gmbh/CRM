# 0087 Instagram-CPM per Scraper, mit sichtbarer Auswahl

Der Instagram-CPM kam bisher aus der Meta Business Discovery API (`_shared/instagram-cpm.js`). Meta liefert jedes Video, das der Creator hochlädt, auch Testvideos und Trial-Reels, und gibt für fremde Profile kein Flag dafür her. Die Rechnung lief komplett im Hintergrund: Mitarbeiter sahen nur das Ergebnis, nicht, welche Reels drin waren und welche als Ausreißer fielen. Das hat verunsichert.

## Entscheidung

- **Testseite `/admin/instagram-cpm` im Accounting-Bereich, nur Admins.** Sie speichert nichts. Das Casting rechnet weiter mit Meta, bis die Seite abgenommen ist.
- **Apify `apify/instagram-reel-scraper` statt Meta.** Es gilt derselbe `APIFY_TOKEN` wie beim TikTok-Scraper, der Actor lässt sich über `APIFY_INSTAGRAM_ACTOR` tauschen.
  - Der Input setzt `skipPinnedPosts` und `skipTrialReels`. Einstellungen in der Apify-Konsole gelten für API-Läufe nicht.
  - Abgerufen werden standardmäßig 50 Reels (12 bis 60), damit nach Vorfilter und Ausreißern genug zum Nachrücken da ist.
  - Views sind `videoPlayCount`, das ist der Wert, den Instagram als „Aufrufe“ zeigt. `videoViewCount` steht nur im Tooltip.
  - Function `instagram-reels-scraper` teilt sich den Ablauf mit `tiktok-scraper` (`_shared/tiktok/laufHandler.js`): starten, pollen, abbrechen.
- **Vorfilter auf dem Server** (`_shared/instagram-reels/ergebnis.js`). Was hier fällt, steht zugeklappt unter „Rausgefiltert“ mit Grund und zählt nie mit:
  - `werbung_verlinkt`: Werbe-Kennzeichnung (Caption-Marker aus `istWerbePost` oder Paid-Partnership-Label) und gleichzeitig ein fremder Account in Mentions, Caption-@, Tags, Sponsoren oder Co-Autoren. Steht nur „Anzeige“ ohne Verlinkung da, zählt das Reel mit und bekommt ein Badge.
  - `collab`: Co-Autor-Reel mit einem fremden Account, auch ohne Werbung. Die Reichweite beider Accounts läuft zusammen.
  - `angepinnt`, `kein_video`, `keine_views`.
  - Keine Altersregel. Anders als beim Meta-Rechner (4 Tage) zählt das neueste Reel sofort mit. Wer es zu frisch findet, wählt es ab.
- **Typische Range statt Nachbarschaftsregel** (`src/core/instagram/reelAuswahl.js`). Basis sind die 30 neuesten Kandidaten, unabhängig von der Auswahl.
  - Median M, Quartile Q1 und Q3. Die typische Range ist Q1 bis Q3.
  - Ausreißer nach oben ab `min(max(M × 2, Q3 × (Q3/Q1)^1,5), M × 5)`: der Tukey-Zaun auf der log-Skala, weil Views multiplikativ streuen, eingeklemmt zwischen Mindest- und Höchstfaktor. Eine enge Creatorin (200K bis 300K) liegt so bei etwa 500K, 700K und 1,2M fallen. Bei breiter Streuung (100K bis 400K) liegt die Grenze bei rund 890K.
  - Nach unten nur der Extremfall unter 5 % des Medians (300K Median, ein Reel mit 5 Views). Normale schwächere Reels bleiben.
  - Unter 5 Kandidaten wird nichts vorgeschlagen.
  - Die vier Werte lassen sich auf der Seite live verstellen („Regeln anpassen“).
- **Grid mit Auswahl, Rechnung erst auf Knopfdruck.**
  - Jede Kachel zeigt Thumbnail, Views, Kommentare, Likes und Datum.
  - Vorgeschlagene Ausreißer sind abgewählt. Ein Klick wählt jede Kachel an oder ab, „Vorschlag wiederherstellen“ setzt zurück.
  - Nachrücken: Die 30 neuesten ausgewählten Reels bilden den 30er, die 12 neuesten davon den 12er. Wer eins abwählt, zieht das nächstältere nach. Badges zeigen `12er`, `30er` und `außerhalb`.
  - „Berechnen“ rechnet mit genau der Auswahl und zeigt den Rechenweg: „Summe / Anzahl = Ø Views → Ø/1000 × TKP = Preis“, dazu die Liste der verwendeten Reels. Der Preis rechnet mit dem gerundeten Schnitt, damit der Rechenweg auf den Cent aufgeht. Ändert sich danach etwas, ist das Ergebnis als veraltet markiert.
- **Thumbnails über `instagram-bild`.** Das Instagram-CDN blockt Einbettungen auf fremden Seiten. Die Function lädt das Bild und gibt es selbst aus (Base64, Cache einen Tag).
  - Ein `<img>` schickt keinen Bearer-Token mit. Deshalb signiert der Scraper jede Bild-URL per HMAC mit einem Schlüssel aus `APIFY_TOKEN` (`_shared/instagram-reels/bildSignatur.js`).
  - Die Function nimmt nur signierte URLs von `*.cdninstagram.com` und `*.fbcdn.net` an, auch nach Weiterleitungen. So wird daraus kein offener Proxy.

## Verworfen

- **Meta behalten und nur die Anzeige verbessern.** Das Testvideo-Problem bleibt. Meta gibt für fremde Profile weder Trial- noch Partnership-Flags her.
- **Mit weniger Reels rechnen statt nachrücken.** Ein 30er aus 26 Reels ist kein 30er. Nachrücken hält die Stichprobe konstant, so wie beim bisherigen Rechner.
- **Collabs ohne Werbung mitzählen.** Die gemeinsame Reichweite zweier Accounts verzerrt den Schnitt nach oben.
- **Range aus der aktuellen Auswahl.** Dann verschiebt jedes Abwählen die Grenzen, und der Vorschlag dreht sich im Kreis.
- **Thumbnails als Data-URL in der Scraper-Antwort.** 50 Bilder in voller Größe sprengen die 6 MB, die eine Netlify-Antwort haben darf.

## Folgen

- Jeder Lauf kostet bei Apify Geld. Der Kostendeckel `APIFY_MAX_USD` gilt auch hier.
- Thumbnail-URLs des CDN laufen nach einigen Tagen ab. Für die Testseite reicht das, für gespeicherte Stände bräuchte es eine Kopie.
- Der Reel-Scraper liefert keine Follower-Zahl. Falls nötig, später über `apify/instagram-profile-scraper`.
- Offen für die Übernahme ins Casting: Auswahl und Rechenweg je Creator speichern, und der Pool bekommt eine neue `calc_version`.
