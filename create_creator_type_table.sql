-- Creator Type Tabelle erstellen
CREATE TABLE IF NOT EXISTS public.creator_type (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE,
    beschreibung TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Standard Creator-Typen einfügen
INSERT INTO public.creator_type (name, beschreibung) VALUES
    ('Influencer', 'Content Creator mit großer Reichweite'),
    ('UGC Creator', 'User Generated Content Creator'),
    ('Micro Influencer', 'Influencer mit kleinerer, aber engagierter Community'),
    ('Macro Influencer', 'Influencer mit großer Reichweite'),
    ('Celebrity', 'Prominente und Stars'),
    ('Expert', 'Fachexperten und Spezialisten'),
    ('Lifestyle', 'Lifestyle und Alltags-Content Creator'),
    ('Gaming', 'Gaming und E-Sports Creator'),
    ('Beauty', 'Beauty und Fashion Creator'),
    ('Fitness', 'Fitness und Gesundheit Creator'),
    ('Food', 'Food und Kochen Creator'),
    ('Travel', 'Travel und Reise Creator'),
    ('Business', 'Business und Karriere Creator'),
    ('Education', 'Bildungs- und Wissensvermittlung Creator'),
    ('Comedy', 'Comedy und Unterhaltung Creator'),
    ('Music', 'Musik und Entertainment Creator'),
    ('Art', 'Kunst und Kreativität Creator'),
    ('Tech', 'Technologie und Innovation Creator'),
    ('Sports', 'Sport und Athletik Creator'),
    ('Parenting', 'Familie und Erziehung Creator')
ON CONFLICT (name) DO NOTHING; 