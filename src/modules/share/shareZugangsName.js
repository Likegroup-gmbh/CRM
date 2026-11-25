// Namensvorschlag für einen Gast-Zugang aus den Empfänger-Adressen.

const FREEMAIL = new Set([
  'gmail.com', 'googlemail.com', 'gmx.de', 'gmx.net', 'gmx.at', 'gmx.ch', 'web.de',
  'outlook.com', 'outlook.de', 'hotmail.com', 'hotmail.de', 'live.com', 'live.de',
  'icloud.com', 'me.com', 't-online.de', 'yahoo.com', 'yahoo.de', 'freenet.de',
  'posteo.de', 'mail.de', 'aol.com',
]);

const GENERISCHE_SLD = new Set(['co', 'com', 'org', 'net', 'ac', 'gv', 'or']);

const MAX_LAENGE = 80;

function gross(wort) {
  return wort ? wort[0].toLocaleUpperCase('de-DE') + wort.slice(1) : '';
}

function firmaAusDomain(domain) {
  const teile = domain.split('.').filter(Boolean);
  if (teile.length < 2) return '';
  const sld = teile.length > 2 && GENERISCHE_SLD.has(teile.at(-2)) ? teile.at(-3) : teile.at(-2);
  return sld.split('-').map(gross).join('-');
}

function personAusAdresse(email) {
  const lokal = email.split('@')[0].split('+')[0];
  return lokal.split(/[._-]+/).filter((teil) => teil && !/^\d+$/.test(teil)).map(gross).join(' ');
}

function tagMonat(datum) {
  const zwei = (n) => String(n).padStart(2, '0');
  return `${zwei(datum.getDate())}.${zwei(datum.getMonth() + 1)}.`;
}

/**
 * Eine gemeinsame Firmen-Domain ergibt den Firmennamen, eine einzelne Freemail-Adresse
 * den Personennamen, alles andere „Gast-Zugang TT.MM.“.
 */
export function standardZugangsName(emails = [], datum = new Date()) {
  const adressen = emails
    .map((email) => String(email || '').trim().toLowerCase())
    .filter((email) => email.includes('@'));
  const domains = [...new Set(adressen.map((email) => email.split('@')[1]))];
  if (domains.length === 1) {
    const [domain] = domains;
    const name = FREEMAIL.has(domain)
      ? (adressen.length === 1 ? personAusAdresse(adressen[0]) : '')
      : firmaAusDomain(domain);
    if (name) return name.slice(0, MAX_LAENGE);
  }
  return `Gast-Zugang ${tagMonat(datum)}`;
}
