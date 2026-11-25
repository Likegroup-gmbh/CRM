// poster-erzeugen-background.js
// Erzeuger der Poster (ADR 0064). Background Function: antwortet sofort 202, laeuft bis zu
// 15 Minuten. Angestossen von poster-urls (Read-Repair) und poster-abgleich (Scheduled),
// geschuetzt ueber x-poster-secret. Der Inhalt des Aufrufs ist egal: die Function claimt
// faellige Schluessel selbst. Ist das Zeitbudget aus und noch Bestand offen, stoesst sie
// sich einmal selbst wieder an.

const { secretOk, erzeugungAnstossen } = require('./_shared/poster');
const { posterAusEnv } = require('./_shared/poster-generator');

const BUDGET_MS = 12 * 60 * 1000;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!secretOk(event)) return { statusCode: 401, body: 'Nicht autorisiert' };

  try {
    const summe = await posterAusEnv().lauf({ budgetMs: BUDGET_MS });
    console.log(`[poster-erzeugen] ${JSON.stringify(summe)}`);
    if (summe.mehr) await erzeugungAnstossen(event);
    return { statusCode: 200, body: JSON.stringify(summe) };
  } catch (err) {
    console.error('[poster-erzeugen]', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
