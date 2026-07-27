-- Neue Content-Art "Partnership Ad" fuer Kooperationen.
-- 'Videograph' fehlte im Constraint, obwohl die UI es seit laengerem anbietet -- mitrepariert.
-- Angewendet auf Prod: 2026-07-27 (via MCP apply_migration "add_content_art_partnership_ad")

alter table public.kooperationen drop constraint if exists kooperationen_content_art_check;
alter table public.kooperationen add constraint kooperationen_content_art_check
  check (content_art = any (array[
    'Paid', 'Organisch', 'Influencer', 'Videograph', 'Whitelisting', 'Spark-Ad', 'Partnership Ad'
  ]));
