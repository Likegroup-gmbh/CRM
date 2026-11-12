// teams-meldung-senden.js
// Anstoss aus dem Browser nach einem Video-Kommentar der Kundenseite (ADR 0066). Ohne Body und
// ohne Login: die Function arbeitet nur die Outbox teams_meldung ab, die der Datenbank-Trigger
// gefuellt hat. Der Minuten-Zeitplan holt nach, was hier nicht durchgeht.

const { json } = require('./_shared/ablage/konfig');
const { verteilenAusEnv } = require('./_shared/teams/verteilen');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    return json(200, await verteilenAusEnv({ budgetMs: 8000 }));
  } catch (err) {
    console.error('[teams-meldung-senden]', err?.message || err);
    return json(500, { error: 'Interner Fehler' });
  }
};
