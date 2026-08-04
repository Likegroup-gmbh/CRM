begin;

-- Herkunft des Geschlecht-Werts: 'manuell' (im Formular gepflegt) oder 'ki'
-- (aus Vorname + Instagram-Profil abgeleitet, siehe
-- netlify/functions/_shared/geschlecht-erkennen.js). Trennt gepflegte Daten von
-- geratenen, damit automatische Laeufe Handarbeit nie ueberschreiben.

alter table public.creator
  add column if not exists geschlecht_quelle text,
  add column if not exists geschlecht_konfidenz numeric;

alter table public.creator
  drop constraint if exists creator_geschlecht_quelle_check;

alter table public.creator
  add constraint creator_geschlecht_quelle_check
  check (geschlecht_quelle is null or geschlecht_quelle in ('manuell', 'ki'));

comment on column public.creator.geschlecht_quelle
  is 'Herkunft von geschlecht: manuell (Formular) oder ki (abgeleitet)';
comment on column public.creator.geschlecht_konfidenz
  is 'Konfidenz der KI-Ableitung zwischen 0 und 1, nur bei geschlecht_quelle = ki gesetzt';

-- Der Bestand wurde ausschliesslich von Hand gepflegt
update public.creator
set geschlecht_quelle = 'manuell'
where geschlecht is not null
  and geschlecht <> ''
  and geschlecht_quelle is null;

-- Wer das Geschlecht aendert, ohne die Quelle mitzuschreiben, pflegt es von
-- Hand. Die Functions setzen geschlecht_quelle = 'ki' im selben Update mit und
-- laufen damit an dieser Regel vorbei.
create or replace function public.creator_geschlecht_quelle_pflegen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.geschlecht is null or new.geschlecht = '' then
    new.geschlecht_quelle := null;
    new.geschlecht_konfidenz := null;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.geschlecht_quelle is null then
      new.geschlecht_quelle := 'manuell';
      new.geschlecht_konfidenz := null;
    end if;
    return new;
  end if;

  if new.geschlecht is distinct from old.geschlecht
     and new.geschlecht_quelle is not distinct from old.geschlecht_quelle then
    new.geschlecht_quelle := 'manuell';
    new.geschlecht_konfidenz := null;
  end if;

  return new;
end;
$$;

drop trigger if exists creator_geschlecht_quelle on public.creator;

create trigger creator_geschlecht_quelle
  before insert or update of geschlecht, geschlecht_quelle on public.creator
  for each row execute function public.creator_geschlecht_quelle_pflegen();

commit;
