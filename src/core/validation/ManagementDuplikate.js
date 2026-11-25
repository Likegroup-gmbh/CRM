// ManagementDuplikate.js
// Reine Logik (ohne Datenbank) fuer doppelte Managements:
//  - Namensgleich: gleicher Kernname, Rechtsform/Gross-Klein/Satzzeichen egal
//  - Zusammenlegen: Gruppen planen, Datensatz zum Behalten waehlen, nichts verlieren
// Genutzt vom Anlege-Check (DuplicateChecker) und vom einmaligen Zusammenlegen.

// Rechtsformen, laengste zuerst. Schluessel = kanonische Form, Muster laufen auf dem
// bereinigten Text (klein, ohne Punkte, einfache Leerzeichen).
const RECHTSFORMEN = [
  { key: 'gmbh&cokg', muster: 'gmbh\\s*(?:&|und)\\s*co\\s*kg' },
  { key: 'ug', muster: 'ug\\s*\\(\\s*haftungsbeschr(?:ä|ae)nkt\\s*\\)' },
  { key: 'gmbh', muster: 'gmbh' },
  { key: 'gmbh', muster: 'mbh' },
  { key: 'kgaa', muster: 'kgaa' },
  { key: 'ohg', muster: 'ohg' },
  { key: 'gbr', muster: 'gbr' },
  { key: 'ek', muster: 'e\\s*k' },
  { key: 'ev', muster: 'e\\s*v' },
  { key: 'ltd', muster: 'ltd' },
  { key: 'inc', muster: 'inc' },
  { key: 'llc', muster: 'llc' },
  { key: 'ug', muster: 'ug' },
  { key: 'ag', muster: 'ag' },
  { key: 'se', muster: 'se' },
  { key: 'kg', muster: 'kg' }
];

const RECHTSFORM_REGEX = RECHTSFORMEN.map((r) => ({
  key: r.key,
  // Rechtsform nur am Ende und als eigenes Wort
  regex: new RegExp(`(?:^|[\\s,;])(${r.muster})\\s*$`, 'u')
}));

/**
 * Zerlegt einen Management-Namen in Kernname und Rechtsform.
 * @param {string} name
 * @returns {{ kern: string, rechtsform: string|null }}
 */
export function zerlegeManagementName(name) {
  let text = String(name ?? '').toLowerCase().trim();
  text = text.replace(/\./g, '').replace(/\s+/g, ' ');

  let rechtsform = null;
  for (const { key, regex } of RECHTSFORM_REGEX) {
    const treffer = text.match(regex);
    if (!treffer) continue;
    const rest = text.slice(0, treffer.index).trim();
    // Der Kernname darf nicht leer werden ("GmbH" allein bleibt ein Name)
    if (!rest.replace(/[^\p{L}\p{N}]+/gu, '')) continue;
    rechtsform = key;
    text = rest;
    break;
  }

  const kern = text.replace(/[^\p{L}\p{N}]+/gu, '');
  return { kern, rechtsform };
}

/** Kernname fuer den Vergleich (Rechtsform, Gross/Klein, Leerzeichen, Satzzeichen weg). */
export function managementKernname(name) {
  return zerlegeManagementName(name).kern;
}

/**
 * Alle Managements mit demselben Kernnamen.
 * @param {string} name - neuer Name
 * @param {Array<{id:string, firmenname:string}>} managements
 * @param {string|null} excludeId
 */
export function findeNamensgleiche(name, managements, excludeId = null) {
  const kern = managementKernname(name);
  if (!kern) return [];
  return (managements || []).filter(
    (m) => m && m.id !== excludeId && managementKernname(m.firmenname) === kern
  );
}

// ---------------------------------------------------------------------------
// Zusammenlegen
// ---------------------------------------------------------------------------

// Einzelwert-Felder: gibt es zwei verschiedene Werte, gewinnt der des bleibenden
// Datensatzes, der andere wird als "Weitere Angabe" in die Notiz geschrieben.
export const KONTAKT_FELDER = [
  'email', 'telefonnummer', 'webseite', 'instagram', 'linkedin', 'steuernummer', 'ust_id'
];

// Adresse: als Block behandelt, damit keine Mischadresse entsteht
export const ADRESS_FELDER = ['strasse', 'hausnummer', 'plz', 'stadt', 'land'];

export const KONFLIKT_FELDER = [...KONTAKT_FELDER, ...ADRESS_FELDER];
export const FUELL_FELDER = KONFLIKT_FELDER;

// Logo gehoert als Satz zusammen: fehlt es am bleibenden Datensatz, kommt der ganze
// Satz vom ersten, der eins hat. Zwei verschiedene Logos sind kein Konflikt.
export const LOGO_FELDER = ['logo_url', 'logo_path', 'logo_thumb_url', 'logo_thumb_path'];

const FELD_LABEL = {
  email: 'E-Mail',
  telefonnummer: 'Telefon',
  webseite: 'Webseite',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  steuernummer: 'Steuernummer',
  ust_id: 'USt-IdNr.'
};

// Gleiche Angabe, andere Sprache oder Schreibweise
const SYNONYME = {
  cologne: 'koln',
  germany: 'deutschland',
  'united kingdom': 'uk',
  'vereinigtes konigreich': 'uk',
  'vereinigtes koenigreich': 'uk',
  grossbritannien: 'uk',
  'great britain': 'uk',
  england: 'uk',
  'united states': 'usa',
  'vereinigte staaten': 'usa',
  osterreich: 'austria',
  schweiz: 'switzerland'
};

export function istLeer(wert) {
  return wert === null || wert === undefined || String(wert).trim() === '';
}

/** Wert fuer den Konfliktvergleich normalisieren. */
export function normalisiereFeld(feld, wert) {
  let text = String(wert ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (feld === 'telefonnummer') text = text.replace(/[\s\-/().]/g, '');
  if (feld === 'instagram') text = text.replace(/^@/, '');
  return text;
}

/**
 * Vergleichsschluessel: gleiche Angabe = gleicher Schluessel.
 * Zusaetzlich zu normalisiereFeld: Webseite ohne Schema/www/Slash, Instagram-URL = Handle,
 * Adressfelder ohne Umlaute/Klammern, Strasse = Str., Koeln = Cologne, Deutschland = Germany.
 */
export function vergleichsSchluessel(feld, wert) {
  let t = normalisiereFeld(feld, wert);

  if (feld === 'webseite') {
    return t.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');
  }
  if (feld === 'instagram') {
    return t.replace(/^https?:\/\/(?:www\.)?instagram\.com\//, '').replace(/[/?#].*$/, '').replace(/^@/, '');
  }
  if (feld === 'telefonnummer') {
    return t.replace(/^00/, '+').replace(/^0(?=[1-9])/, '+49');
  }
  if (ADRESS_FELDER.includes(feld)) {
    t = t.replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    t = t.replace(/\([^)]*\)/g, ' ').replace(/strasse/g, 'str').replace(/[^a-z0-9]+/g, ' ').trim();
    t = t.replace(/\bstr\b/g, 'str');
    return SYNONYME[t] || t;
  }
  return t;
}

// a steckt am Anfang von b (an einer Wortgrenze): "im mediapark" in "im mediapark 6a"
function istAnfangVon(a, b) {
  return a !== b && b.startsWith(`${a} `);
}

function verknuepfungen(links, id) {
  const wert = links?.[id];
  return typeof wert === 'number' ? wert : 0;
}

/** Reihenfolge: meiste Verknuepfungen, dann aelter, dann ID (stabil). */
function sortiereBehalten(zeilen, links) {
  return [...zeilen].sort((a, b) => {
    const diff = verknuepfungen(links, b.id) - verknuepfungen(links, a.id);
    if (diff !== 0) return diff;
    const ta = a.created_at ? new Date(a.created_at).getTime() : Infinity;
    const tb = b.created_at ? new Date(b.created_at).getTime() : Infinity;
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });
}

/**
 * Gruppiert die Werte eines Feldes nach "gleiche Angabe".
 * Strasse und Stadt: ein Wert, der am Anfang eines laengeren steht, ist dieselbe Angabe,
 * der laengere gewinnt ("Im Mediapark" -> "Im MediaPark 6A").
 * @returns {Array<{ wert: string, key: string, ids: string[] }>} erste Gruppe = Gewinner
 */
function gruppiereWerte(feld, zeilen, mitAnfang) {
  const gruppen = [];
  for (const z of zeilen) {
    if (istLeer(z[feld])) continue;
    const wert = String(z[feld]).trim();
    const key = vergleichsSchluessel(feld, wert);
    let ziel = gruppen.find((g) => g.key === key);
    if (!ziel && mitAnfang) {
      ziel = gruppen.find((g) => istAnfangVon(g.key, key) || istAnfangVon(key, g.key));
      if (ziel && istAnfangVon(ziel.key, key)) {
        ziel.wert = wert;
        ziel.key = key;
      }
    }
    if (ziel) ziel.ids.push(z.id);
    else gruppen.push({ wert, key, ids: [z.id] });
  }
  return gruppen;
}

function adresseText(z) {
  const strasse = [z.strasse, z.hausnummer].filter((v) => !istLeer(v)).map((v) => String(v).trim()).join(' ');
  const ort = [z.plz, z.stadt].filter((v) => !istLeer(v)).map((v) => String(v).trim()).join(' ');
  return [strasse, ort, istLeer(z.land) ? '' : String(z.land).trim()].filter(Boolean).join(', ');
}

/**
 * Plant das Zusammenlegen aller Namensgleichen. Nichts geht verloren:
 * abweichende Kontaktwerte und Adressen landen als "Weitere Angaben" in der Notiz.
 * Schreibt nichts: liefert nur die Gruppen (`zusammen`, `liegen`).
 *
 * Es bleibt liegen, wenn die Gruppe zwei verschiedene Rechtsformen hat (GmbH gegen AG).
 *
 * @param {Array<Object>} managements - Zeilen aus `management` (id, firmenname, created_at, Felder, notiz)
 * @param {Object<string, number>} links - id -> Anzahl Verknuepfungen (Creator, Ansprechpartner, Vertraege)
 * @returns {{ zusammen: Array<Object>, liegen: Array<Object> }}
 */
export function planeZusammenlegen(managements, links = {}) {
  const gruppen = new Map();
  for (const m of managements || []) {
    const kern = managementKernname(m.firmenname);
    if (!kern) continue;
    if (!gruppen.has(kern)) gruppen.set(kern, []);
    gruppen.get(kern).push(m);
  }

  const zusammen = [];
  const liegen = [];

  for (const [kern, zeilen] of gruppen) {
    if (zeilen.length < 2) continue;

    const geordnet = sortiereBehalten(zeilen, links);
    const ids = geordnet.map((z) => z.id);
    const namen = geordnet.map((z) => z.firmenname);

    // Zwei verschiedene Rechtsformen = vermutlich verschiedene Rechtstraeger
    const formen = new Set(
      geordnet.map((z) => zerlegeManagementName(z.firmenname).rechtsform).filter(Boolean)
    );
    if (formen.size > 1) {
      liegen.push({ kern, grund: 'rechtsform', ids, namen, details: [...formen] });
      continue;
    }

    const behalte = geordnet[0];
    const entfernen = geordnet.slice(1);
    const patch = {};
    const zusatz = []; // { label, wert } -> Notiz

    // Kontaktfelder: Gewinner = bleibender Datensatz, sonst erster mit Wert
    for (const feld of KONTAKT_FELDER) {
      const werte = gruppiereWerte(feld, geordnet, false);
      if (werte.length === 0) continue;
      const [gewinner, ...rest] = werte;
      if (istLeer(behalte[feld])) patch[feld] = gewinner.wert;
      for (const w of rest) zusatz.push({ label: FELD_LABEL[feld], wert: w.wert });
    }

    // Adresse als Block
    const adressWerte = Object.fromEntries(
      ADRESS_FELDER.map((feld) => [feld, gruppiereWerte(feld, geordnet, feld === 'strasse' || feld === 'stadt')])
    );
    const adressKonflikt = ADRESS_FELDER.some((feld) => adressWerte[feld].length > 1);

    if (!adressKonflikt) {
      // Alles dieselbe Angabe: Feld fuer Feld, die vollstaendigere Form gewinnt
      for (const feld of ADRESS_FELDER) {
        const [gewinner] = adressWerte[feld];
        if (!gewinner) continue;
        if (String(behalte[feld] ?? '').trim() !== gewinner.wert) patch[feld] = gewinner.wert;
      }
    } else {
      // Blockweise: die erste Adresse (bleibender Datensatz zuerst) bleibt, die anderen wandern in die Notiz
      const basis = geordnet.find((z) => ADRESS_FELDER.some((f) => !istLeer(z[f])));
      for (const feld of ADRESS_FELDER) {
        if (!istLeer(basis[feld]) && String(behalte[feld] ?? '').trim() !== String(basis[feld]).trim()) {
          patch[feld] = String(basis[feld]).trim();
        }
      }
      const gesehen = new Set([ADRESS_FELDER.map((f) => vergleichsSchluessel(f, basis[f])).join('|')]);
      for (const z of geordnet) {
        if (z === basis || !ADRESS_FELDER.some((f) => !istLeer(z[f]))) continue;
        const key = ADRESS_FELDER.map((f) => vergleichsSchluessel(f, z[f])).join('|');
        if (gesehen.has(key)) continue;
        gesehen.add(key);
        zusatz.push({ label: 'Weitere Adresse', wert: adresseText(z) });
      }
    }

    if (istLeer(behalte.logo_url)) {
      const mitLogo = entfernen.find((z) => !istLeer(z.logo_url));
      if (mitLogo) {
        for (const feld of LOGO_FELDER) {
          if (!istLeer(mitLogo[feld])) patch[feld] = mitLogo[feld];
        }
      }
    }

    // Name mit Rechtsform, falls die Gruppe genau eine hat
    if (formen.size === 1) {
      const mitForm = geordnet.find((z) => zerlegeManagementName(z.firmenname).rechtsform);
      if (mitForm && String(mitForm.firmenname).trim() !== String(behalte.firmenname).trim()) {
        patch.firmenname = String(mitForm.firmenname).trim();
      }
    }

    // Notizen aneinanderhaengen (gleiche Texte nur einmal), dann die weiteren Angaben
    const teile = [];
    for (const z of geordnet) {
      const text = istLeer(z.notiz) ? null : String(z.notiz).trim();
      if (text && !teile.includes(text)) teile.push(text);
    }
    if (zusatz.length > 0) {
      teile.push(
        ['Weitere Angaben aus zusammengelegten Einträgen:', ...zusatz.map((z) => `- ${z.label}: ${z.wert}`)].join('\n')
      );
    }
    const notiz = teile.join('\n\n');
    if (notiz && notiz !== String(behalte.notiz ?? '').trim()) patch.notiz = notiz;

    zusammen.push({
      kern,
      behalte_id: behalte.id,
      name: patch.firmenname || behalte.firmenname,
      entfernen_ids: entfernen.map((z) => z.id),
      namen,
      patch,
      zusatz,
      verknuepfungen: Object.fromEntries(ids.map((id) => [id, verknuepfungen(links, id)]))
    });
  }

  return { zusammen, liegen };
}
