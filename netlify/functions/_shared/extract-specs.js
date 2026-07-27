// extract-specs.js
// Zentrale Feldspezifikation fuer die Webseiten-Extraktion (site-extract).
//
// Ein weiteres Formular wird an genau zwei Stellen freigeschaltet:
//   1. hier einen Eintrag unter SPECS ergaenzen
//   2. im FormConfig des Formulars `aiExtract: true` am URL-Feld setzen
//
// kind: 'fact'  = steht belegbar auf der Seite (Impressum, Meta-Daten, JSON-LD)
//       'guess' = wird interpretiert oder abgeleitet, im UI als Vorschlag markiert

// Wird in den Cache-Key gehasht: Aenderungen an den Specs invalidieren
// automatisch alte Extraktionen, statt veraltete Ergebnisse auszuliefern.
const SPEC_VERSION = 1;

const SPECS = {
  unternehmen: {
    // Zusaetzlich zur eingegebenen URL geladene Unterseiten
    followLinks: ['impressum'],
    logo: true,
    fields: [
      {
        name: 'firmenname',
        label: 'Firmenname',
        kind: 'fact',
        hint: 'Vollstaendiger rechtlicher Firmenname inklusive Rechtsform, z.B. "Muster Handels GmbH" oder "Beispiel AG". Bevorzugt aus dem Impressum. NICHT der verkuerzte Markenname aus dem Seitentitel oder Logo.'
      },
      {
        name: 'rechnungsadresse_strasse',
        label: 'Strasse',
        kind: 'fact',
        hint: 'Nur der Strassenname ohne Hausnummer, z.B. "Musterweg". Aus der Anschrift im Impressum.'
      },
      {
        name: 'rechnungsadresse_hausnummer',
        label: 'Hausnummer',
        kind: 'fact',
        hint: 'Nur die Hausnummer, inklusive Zusatz wie "12a" oder "5-7". Getrennt vom Strassennamen.'
      },
      {
        name: 'rechnungsadresse_plz',
        label: 'PLZ',
        kind: 'fact',
        hint: 'Postleitzahl, z.B. "10115".'
      },
      {
        name: 'rechnungsadresse_stadt',
        label: 'Stadt',
        kind: 'fact',
        hint: 'Ort ohne PLZ und ohne Ortsteil-Zusatz in Klammern.'
      },
      {
        name: 'rechnungsadresse_land',
        label: 'Land',
        kind: 'fact',
        hint: 'Land ausgeschrieben auf Deutsch, z.B. "Deutschland", "Oesterreich", "Schweiz". Wenn die Adresse deutsch ist und kein Land genannt wird, "Deutschland".'
      },
      {
        name: 'webseite',
        label: 'Webseite',
        kind: 'fact',
        hint: 'Die Hauptdomain der Firma als vollstaendige URL mit https und ohne Pfad, Tracking-Parameter oder abschliessenden Slash, z.B. "https://www.muster.de".'
      },
      {
        name: 'invoice_email',
        label: 'Rechnungs-Email',
        kind: 'guess',
        hint: 'E-Mail-Adresse fuer Rechnungen. Falls keine explizite Rechnungs- oder Buchhaltungsadresse genannt wird, die allgemeine Kontaktadresse aus dem Impressum verwenden. Keine Adresse erfinden.'
      }
    ]
  },

  marke: {
    // Bewusst ohne Impressum: dort steht der Firmenname mit Rechtsform, nicht
    // der Markenname. Spart den zweiten Seitenabruf.
    followLinks: [],
    logo: true,
    fields: [
      {
        name: 'markenname',
        label: 'Markenname',
        kind: 'fact',
        hint: 'Der Name, unter dem die Marke nach aussen auftritt - so wie im Logo, im Seitentitel, in og:site_name oder im JSON-LD. OHNE Rechtsform: aus "true fruits GmbH" wird "true fruits", aus "Muster Handels AG" wird "Muster". Auch Shop-Zusaetze weglassen: aus "Veganz Shop" wird "Veganz", aus "Muster Online-Store" wird "Muster". Keine Slogans oder Claims (nicht "Veganer Genuss aus Berlin"), keine Domain. Eigenschreibweise der Marke beibehalten, auch Kleinschreibung.'
      }
    ]
  }
};

function getSpec(entityType) {
  const spec = SPECS[entityType];
  if (!spec) {
    throw new Error(`Keine Extraktions-Spec fuer "${entityType}" hinterlegt`);
  }
  return spec;
}

function hasSpec(entityType) {
  return Boolean(SPECS[entityType]);
}

/**
 * Baut die Feldbeschreibung fuer den Prompt. Bewusst als Text und nicht als
 * JSON-Schema: Claude haelt sich an eine kommentierte Liste besser als an
 * ein formales Schema, und die Hints stehen direkt am Feld.
 */
function buildFieldInstructions(spec) {
  return spec.fields
    .map((f) => {
      const art = f.kind === 'fact' ? 'BELEGBAR' : 'ABGELEITET';
      return `- "${f.name}" (${f.label}, ${art}): ${f.hint}`;
    })
    .join('\n');
}

function getFieldKinds(spec) {
  const kinds = {};
  for (const f of spec.fields) kinds[f.name] = f.kind;
  return kinds;
}

module.exports = {
  SPEC_VERSION,
  getSpec,
  hasSpec,
  buildFieldInstructions,
  getFieldKinds
};
