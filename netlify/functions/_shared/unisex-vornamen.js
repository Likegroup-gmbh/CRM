// Vornamen, die im Deutschen für Männer und Frauen funktionieren, getaggt nach
// Namensregister (Stilrichtung) und Jahrgang (zu welchem Alter der Name passt).
// Nur der Startrun und der Karten-Ersatz (modus initial / karte) müssen daraus
// wählen. modus weitere bleibt frei, die Liste ist dort nur Orientierung.
//
// Jahrgang: jung = bis 30, mittel = 31 bis 50, aelter = ab 51.
// Ein Name steht in genau einem Register. Namen, die im Deutschen eher zu
// einem Geschlecht kippen, stehen mit den Jahrgängen, in denen sie noch neutral wirken.

const REGISTER = Object.freeze({
  klassisch: 'klassisch-bodenständig',
  modern: 'modern-urban',
  kurz: 'kurz-verspielt',
  international: 'nordisch/international'
});

const REGISTER_LABELS = Object.freeze(Object.values(REGISTER));

const JAHRGANG = Object.freeze({ j: 'jung', m: 'mittel', a: 'aelter' });

// [Name, Register, Jahrgänge (j = jung, m = mittel, a = älter)]
const EINTRAEGE = [
  ['Chris', 'klassisch', 'ma'], ['Kay', 'klassisch', 'ma'], ['Jo', 'klassisch', 'ma'],
  ['Micha', 'klassisch', 'ma'], ['Sascha', 'klassisch', 'ma'], ['Eike', 'klassisch', 'ma'],
  ['Charly', 'klassisch', 'ma'], ['Andy', 'klassisch', 'ma'], ['Dominique', 'klassisch', 'm'],
  ['Kim', 'klassisch', 'm'], ['Toni', 'klassisch', 'ma'], ['Robin', 'klassisch', 'jm'],
  ['Jessie', 'klassisch', 'm'], ['Dana', 'klassisch', 'm'],

  ['Alex', 'modern', 'jma'], ['Luca', 'modern', 'jm'], ['Luka', 'modern', 'j'],
  ['Mika', 'modern', 'j'], ['Elia', 'modern', 'j'], ['Noa', 'modern', 'j'],
  ['Lio', 'modern', 'j'], ['Lou', 'modern', 'jm'], ['Jona', 'modern', 'j'],
  ['Nico', 'modern', 'jm'], ['Ari', 'modern', 'j'], ['Eli', 'modern', 'j'],
  ['Jules', 'modern', 'jm'], ['Kai', 'modern', 'jm'], ['Noel', 'modern', 'j'],

  ['Sam', 'kurz', 'jm'], ['Jamie', 'kurz', 'jm'], ['Kris', 'kurz', 'm'],
  ['Mo', 'kurz', 'jm'], ['Lee', 'kurz', 'jm'], ['Jay', 'kurz', 'jm'],
  ['Vic', 'kurz', 'jm'], ['Frankie', 'kurz', 'j'], ['Billie', 'kurz', 'j'],
  ['Maxi', 'kurz', 'jm'], ['Bo', 'kurz', 'j'], ['Cris', 'kurz', 'm'],

  ['Sasha', 'international', 'm'], ['Sacha', 'international', 'm'], ['Rene', 'international', 'ma'],
  ['Nicola', 'international', 'ma'], ['Andrea', 'international', 'ma'], ['Deniz', 'international', 'jm'],
  ['Noor', 'international', 'j'], ['Ayan', 'international', 'j'], ['Yuki', 'international', 'j'],
  ['Ariel', 'international', 'jm'], ['Jordan', 'international', 'jm'], ['Quinn', 'international', 'j'],
  ['Rory', 'international', 'j'], ['Morgan', 'international', 'm'], ['Charlie', 'international', 'jm'],
  ['Alexis', 'international', 'm'], ['Dani', 'international', 'm']
];

const NAMEN = Object.freeze(EINTRAEGE.map(([name, register, jahrgaenge]) => Object.freeze({
  name,
  register: REGISTER[register],
  jahrgaenge: Object.freeze([...jahrgaenge].map((k) => JAHRGANG[k]))
})));

const UNISEX_VORNMEN = Object.freeze(NAMEN.map((n) => n.name));

function nameKey(name) {
  return String(name || '').trim().toLowerCase();
}

function eintrag(name) {
  const key = nameKey(name);
  return NAMEN.find((n) => nameKey(n.name) === key) || null;
}

function nameIstUnisex(name) {
  return !!eintrag(name);
}

function kanonischerUnisexName(name) {
  return eintrag(name)?.name || null;
}

/** Jahrgang zu einem Alter. null, wenn kein Alter bekannt ist. */
function jahrgangFuerAlter(alter) {
  const zahl = Number(alter);
  if (alter == null || alter === '' || !Number.isFinite(zahl)) return null;
  if (zahl <= 30) return JAHRGANG.j;
  if (zahl <= 50) return JAHRGANG.m;
  return JAHRGANG.a;
}

/**
 * Jahrgänge, die zu einer Alterspanne passen: Anfang, Ende und Mitte.
 * Tolerant, damit eine Spanne über zwei Jahrgänge nicht unnötig verworfen wird.
 */
function jahrgaengeFuerSpanne(alterVon, alterBis) {
  const punkte = [alterVon, alterBis].filter((a) => a != null && a !== '' && Number.isFinite(Number(a)));
  if (!punkte.length) return [];
  if (punkte.length === 2) punkte.push((Number(punkte[0]) + Number(punkte[1])) / 2);
  return [...new Set(punkte.map(jahrgangFuerAlter).filter(Boolean))];
}

function registerGueltig(register) {
  return REGISTER_LABELS.includes(register);
}

/**
 * Passt der Name zu Register und Alter? Fehlt eine Angabe, wird sie nicht geprüft.
 * @returns {{ ok: true } | { ok: false, grund: 'Name passt nicht zum Register' | 'Name passt nicht zum Alter' }}
 */
function passtNameZu(name, { register = null, alterVon = null, alterBis = null } = {}) {
  const e = eintrag(name);
  if (!e) return { ok: false, grund: 'kein Unisex-Vorname' };
  if (register && registerGueltig(register) && e.register !== register) {
    return { ok: false, grund: 'Name passt nicht zum Register' };
  }
  const jahrgaenge = jahrgaengeFuerSpanne(alterVon, alterBis);
  if (jahrgaenge.length && !jahrgaenge.some((j) => e.jahrgaenge.includes(j))) {
    return { ok: false, grund: 'Name passt nicht zum Alter' };
  }
  return { ok: true };
}

/**
 * Namen, die noch frei sind: belegte Namen (Pool, aktive Karten) und der
 * verworfene Vorname fliegen raus. Ist danach nichts übrig, fallen die
 * belegten Namen wieder rein, der verworfene bleibt raus.
 */
function gefilterteUnisexNamen({ poolNamen = [], belegteNamen = [], verworfenerName = null } = {}) {
  const belegt = new Set(
    [...(Array.isArray(poolNamen) ? poolNamen : []), ...(Array.isArray(belegteNamen) ? belegteNamen : [])]
      .map(nameKey).filter(Boolean)
  );
  const verworfen = nameKey(verworfenerName);
  const frei = UNISEX_VORNMEN.filter((n) => !belegt.has(nameKey(n)) && nameKey(n) !== verworfen);
  if (frei.length) return frei;
  const rest = UNISEX_VORNMEN.filter((n) => nameKey(n) !== verworfen);
  return rest.length ? rest : [...UNISEX_VORNMEN];
}

/**
 * Für die Korrektur nach einem verworfenen Entwurf: freie Namen, die zu
 * Register und Alter passen. Gibt es keinen, zählt nur das Alter, dann alle freien.
 */
function passendeNamen(freieNamen, { register = null, alterVon = null, alterBis = null } = {}) {
  const liste = Array.isArray(freieNamen) && freieNamen.length ? freieNamen : [...UNISEX_VORNMEN];
  const voll = liste.filter((n) => passtNameZu(n, { register, alterVon, alterBis }).ok);
  if (voll.length) return voll;
  const nurAlter = liste.filter((n) => passtNameZu(n, { alterVon, alterBis }).ok);
  return nurAlter.length ? nurAlter : liste;
}

/** Prompt-Text: Namen je Register gruppiert, mit Jahrgängen. */
function fmtNamenListe(namen = UNISEX_VORNMEN) {
  const erlaubt = new Set((namen || []).map(nameKey));
  const zeilen = [];
  for (const register of REGISTER_LABELS) {
    const teil = NAMEN
      .filter((n) => n.register === register && erlaubt.has(nameKey(n.name)))
      .map((n) => `${n.name} (${n.jahrgaenge.join('/')})`);
    if (teil.length) zeilen.push(`- ${register}: ${teil.join(', ')}`);
  }
  return zeilen.join('\n');
}

module.exports = {
  UNISEX_VORNMEN,
  REGISTER_LABELS,
  nameIstUnisex,
  kanonischerUnisexName,
  jahrgangFuerAlter,
  passtNameZu,
  gefilterteUnisexNamen,
  passendeNamen,
  fmtNamenListe
};
