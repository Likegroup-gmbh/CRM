begin;

create or replace function public.enforce_rechnung_vertrag_exists()
returns trigger
language plpgsql
as $$
declare
  v_koop record;
begin
  if new.kooperation_id is null then
    raise exception using message = 'RECHNUNG_VERTRAG_REQUIRED: Kooperation ist Pflicht fuer die Rechnungserstellung.';
  end if;

  select
    k.id,
    k.creator_id,
    k.kampagne_id
  into v_koop
  from public.kooperationen k
  where k.id = new.kooperation_id;

  if not found then
    raise exception using message = 'RECHNUNG_VERTRAG_REQUIRED: Zugehoerige Kooperation wurde nicht gefunden.';
  end if;

  if v_koop.creator_id is null or v_koop.kampagne_id is null then
    raise exception using message = 'RECHNUNG_VERTRAG_REQUIRED: Kooperation ist unvollstaendig (Creator oder Kampagne fehlt).';
  end if;

  if not exists (
    select 1
    from public.vertraege v
    where v.creator_id = v_koop.creator_id
      and v.kampagne_id = v_koop.kampagne_id
      and coalesce(v.is_draft, false) = false
  ) then
    raise exception using message = 'RECHNUNG_VERTRAG_REQUIRED: Vor der Rechnung muss ein finaler Vertrag angelegt sein.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rechnung_require_vertrag on public.rechnung;

create trigger trg_rechnung_require_vertrag
before insert on public.rechnung
for each row
execute function public.enforce_rechnung_vertrag_exists();

commit;
