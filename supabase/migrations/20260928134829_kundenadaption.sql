-- Kundenadaption an der Videoidee (ADR 0033).
-- Umsetzungsvorgabe: interne Vorgabe, nur an einer Videoreferenz.
-- Kundenadaption: Absatz plus Punkte, wie das Video fuer den Kunden laufen koennte.
-- quelle analog beschreibung_quelle: ki / user / NULL (leer oder Altbestand).

alter table public.strategie_items
  add column if not exists umsetzungsvorgabe text,
  add column if not exists kundenadaption text,
  add column if not exists kundenadaption_quelle text;

alter table public.strategie_items
  drop constraint if exists strategie_items_kundenadaption_quelle_check;
alter table public.strategie_items
  add constraint strategie_items_kundenadaption_quelle_check
  check (kundenadaption_quelle is null or kundenadaption_quelle in ('ki', 'user'));

comment on column public.strategie_items.umsetzungsvorgabe is
  'Pflicht an einer Videoreferenz: was davon umgesetzt werden soll. Team-intern.';
comment on column public.strategie_items.kundenadaption is
  'Absatz plus Punkte, wie die Videoreferenz fuer den Kunden laufen koennte. An einer Idee leer, bis jemand schreibt.';
comment on column public.strategie_items.kundenadaption_quelle is
  'ki = generiert, user = von Hand, NULL = leer oder Altbestand';
