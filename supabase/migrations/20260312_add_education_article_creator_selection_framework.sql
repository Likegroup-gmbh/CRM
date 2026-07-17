begin;

do $$
declare
  v_slug text := 'creator-selection-framework';
  v_title text := 'Creator Selection Framework';
  v_short_description text := 'Ein praxisnaher Auswahlprozess, um fuer jede Contentidee den passenden Creator nach Format-Fit, Authentizitaet, Zielgruppen-Fit und Wirtschaftlichkeit zu finden.';
  v_content text := $md$
# Creator Selection Framework

Die Auswahl der Creator ist ein zentraler Bestandteil jeder Content-Produktion.
Ziel ist nicht die Person mit der groessten Reichweite, sondern der beste Fit fuer die konkrete Videoidee.

Entscheidend sind:
- Format-Fit
- Content-Faehigkeit
- Zielgruppen-Fit
- Authentizitaet
- Preis-Leistungs-Verhaeltnis
- realistische Verfuegbarkeit

---

## 1) Videoidee und Format zuerst definieren

Bevor Creator recherchiert werden, muss klar sein, welcher Content konkret produziert werden soll.

Definiere zuerst:
- Videoidee
- Contentformat
- Contentstil
- Zielplattform

Typische Formate:
- Talking Head
- POV Story
- Produktdemonstration
- UGC Testimonial
- Street Interview
- Silent Demonstration

Leitfrage:
Welche Art Creator kann genau diese Idee glaubwuerdig umsetzen?

---

## 2) Passende Creator-Nischen identifizieren

Im zweiten Schritt wird festgelegt, welche Creator-Nischen zum Produkt und zur Botschaft passen.

Beispiele:
- Fitnessprodukt -> Fitness Creator
- Beautyprodukt -> Beauty Creator
- Techprodukt -> Tech Creator
- Lifestyleprodukt -> Lifestyle Creator

Der Creator muss im Produktkontext glaubwuerdig wirken - nicht nur "irgendwie Reichweite" haben.

---

## 3) Creator-Recherche auf mehreren Kanaelen

Relevante Quellen:
- Creator-Plattformen (z. B. Infludata)
- TikTok Creator Search
- Instagram Creator Search
- Hashtag-Recherche
- Analyse viraler Nischenvideos

Gesucht werden Creator, die:
- aehnliche Formate bereits produzieren
- regelmaessig posten
- Kameraerfahrung mitbringen

---

## 4) Creator nach Format-Faehigkeit bewerten

Der wichtigste Faktor ist die Umsetzungsfaehigkeit im gewuenschten Format.

Pruefkriterien:
- **Format-Erfahrung:** hat der Creator aehnliche Videos erfolgreich produziert?
- **Kamera-Praesenz:** wirkt die Performance natuerlich und authentisch?
- **Sprechfaehigkeit:** kann der Creator klar und ueberzeugend vermitteln?
- **Storytelling:** kann er Inhalte strukturiert aufbauen?
- **Editing-Stil:** passt der Schnitt zur gewuenschten Formatlogik?
- **Authentizitaet:** passt die Person glaubwuerdig zu Produkt und Zielgruppe?

---

## 5) Den Creator-Sweetspot finden

Der beste Creator liegt oft zwischen zwei Extremen:

- **Zu gross:** haeufig teuer, oft unflexibel
- **Zu klein:** teils wenig Erfahrung, teils schwankende Qualitaet

Sweetspot:
Micro- oder Nischen-Creator, die kameraerfahren sind, regelmaessig Content produzieren und wirtschaftlich effizient einsetzbar sind.

---

## 6) Creator realistisch validieren

Vor internem Pitch oder Kundenvorschlag muss geprueft werden:
- Ist der Creator grundsaetzlich verfuegbar?
- Liegt der Creator im Budgetrahmen?
- Ist die Zusammenarbeit operativ realistisch?

Vermeide Shortlists mit Creatorn:
- die noch nicht angefragt wurden
- die klar ueber Budget liegen
- die aktuell nicht verfuegbar sind

Ziel:
Eine belastbare, realistische Creator-Shortlist.

---

## 7) Creator passend zu Contentideen einsetzen

Nicht jeder Creator passt zu jeder Videoidee.

Beispiele:
- Talking Head -> sichere Sprech-Performance noetig
- POV Story -> situatives Storytelling noetig
- Produktdemo -> verstaendliche Erklaerfaehigkeit noetig
- Silent/Visual -> starke visuelle Darstellung noetig

Creator sollten immer anhand bereits gezeigter Formatkompetenz eingesetzt werden.

---

## 8) Haeufige Fehler bei der Creator-Auswahl

1. Creator auswaehlen ohne Bezug zur Videoidee  
2. Random Outreach ohne Formatpruefung  
3. Nur nach Followern entscheiden  
4. Creator buchen, die das Format nicht beherrschen  
5. Zu grosse oder zu kleine Creator ohne Fit-Check waehlen  
6. Unvalidierte Creator an Kunden kommunizieren  
7. Creator falsch zu Contentideen zuordnen  
8. Neue Creator ohne ausreichende Qualitaetspruefung einsetzen  
9. Zielgruppen-Fit ignorieren  
10. Erfolgreiche Creator nicht erneut einsetzen

Zusatzhebel:
Bestehende Creator-Inhalte systematisch analysieren und bereits performende "Winning Formats" gemeinsam erneut produzieren oder weiterentwickeln.

---

## Operativer Prozess fuer Creator Selection

1. Pro Videoidee zuerst Format- und Stil-Briefing fixieren
2. Potenzielle Creator aus mehreren Quellen clustern
3. Kandidaten per Scorecard (Format-Fit, Kamera, Sprache, Authentizitaet, Budget, Verfuegbarkeit) bewerten
4. Realistische Shortlist bauen und vorqualifizieren
5. Passende Creator den jeweiligen Contentideen zuordnen
6. Nach Produktion Performance je Creator/Format dokumentieren
7. Winning Creator-Format-Paare priorisiert wiederholen

Ergebnis:
Hoehere Content-Qualitaet, besserer Format-Fit und planbarere Performance statt Reichweiten-Lotterie.
$md$;
  v_category_id uuid;
  v_article_id uuid;
  v_tag_names text[] := array[
    'Creator Selection',
    'Creator Recherche',
    'Format Fit',
    'Zielgruppen Fit',
    'Authentizitaet',
    'UGC',
    'Video Sourcing',
    'Formatanalyse',
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
-- select id, title, slug, status from public.education_articles where slug = 'creator-selection-framework';
-- select a.slug, t.name
-- from public.education_article_tags at
-- join public.education_articles a on a.id = at.article_id
-- join public.education_tags t on t.id = at.tag_id
-- where a.slug = 'creator-selection-framework'
-- order by t.name;

commit;
