-- Creator Tabelle für neue Struktur aktualisieren

-- Neue Spalten hinzufügen
ALTER TABLE public.creator 
ADD COLUMN IF NOT EXISTS sprachen_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS branche_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS creator_type_id UUID;

-- Foreign Key für creator_type_id hinzufügen (ohne IF NOT EXISTS)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'creator_creator_type_id_fkey'
    ) THEN
        ALTER TABLE public.creator 
        ADD CONSTRAINT creator_creator_type_id_fkey 
        FOREIGN KEY (creator_type_id) REFERENCES public.creator_type(id);
    END IF;
END $$;

-- Alte Spalten entfernen (falls vorhanden)
ALTER TABLE public.creator 
DROP COLUMN IF EXISTS sprachen,
DROP COLUMN IF EXISTS branche,
DROP COLUMN IF EXISTS creator_type;

-- Index für bessere Performance
CREATE INDEX IF NOT EXISTS idx_creator_sprachen_ids ON public.creator USING GIN (sprachen_ids);
CREATE INDEX IF NOT EXISTS idx_creator_branche_ids ON public.creator USING GIN (branche_ids);
CREATE INDEX IF NOT EXISTS idx_creator_creator_type_id ON public.creator (creator_type_id); 