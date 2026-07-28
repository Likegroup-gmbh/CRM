-- Webseiten wurden im Formular ohne Schema eingegeben (der FormRenderer zeigt
-- "https://" nur als visuellen Prefix). Dadurch stehen Werte wie "www.canon.de/"
-- in der DB, die als href zu einer App-internen Navigation fuehren statt zur
-- Zielseite. Bestand einmalig auf absolute URLs normalisieren.

update unternehmen
set webseite = 'https://' || btrim(webseite)
where webseite is not null
  and btrim(webseite) <> ''
  and webseite !~* '^https?://';

update marke
set webseite = 'https://' || btrim(webseite)
where webseite is not null
  and btrim(webseite) <> ''
  and webseite !~* '^https?://';
