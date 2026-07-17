begin;

do $$
declare
  v_slug text := 'paid-ad-scripting-framework';
  v_title text := 'Paid Ad Scripting Framework';
  v_short_description text := 'Framework fuer performante Social Ad Scripts entlang der Funnel-Logik mit starken Hooks, Story-Struktur, nativer Sprache und klarer CTA.';
  v_content text := $md$
# Paid Ad Scripting Framework

Ein gutes Ad-Script funktioniert wie ein gutes Social Video:
relevant, verstaendlich und natuerlich erzaehlt.

Ziel eines Scripts:
- Aufmerksamkeit gewinnen
- die richtige Zielgruppe direkt abholen
- ein klares Problem oder einen klaren Wunsch zeigen
- eine Loesung praesentieren
- eine Handlung ausloesen

---

## 1) Funnel zuerst definieren

Bevor ein Script geschrieben wird, muss klar sein:
Fuer welche Funnel-Stufe ist das Video?

Jede Funnel-Stufe braucht eine andere Dramaturgie.

### Upper Funnel
Ziel: Aufmerksamkeit und Interesse.

Typische Ansaetze:
- Storytelling
- Unterhaltung
- Alltagssituationen
- ueberraschende Beobachtungen

Produkt steht hier noch nicht im Mittelpunkt. Fokus liegt auf Thema, Situation und Story.

### Mid Funnel
Ziel: Problemverstaendnis + Loesungsbruecke.

Das Script muss zeigen:
- welches Problem existiert
- warum es frustriert
- warum bisherige Loesungen nicht greifen
- wie das Produkt konkret hilft

Je praeziser der Schmerzpunkt, desto hoeher die Identifikation.

### Low Funnel
Ziel: Conversion.

Noetig sind klare Kaufargumente + starkes Angebot:
- Rabatt
- zeitliche Limitierung
- Bundle
- exklusiver Deal

Das Offer darf und sollte oft schon in der Hook auftauchen.

---

## 2) Der Hook entscheidet alles

Die ersten Sekunden entscheiden ueber Watch oder Scroll.

Ein Hook muss:
- sofort relevant sein
- sofort verstaendlich sein
- sofort Interesse ausloesen

Regel:
Der wichtigste Punkt des Videos gehoert so frueh wie moeglich nach vorne.

### Visueller Einstieg statt Standard-Satz
Nicht jeder Hook ist nur Text.
Visuelle Key-Elemente funktionieren oft besser:
- ungewoehnliche Situation
- sichtbares Problem
- ueberraschendes Ergebnis
- klare Alltagsszene

### Schwache Hooks (vermeiden)
- "Kennst du das...?"
- "Viele Menschen haben das Problem..."
- "Ich moechte euch heute etwas zeigen..."
- "Heute zeige ich euch ein Produkt..."
- "Ich habe etwas Neues entdeckt..."

Diese sind haeufig zu generisch, zu langsam und ziehen oft die falsche Zielgruppe an.

### Starke Hooks
Typisch:
- konkret
- ueberraschend
- emotional
- direkt im Thema

---

## 3) Gute Ads erzaehlen eine Story

Der groesste Fehler vieler Scripts:
Produktvorteile nur aufzaehlen.

Besser ist eine klare Mini-Dramaturgie:
1. Situation (Problem)
2. Konflikt (Frustration/Schmerz)
3. Loesung (Produkt)
4. Transformation (Ergebnis)
5. Call to Action (naechster Schritt)

So entsteht Story statt klassischer Werbetext.

---

## 4) USPs immer in Story-Kontext einbauen

USPs ueberzeugen selten als reine Behauptung.

Starkes Muster:
1. Alltagssituation mit Problem
2. Produktanwendung
3. sichtbarer Nutzen/Ergebnis

So wird ein USP erlebbar statt nur behauptet.

---

## 5) Social Content statt Werbetext

Viele Scripts scheitern, weil sie wie klassische Werbung klingen.

Praxis-Test:
Wuerde ein Creator dieses Script auf dem eigenen Kanal posten?

Wenn nein, ist das Script oft zu werblich.
Starke Ads integrieren sich in den natuerlichen Content-Flow der Plattform.

---

## 6) Zielgruppe wirklich verstehen

Ein gutes Script startet immer mit:
Was beschaeftigt diese Zielgruppe wirklich?

Typische Trigger:
- Problem
- Wunsch
- Frustration
- Alltagssituation

Je praeziser der Trigger, desto staerker das Script.

---

## 7) Haeufige Fehler im Paid Scripting

1. Zu werbliche Sprache  
2. Keine klare Story  
3. USPs werden nur aufgelistet  
4. Schmerzpunkt zu oberflaechlich  
5. Generische Hooks  
6. Wichtigster Punkt kommt zu spaet  
7. Funnel-Stufe wird ignoriert  
8. Kein klares Offer im Low Funnel  
9. Script klingt nicht nach Creator-Sprache  
10. Keine klare Handlung am Ende

---

## Operatives Paid-Scripting-Setup

1. Funnel-Ziel pro Creative festlegen
2. Core-Hook und Offer-Prioritaet definieren
3. Story-Template (Situation -> Konflikt -> Loesung -> Transformation -> CTA) ausfuellen
4. Script auf natuerliche Creator-Sprache trimmen
5. Hook-Varianten testen
6. Gewinner iterieren und pro Funnel-Stufe getrennt weiterentwickeln

Ergebnis:
Bessere Scroll-Stops, klarere Botschaften und mehr Conversion pro Creative.
$md$;
  v_category_id uuid;
  v_article_id uuid;
  v_tag_names text[] := array[
    'Paid Ads',
    'Paid Scripting',
    'Hook',
    'Storytelling',
    'Funnel Strategie',
    'Conversion Trigger',
    'Creative Strategie',
    'Social Media',
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
-- select id, title, slug, status from public.education_articles where slug = 'paid-ad-scripting-framework';
-- select a.slug, t.name
-- from public.education_article_tags at
-- join public.education_articles a on a.id = at.article_id
-- join public.education_tags t on t.id = at.tag_id
-- where a.slug = 'paid-ad-scripting-framework'
-- order by t.name;

commit;
