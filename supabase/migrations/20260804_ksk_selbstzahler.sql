begin;

-- KSK-Selbstzahler: Creator, die die Kuenstlersozialabgabe selbst abfuehren,
-- erhalten pro Kooperation einen Aufschlag (4,9% vom EK-Netto) on top.
-- Hinweis: unabhaengig von rechnung.ksk_pflichtig (Contracting-Flag) und
-- auftrag.ksk_value / auftrag_details.ksk_* (KSK-Topf des Auftrags).

alter table public.creator
  add column if not exists ksk_selbstzahler boolean;

update public.creator
set ksk_selbstzahler = false
where ksk_selbstzahler is null;

alter table public.creator
  alter column ksk_selbstzahler set default false;

alter table public.creator
  alter column ksk_selbstzahler set not null;

comment on column public.creator.ksk_selbstzahler
  is 'True, wenn der Creator die KSK-Abgabe selbst zahlt (Aufschlag auf Kooperations-EK)';

alter table public.kooperationen
  add column if not exists ksk_selbstzahler boolean;

update public.kooperationen
set ksk_selbstzahler = false
where ksk_selbstzahler is null;

alter table public.kooperationen
  alter column ksk_selbstzahler set default false;

alter table public.kooperationen
  alter column ksk_selbstzahler set not null;

alter table public.kooperationen
  add column if not exists ksk_betrag numeric default 0;

alter table public.kooperationen
  add column if not exists ksk_prozent numeric;

comment on column public.kooperationen.ksk_selbstzahler
  is 'True, wenn der Creator dieser Kooperation die KSK selbst zahlt';
comment on column public.kooperationen.ksk_betrag
  is 'KSK-Aufschlag in EUR (ksk_prozent vom EK-Netto), wird dem Creator on top gezahlt';
comment on column public.kooperationen.ksk_prozent
  is 'Snapshot des KSK-Satzes in Prozent zum Zeitpunkt der Berechnung (z.B. 4.9)';

alter table public.rechnung
  add column if not exists ksk_betrag numeric default 0;

comment on column public.rechnung.ksk_betrag
  is 'KSK-Aufschlag in EUR auf Creator-Rechnungen (Selbstzahler), Teil der USt-Basis';

commit;
