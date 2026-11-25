// skript-referenz-karte.js
// Videovorlage auf Hook-Mechanik, Pace und CTA-Mechanik reduzieren.
// Der Schreib-Aufruf sieht diese Karte, nicht das Rohtranskript.

const { callClaude, MODELS } = require('./anthropic');
const { kuerzeTranskript } = require('./skript-context/formatter');

const KARTE_TOOL = {
  name: 'karte_abgeben',
  description: 'Reduziert eine Videovorlage auf die kreative Bauweise, ohne Wortlaut und ohne Produktfakten.',
  input_schema: {
    type: 'object',
    properties: {
      hook_mechanik: { type: 'string', description: 'Wie der Hook funktioniert, nicht der Wortlaut.' },
      pace: { type: 'string', description: 'Tempo und Schnittfolge, abstrakt.' },
      cta_mechanik: { type: 'string', description: 'Wie der CTA funktioniert, nicht der Wortlaut.' }
    },
    required: ['hook_mechanik', 'pace', 'cta_mechanik']
  }
};

function fmtReferenzKarte(karte) {
  if (!karte || !(karte.hook_mechanik || karte.pace || karte.cta_mechanik)) return '';
  return '\n## VIDEOVORLAGE (nur Bauweise, keine Fakten, kein Wortlaut)\n'
    + `- Hook-Mechanik: ${karte.hook_mechanik || '-'}\n`
    + `- Pace: ${karte.pace || '-'}\n`
    + `- CTA-Mechanik: ${karte.cta_mechanik || '-'}\n`;
}

function kurzFeld(wert) {
  return String(wert || '').trim().slice(0, 400);
}

async function karteAusReferenz(referenz) {
  const text = (referenz?.transkript_verwendet || referenz?.transkript || '').trim();
  if (!text) return null;
  const result = await callClaude({
    model: MODELS.distill,
    systemBlocks: [{
      text: 'Du extrahierst nur die Bauweise eines Videos. Keine Zitate, keine Produktfakten, keine Claims, keine Namen.'
    }],
    userPrompt: `Transkript:\n${kuerzeTranskript(text, 6000)}\n\nGib nur Hook-Mechanik, Pace und CTA-Mechanik zurueck.`,
    maxTokens: 600,
    tool: KARTE_TOOL
  });
  const json = result.json || {};
  if (!json.hook_mechanik && !json.pace && !json.cta_mechanik) return null;
  return {
    hook_mechanik: kurzFeld(json.hook_mechanik),
    pace: kurzFeld(json.pace),
    cta_mechanik: kurzFeld(json.cta_mechanik)
  };
}

module.exports = { fmtReferenzKarte, karteAusReferenz, KARTE_TOOL };
