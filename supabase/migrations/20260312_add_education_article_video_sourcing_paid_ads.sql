begin;

do $$
declare
  v_slug text := 'video-sourcing-fuer-paid-ads';
  v_title text := 'Ergaenzung zum Framework: Video Sourcing fuer Paid Ads';
  v_short_description text := 'Wie du Video Sourcing fuer Paid Ads mit Ads Libraries, klaren Bewertungskriterien und systematischer Iteration auf Conversion ausrichtest.';
  v_content text := $md$
# Ergaenzung zum Framework: Video Sourcing fuer Paid Ads

Die Grundlogik bleibt identisch:
- Zielgruppe verstehen
- Creator der Nische analysieren
- funktionierende Content-Formate identifizieren
- virale Videos analysieren
- eigene Videoideen entwickeln

Der Unterschied bei Paid Ads liegt vor allem in:
- zusaetzlichen Recherchequellen
- anderen Bewertungskriterien
- deutlich staerkerer Iteration

---

## 1) Zusaetzliche Recherchequelle: Ads Libraries

Bei Paid Ads wird die Recherche um Plattform-Ads-Libraries erweitert, z. B.:
- TikTok Ads Library
- Meta Ads Library

Hier analysierst du gezielt:
- welche Creatives aktuell live sind
- welche Creatives Wettbewerber nutzen
- welche Anzeigen ueber laengere Zeit aktiv bleiben

Ein zentraler Indikator ist die Laufzeit:
Wenn ein Creative lange aktiv bleibt, ist das oft ein Signal fuer stabile Profitabilitaet.

---

## 2) Konkurrenzanzeigen systematisch analysieren

Neben organischem Content wird die Wettbewerbsanalyse zur Pflicht.

Untersuche:
- verwendete Hooks
- eingesetzte Videoformate
- Produktintegration (wie frueh, wie klar, wie nativ)
- Messaging-Struktur (Problem -> Loesung -> Offer -> Call to Action)

Ziel:
Verstehen, welche Creative-Strukturen im Markt bereits funktionieren - und wo Differenzierung moeglich ist.

---

## 3) Organische Videos bleiben zentrale Inspirationsquelle

Auch bei Paid Ads bleiben organische Gewinner-Formate entscheidend.
Viele starke Ads basieren auf Inhalten, die zuerst organisch viral gegangen sind.

Typische Quellen:
- Hashtag-Recherche
- Creator-Recherche
- virale Nischenvideos

Diese liefern oft:
- starke native Hooks
- natuerliche Story-Strukturen
- authentische Formate, die wie Plattform-Content wirken

---

## 4) Die drei Quellen fuer starke Ad-Creatives

Die Creative-Recherche fuer Paid Ads basiert auf drei Saeulen:

1. **Ads Libraries**  
   Bestehende Anzeigen mit Performance-Indizien.

2. **Organische Videos**  
   Virale Content-Formate aus der Zielnische.

3. **Eigene Ideen**  
   Neue Varianten, die aus Musteranalyse + Positionierung entstehen.

Die hohe Trefferquote entsteht erst aus der Kombination aller drei Quellen.

---

## 5) Bewertungskriterien bei Ads

Bei Ads gelten andere Bewertungslogiken als bei rein organischem Content.

Neben Aufmerksamkeit zaehlen:
- Klarheit der Botschaft
- schnelle Produktintegration
- klar erkennbare Problemlosung
- Conversion-Trigger
- stringente Story-Struktur

Ads muessen nicht nur konsumiert werden - sie muessen Verhalten ausloesen.

---

## 6) Hook-Testing und Iteration als Kernprozess

Der groesste Hebel im Paid-Umfeld ist systematisches Testen.

Eine Videoidee wird in Varianten produziert, z. B. mit:
- unterschiedlichen Hooks
- verschiedenen Einstiegen
- alternativen Story-Winkeln

Ziel:
Die Variante finden, die sowohl Aufmerksamkeit als auch Conversion maximiert.

Praktisch bedeutet das:
- Gewinner-Hooks skalieren
- schwache Varianten frueh stoppen
- klare Learnings in naechste Produktion uebertragen

---

## 7) Haeufige Fehler im Video Sourcing fuer Ads

1. Nur Ads Libraries nutzen und organischen Content ignorieren  
2. Ads kopieren statt Erfolgsstruktur zu verstehen  
3. Creatives ohne echten Performance-Proof als Referenz waehlen  
4. Nur grosse Marken/Creator analysieren (geringe Uebertragbarkeit)  
5. Hooks nicht variieren  
6. Produktintegration kommt zu spaet  
7. Funktionierende Strukturen zu stark veraendern  
8. Keine Performance-Analyse nach Ausspielung  
9. Keine Iteration erfolgreicher Creatives  
10. Ads wirken zu werblich statt nativ-social

---

## Operatives Setup fuer Performance-Creatives

So setzt du das als Prozess auf:
1. Woechentliches Sourcing aus Ads Libraries + organischen Quellen
2. Referenz-Creatives nach Hook, Format, Offer und CTA strukturieren
3. Pro Creative mehrere Hook-Varianten produzieren
4. Testset mit klaren KPI-Schwellen ausspielen
5. Gewinner iterieren (nicht neu erfinden)
6. Lernarchiv aufbauen, damit jedes neue Creative auf echtem Proof basiert

Ergebnis:
Mehr planbare Creative-Wins, weniger Zufall und schnellere Lernzyklen im Paid-Kanal.
$md$;
  v_category_id uuid;
  v_article_id uuid;
  v_tag_names text[] := array[
    'Video Sourcing',
    'Paid Ads',
    'Ads Library',
    'Creative Strategie',
    'Hook',
    'Hook Testing',
    'Test and Learn',
    'Conversion Trigger',
    'Performance Marketing'
  ];
begin
  -- Bevorzugte Kategorie fuer Strategie/Marketing-Inhalte
  select c.id
    into v_category_id
  from public.education_categories c
  where lower(c.name) in ('strategie', 'content strategie', 'social media', 'marketing')
  order by c.sort_order nulls last, c.name
  limit 1;

  if v_category_id is null then
    select c.id
      into v_category_id
    from public.education_categories c
    order by c.sort_order nulls last, c.name
    limit 1;
  end if;

  if v_category_id is null then
    raise exception 'Keine Kategorie in education_categories gefunden. Bitte zuerst mindestens eine Kategorie anlegen.';
  end if;

  insert into public.education_articles (
    title,
    slug,
    short_description,
    content,
    category_id,
    status
  )
  values (
    v_title,
    v_slug,
    v_short_description,
    v_content,
    v_category_id,
    'published'
  )
  on conflict (slug) do update
    set title = excluded.title,
        short_description = excluded.short_description,
        content = excluded.content,
        category_id = excluded.category_id,
        status = excluded.status,
        updated_at = now()
  returning id into v_article_id;

  insert into public.education_tags (name)
  select tag_name
  from unnest(v_tag_names) as tag_name
  on conflict (name) do nothing;

  delete from public.education_article_tags
  where article_id = v_article_id;

  insert into public.education_article_tags (article_id, tag_id)
  select v_article_id, t.id
  from public.education_tags t
  join unnest(v_tag_names) as tag_name
    on lower(t.name) = lower(tag_name)
  group by t.id;
end
$$;

-- Validierungsabfragen (nach Migration ausfuehren)
-- select id, title, slug, status from public.education_articles where slug = 'video-sourcing-fuer-paid-ads';
-- select a.slug, t.name
-- from public.education_article_tags at
-- join public.education_articles a on a.id = at.article_id
-- join public.education_tags t on t.id = at.tag_id
-- where a.slug = 'video-sourcing-fuer-paid-ads'
-- order by t.name;

commit;
