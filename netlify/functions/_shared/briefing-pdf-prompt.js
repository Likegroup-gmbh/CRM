// briefing-pdf-prompt.js
// Tools und Prompts für Liky am Briefing-Formular (briefing-pdf-background.js).
// Die Felder folgen dem Creator-Briefing-PDF (ADR 0073); die Spec kommt vom Client
// aus briefingFelder.json, die Regeln hier sagen, was wohin gehört.

const { verlaufZuMessages } = require('./chat-verlauf');

const FELD_EINTRAG = {
  type: 'object',
  properties: {
    value: {},
    kind: { type: 'string', enum: ['fact', 'guess'] },
    from: { type: 'string' }
  },
  required: ['value']
};

const EXTRACT_TOOL = {
  name: 'briefing_extract_abgeben',
  description: 'Gibt die aus dem Kundenbriefing erkannten Felder ab.',
  input_schema: {
    type: 'object',
    properties: {
      fields: {
        type: 'object',
        description: 'Feldname -> { value, kind: fact|guess, from }',
        additionalProperties: FELD_EINTRAG
      },
      missing: { type: 'array', items: { type: 'string' } },
      unternehmen_hint: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          passt: { type: 'boolean' }
        }
      }
    },
    required: ['fields']
  }
};

const CHAT_TOOL = {
  name: 'briefing_chat_abgeben',
  description: 'Antwortet im Chat und liefert Feld-Patches.',
  input_schema: {
    type: 'object',
    properties: {
      reply: { type: 'string' },
      patches: {
        type: 'object',
        additionalProperties: {
          ...FELD_EINTRAG,
          properties: { ...FELD_EINTRAG.properties, force: { type: 'boolean' } }
        }
      }
    },
    required: ['reply']
  }
};

const FELD_REGELN = [
  '- aktivierung_name: der Kampagnentitel.',
  '- nutzung_markenkanal / nutzung_paid_media / nutzung_creator_kanal: wie der Content verwendet wird '
    + '(Owned Media, Paid Ads, Influencer-Marketing). Nur true setzen, was das PDF nennt.',
  '- plattformen und seitenverhaeltnisse: nur options.value. Andere Plattformen oder Formate als Text in '
    + 'plattformen_weitere bzw. seitenverhaeltnis_weitere.',
  '- videolaenge: gewünschte Länge als { "von": 15, "bis": 30 } in Sekunden; eine Mindestlänge '
    + '("mindestens 30 Sekunden", "ab 30 s") als { "von": 30, "bis": null }.',
  '- nutzungsrechte: alles zur Nutzung: Nutzungsdauer, Accounts, Collab-Post, Partnership- oder Spark Ads, '
    + 'Whitelisting, Rohmaterial, Buyout. Ein Text.',
  '- content_deadline / go_live: Datum "YYYY-MM-DD". Ein Zeitraum wird zu Start (content_deadline, go_live) '
    + 'und Ende (content_deadline_bis, go_live_bis). Kalenderwochen nur, wenn das Datum eindeutig ist.',
  '- produkte: array, ein Objekt pro beworbenem Produkt: { name, url, kurzbeschreibung, usp, loesung }. '
    + 'usp = Produkteigenschaften, eine pro Zeile. loesung = welches Problem es löst oder welchen Nutzen es bietet. '
    + 'Nur Keys, die im PDF belegt sind.',
  '- beschreibung: Kampagnenidee und Zielgruppe in einem Text.',
  '- kernbotschaft: was beim Publikum hängen bleiben soll. Ein bis zwei Sätze.',
  '- aufgabe: was der Creator im Video tun soll.',
  '- vorgabe_pflicht: was gesagt oder gezeigt werden muss: Produktintegration, sichtbare Elemente, '
    + 'Pflichtaussagen, CTA, Rabattcode, rechtliche Hinweise und Kennzeichnung. Ein Punkt pro Zeile.',
  '- setting: Drehort, Licht, Stimmung, Produktionshinweise.',
  '- vorgabe_dos / vorgabe_donts: Gewünschtes und zu Vermeidendes getrennt, ein Punkt pro Zeile. Verbote mit '
    + '"kein", "nicht" oder "ohne" formulieren. Gilt ein Verbot der Person ("Creator ohne Haustier"), so schreiben, '
    + 'gilt es dem Video, dann mit Bezug ("Im Bild keine Kinder"). Nichts dazuerfinden.',
  '- umsetzungsideen_eintraege: array von { text, verbindlich }. Ein Eintrag pro Idee, Storyline oder '
    + 'Referenz-Link; Links als eigener Eintrag. verbindlich=true nur, wenn das PDF die Idee ausdrücklich '
    + 'vorschreibt ("muss so umgesetzt werden", "Pflicht-Szene"), sonst false (Inspiration). Hook-, '
    + 'Dramaturgie- und Pflichtvorgaben sind keine Ideen: die gehören in vorgabe_pflicht oder aufgabe.'
].join('\n');

function buildExtractPrompt({ spec, unternehmenName, markeName, schonGelesen = [] }) {
  const stable = 'Du bist Liky, der KI-Assistent im CRM. Du liest ein Kundenbriefing '
    + '(PDF) und fuellst damit das Briefing-Formular vor. Antworte ausschliesslich '
    + 'ueber das Tool "briefing_extract_abgeben". Deutsch. Keine Floskeln.';

  let task = '# AUFTRAG\n'
    + 'Lies das PDF und belege die Felder der Spec. Nur was im PDF steht. '
    + 'Enums auf options.value mappen. Nichts erfinden. Formular ist Deutsch.\n\n';

  if (unternehmenName) task += `Unternehmen: ${unternehmenName}\n`;
  if (markeName) task += `Marke: ${markeName}\n`;
  if (schonGelesen.length) {
    task += `Schon aus den Formularfeldern des PDFs gelesen (nicht nochmal liefern): ${schonGelesen.join(', ')}\n`;
  }

  task += '\n# SPEC\n' + JSON.stringify(spec, null, 2) + '\n\n';
  task += '# REGELN\n'
    + '- Spec ist geschlossen: nur Felder aus der Spec belegen. Was keinem Feld '
    + 'zugeordnet werden kann, weglassen. Keine Rueckfragen, keine Extra-Keys. '
    + 'Kunden-PDFs enthalten oft Irrelevantes (Scope, Kontakte, Zeitplaene).\n'
    + '- Ignorieren: Ansprechpartner/Kontaktpersonen, Agentur-Leistungsbeschreibung, '
    + 'interne Projektplaene, Budget, Legal-Boilerplate, Deckblatt-Metadaten.\n'
    + '- fields: Objekt Feldname -> { value, kind, from }. kind=fact wenn direkt im Text, '
    + 'kind=guess wenn abgeleitet. from = kurzer Quellverweis (Seite/Abschnitt).\n'
    + '- value exakt in der Form, die valueShape des Feldes vorgibt.\n'
    + FELD_REGELN + '\n'
    + '- missing: Felder, die das Creator-Briefing braucht und die leer bleiben (z.B. aktivierung_name).\n'
    + '- unternehmen_hint: Name aus dem PDF, passt = ob er zum gewaehlten Unternehmen passt.\n';

  return { stable, task };
}

function buildChatPrompt({ spec, history, formData, userText }) {
  const stable = 'Du bist Liky, der KI-Assistent im CRM. Du hilfst beim Ausfuellen '
    + 'des Briefing-Formulars. Antworte ausschliesslich ueber das Tool '
    + '"briefing_chat_abgeben". Deutsch. Knapp.';

  let task = '# KONTEXT\n';
  task += 'Spec: ' + JSON.stringify(spec, null, 2) + '\n\n';
  task += 'Aktueller Formularstand: ' + JSON.stringify(formData, null, 2) + '\n\n';
  task += `User: ${userText}\n\n`;
  task += '# REGELN\n'
    + '- reply: deine Antwort an den User.\n'
    + '- Du siehst KEIN PDF und kein Kundenbriefing. Dir liegen nur der '
    + 'Formularstand und der Chat vor. Erfinde keine Briefing-Inhalte, Zahlen '
    + 'oder Termine - wenn etwas fehlt, frag nach.\n'
    + '- patches: nur Felder, die der User geaendert haben will. '
    + 'patches.feldname = { value, kind, from }. value exakt in der Form, die '
    + 'valueShape des Feldes vorgibt. Ein Aenderungswunsch gehoert immer in patches. '
    + 'Ein Reply ohne patches aendert das Formular nicht.\n'
    + '- force=true nur wenn der User explizit ueberschreiben will (z.B. "Deadline weg").\n'
    + FELD_REGELN + '\n';

  return {
    stable,
    task,
    messages: verlaufZuMessages(history, { task, limit: 10, dropTrailingUser: userText })
  };
}

module.exports = { EXTRACT_TOOL, CHAT_TOOL, buildExtractPrompt, buildChatPrompt };
