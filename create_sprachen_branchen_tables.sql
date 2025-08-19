-- Sprachen Tabelle erstellen
CREATE TABLE IF NOT EXISTS public.sprachen (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE,
    code VARCHAR(3),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Standard Sprachen einfügen
INSERT INTO public.sprachen (name, code) VALUES
    ('Deutsch', 'deu'),
    ('Englisch', 'eng'),
    ('Französisch', 'fra'),
    ('Spanisch', 'spa'),
    ('Italienisch', 'ita'),
    ('Niederländisch', 'nld'),
    ('Polnisch', 'pol'),
    ('Türkisch', 'tur'),
    ('Arabisch', 'ara'),
    ('Chinesisch', 'zho'),
    ('Japanisch', 'jpn'),
    ('Koreanisch', 'kor'),
    ('Russisch', 'rus'),
    ('Portugiesisch', 'por'),
    ('Schwedisch', 'swe'),
    ('Norwegisch', 'nor'),
    ('Dänisch', 'dan'),
    ('Finnisch', 'fin'),
    ('Ungarisch', 'hun'),
    ('Tschechisch', 'ces')
ON CONFLICT (name) DO NOTHING;

-- Branchen Tabelle erstellen
CREATE TABLE IF NOT EXISTS public.branchen_creator (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE,
    beschreibung TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Standard Branchen für Creator einfügen
INSERT INTO public.branchen_creator (name, beschreibung) VALUES
    ('Beauty & Fashion', 'Beauty, Mode und Lifestyle'),
    ('Fitness & Gesundheit', 'Fitness, Gesundheit und Wellness'),
    ('Food & Lifestyle', 'Essen, Kochen und Lifestyle'),
    ('Gaming', 'Gaming und E-Sports'),
    ('Tech', 'Technologie und Innovation'),
    ('Travel', 'Reisen und Abenteuer'),
    ('Business', 'Business und Karriere'),
    ('Education', 'Bildung und Wissen'),
    ('Comedy', 'Comedy und Unterhaltung'),
    ('Music', 'Musik und Entertainment'),
    ('Art', 'Kunst und Kreativität'),
    ('Sports', 'Sport und Athletik'),
    ('Parenting', 'Familie und Erziehung'),
    ('Automotive', 'Auto und Mobilität'),
    ('Finance', 'Finanzen und Investment'),
    ('Real Estate', 'Immobilien und Wohnen'),
    ('Pets', 'Haustiere und Tiere'),
    ('DIY & Craft', 'Do-it-yourself und Handwerk'),
    ('Science', 'Wissenschaft und Forschung'),
    ('Politics', 'Politik und Gesellschaft')
ON CONFLICT (name) DO NOTHING; 