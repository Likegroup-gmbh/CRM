// prompt.cjs
// Prompt und Tool-Schema fuer den Neuigkeiten-Kurztext aus einem Deploy-Diff.
// In eigener Datei, damit run.cjs die Orchestrierung lesbar bleibt und der
// Sanitizer separat testbar ist.
//
// Seit dem Dashboard-Umbau gibt es keine Schritte, Screenshots und Routen
// mehr: eine Neuigkeit ist nur noch titel + kurztext (Du-Form, 1-3 Saetze).

const TITEL_MAX = 120;
const KURZTEXT_MAX = 500;

const NEUIGKEIT_TOOL = {
  name: 'neuigkeit_post',
  description: 'Kurz-Update fuer das interne Dashboard nach einem Deploy. user_relevant=false, wenn der Diff nichts an der Bedienung aendert.',
  input_schema: {
    type: 'object',
    properties: {
      user_relevant: {
        type: 'boolean',
        description: 'true, wenn Mitarbeiter in der Bedienung etwas Neues sehen oder anders machen. false bei reinen Tests, Build/Config, Refactorings, Doku oder Migrationen ohne sichtbare Folge.'
      },
      titel: { type: 'string', description: 'Max 60 Zeichen, nennt die Funktion, nicht die Technik.' },
      kurztext: { type: 'string', description: '1-3 Saetze, Du-Form: was ist neu und wo du es findest. Keine Anleitung, kein Tutorial.' }
    },
    required: ['user_relevant']
  }
};

function buildSystemPrompt() {
  return [
    'Du schreibst die internen Update-Notizen fuer LikeBase, das CRM einer Influencer-Marketing-Agentur.',
    'Nach jedem Deploy liest du Commits und Code-Diff und entscheidest: sieht ein Mitarbeiter in der Bedienung etwas Neues oder macht etwas anders?',
    '',
    'Deine Leser sind Mitarbeiter, keine Entwickler. Sie ueberfliegen die Notiz auf dem Dashboard in wenigen Sekunden.',
    '',
    'Regeln:',
    '- Einfaches Deutsch, kurze Saetze, Du-Form.',
    '- kurztext: 1-3 Saetze. Was ist neu, fuer wen ist es relevant, wo findest du es. Keine Schritt-fuer-Schritt-Anleitung, kein Tutorial-Ton, keine Ueberschriften, keine Listen.',
    '- Keine Dateinamen, keine technischen Begriffe (RLS, Migration, Endpoint, Refactoring, Komponente), keine Commit-Hashes, keine Ticket-IDs.',
    '- titel nennt die Funktion, nicht die Technik. Gut: "Personas lassen sich jetzt als Ordner gruppieren". Schlecht: "PersonaFolderRenderer eingefuehrt".',
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

// Bereinigt einen Modell-Text: nur Strings, getrimmt, Laenge gedeckelt.
// Gibt null zurueck, wenn nichts Verwertbares uebrig bleibt.
function sanitizeText(wert, max = KURZTEXT_MAX) {
  if (typeof wert !== 'string') return null;
  const getrimmt = wert.trim();
  if (!getrimmt) return null;
  return getrimmt.slice(0, max);
}

function sanitizeTitel(wert) {
  return sanitizeText(wert, TITEL_MAX);
}

function sanitizeKurztext(wert) {
  return sanitizeText(wert, KURZTEXT_MAX);
}

module.exports = { NEUIGKEIT_TOOL, buildSystemPrompt, buildUserPrompt, sanitizeTitel, sanitizeKurztext, TITEL_MAX, KURZTEXT_MAX };
