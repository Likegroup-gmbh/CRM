// prompt.cjs
// Prompt und Tool-Schema fuer den Neuigkeiten-Post aus einem Deploy-Diff.
// In eigener Datei, damit run.cjs die Orchestrierung lesbar bleibt und die
// Allowlist/Sanitizer separat testbar sind.

// Routen, auf denen ein Screenshot Sinn ergibt und die die App kennt.
// Alles ausserhalb dieser Liste wird verworfen (halluzinierte URLs).
const ROUTE_ALLOWLIST = [
  '/dashboard',
  '/unternehmen',
  '/persona',
  '/produkt',
  '/ansprechpartner',
  '/management',
  '/creator',
  '/creator-lists',
  '/kampagne',
  '/kooperation',
  '/briefing',
  '/skripte',
  '/sourcing',
  '/strategie',
  '/videos',
  '/rechnung',
  '/ausgangsrechnungen',
  '/vertraege',
  '/contracts',
  '/auftrag',
  '/auftragsdetails',
  '/tasks',
  '/mitarbeiter',
  '/kunden-admin',
  '/feedback',
  '/education',
  '/ki-usage',
  '/stakeholder',
  '/shares',
  '/neuigkeiten'
];

const MAX_SCHRITTE = 6;

const NEUIGKEIT_TOOL = {
  name: 'neuigkeit_post',
  description: 'Update-Post fuer das interne Dashboard nach einem Deploy. user_relevant=false, wenn der Diff nichts an der Bedienung aendert.',
  input_schema: {
    type: 'object',
    properties: {
      user_relevant: {
        type: 'boolean',
        description: 'true, wenn Mitarbeiter in der Bedienung etwas Neues sehen oder anders machen. false bei reinen Tests, Build/Config, Refactorings, Doku oder Migrationen ohne sichtbare Folge.'
      },
      titel: { type: 'string', description: 'Max 60 Zeichen, nennt die Funktion, nicht die Technik.' },
      teaser: { type: 'string', description: 'Ein Satz, max 140 Zeichen: was ist neu, fuer wen.' },
      inhalt: { type: 'string', description: 'Markdown, 1-2 Absaetze: was ist neu und warum es hilft.' },
      schritte: {
        type: 'array',
        description: '1-6 Schritte zum Ausprobieren.',
        items: {
          type: 'object',
          properties: {
            titel: { type: 'string', description: 'Imperativ, kurz, z.B. "Oeffnen Sie die Produktliste".' },
            text: { type: 'string', description: 'Was man dort sieht.' },
            route: { type: 'string', description: 'Startseite des Schritts, nur aus der erlaubten Routenliste.' }
          },
          required: ['titel', 'text']
        }
      }
    },
    required: ['user_relevant']
  }
};

function buildSystemPrompt() {
  return [
    'Du schreibst die internen Update-Notizen fuer LikeBase, das CRM einer Influencer-Marketing-Agentur.',
    'Nach jedem Deploy liest du Commits und Code-Diff und entscheidest: sieht ein Mitarbeiter in der Bedienung etwas Neues oder macht etwas anders?',
    '',
    'Deine Leser sind Mitarbeiter, keine Entwickler. Sie wollen wissen: was kann ich jetzt, wo finde ich es, wie geht es.',
    '',
    'Regeln:',
    '- Einfaches Deutsch, kurze Saetze, Sie-Form.',
    '- Keine Dateinamen, keine technischen Begriffe (RLS, Migration, Endpoint, Refactoring, Komponente), keine Commit-Hashes, keine Ticket-IDs.',
    '- titel nennt die Funktion, nicht die Technik. Gut: "Personas lassen sich jetzt als Ordner gruppieren". Schlecht: "PersonaFolderRenderer eingefuehrt".',
    '- inhalt: was ist neu und warum es hilft. Keine Ueberschriften, keine Aufzaehlung von Dateien.',
    '- schritte: konkret zum Nachklicken. Jeder Schritt sagt, wo man startet (route) und was man dann sieht.',
    '- Nur Routen aus dieser Liste: ' + ROUTE_ALLOWLIST.join(', '),
    '- Im Zweifel eher user_relevant=false als ein seichter Post.'
  ].join('\n');
}

function buildUserPrompt({ commits, stat, diff }) {
  return [
    'Commits seit dem letzten verarbeiteten Deploy:',
    commits || '(keine)',
    '',
    'Diff-Statistik:',
    stat || '(leer)',
    '',
    'Diff (gekuerzt):',
    diff || '(leer)'
  ].join('\n');
}

// Bereinigt die Modell-Schritte: fehlende Felder raus, Route gegen die
// Allowlist, Laenge begrenzt. Gibt ein sauberes Array zurueck.
function sanitizeSchritte(schritte) {
  if (!Array.isArray(schritte)) return [];
  return schritte
    .filter((s) => s && typeof s.titel === 'string' && typeof s.text === 'string' && s.titel.trim() && s.text.trim())
    .slice(0, MAX_SCHRITTE)
    .map((s) => ({
      titel: s.titel.trim(),
      text: s.text.trim(),
      route: ROUTE_ALLOWLIST.includes(s.route) ? s.route : null,
      screenshot_path: null
    }));
}

function slugify(titel) {
  return String(titel || 'update')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'update';
}

module.exports = { ROUTE_ALLOWLIST, NEUIGKEIT_TOOL, buildSystemPrompt, buildUserPrompt, sanitizeSchritte, slugify };
