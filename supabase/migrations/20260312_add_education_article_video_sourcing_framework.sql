begin;

do $$
declare
  v_slug text := 'video-sourcing-content-strategy-framework';
  v_title text := 'Video Sourcing & Content Strategy Framework';
  v_short_description text := 'Ein praxisnaher Prozess, um aus Zielgruppenanalyse und Creator-Research wiederholbar starke Videoideen abzuleiten.';
  v_content text := $md$
# Video Sourcing & Content Strategy Framework

Das Ziel dieses Frameworks ist nicht einfach Content zu produzieren.  
Das Ziel ist, systematisch zu verstehen, welche Videos eine Zielgruppe wirklich konsumiert - und daraus funktionierende Videoideen und Formate abzuleiten.

Viele Marken produzieren Content nach Bauchgefuehl.  
Erfolgreiche Social-Strategien entstehen dagegen durch strukturierte Analyse, Mustererkennung und kontinuierliches Lernen aus Performance.

---

## 1) Zielgruppe wirklich verstehen

Der Ausgangspunkt jeder Contentstrategie ist das Contentverhalten der Zielgruppe.  
Es reicht nicht, nur Produkt und Angebot zu verstehen.

Entscheidend ist:
- Welche Inhalte konsumiert die Zielgruppe taeglich?
- Welche Formate und Storytypen dominieren den Feed?
- Welche Emotionen triggern Reaktionen?
- Welche Probleme, Sehnsuechte und Einwaende kommen immer wieder?

Analysiere dafuer gezielt:
- TikTok-Feeds der Zielgruppe
- Instagram Reels
- YouTube Shorts
- Meme- und Trendseiten der Nische
- relevante Creator-Profile

---

## 2) Top-Creator der Nische analysieren

Der schnellste Weg, erfolgreiche Muster zu erkennen, ist die Analyse der Creator, die in der Nische bereits konstant performen.

Untersuche:
- welche Videos wiederholt viral gehen
- welche Hooks regelmaessig genutzt werden
- welche Dramaturgien sich wiederholen
- welche Formate zu hoher Interaktion fuehren

Wichtig: Viele starke Creator arbeiten nicht mit staendig neuen Konzepten, sondern mit 2-4 wiederkehrenden Formaten, die sie iterativ verbessern.

---

## 3) Erfolgreiche Content-Formate identifizieren

Ein Format beschreibt die Struktur eines Videos, nicht nur das Thema.

Typische Formate:
- POV Story
- Tutorial
- Ranking
- Myth Busting
- Reaction
- Street Interview
- Before/After
- "3 Dinge, die du falsch machst"

Ziel in diesem Schritt:
- dominierende Formate finden
- unterrepraesentierte Formate erkennen
- moegliche White-Spaces fuer neue Formate entdecken

---

## 4) Virale Videos systematisch recherchieren

Jetzt startet das eigentliche Sourcing.

Methoden:
- Hashtag-Recherche
- Creator-to-Creator-Recherche
- Sound- und Trend-Monitoring

Beispiele fuer Hashtag-Startpunkte:
- `#gymtok`
- `#skincare`
- `#streetstyle`
- `#datingtips`

Priorisiere Videos mit:
- hohen Views
- starkem Kommentarvolumen
- auffaellig vielen Shares

Kommentaraktivitaet ist ein Schluesselsignal, weil sie zeigt, dass ein Video echte Reaktionen und Diskussion ausloest.

---

## 5) Erfolgsfaktoren je Video analysieren

Jedes relevante Video wird wie eine Case Study zerlegt:

### Hook
- Warum stoppt das Video den Scroll?
- Provokation, starke Frage, Ueberraschung oder Problem-Statement?

### Struktur
Typisches Muster:
1. Hook
2. Kontext / Spannungsaufbau
3. Information oder Demonstration
4. Ergebnis / Reveal

### Emotion
Welche Emotion treibt die Interaktion?
- Neugier
- Humor
- Empoerung
- Ueberraschung
- Inspiration

### Format
In welcher Darreichung wird geliefert?
- Talking Head
- Voice Over
- POV
- Demonstration
- Interview

### Kommentare
Die Kommentarspalte zeigt oft:
- Fragen und Einwaende
- echte Triggerpunkte
- Diskussionspotenzial
- Wiederholungsmuster fuer neue Videoideen

---

## 6) Muster erkennen

Nach einer ausreichenden Stichprobe werden Pattern sichtbar.

Beispielhafte Muster:
- Fitness: "Top Fehler im Gym", Transformationen, POV-Situationen
- Beauty: GRWM, Skincare-Mythen, Produktreviews

Diese Muster sind die Basis fuer planbare Contentproduktion statt Zufallstreffern.

---

## 7) Eigene Videoideen entwickeln

Aus den Erkenntnissen ergeben sich zwei Wege:

### A) Variation bestehender Gewinnerformate
Beispiel:
- Original: "3 Fehler im Gym"
- Variation: "3 Fehler, die dich schwaecher aussehen lassen"
- Variation: "3 Fehler, die fast jeder Anfaenger macht"

### B) Neue Formate in der Nische aufbauen
Wenn klare Referenzen fehlen oder eine Positionierungsluecke besteht:
- Street Interviews
- Social Experiments
- Creator Challenges
- POV Storylines

Wichtig ist nicht Kopie, sondern funktionale Adaption auf Marke, Produkt und Zielgruppe.

---

## 8) Haeufige Fehler im Video Sourcing

Typische Bremsen:
1. Contentproduktion ohne vorgelagerte Analyse
2. Keine klar definierten Formate
3. Referenzvideos ohne echten Proof (niedriges Engagement)
4. Fokus nur auf grosse Influencer statt uebertragbarer Cases
5. Virale Videos kopieren ohne Erfolgsfaktoren zu verstehen
6. Nur Themen kopieren, nicht Struktur/Hook/Spannung
7. Kleine, entscheidende Nuancen unbewusst veraendern
8. Keine marken- und zielgruppengerechte Adaption
9. Analyse bleibt oberflaechlich
10. Kein strukturiertes Test-and-Learn nach der Ausspielung

---

## Umsetzungs-Blueprint fuer die Praxis

Nutze den folgenden Ablauf als operatives System:
1. Woechentliche Recherche-Slots fuer Sourcing einplanen
2. Top-Videos in einer strukturierten Datenbank erfassen
3. Pro Video Hook, Struktur, Emotion, Format und Kommentar-Insights dokumentieren
4. Muster monatlich clustern
5. Ideen-Backlog mit Variationen und Prioritaeten pflegen
6. Content in klaren Format-Serien produzieren
7. Performance auswerten und Formate iterativ schaerfen

Ergebnis: Mehr planbare Treffer, weniger Content-Zufall.
$md$;
  v_category_id uuid;
  v_article_id uuid;
  v_tag_names text[] := array[
    'Video Sourcing',
    'Content Strategie',
    'Hook',
    'Formatanalyse',
    'Social Media',
    'Test and Learn'
  ];
begin
  -- Bevorzugte Kategorie "Strategie"; falls nicht vorhanden, erste verfuegbare Kategorie nutzen
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
-- 1) Artikel vorhanden?
-- select id, title, slug, status from public.education_articles where slug = 'video-sourcing-content-strategy-framework';
--
-- 2) Tags am Artikel?
-- select a.slug, t.name
-- from public.education_article_tags at
-- join public.education_articles a on a.id = at.article_id
-- join public.education_tags t on t.id = at.tag_id
-- where a.slug = 'video-sourcing-content-strategy-framework'
-- order by t.name;

commit;
