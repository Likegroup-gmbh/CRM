-- Der Schlüssel aus der alten Tabelle marke_zustaendigkeit lag nach der
-- Umbenennung weiter auf marke_id, neben fk_marke_mitarbeiter_marke_id.
-- PostgREST bricht Einbettungen wie marke:marke_id(...) deshalb ab, und
-- eine reine Markenzuordnung kommt im Rechnungs-Dropdown nicht als Firma an.

begin;

alter table public.marke_mitarbeiter
  drop constraint if exists marke_zustaendigkeit_marke_id_fkey;

-- Matea Dobric: Marken Ninja, Campari und Sarti ohne Firmenzeile.
-- Rolle wie an der Marke. Catrice, essence, INAO und LSCN sind schon zugeordnet.
insert into public.mitarbeiter_unternehmen (mitarbeiter_id, unternehmen_id, role)
select b.id, u.id, v.role
from (
  values
    ('SharkNinja Germany GmbH', 'lead_mitarbeiter'),
    ('CAMPARI Deutschland GmbH', 'mitarbeiter')
) as v(firmenname, role)
join public.benutzer b on b.email = 'matea@creatorjobs.com'
join public.unternehmen u on u.firmenname = v.firmenname
on conflict (mitarbeiter_id, unternehmen_id, role) do nothing;

commit;
