-- Videozahl: Kooperationsvideos im rollierenden Fenster, nicht die Kooperation.

begin;

create index if not exists idx_kooperation_videos_created_at
  on public.kooperation_videos (created_at);

create or replace function public.creator_video_anzahl(seit timestamptz)
returns table (creator_id uuid, anzahl integer)
language sql
stable
security invoker
set search_path = public
as $$
  select k.creator_id, count(v.id)::integer
  from public.kooperation_videos v
  join public.kooperationen k on k.id = v.kooperation_id
  where k.creator_id is not null
    and v.created_at >= seit
  group by k.creator_id;
$$;

drop function if exists public.creator_buchung_anzahl(timestamptz);

revoke all on function public.creator_video_anzahl(timestamptz) from public, anon;
grant execute on function public.creator_video_anzahl(timestamptz) to authenticated, service_role;

commit;
