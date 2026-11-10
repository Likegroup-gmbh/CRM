# Video-Tags hängen an der Variante; Detailbereich in Regionen und Tabs

Im Video-Tab bekommt jede Variante (`variantKey`, z. B. `videoA`) frei vergebbare Tags (Hook, Plattform, Stil …). Sie liegen in zwei neuen Tabellen: `video_tag_typen` (Katalog mit Gruppe, optional auf eine Kampagne begrenzt) und `video_variante_tags` (Zuordnung Variante ↔ Tag). Finale Versionen erben die Tags über den `variantKey`; sie sind eigene Zeilen (ADR-0017) und tragen keine eigenen Tags. Neue Tags landen in der Gruppe „Eigene“ mit Kampagnen-Scope. Eindeutig ist `lower(label)` pro Scope, ein Doppelinsert (23505) zählt als Erfolg.

Der Detailbereich wird in Regionen gerendert (`head`, `meta`, `preview`, `final`, `tabs`). Ein Teil-Render ersetzt nur geänderte Regionen, der Player wird nie neu gemountet. Der Titel-Kopf bleibt beim Umbenennen stehen, die Tabs bei fokussiertem Textfeld.

## Considered Options

- **Tags am Asset (Datei/Version).** Würde bei jeder neuen Version oder Final-Zeile Tags verlieren oder duplizieren; Filter pro Variante wären nicht möglich.
- **Tags als Freitext-Array an der Variante.** Kein Katalog, keine Vorschläge, Schreibweisen driften.
- **Bestehende `kooperation_tag_typen` / `creator_tags` wiederverwenden.** Andere Bedeutung (Kooperation bzw. Creator), andere RLS-Kreise.
- **Detail komplett neu rendern.** Einfacher, setzt aber Player, Fokus und laufende Eingaben zurück.

## Abweichungen von den Specs (`video-tab-final-und-tags`, `video-tab-detailbereich`)

- Final bleibt das ADR-0017-Modell (eigene Zeile pro Seitenverhältnis, `source_asset_id`, mehrere erlaubt). Kein Format-Umschalter, keine „Neue Version“-Zeile, keine Stern-Badges in Contact Sheet und Versionsverlauf.
- Kein Kunden-Entscheidungsblock (Freigeben / Änderungen / Aussortieren).
- Löschen behält Bestätigungsdialog und Hard Delete, bekommt nur die Einklapp-Animation.
- Ad-Manager-Name behält das echte Dropbox-Umbenennen; dazu Live-Vorschau „Wird zu: …“, Kopieren-Button und Hinweis-Toast bei Bereinigung.
- „Aus Finale Version entfernen“ = Markierung aufheben, ohne Dialog, mit Einklapp-Animation. Rückgängig über Toast.
- Kunde startet im Tab „Kommentare“, Team in „Details“. Tab „Ad Manager“ nur für Team und Videos mit `file_path`. Die Tab-Leiste erscheint erst ab zwei Tabs. `detailTab` gilt global, nicht pro Item.
- Titel ist per Klick editierbar (kein Doppelklick mehr), Taste E wie Klick.

## Consequences

- Tastenkürzel: `E` Titel, `F` Final umschalten (nicht im Player, dort gehört `F` dem Vollbild), `T` Tag-Feld (wechselt in Details). Alle sind in Eingabefeldern deaktiviert.
- Final-Umschalten ist optimistisch mit Rollback bei Fehler; temporäre Zeilen heißen `tmp-<sourceId>-<slot>`. Bei unklarem Format fragt ein Slot-Menü.
- Tag-Filter ist pro Ordner (`vb.filter = {folderId, value}`), nicht persistent.
- Migration `20261128_video_tags.sql` mit RLS für Staff, Gast, Agent und Testunternehmen. Sie ist nicht remote angewendet.
- `ToastSystem` kennt jetzt eine Aktion („Rückgängig“) und 5 s Standzeit für solche Toasts.
