-- creator_auswahl_items.typ: CHECK temporaer wieder oeffnen
--
-- Hintergrund: Der Kampagnenarten-Merge (20260817_merge_kampagnenarten) hat den
-- CHECK auf die 6 kanonischen Werte verengt. Das laufende Frontend-Bundle schickt
-- aber noch Legacy-Typen (z.B. "UGC Pro Paid"), deshalb schlagen Inserts mit
-- 23514 fehl. Bis das neue Bundle live ist, erlaubt der CHECK die Legacy-Werte
-- wieder. Das Frontend mappt sie beim Schreiben bereits auf die kanonischen
-- Werte (creatorTypeOptions.js -> canonicalizeCreatorTyp).
--
-- Nach dem Frontend-Deploy diese Migration durch eine erneute Verengung auf die
-- 6 kanonischen Werte ersetzen.

begin;

alter table public.creator_auswahl_items
  drop constraint if exists creator_auswahl_items_typ_check;

alter table public.creator_auswahl_items
  add constraint creator_auswahl_items_typ_check
  check (
    typ is null
    or typ = any (
      array[
        'UGC Paid'::text,
        'UGC Organic'::text,
        'Influencer'::text,
        'Vor-Ort-Produktion'::text,
        'Videograf'::text,
        'Model'::text,
        -- Legacy-Uebergang bis Frontend-Deploy
        'UGC Pro Paid'::text,
        'UGC Video Paid'::text,
        'UGC Pro Organic'::text,
        'UGC Video Organic'::text,
        'UGC'::text,
        'IGC'::text
      ]
    )
  );

commit;
