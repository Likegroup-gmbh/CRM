-- Funnel-Stufe an der Videoidee: Source of Truth fuer das Skript.
-- Das Briefing nennt die Stufen grob (Mehrfachauswahl), die Videoidee hat genau eine.
-- Leer heisst: keine Vorgabe. Das Skript liest das Briefing dafuer nicht mehr.

alter table public.strategie_items
  add column if not exists funnel_stufe text;

alter table public.strategie_items
  drop constraint if exists strategie_items_funnel_stufe_check;

alter table public.strategie_items
  add constraint strategie_items_funnel_stufe_check
  check (funnel_stufe is null or funnel_stufe in ('upper', 'mid', 'lower'));

comment on column public.strategie_items.funnel_stufe is
  'Funnel-Stufe der Videoidee (upper, mid, lower). Schlaegt das Briefing; leer = keine Vorgabe.';

-- Bestand: nur Paid-Linien, deren Briefing genau eine Stufe nennt.
update public.strategie_items si
set funnel_stufe = b.pa_funnel_stufen[1]
from public.strategie s
join public.campaign_briefings b on b.id = s.briefing_id
where si.strategie_id = s.id
  and si.funnel_stufe is null
  and b.bereich = 'paid_creator_ads'
  and coalesce(array_length(b.pa_funnel_stufen, 1), 0) = 1
  and b.pa_funnel_stufen[1] in ('upper', 'mid', 'lower');
