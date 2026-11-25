# 0072 Video-Freigabe durch die Kundenseite im Videos-Tab

In der Kooperationstabelle steht hinter „Kunde Feedback 3“ die Checkbox „Freigabe“ (`kooperation_videos.freigabe`): der Kunde gibt das Video frei. Im Videos-Tab konnte die Kundenseite bisher nur kommentieren. Freigegeben hat dort nur das Team, über „Als finale Version freigeben“. Der Kunde musste also im Videos-Tab prüfen und in der Tabelle den Haken setzen, und die Finale Version fehlte, bis das Team nachzog.

## Entscheidung

- **Ein Klick je Video:** Die Kundenseite (Kunde oder Gast mit Feedback-Recht) sieht in der aktuellen Feedbackschleife „Video freigeben“. Der Button steht an drei Stellen:
  - unter dem Player, an der Stelle der Final-Leiste des Teams,
  - im Video-Detail unter „Nächster Schritt“,
  - im Ordner-Detail der Schleife.

  Eine Bestätigung nennt Video, Schleife und Anzahl der Dateien. Dateien ohne Standardformat zählt sie getrennt auf.
- **Flag und Finale Version zusammen:** Die Freigabe legt aus jeder Datei der Schleife eine Finale Version an (Referenzzeile wie beim Team, `source_asset_id`, gleiche Ablage) und setzt `freigabe = true`, in einer Transaktion. Videos und Stories bekommen ihr Seitenverhältnis aus den Pixelmaßen bzw. den Metadaten (9:16, 4:5, 1:1). Ohne erkanntes Format bleibt die Datei in der Schleife. Bilder brauchen kein Format.
- **RPC statt Client-Insert:** `freigeben_video_kunde(p_video_id, p_finals)` ist SECURITY DEFINER. Die Kundenseite hat auf `kooperation_video_asset`, `kooperation_story_asset` und `kooperation_bilder_asset` kein Insert-Recht und soll keins bekommen: dann könnte sie beliebige Zeilen anlegen. Die RPC prüft das Recht wie beim Video-Kommentar (`can_access_video_comment` oder `gast_can_access_video(..., true)`). Sie kopiert nur Quellen desselben Videos aus der höchsten Feedbackschleife und lehnt eine zweite Freigabe derselben Schleife ab (`HINT = 'bereits_freigegeben'`). Der Client schickt nur `{kind, source_id, slot}`, Datei- und Ablage-Felder liest der Server aus der Quelle.
- **Rückgängig:** Der Erfolgs-Toast bietet „Rückgängig“. `zuruecknehmen_video_kunde(p_video_id, p_ids, p_freigabe)` löscht nur Finals mit Quelle, die derselbe Benutzer in den letzten 2 Minuten angelegt hat, und setzt das Flag auf den Wert von vorher zurück. Danach nimmt nur das Team die Freigabe zurück.
- **Optimistisch:** Die Ansicht zeigt das Video sofort als freigegeben (temporäre Final-Zeilen). Schlägt die RPC fehl, verschwinden die Zeilen wieder und ein Toast erklärt den Fehler.
- **Live:** keine eigene Logik. Die Inserts erhöhen `kooperation_medien_stand`, das Flag ändert `kooperation_videos`. Beides lädt den Videos-Tab neu und setzt den Haken in der Kooperationstabelle (`VideoTableRealtimeHandler`, Spalte `freigabe`).
- **Final sperrt nichts:** Freigegeben ist die Schleife, aus der die Finale Version stammt. Die nächste leere Schleife bleibt für das Team sichtbar und beschreibbar, die letzte bleibt kommentierbar. Lädt das Team danach eine neue Schleife hoch, wartet sie wieder auf den Kunden und lässt sich erneut freigeben.

## Verworfen

- **Nur das Flag setzen.** Dann stünde im Videos-Tab weiter „Zu prüfen“, und das Team müsste die Finale Version von Hand nachziehen. Status und Haken liefen auseinander.
- **Freigabe je Datei.** Mehr Klicks, und der Kunde müsste verstehen, was eine Finale Version ist. Die Entscheidung des Kunden betrifft das Video, nicht die einzelne Datei.
- **Insert-Policy für Kunden auf den Asset-Tabellen.** Eine Policy könnte die Quelle und die Schleife nur schwer prüfen, und das Flag läge in einer zweiten, nicht atomaren Anfrage.
- **Formatwahl durch den Kunden.** Das Seitenverhältnis ist ein technisches Detail. Fehlt es, kümmert sich das Team.

## Folgen

- Deploy-Reihenfolge:
  1. Migration `20261214_video_kundenfreigabe.sql`. Rollback steht im Kopf der Datei.
  2. Client. Ohne die RPCs zeigt der Button nach dem Klick einen Fehler-Toast und rollt zurück.
- Vorhandene finale Bilder werden bei einer erneuten Freigabe nicht ersetzt. Die neuen kommen dazu.
- In SharePoint ändert sich nichts: die Finale Version verweist wie beim Team auf die Datei in der Feedbackschleife.
