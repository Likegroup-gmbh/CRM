# 0061 Die Vorschaudatei ist abgeleitete Datei, das Original bleibt System of Record

Der Videos-Tab spielte die Originale direkt aus Dropbox. 1.126 von 3.909 Videoassets sind `.mov` vom Handy (hohe Bitrate, oft HEVC). Dazu lief ein zweiter Voll-Download desselben Videos als Blob, und mitten in der Wiedergabe wurde auf diesen Blob umgeschaltet. Folge: lange Ladezeiten, Abbruch nach 1 bis 2 Sekunden, Ruckler. Ziel ist p95 erstes Bild unter 1,5 s und kein Stall in den ersten 60 s (Desktop, Team und Kunden). Gemessen wird in echten Sessions (`media_wiedergabe_messung`, Auswertung `media_wiedergabe_perzentile`, getrennt nach Quelle und Format).

## Entscheidung

- Abgespielt wird eine **Vorschaudatei** bei Cloudflare Stream (MP4 über `downloads/default.mp4`). Der Download liefert immer das Original. Die Vorschaudatei ist eine Funktion des Originals: wegwerfbar und jederzeit neu erzeugbar.
- Schlüssel ist Quelle + Pfad + Revision (`kooperation_video_vorschau`), nicht die Asset-Zeile. Revision ist `created_at` der Asset-Zeile, bei einer übernommenen Finalen Version die ihrer Quelle (`source_asset_id`). Sie wird live berechnet (`vorschau_quelle_revision`), nicht gespeichert. Replace überschreibt den Dropbox-Pfad und setzt `created_at` neu, also entsteht eine neue Revision. Die View `kooperation_video_vorschau_je_asset` joint über die aktuelle Revision, eine alte Vorschaudatei ist damit sofort unsichtbar.
- Aufträge kommen aus einer Outbox. Ein Trigger auf `kooperation_video_asset` schreibt in derselben Transaktion `erzeugen` bzw. `loeschen` nach `kooperation_video_vorschau_auftrag`. Keiner der sechs Upload- und vier Löschpfade wurde geändert, der Client ruft nach dem Upload nichts auf.
- `vorschau-verarbeiten` konsumiert die Outbox. Angestoßen wird es per Database Webhook, ein Sweeper alle 2 Minuten ist das Sicherheitsnetz. Der Claim (`vorschau_auftraege_holen`) arbeitet mit SKIP LOCKED, einer Lease von 2 Minuten und höchstens 3 parallelen Aufträgen. Liegen beim Anbieter 10 Videos in Arbeit, pausiert das Erzeugen. Der Abschluss schreibt nur mit passendem `versuche` (Fencing). Fehler laufen mit Backoff 30 s · 2^(n−1), höchstens 30 Minuten; nach 5 Versuchen oder einem permanenten Fehler ist der Auftrag `failed`.
- Zustellung ist überall at-least-once, die Wirkung idempotent. Der Upsert läuft auf den Schlüssel. Die uid wird nur gesetzt, wenn sie leer ist, sonst wird das Duplikat beim Anbieter gelöscht. Der Webhook schreibt nur seinen Datensatz; dasselbe Ereignis zweimal ändert nichts. `ready` heißt: MP4 fertig und ein signierter Range-Abruf geht durch. Dauer, Bildrate und Auflösung stammen aus der Datei.
- `vorschau-link` nimmt alle Assets eines Ordners in einem Call. Die Function prüft unter der RLS des Aufrufers (Team, Kunde, Gast) und signiert lokal (RS256 mit Signing Key, 4 Stunden). `anbieter_id` ist für Clients nicht lesbar. Zwischen Klick und erstem Bild liegt kein Cloudflare-Call.
- Der Player nimmt die Vorschaudatei nur bei `ready`, sonst das Original. Während der Wiedergabe schaltet er nie um. Scheitert die Vorschaudatei, lädt er einmal das Original an derselben Stelle. Nachbarn laden nur `preload=metadata`, und das erst nach `canplaythrough` des aktiven Videos.
- Rollout-Schalter `app_schalter.vorschau_wiedergabe` (`team`, `kunde`): Aus heißt sofort Original, ohne Deploy.
- Nur neue Uploads bekommen eine Vorschaudatei. Ein Löschauftrag entfernt das Video beim Anbieter erst, wenn keine Asset-Zeile mehr auf den Schlüssel zeigt.

## Verworfen

- **Vorschau neben dem Original in Dropbox, später SharePoint, mit eigenem ffmpeg.** Koppelt die abgeleitete Datei an einen Speicher, der gerade wechselt. Transkodieren sprengt Laufzeit und Speicher einer Netlify Function.
- **Der Client stößt nach dem Upload an.** Das ist ein Dual Write: Tab zu, Netz weg oder einen der sechs Schreibpfade vergessen, dann fehlt die Vorschau, ohne dass es jemand merkt. `creator-upload-finalize` läuft serverseitig und hätte einen eigenen Aufruf gebraucht.
- **Schlüssel `asset_id`.** Promote legt für dieselbe Datei eine neue Zeile an, es würde also doppelt transkodiert. Replace behält die id bei neuer Datei, das ergibt eine veraltete Vorschau.
- **Revision als Spalte an der Asset-Zeile.** Jeder Schreibpfad müsste sie pflegen. Live berechnet folgt sie Replace und Promote von selbst.
- **HLS statt MP4.** Braucht einen anderen Player, dabei hängen Bild-Schritt und Zeitkommentare am `<video>`-Element. MP4 läuft ohne Umbau.
- **Mux.** Bleibt die Alternative mit expliziter 1080p-Rendition, falls `default.mp4` bei Cloudflare im Spike nicht passt.

## Folgen

- Deploy-Reihenfolge: erst die Migration, dann Functions, Env und Webhooks (Database Webhook auf INSERT der Outbox, Cloudflare-Webhook), zuletzt der Client. Alte Bundles ignorieren die neuen Tabellen und spielen das Original.
- Ohne `pg_net` gibt es keinen Database Webhook. Dann arbeitet nur der Sweeper, und die Vorschaudatei kommt bis zu 2 Minuten später.
- Wird die Quelle einer Finalen Version gelöscht, verliert die Finale Version ihre Vorschaudatei (Schlüssel über die Quelle) und spielt das Original.
- Der Bestand bleibt ohne Vorschaudatei. Nachrüsten oder ein neues Encoding-Profil heißt: Aufträge `erzeugen` für eine Menge Schlüssel anlegen.
- Der Cloudflare-Webhook gilt für das ganze Konto. Videos ohne `meta.vorschau_id` fasst der Worker nicht an.
- Cloudflare rechnet gespeicherte und ausgelieferte Minuten ab. Das Vorwärmen bleibt deshalb auf Metadaten begrenzt.
- Offen bis zum Spike (`scripts/vorschau-spike.mjs`): Auflösung und Bitrate von `default.mp4` sind nicht dokumentiert, außerdem fehlt der Nachweis, dass der signierte Abruf mit `downloadable` klappt. Der Schalter `kunde` geht erst danach an.
- Die AVV mit Cloudflare für Creator-Material ist noch zu klären.
