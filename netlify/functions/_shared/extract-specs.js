// extract-specs.js
// Zentrale Feldspezifikation fuer die Webseiten-Extraktion (site-extract).
//
// Ein weiteres Formular wird an genau zwei Stellen freigeschaltet:
//   1. hier einen Eintrag unter SPECS ergaenzen
//   2. im FormConfig des Formulars `aiExtract: true` am URL-Feld setzen
//
// kind: 'fact'  = steht belegbar auf der Seite (Impressum, Meta-Daten, JSON-LD)
//       'guess' = wird interpretiert oder abgeleitet, im UI als Vorschlag markiert
// type: 'number' = Wert wird als Dezimalzahl normalisiert (Waehrung, Komma)
//
// Optional pro Spec:
//   model     - Schluessel aus MODELS in _shared/anthropic.js (Default: extract)
//   maxTokens - Antwortbudget (Default: 2048)
//   images    - Anzahl Produktbilder, die aus der Seite gezogen werden
//   varianten - true: das Modell soll zusaetzlich Produktvarianten liefern

// Wird in den Cache-Key gehasht: Aenderungen an den Specs invalidieren
// automatisch alte Extraktionen, statt veraltete Ergebnisse auszuliefern.
const SPEC_VERSION = 2;

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
  },

  // Produktseiten tragen deutlich mehr Substanz als eine Startseite: Sonnet
  // statt Haiku, weil hier interpretiert werden muss (USP, Pain Points), und
  // ein groesseres Antwortbudget, weil Freitextfelder und Varianten dazukommen.
  produkt: {
    followLinks: [],
    logo: false,
    images: 5,
    varianten: true,
    model: 'extract_produkt',
    maxTokens: 8192,
    fields: [
      {
        name: 'name',
        label: 'Produktname',
        kind: 'fact',
        hint: 'Der Produktname wie auf der Seite, aus <h1>, og:title oder JSON-LD Product.name. Bei einer Kollektion mit Varianten der gemeinsame Oberbegriff: aus "Clear Case iPhone 15 Pro - Sand" wird "Clear Case". Ohne Markennamen davor, ohne Preis, ohne Werbezusaetze wie "NEU" oder "Bestseller".'
      },
      {
        name: 'kurzbeschreibung',
        label: 'Kurzbeschreibung',
        kind: 'fact',
        hint: 'Zwei bis drei Saetze, was das Produkt ist. Aus der Produktbeschreibung oder JSON-LD Product.description. Sachlich zusammenfassen, keine Werbesprache uebernehmen, keine Aufzaehlung.'
      },
      {
        name: 'usp',
        label: 'USP',
        kind: 'guess',
        hint: 'Warum man dieses Produkt kauft. Ein USP pro Zeile, maximal fuenf, jeweils ein kurzer Satz ohne Bulletpoint-Zeichen. Aus Features und Vorteilen ableiten, aber nur was die Seite hergibt. Keine allgemeinen Floskeln wie "hohe Qualitaet".'
      },
      {
        name: 'pain_points',
        label: 'Pain Points',
        kind: 'guess',
        hint: 'Welche konkreten Probleme des Nutzers das Produkt adressiert. Ein Pain Point pro Zeile, maximal fuenf. Formuliert aus Sicht des Nutzers ("Kabel verheddern sich in der Tasche"), nicht als Produktvorteil.'
      },
      {
        name: 'loesung',
        label: 'Loesung',
        kind: 'guess',
        hint: 'Wie das Produkt diese Probleme konkret loest. Zwei bis vier Saetze, mechanisch nachvollziehbar, keine Wiederholung der USPs.'
      },
      {
        name: 'einsatzsituation',
        label: 'Einsatzsituation',
        kind: 'guess',
        hint: 'Wer nutzt das Produkt wann und wo. Konkrete Situationen, zwei bis vier Saetze, z.B. "morgens vor dem Sport", "unterwegs im Zug". Keine Zielgruppen-Demografie.'
      },
      {
        name: 'preis_von',
        label: 'Preis von',
        kind: 'fact',
        type: 'number',
        hint: 'Guenstigster Preis in Euro als Dezimalzahl mit Punkt, z.B. "29.90". Aus JSON-LD offers.price, offers.lowPrice oder der Preisangabe auf der Seite. Bei nur einem Preis diesen hier eintragen. Kein Waehrungszeichen, kein Text.'
      },
      {
        name: 'preis_bis',
        label: 'Preis bis',
        kind: 'fact',
        type: 'number',
        hint: 'Teuerster Preis in Euro als Dezimalzahl mit Punkt, nur wenn es eine echte Preisspanne ueber mehrere Varianten gibt (JSON-LD offers.highPrice oder "ab X bis Y"). Bei einem einzigen Preis null.'
      },
      {
        name: 'inhaltsstoffe',
        label: 'Inhaltsstoffe',
        kind: 'fact',
        hint: 'Zusammensetzung, Materialien oder Wirkstoffe, sofern die Seite sie nennt (INCI-Liste, Materialangabe, Naehrwerte). Wortlaut der Seite uebernehmen. Nichts ergaenzen, nichts erfinden.'
      },
      {
        name: 'erlaubte_claims',
        label: 'Erlaubte Claims',
        kind: 'guess',
        hint: 'Aussagen, die die Marke selbst auf der Seite trifft und die ein Creator deshalb auch treffen darf. Ein Claim pro Zeile, maximal acht, im Wortlaut der Seite. Nur was tatsaechlich dort steht.'
      },
      {
        name: 'verbotene_claims',
        label: 'Verbotene Claims',
        kind: 'guess',
        hint: 'Aussagen, die bei dieser Produktkategorie rechtlich problematisch sind und deshalb nicht getroffen werden duerfen - etwa Heilversprechen bei Kosmetik oder Nahrungsergaenzung, Wirkungsversprechen ohne Health-Claim-Zulassung. Ein Punkt pro Zeile, maximal fuenf. Nur setzen, wenn die Produktkategorie das eindeutig hergibt.'
      },
      {
        name: 'rechtliche_hinweise',
        label: 'Rechtliche Hinweise',
        kind: 'fact',
        hint: 'Pflichtangaben, Disclaimer oder Kennzeichnungspflichten von der Seite, z.B. "Nahrungsergaenzungsmittel sind kein Ersatz fuer eine ausgewogene Ernaehrung", Altersfreigaben, Warnhinweise. Im Wortlaut der Seite.'
      }
    ]
  }
};

const VARIANTEN_INSTRUCTION = `Zusaetzlich das Feld "_varianten": Array der auf der Seite auswaehlbaren Produktvarianten, maximal 10 Eintraege. Jeder Eintrag: { "name": <Anzeigename der Variante>, "farbe": <Farbe oder Ausfuehrung oder null>, "modell_kompatibilitaet": <bei Zubehoer das passende Geraet, sonst null>, "preis": <Dezimalzahl mit Punkt oder null, nur wenn abweichend>, "merkmal": <weiteres Unterscheidungsmerkmal oder null> }.
Nur echte Varianten desselben Produkts aufnehmen - keine anderen Produkte des Shops, keine Mengenrabatte, keine Abo-Optionen. Wenn die Seite keine Varianten anbietet: leeres Array.`;

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
  const lines = spec.fields.map((f) => {
    const art = f.kind === 'fact' ? 'BELEGBAR' : 'ABGELEITET';
    return `- "${f.name}" (${f.label}, ${art}): ${f.hint}`;
  });
  if (spec.varianten) lines.push('', VARIANTEN_INSTRUCTION);
  return lines.join('\n');
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
