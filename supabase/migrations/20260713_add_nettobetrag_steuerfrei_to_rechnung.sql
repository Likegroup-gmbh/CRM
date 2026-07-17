begin;

-- Steuerfreier Netto-Anteil (0% USt) einer Eingangsrechnung.
-- Nullable wie nettobetrag/zusatzkosten: der Submit-Flow (DataPreparer)
-- wandelt leere Zahlenfelder in null um; null wird im Code als 0 behandelt.
alter table public.rechnung
  add column if not exists nettobetrag_steuerfrei numeric default 0;

commit;
