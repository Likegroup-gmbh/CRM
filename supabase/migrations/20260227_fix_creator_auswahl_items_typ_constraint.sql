-- creator_auswahl_items.typ: neue Taxonomie + Übergangs-Kompatibilität
-- Root Cause: UI sendet neue Typwerte, DB-Constraint erlaubte nur Legacy-Werte.

begin;

-- 1) Constraint für neue + Legacy-Werte öffnen (NULL bleibt erlaubt)
alter table public.creator_auswahl_items
  drop constraint if exists creator_auswahl_items_typ_check;

alter table public.creator_auswahl_items
  add constraint creator_auswahl_items_typ_check
  check (
    typ is null
    or typ = any (
      array[
        'UGC Pro Paid'::text,
        'UGC Pro Organic'::text,
        'UGC Video Paid'::text,
        'UGC Video Organic'::text,
        'Influencer'::text,
        'Vor-Ort-Produktion'::text,
        'Videograf'::text,
        'Model'::text,
        -- Legacy-Übergang (wird später entfernt)
        'IGC'::text,
        'UGC'::text
      ]
    )
  ) not valid;

alter table public.creator_auswahl_items
  validate constraint creator_auswahl_items_typ_check;

-- 2) Bestehende Legacy-Daten in neue Taxonomie überführen
-- Mapping-Regel:
-- UGC -> UGC Video Organic
-- IGC -> Influencer
update public.creator_auswahl_items
set typ = case
  when typ = 'UGC' then 'UGC Video Organic'
  when typ = 'IGC' then 'Influencer'
  else typ
end
where typ in ('UGC', 'IGC');

commit;
