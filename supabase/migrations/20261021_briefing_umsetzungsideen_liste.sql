-- Vorhandene Umsetzungsideen: Freitext (text) -> Liste einzelner Ideen (jsonb-Array von Strings).
-- Das Briefing-Feld ist jetzt ein repeatableText (eine Idee pro Eintrag).
--
-- Backfill ohne Clever-Logik: eine Zeile = eine Idee, Aufzaehlungszeichen/Nummern
-- werden entfernt, reine Ueberschriften ("UGC-Ideen:") fallen weg, Inline-
-- Nummerierung "(1) ... (2) ..." in einer Zeile wird getrennt. Komma-Aufzaehlungen
-- im Fliesstext bleiben ein Eintrag und werden von Hand nachgezogen.
--
-- Ein ALTER ... TYPE ... USING erlaubt keine Subquery, deshalb neue Spalte,
-- Umkopieren, alte Spalte weg, umbenennen. Guard: laeuft nur, solange die
-- Spalte noch text ist (idempotent).

DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'campaign_briefings'
          AND column_name = 'umsetzungsideen') = 'text' THEN

    ALTER TABLE campaign_briefings ADD COLUMN umsetzungsideen_liste jsonb;

    UPDATE campaign_briefings b
    SET umsetzungsideen_liste = s.liste
    FROM (
      SELECT id,
             jsonb_agg(item ORDER BY ord, sub) AS liste
      FROM (
        SELECT c.id,
               t.ord,
               u.sub,
               btrim(regexp_replace(u.part, '^\s*([-•*–—]|\d{1,2}[.)]|\(\d{1,2}\))\s+', '')) AS item
        FROM campaign_briefings c
        CROSS JOIN LATERAL regexp_split_to_table(replace(c.umsetzungsideen, E'\r', ''), E'\n')
          WITH ORDINALITY AS t(line, ord)
        CROSS JOIN LATERAL regexp_split_to_table(
          CASE WHEN t.line ~ '\(1\).*\(2\)'
               THEN regexp_replace(t.line, '\s*\(\d{1,2}\)\s*', E'\n', 'g')
               ELSE t.line END,
          E'\n'
        ) WITH ORDINALITY AS u(part, sub)
        WHERE c.umsetzungsideen IS NOT NULL
          AND btrim(c.umsetzungsideen) <> ''
      ) zerlegt
      WHERE item <> '' AND item !~ ':\s*$'
      GROUP BY id
    ) s
    WHERE b.id = s.id;

    ALTER TABLE campaign_briefings DROP COLUMN umsetzungsideen;
    ALTER TABLE campaign_briefings RENAME COLUMN umsetzungsideen_liste TO umsetzungsideen;
  END IF;
END
$$;

COMMENT ON COLUMN campaign_briefings.umsetzungsideen IS
  'Vorhandene Umsetzungsideen des Kunden als Liste (jsonb-Array von Strings), eine Idee pro Eintrag.';
