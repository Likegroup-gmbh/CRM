begin;

alter table public.auftrag_kampagnenart_blocks
  add column if not exists umsatz_netto numeric;

alter table public.auftrag_kampagnenart_blocks
  drop constraint if exists auftrag_kampagnenart_blocks_umsatz_nonnegative;

alter table public.auftrag_kampagnenart_blocks
  add constraint auftrag_kampagnenart_blocks_umsatz_nonnegative
  check (umsatz_netto is null or umsatz_netto >= 0);

-- Backfill: Auftraege mit genau einem Kampagnenart-Block bekommen den vollen
-- Auftrags-Nettobetrag als Umsatz zugeordnet (nur wo noch nichts gesetzt ist).
update public.auftrag_kampagnenart_blocks b
set umsatz_netto = a.nettobetrag
from public.auftrag a
where b.auftrag_id = a.id
  and b.umsatz_netto is null
  and a.nettobetrag is not null
  and a.nettobetrag > 0
  and (
    select count(*) from public.auftrag_kampagnenart_blocks b2
    where b2.auftrag_id = b.auftrag_id
  ) = 1;

commit;
