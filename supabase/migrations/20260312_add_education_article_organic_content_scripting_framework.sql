begin;

do $$
declare
  v_slug text := 'organic-content-scripting-framework';
  v_title text := 'Organic Content Scripting Framework';
  v_short_description text := 'Struktur fuer performante Social-Media-Skripte mit klarem Hook, Story-Logik, Formatdenken und Interaktionsfokus.';
  v_content text := $md$
# Organic Content Scripting Framework

Organischer Content funktioniert nur dann, wenn es einen klaren Grund gibt, weiterzuschauen.
Menschen entscheiden in Sekunden, ob sie bleiben oder weiterscrollen.

Deshalb muss direkt am Anfang klar sein:
Warum lohnt sich dieses Video?

Organischer Content performt typischerweise ueber zwei Mechaniken:
- Entertainment
- Mehrwert / Education

Wenn ein Video weder unterhaltsam noch hilfreich ist, performt es selten stabil.

---

## 1) Zielgruppe und Thema wirklich verstehen

Der Ausgangspunkt jedes Scripts ist ein tiefes Zielgruppenverstaendnis.

Es geht nicht nur ums Produkt, sondern um:
- Probleme
- Alltagssituationen
- Trends
- Erfahrungen
- haeufige Fragen

Typischer Fehler:
Themen aus Markenlogik statt aus Zielgruppeninteresse.

Hilfreiche Leitfrage:
Wie wuerde ein echter Nischencreator dieses Thema seiner Community erklaeren?

---

## 2) Der Hook muss den Grund liefern weiterzuschauen

Der Einstieg muss sofort beantworten:
- Worum geht es?
- Warum ist es relevant?
- Warum lohnt es sich dranzubleiben?

Ein klarer Einstieg hilft zusaetzlich dem Algorithmus, den Content passender auszuspielen.

### Schwache Hooks (vermeiden)
- "Heute moechte ich euch etwas zeigen."
- "Ich habe etwas entdeckt."
- "Ich wollte euch kurz etwas erklaeren."
- "Viele Menschen wissen nicht, dass ..."

Diese Einstiege sind oft zu langsam, zu generisch und ohne Spannung.

### Starke Hook-Muster
1. **Education/Mehrwert direkt benennen**
   - "Die drei groessten Fehler bei ..."
   - "Warum die meisten bei ... scheitern"
   - "Das eigentliche Problem bei ... ist ..."

2. **Ergebnis frueh zeigen**
   - Kochvideo: fertiges Gericht zu Beginn
   - DIY: Endergebnis vor dem Prozess
   - Transformation: vorher/nachher direkt zeigen

---

## 3) Entertainment oder Mehrwert liefern

### Entertainment
Der Zuschauer bleibt wegen Unterhaltung:
- lustig
- ueberraschend
- emotional
- trendbasiert
- relatable

### Mehrwert / Education
Der Zuschauer bleibt, weil er etwas mitnimmt:
- Wissen
- Tipps
- Erkenntnisse
- Problemlosungen
- Inspiration

Jedes Script sollte klar priorisieren, welche der beiden Mechaniken dominiert.

---

## 4) Story statt glatter Praesentation

Ein haeufiges Problem ist glatter, austauschbarer Content ohne Situation.

Starker Organic Content zeigt meist:
- konkrete Situationen
- reale Erfahrungen
- Beobachtungen
- kleine Geschichten

Story macht Content greifbar, merkbar und teilbar.

---

## 5) Formatdenken

Erfolgreiche Kanaele arbeiten mit wiederkehrenden Formaten:
- POV
- Storytime
- Ranking
- Reactions
- Experimente
- Tutorials

Formatlogik hilft:
- Wiedererkennbarkeit aufzubauen
- schneller neue Skripte zu entwickeln
- konsistent zu produzieren

Kein klares Format fuehrt oft zu beliebigem Content ohne Wiederholbarkeit.

---

## 6) Interaktion mitdenken

Social Plattformen belohnen Content, der Reaktionen ausloest.

Deshalb schon im Script planen:
Warum sollten Menschen kommentieren, teilen oder diskutieren?

Interaktions-Trigger:
- Fragen
- Diskussionsthemen
- kontroverse Aussagen
- relatable Situationen
- ueberraschende Meinungen

Mehr Emotion und Meinung fuehren oft zu hoeherer Interaktionsrate.

---

## 7) Haeufige Fehler im Organic Scripting

1. Themen ohne echtes Zielgruppeninteresse  
2. Kein klarer Grund weiterzuschauen in den ersten Sekunden  
3. Zu generische Hooks  
4. Weder Entertainment noch Mehrwert  
5. Keine konkrete Situation/Story  
6. Kein klares Contentformat  
7. Zu stark geskriptet, unnatuerliche Creator-Performance  
8. Zu werblich statt nativer Social-Content  
9. Kein Interaktionspotenzial  
10. Zu glatt, ohne Twist/Emotion/Ueberraschung

---

## Operatives Skript-Framework

1. Zielgruppen-Insight + Thema definieren
2. Hook-Optionen entwickeln und priorisieren
3. Mechanik festlegen (Entertainment vs Mehrwert)
4. Story-Situation konkretisieren
5. Format-Template waehlen (POV, Ranking, Storytime etc.)
6. Interaktions-Trigger integrieren
7. In Produktion testen, Learnings dokumentieren, naechste Skripte iterieren

Ergebnis:
Mehr Watchtime, hoehere Interaktion und konsistent bessere Organic-Performance.
$md$;
  v_category_id uuid;
  v_article_id uuid;
  v_tag_names text[] := array[
    'Organic Content',
    'Content Scripting',
    'Hook',
    'Storytelling',
    'Formatanalyse',
    'Interaktion',
    'Social Media',
    'Content Strategie',
    'Test and Learn'
  ];
begin
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
-- select id, title, slug, status from public.education_articles where slug = 'organic-content-scripting-framework';
-- select a.slug, t.name
-- from public.education_article_tags at
-- join public.education_articles a on a.id = at.article_id
-- join public.education_tags t on t.id = at.tag_id
-- where a.slug = 'organic-content-scripting-framework'
-- order by t.name;

commit;
