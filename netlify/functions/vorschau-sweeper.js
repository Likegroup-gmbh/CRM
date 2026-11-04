// vorschau-sweeper.js
// Scheduled Function (alle 2 Minuten): Sicherheitsnetz der Vorschau-Outbox (ADR 0061).
// 1. Faellige Auftraege abarbeiten (verlorene Database-Webhook-Anstoesse, Retries).
// 2. Haengende Vorschaudateien direkt bei Cloudflare abgleichen (Reconciliation).
// 3. Zaehler fuer den Betrieb loggen: pending > 10 min und failed.

const { vorschauAusEnv } = require('./_shared/vorschau-verarbeitung');

async function schritt(name, fn) {
  try {
    return await fn();
  } catch (err) {
    console.error(`[vorschau-sweeper] ${name}:`, err);
    return null;
  }
}

exports.handler = async () => {
  let v;
  try {
    v = vorschauAusEnv();
  } catch (err) {
    console.error('[vorschau-sweeper]', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }

  const auftraege = await schritt('Auftraege', () => v.verarbeiteAuftraege());
  const abgleich = await schritt('Abgleich', () => v.abgleich());
  const z = await schritt('Zaehler', () => v.zaehler());

  const line = `[vorschau-sweeper] Auftraege ${auftraege?.length ?? '–'}, abgeglichen ${abgleich?.length ?? '–'}`
    + (z ? ` | haengend=${z.haengend} failed=${z.failed} auftraege_haengend=${z.auftraegeHaengend} auftraege_failed=${z.auftraegeFailed}` : '');
  if (z && (z.haengend || z.auftraegeHaengend)) console.warn(line);
  else console.log(line);

  return { statusCode: 200, body: JSON.stringify({ auftraege, abgleich, zaehler: z }) };
};
