// Masterlisten-Zeile -> Person, wie sie addBestandPersonen erwartet.
// Grüne Zeile (Creator-Datensatz) trägt die Stammdaten-ID, rote Zeile die
// eigenen Werte und, falls gesetzt, die Creator Art der Zeile.

import { isAllowedCreatorTyp } from './creatorTypeOptions.js';
import { bestandKey, castingHandle, teileNachDuplikat } from './bestandZuCasting.js';

export function personAusMember(member) {
  const creator = member?.creator || {};
  const gruen = Boolean(member?.hatDatensatz && creator.id);
  const typ = (creator.creatorTypes || [])[0];
  return {
    id: gruen ? creator.id : null,
    memberId: member?.memberId || null,
    vorname: creator.vorname || '',
    nachname: creator.nachname || '',
    instagram: creator.instagram || member?.igUsername || '',
    tiktok: creator.tiktok || '',
    instagram_follower: creator.instagram_follower ?? null,
    tiktok_follower: creator.tiktok_follower ?? null,
    lieferadresse_stadt: creator.lieferadresse_stadt || '',
    mail: creator.mail || '',
    telefonnummer: creator.telefonnummer || '',
    typ: isAllowedCreatorTyp(typ) ? typ : undefined,
    profilbild_url: gruen ? null : (creator.profilbild_url || null),
    profilbild_thumb_url: gruen ? null : (creator.profilbild_thumb_url || null)
  };
}

/** Anzeigename, z. B. "Ada Lovelace · @ada". */
export function personLabel(person) {
  const name = [person?.vorname, person?.nachname].filter(Boolean).join(' ') || 'Unbekannt';
  const handle = castingHandle(person?.instagram);
  return handle ? `${name} · @${handle}` : name;
}

export function masterlisteLabel(row) {
  const name = row?.name || 'Ohne Namen';
  const firma = row?.unternehmen?.firmenname;
  return firma ? `${name} · ${firma}` : name;
}

/**
 * Personen einer Masterliste gegen die Einträge des Castings.
 * schonDa: Creator, Handle oder Name steht schon auf dem Casting.
 */
export function personenFuerCasting(members, vorhandene) {
  const personen = (members || [])
    .map(personAusMember)
    .filter(person => person.id || person.instagram || person.vorname || person.nachname);
  const { ueberspringen } = teileNachDuplikat(personen, vorhandene);
  const schonDa = new Set(ueberspringen.map(bestandKey));
  for (const person of personen) person.schonDa = schonDa.has(bestandKey(person));
  personen.sort((a, b) => {
    if (a.schonDa !== b.schonDa) return a.schonDa ? 1 : -1;
    return personLabel(a).localeCompare(personLabel(b), 'de');
  });
  return personen;
}

export function gefiltertePersonen(personen, filter) {
  const q = String(filter || '').trim().toLowerCase();
  if (!q) return personen || [];
  return (personen || []).filter(person => personLabel(person).toLowerCase().includes(q));
}
