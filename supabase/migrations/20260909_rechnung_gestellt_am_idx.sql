-- Monatstab auf /rechnung filtert nach gestellt_am.
-- Ohne Index sequenziert der Range-Scan alle Rechnungen.
create index if not exists idx_rechnung_gestellt_am
  on public.rechnung (gestellt_am desc)
  where gestellt_am is not null;
