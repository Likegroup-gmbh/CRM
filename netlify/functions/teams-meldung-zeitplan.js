// teams-meldung-zeitplan.js
// Sicherheitsnetz fuer die Teams-Meldungen (ADR 0066): jede Minute die Outbox abarbeiten,
// auch Wiederholungen nach Fehlern. Scheduled Functions haben 30 s.

const { verteilenAusEnv } = require('./_shared/teams/verteilen');

exports.handler = async () => {
  try {
    const ergebnis = await verteilenAusEnv({ budgetMs: 20000 });
    if (ergebnis.gesendet || ergebnis.fehler) console.log('[teams-meldung-zeitplan]', JSON.stringify(ergebnis));
    return { statusCode: 200, body: JSON.stringify(ergebnis) };
  } catch (err) {
    console.error('[teams-meldung-zeitplan]', err?.message || err);
    return { statusCode: 500, body: JSON.stringify({ error: err?.message || 'Fehler' }) };
  }
};
