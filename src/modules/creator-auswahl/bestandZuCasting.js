// bestandZuCasting.js
// Zeilen des Casting-Bestands (Creator Casting) auf ein Casting legen (ADR 0050).
// Reine Regeln ohne Datenbankzugriff: Schlüssel einer Bestandszeile und die
// Duplikat-Prüfung gegen die Einträge des Ziel-Castings. Die Schlüssel spiegeln
// die Zeilenbildung der RPC get_casting_bestand (ADR 0046): creator_id, sonst
// Instagram-Handle, sonst normalisierter Name.

const RESERVIERTE_HANDLES = ['p', 'reel', 'reels', 'tv', 'explore', 'stories', 'direct', 'accounts', 'about'];

/** Spiegel zu public.casting_handle: Instagram-Handle aus Link oder nacktem Handle, sonst null. */
export function castingHandle(wert) {
  const raw = String(wert ?? '').trim();
  let handle;
  if (/instagram\.com\//i.test(raw)) {
    handle = raw.match(/instagram\.com\/([A-Za-z0-9._]+)/i)?.[1] ?? null;
  } else if (/^[a-z]+:\/\//i.test(raw) || /\.[a-z]{2,}\//i.test(raw)) {
    handle = null;
  } else {
    handle = raw.replace(/[?#/].*$/, '').replace(/^@/, '');
  }
  handle = String(handle ?? '').trim().toLowerCase();
  if (!handle || RESERVIERTE_HANDLES.includes(handle)) return null;
  return handle;
}

export function nameKey(name) {
  return String(name ?? '').trim().toLowerCase() || null;
}

/** Anzeigename einer Bestandszeile. */
export function bestandName(zeile) {
  return [zeile?.vorname, zeile?.nachname]
    .map(teil => String(teil ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/**
 * Stabiler Schlüssel einer Bestandszeile: c:<creator_id>, h:<handle> oder n:<name>.
 * @returns {string|null} null, wenn die Zeile weder Creator noch Handle noch Namen hat
 */
export function bestandKey(zeile) {
  if (zeile?.id) return `c:${zeile.id}`;
  const handle = castingHandle(zeile?.instagram);
  if (handle) return `h:${handle}`;
  const name = nameKey(bestandName(zeile));
  return name ? `n:${name}` : null;
}

/**
 * Teilt markierte Bestandszeilen in "anlegen" und "überspringen" gegen die
 * Einträge, die das Ziel-Casting schon hat.
 *
 * @param {Array<Object>} personen - Bestandszeilen (id, vorname, nachname, instagram, ...)
 * @param {Array<{creator_id?: string|null, name?: string|null, link_instagram?: string|null}>} vorhandene
 * @returns {{anlegen: Object[], ueberspringen: Object[]}}
 */
export function teileNachDuplikat(personen, vorhandene) {
  const creatorIds = new Set();
  const handles = new Set();
  const namenOhneHandle = new Set();

  for (const eintrag of vorhandene || []) {
    if (eintrag.creator_id) creatorIds.add(eintrag.creator_id);
    const handle = castingHandle(eintrag.link_instagram);
    if (handle) handles.add(handle);
    else if (!eintrag.creator_id) {
      const name = nameKey(eintrag.name);
      if (name) namenOhneHandle.add(name);
    }
  }

  const anlegen = [];
  const ueberspringen = [];
  for (const person of personen || []) {
    const handle = castingHandle(person.instagram);
    let schonDa;
    if (person.id) {
      schonDa = creatorIds.has(person.id) || (handle ? handles.has(handle) : false);
    } else if (handle) {
      schonDa = handles.has(handle);
    } else {
      const name = nameKey(bestandName(person));
      schonDa = name ? namenOhneHandle.has(name) : false;
    }
    (schonDa ? ueberspringen : anlegen).push(person);
  }
  return { anlegen, ueberspringen };
}

/** Toast-Text zum Ergebnis von addBestandPersonen. */
export function bestandErgebnisText({ added = 0, skipped = 0 }) {
  const hinzu = `${added} Creator hinzugefügt`;
  if (!skipped) return hinzu;
  if (!added) return `${skipped} schon auf dem Casting, nichts hinzugefügt`;
  return `${hinzu}, ${skipped} schon auf dem Casting`;
}
