-- Sourcing: Creator Art startet ausgeblendet.
--
-- Die Spalte wird in der Praxis kaum gepflegt und kostet in der ohnehin breiten
-- Tabelle Platz, den die nach vorne gerueckte Kurzbeschreibung besser nutzt.
-- Sie bleibt im Drawer "Tabelle anpassen" stehen und laesst sich pro Liste
-- jederzeit wieder einblenden - deshalb nur ein einmaliges Setzen des
-- Startwerts und keine Aenderung an der Spaltendefinition.

update public.creator_auswahl
set hidden_columns = hidden_columns || '["cp-col-typ"]'::jsonb
where not hidden_columns ? 'cp-col-typ';
