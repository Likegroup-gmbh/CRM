# 0064 Das Poster ist abgeleitete Datei; der Browser cacht Bytes, nicht URLs

Der Showcase lud für jede Kachel das Original aus Dropbox: bei Videos einen Temp-Link und dann so viel vom Video, bis das erste Bild da war (Canvas), bei Stills das ganze Bild. Bei 30 bis 40+ Kacheln geschah das in jeder Sitzung neu, gecacht war nur der Temp-Link. Im Ordner blieb der Player bis zum ersten Frame schwarz. Beim letzten Versuch mit Signed URLs wurden die URLs selbst gespeichert, liefen ab, und die Bilder verschwanden nach einiger Zeit.

## Entscheidung

- Das **Poster** ist ein Standbild als WebP, höchstens 480 px breit, im privaten Bucket `video-posters`. System of Record bleibt das Original in Dropbox. Das Poster ist daraus abgeleitet: wegwerfbar und jederzeit neu erzeugbar. Es gibt Poster für alle vier Item-Typen im Videos-Tab (Video, Story, Still, Rohmaterial).
- Schlüssel ist `(file_path, revision)` wie in ADR 0061. Die Revision ist `created_at` der Asset-Zeile, bei einer übernommenen Finalen Version die ihrer Quelle (`source_asset_id`). Sie wird live in der View `poster_soll` berechnet (`poster_revision`: UTC, Mikrosekunden), nicht gespeichert. Der Pfad im Bucket ist `sha256(file_path \n revision)`, also eine Datei je Schlüssel, und der Upload per Upsert ist idempotent. Replace ergibt eine neue Revision und damit ein neues Poster; das alte ist sofort unsichtbar und wird später geräumt.
- **Abgleich statt Outbox:** `poster_soll` ist der Soll-Zustand (jede Asset-Zeile mit Bild- oder Videoendung), `asset_poster` der Ist-Zustand. Was fehlt, wird erzeugt, was keiner mehr braucht, wird gelöscht. Kein Trigger und kein Hook in den Upload-, Replace- oder Löschpfaden. Bestand, neue Uploads, Replace und Retries laufen über denselben Weg.
- Erzeugt wird nur auf dem Server, in `poster-erzeugen-background` (Background Function, 15 Minuten, Budget 12 Minuten; ist danach noch etwas offen, stößt sie sich einmal selbst an). Quelle ist Dropbox `files/get_thumbnail_batch` (25 Dateien je Call, `w480h320`, `fitone_bestfit`, JPEG). Danach bringt sharp das Bild auf WebP (EXIF-Drehung, 480 px, q72).
- Geholt werden die Aufträge über `poster_auftraege_holen`. Ein Advisory Lock serialisiert parallele Läufe. Die Lease dauert 5 Minuten, höchstens 75 Aufträge sind gleichzeitig in Arbeit, und Read-Repair-Zeilen kommen zuerst dran. Jeder Claim erhöht `versuche`. Der Abschluss schreibt nur, wenn `versuche` noch dem Stand des Claims entspricht (Fencing).
- Fehlerbehandlung:
  - Permanente Fehler (`path`, `unsupported_extension`, `unsupported_image`, `encrypted_content`) oder 3 Versuche führen zu `failed`.
  - Sonst gilt Backoff: 60 s · 2^(n−1).
  - Ein Batch-Fehler (429, 5xx, Token) gibt die Lease frei, ohne einen Versuch zu verbrauchen, und hält `Retry-After` ein.
- `poster-abgleich` (Scheduled, alle 5 Minuten) räumt Verwaiste aus Tabelle und Bucket (nach 1 Stunde Schonfrist), liest `poster_stand()` und stößt den Erzeuger an, wenn etwas offen ist. Scheduled Functions haben nur 30 Sekunden, deshalb läuft die Arbeit selbst im Erzeuger.
- **Read-Repair:** `poster-urls` legt fehlende Schlüssel per `upsert … ignoreDuplicates` an und stößt den Erzeuger nur an, wenn wirklich neue Zeilen entstanden sind. So bekommt der erste Betrachter sein Poster nach Sekunden statt erst nach dem nächsten Abgleich, auch auf Branch-Deploys.
- **Zugriff:** `poster-urls` nimmt alle sichtbaren Kacheln in einem Call (höchstens 200, intern in Blöcken von 100). Die Asset-Zeilen liest die Function mit dem JWT des Aufrufers, also unter RLS (Team, Kunde, Gast). Nur was der Aufrufer sieht, bekommt eine Signed URL, und die gilt 600 s. Tabelle, Views und RPCs sind nur für `service_role`.
- **Client (`PosterCache`):**
  - Er speichert die Bytes (Blob) in IndexedDB (`crm-poster`) unter `{typ}:{id}:{created_at}`, nie die URL. Höchstens 5000 Einträge werden nach `lastAccess` verdrängt, und `lastAccess` wird höchstens einmal am Tag aktualisiert.
  - Fehlende Poster sammelt er 30 ms lang (höchstens 100) zu einem Call.
  - `ausstehend` sperrt eine Datei für 30 s, `ohne` für 10 Minuten.
  - Ist eine URL abgelaufen, holt er einmal eine frische.
  - Antwortet `poster-urls` mit 404, bleibt der Cache für die Sitzung aus.
- Der Showcase zeigt das Poster als `<img>`. Ohne Poster greift der bisherige Weg (Original, Canvas-Frame, höchstens 4 parallel). Der Ordner-Player setzt das Poster als `poster`-Attribut, sofort aus dem Speicher oder nachgereicht, solange noch kein Bild der Datei da ist. `_prefetchMedia` holt die Poster der Nachbarn mit.

## Verworfen

- **Signed URLs mit langer Laufzeit cachen.** Das ist genau der alte Fehler: Die URL läuft ab, das Bild ist weg. Eine Laufzeit von Wochen macht daraus faktisch öffentliche Links, die sich nicht zurückziehen lassen.
- **Öffentlicher Bucket.** Es geht um Creator-Material für Kunden. Ohne RLS-Prüfung bliebe ein einmal geteilter Link für immer gültig.
- **Poster im Browser erzeugen und hochladen.** Der erste Betrachter müsste das Original laden. Das wäre ein Dual Write aus dem Client heraus. Safari liefert bei HEVC im Canvas teils schwarze Frames, und der Client würde über geteilte Daten entscheiden.
- **Hook im Upload-Job oder Outbox-Trigger (wie ADR 0061).** Es gibt sechs und mehr Schreibpfade, darunter `creator-upload-finalize` auf dem Server, und der Bestand bräuchte trotzdem einen Backfill. Der Abgleich deckt alles mit einem Mechanismus ab. Eine Outbox wäre schneller (Sekunden statt bis zu 5 Minuten), aber diese Lücke schließt der Read-Repair.
- **ffmpeg in der Function.** Ein Binary von etwa 70 MB, und bei `.mov` liegt das `moov`-Atom oft am Ende, also wäre ein Voll-Download nötig. Dropbox rendert das Standbild serverseitig, ohne dass wir das Original laden.
- **Service Worker mit Cache API.** Der Cache-Key wäre die signierte URL, und die wechselt bei jeder Ausgabe. IndexedDB mit einem Key aus dem Inhalt ist deterministisch und einfacher.
- **Schlüssel `asset_id`.** Siehe ADR 0061: Promote würde doppelt erzeugen, Replace ein veraltetes Poster liefern.

## Folgen

- Deploy-Reihenfolge:
  1. Migration `20261129_asset_poster.sql` (noch nicht remote angewendet).
  2. Functions und Env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, Dropbox-Zugang, optional `POSTER_SECRET`. Ohne `POSTER_SECRET` wird es aus dem Service-Key abgeleitet.
  3. Client.

  Alte Bundles ignorieren alles. Ein neuer Client ohne die Function bekommt 404 und zeigt das Original.
- Scheduled Functions laufen nur auf dem veröffentlichten Production-Deploy. Auf Branch-Deploys entstehen Poster nur über den Read-Repair.
- Der erste Abgleich auf Production ist der Backfill des Bestands (gut 3.900 Videoassets plus Bilder, 25 je Dropbox-Call). Rate Limits von Dropbox fangen BatchError und `Retry-After` ab.
- **Offen aus dem Spike:** Ein Live-Test war lokal nicht möglich (Token-Refresh mit `invalid_client`). Für Videos ist `get_thumbnail_batch` nicht dokumentiert. Jede Datei hält ihr Ergebnis in `asset_poster.fehler`. Auswertung nach dem ersten Lauf:

  ```sql
  select poster_art(file_path) as art, status, fehler, count(*)
  from asset_poster group by 1, 2, 3 order by 4 desc;
  select * from poster_stand();
  ```

  Scheitern Videos mit `dropbox:unsupported_extension`, wird nur `thumbnails` im Generator ausgetauscht: ffmpeg oder, nach dem Wechsel zu SharePoint, Graph-Thumbnails. Vorab mit gültigen Credentials testen: `node scripts/poster-spike.mjs /tmp/poster-spike /Pfad/a.mov /Pfad/b.mp4`.
- Beim Wechsel des Speichers (SharePoint) bleibt der Schlüssel `file_path + revision`. Ändern sich die Pfade, entstehen alle Poster neu, und die alten verwaisen und werden geräumt.
- Wird die Quelle einer Finalen Version gelöscht, fällt die Revision auf das eigene `created_at` zurück. Die Finale Version bekommt dann ein eigenes Poster.
- `failed` bleibt `failed`. Für einen neuen Versuch reicht `delete from asset_poster where status = 'failed' …`; Abgleich und Read-Repair legen die Schlüssel neu an.
- Grenze im Browser: Der Key `{typ}:{id}:{created_at}` folgt nicht der Revision der Quelle. Wird die Quelle einer Finalen Version ersetzt, ohne dass sich `created_at` der Finalen ändert, kann ein Browser das alte Poster zeigen, bis der Eintrag verdrängt wird. Das ist dieselbe Grenze wie bei `MediaCache`; der Server liefert richtig.
- Der Canvas-Fallback im Showcase behält `preload='auto'`, weil Safari bei `metadata` `loadeddata` nicht verlässlich feuert. Die Quelle wird nach dem ersten Bild sofort freigegeben.
- Speicher (Schätzung): etwa 20 bis 40 KB je Poster, für den Bestand also grob 100 bis 200 MB im Bucket.
