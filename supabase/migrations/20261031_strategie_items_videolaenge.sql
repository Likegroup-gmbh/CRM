-- Dauer an der Videoidee: Source of Truth fuer das Skript.
-- Das Briefing nennt die Videolaenge global (und bei Paid je Funnel-Stufe), die Videoidee
-- im Konzept hat die heruntergebrochene, finale Dauer. Sekunden, von und bis inklusive.
-- Leer heisst: keine Vorgabe an der Videoidee, das Skript faellt dann auf das Briefing zurueck.

alter table public.strategie_items
  add column if not exists videolaenge_von integer,
  add column if not exists videolaenge_bis integer;

alter table public.strategie_items
  drop constraint if exists strategie_items_videolaenge_check;

alter table public.strategie_items
  add constraint strategie_items_videolaenge_check
  check (
    (videolaenge_von is null and videolaenge_bis is null)
    or (
      videolaenge_von between 1 and 180
      and videolaenge_bis between videolaenge_von and 180
    )
  );

comment on column public.strategie_items.videolaenge_von is
  'Dauer der Videoidee in Sekunden (von, inklusive). Schlaegt das Briefing; leer = keine Vorgabe.';
comment on column public.strategie_items.videolaenge_bis is
  'Dauer der Videoidee in Sekunden (bis, inklusive). Gemeinsam mit videolaenge_von gesetzt oder leer.';

-- Bestand: wie videolaengeFuerStufe. Paid nimmt zuerst das Intervall der Funnel-Stufe,
-- sonst gilt die allgemeine Videolaenge des Briefings.
with quelle as (
  select
    si.id,
    case
      when b.bereich = 'paid_creator_ads'
        and si.funnel_stufe is not null
        and (b.videolaenge_funnel -> si.funnel_stufe ->> 'von') ~ '^\d+$'
        and (b.videolaenge_funnel -> si.funnel_stufe ->> 'bis') ~ '^\d+$'
      then (b.videolaenge_funnel -> si.funnel_stufe ->> 'von')::integer
      else b.videolaenge_von
    end as von,
    case
      when b.bereich = 'paid_creator_ads'
        and si.funnel_stufe is not null
        and (b.videolaenge_funnel -> si.funnel_stufe ->> 'von') ~ '^\d+$'
        and (b.videolaenge_funnel -> si.funnel_stufe ->> 'bis') ~ '^\d+$'
      then (b.videolaenge_funnel -> si.funnel_stufe ->> 'bis')::integer
      else b.videolaenge_bis
    end as bis
  from public.strategie_items si
  join public.strategie s on s.id = si.strategie_id
  join public.campaign_briefings b on b.id = s.briefing_id
  where si.videolaenge_von is null
    and si.videolaenge_bis is null
)
update public.strategie_items si
set videolaenge_von = q.von,
    videolaenge_bis = q.bis
from quelle q
where si.id = q.id
  and q.von between 1 and 180
  and q.bis between q.von and 180;
