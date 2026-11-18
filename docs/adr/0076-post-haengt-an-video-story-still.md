# 0076 Post hängt an Video, Story oder Still und nennt die Datei

Die Auswertung braucht Zahlen je Veröffentlichung. Ein Kooperationsvideo hat oft mehrere Finale Versionen (9:16, 4:5, 1:1, ADR 0017), und dieselbe Datei kann auf mehreren Plattformen laufen. Die Spec des Auswertungs-Tabs hängt die Zahlen an das finale Asset, also an die einzelne Datei. Heute stehen `stats_*` je Kooperationsvideo.

## Entscheidung

- **Anker:** Ein Post gehört zu genau einem Kooperationsvideo, einer Story oder einem Still. Er nennt zusätzlich die gepostete Finale Version. So bekommt jede Datei eigene Zahlen: die 4:5 auf TikTok und die 9:16 auf Instagram sind zwei Posts desselben Videos.
- **„Fehlt“ zählt pro Video, Story oder Still:** Erledigt ist die Einheit, sobald sie einen bestätigten Post hat. Ein nie gepostetes Seitenverhältnis (etwa die 1:1 nur für Anzeigen der Marke) erzeugt keinen offenen Eintrag.
- **Paid:** Linien mit Briefing-Typ Paid erwarten keine Posts, ihre Videos zählen nicht als „Fehlt“. Nachtragen geht trotzdem (Collab-Post, Spark Ads).
- **Datei weg, Post bleibt:** Wird die genannte Finale Version ersetzt oder abgewählt, verliert der Post nur den Dateiverweis, nicht seine Zahlen.

## Verworfen

- **Post an der einzelnen Datei, „Fehlt“ pro Datei.** Drei Videos mit je drei Seitenverhältnissen ergeben neun offene Einträge, obwohl dreimal gepostet wurde. Jede ungepostete Datei müsste per „Wird nicht gepostet“ weggeklickt werden. Ein Replace oder Abwählen ließe die Zahlen ohne Anker zurück.
- **Nur am Kooperationsvideo ohne Dateiverweis.** Dann ließe sich nicht sagen, welches Seitenverhältnis wo lief.

## Folgen

- Persona- und Ansatz-Tags hängen an der Datei (`variant_key`). Die Auswertung vereinigt die Tags aller Finalen Versionen einer Einheit.
- Direkt hochgeladene Finale Versionen haben keine Quelle und damit keine Tags. Das muss vor dem echten Report gelöst sein, sonst landen sie unter „Ohne Persona“.
