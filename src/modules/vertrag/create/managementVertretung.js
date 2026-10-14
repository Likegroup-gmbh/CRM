// Management-Vertretung im Vertrag: Auswahl, Adresse, Ansprechpartner.
// Reine Entscheidungen, ohne DOM und ohne Datenbank.

export const VERTRETUNG_TYPEN = ['UGC', 'Influencer Kooperation', 'Contracting'];

export function vertretungGiltFuer(typ) {
  return VERTRETUNG_TYPEN.includes(typ);
}

export function normName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function addressComplete(row) {
  if (!row) return false;
  return ['strasse', 'plz', 'stadt'].every((key) => String(row[key] || '').trim() !== '');
}

export function personLabel(person) {
  return `${person?.vorname || ''} ${person?.nachname || ''}`.replace(/\s+/g, ' ').trim();
}

export function matchManagement(query, managements) {
  const wanted = normName(query);
  if (wanted.length < 2) return { exact: null, similar: [] };
  const list = managements || [];
  const exact = list.find((item) => normName(item.firmenname) === wanted) || null;
  const similar = list.filter((item) => {
    if (exact && item.id === exact.id) return false;
    const name = normName(item.firmenname);
    return name && name !== wanted && (name.includes(wanted) || wanted.includes(name));
  });
  return { exact, similar };
}

export function matchPerson(vorname, nachname, people) {
  const first = normName(vorname);
  const last = normName(nachname);
  if (!first || !last) return { exact: null, similar: [] };
  const list = people || [];
  const exact = list.find((item) => normName(item.vorname) === first && normName(item.nachname) === last) || null;
  const similar = list.filter((item) => {
    if (exact && item.id === exact.id) return false;
    const otherFirst = normName(item.vorname);
    const otherLast = normName(item.nachname);
    const firstHit = first.length >= 3 && otherFirst && (otherFirst.includes(first) || first.includes(otherFirst));
    const lastHit = last.length >= 2 && otherLast && (otherLast.includes(last) || last.includes(otherLast));
    return firstHit && lastHit;
  });
  return { exact, similar };
}

export function preselectManagementId(creatorManagements) {
  return creatorManagements?.length === 1 ? creatorManagements[0].id : null;
}

export function preselectPersonId(people, betreuungIds) {
  const ids = new Set(betreuungIds || []);
  const hits = (people || []).filter((person) => ids.has(person.id));
  return hits.length === 1 ? hits[0].id : null;
}

export function readPendingPerson(formData = {}) {
  return {
    vorname: String(formData._vertretung_vorname || '').trim(),
    nachname: String(formData._vertretung_nachname || '').trim(),
    email: String(formData._vertretung_email || '').trim(),
    telefon: String(formData._vertretung_telefon || '').trim()
  };
}

export function pendingPersonStarted(person) {
  return !!(person?.vorname || person?.nachname || person?.email || person?.telefon);
}

export function pendingPersonComplete(person) {
  return !!(person?.vorname && person?.nachname && String(person.email || '').includes('@'));
}

export function legacyFreitextName(formData = {}) {
  if (formData._management_id) return '';
  if (!formData.influencer_agentur_vertreten) return '';
  return String(formData.influencer_agentur_name || '').trim();
}

export function vertretungLuecken({
  managementId,
  address,
  ansprechpartnerId,
  person,
  personHasEmail,
  legacyName
} = {}) {
  if (!managementId) {
    return legacyName ? ['Management aus den Stammdaten wählen oder neu anlegen.'] : [];
  }
  const gaps = [];
  if (!addressComplete(address)) {
    gaps.push('Straße, PLZ und Stadt am Management fehlen.');
  }
  if (pendingPersonStarted(person)) {
    if (!pendingPersonComplete(person)) {
      gaps.push('Ansprechpartner braucht Vorname, Nachname und E-Mail.');
    }
  } else if (!ansprechpartnerId) {
    gaps.push('Ansprechpartner wählen oder mit Vorname, Nachname und E-Mail anlegen.');
  } else if (personHasEmail === false) {
    gaps.push('Dem Ansprechpartner fehlt die E-Mail.');
  }
  return gaps;
}

export function vertretenDurchPayload(formData = {}) {
  const person = readPendingPerson(formData);
  if (!formData._management_id && !formData._ansprechpartner_id && !pendingPersonStarted(person)) {
    return null;
  }
  return {
    ansprechpartner_id: formData._ansprechpartner_id || null,
    vorname: person.vorname,
    nachname: person.nachname,
    email: person.email,
    telefon: person.telefon
  };
}

export function applyVertretenDurch(formData, payload) {
  const next = { ...formData };
  const data = payload || {};
  next._ansprechpartner_id = data.ansprechpartner_id || null;
  next._vertretung_vorname = data.vorname || '';
  next._vertretung_nachname = data.nachname || '';
  next._vertretung_email = data.email || '';
  next._vertretung_telefon = data.telefon || '';
  return next;
}
