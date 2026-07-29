-- Instagram-Bilder in zwei Groessen: Hauptbild (640px) und Thumbnail (128px),
-- beide als AVIF (siehe storeImagePair in netlify/functions/_shared/instagram-graph.js).
--
-- Die Thumbnails sind fuer Avatare in Tabellen und Karten gedacht; das
-- Frontend nimmt "thumb || haupt", damit Altbestand ohne Thumb weiter
-- funktioniert (gleiches Muster wie logo_thumb_url / profile_image_thumb_url
-- bei unternehmen, marke, ansprechpartner und benutzer).
--
-- Bewusst ohne die *_path-Spalten des Upload-Musters: bei Instagram-Bildern
-- ist der Storage-Pfad deterministisch aus Handle bzw. creator_id ableitbar,
-- es gibt keine benutzerdefinierten Dateinamen zu merken.
--
-- Die Post-Thumbnails und Brand-Logos in creator.ig_recent_posts und
-- creator.ig_brand_mentions brauchen keine Spalte: das sind jsonb-Felder und
-- bekommen die Zusatz-Keys thumbnail_thumb_path bzw. profile_pic_thumb.

alter table public.sourcing_creator
  add column if not exists profile_image_thumb_url text;

alter table public.creator_auswahl_items
  add column if not exists profile_image_thumb_url text;

alter table public.creator
  add column if not exists profilbild_thumb_url text;

alter table public.instagram_brands
  add column if not exists profile_picture_thumb_url text;
