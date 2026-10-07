# Casting-Bestand startet mit den meistgebuchten Creatorn und zeigt ihre Brands

Der Casting-Bestand dient dazu, bewährte Creator für das nächste Casting zu finden. Die Beste steht oben, und man sieht ohne Klick, für wen sie schon produziert haben.

## Entscheidung

Die Startsortierung ist Produktion absteigend (Anzahl Kooperationsdatensätze, Tiebreaker „Zuletzt“). Der RPC-Default von `get_casting_bestand` ist ebenfalls `produktionen`. Unbekannte Sortierfelder fallen weiter auf „Zuletzt“ zurück.

Die Spalte „Brands“ steht nach „Produktion“ und vor „Zuletzt“, sortierbar (`p_sort = 'marken'`, Anzahl eindeutiger Marken, erster Klick absteigend) und zeigt Avatar-Bubbles der Marken, mit denen der Creator produziert hat. Quelle sind die Kooperationen des Creators über `kampagne.marke`. Dieselbe Marke zählt einmal, auch bei mehreren Produktionen. Neueste Kooperation zuerst. Zeilen ohne Creator-Datensatz haben keine Kooperationen und damit keine Brands. Die RPC liefert dazu `marken` (`id`, `markenname`, `logo_url`, `logo_thumb_url`).

Die Spalte „Alter“ steht nach „Typen“ und vor „Insta“, ohne Sortierung. Sie zeigt wie die Creator-Liste die Spanne (`alter_min`-`alter_max`), einen Einzelwert oder das alte `alter_jahre`. Casting-Einträge kennen kein Alter, Zeilen ohne Creator-Datensatz zeigen `-`.

Instagram und TikTok stehen je als Link-Spalte (Kopf nur „Insta“ und „TikTok“) vor der Follower-Spalte, nur als Plattform-Icon, ohne URL-Text. Creator liefern meist nur den Handle, daraus wird die Profil-URL gebaut. Bei Zeilen ohne Creator liefert die RPC den jüngsten `link_tiktok` der Casting-Einträge.

## Verworfene Alternativen

- Instagram-Werbepartner (`ig_brand_mentions`) als Brands. Das Creator-Grid mischt sie in die Kooperationsreihe, hier zählt nur, was in der Plattform produziert wurde.
- „Zuletzt“ als Startsortierung behalten. Der neueste Eintrag sagt nichts über die Bewährung des Creators.
