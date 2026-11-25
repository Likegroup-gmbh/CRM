// poster-abgleich.js
// Scheduled Function (siehe netlify.toml): Abgleich der Poster (ADR 0064).
// 1. Verwaiste Poster entfernen (Asset geloescht, ersetzt oder umbenannt).
// 2. Stand lesen und loggen.
// 3. Ist etwas offen (Bestand, neue Uploads, Replace, Retries), poster-erzeugen-background
//    anstossen. Die Arbeit selbst laeuft dort: Scheduled Functions haben nur 30 Sekunden.
// Laeuft nur auf dem veroeffentlichten Production-Deploy; auf Branch-Deploys erzeugt
// ausschliesslich der Read-Repair aus poster-urls.

const { erzeugungAnstossen } = require('./_shared/poster');
const { posterAusEnv } = require('./_shared/poster-generator');

async function schritt(name, fn) {
  try {
    return await fn();
  } catch (err) {
    console.error(`[poster-abgleich] ${name}:`, err.message);
    return null;
  }
}

exports.handler = async (event) => {
  let gen;
  try {
    gen = posterAusEnv();
  } catch (err) {
    console.error('[poster-abgleich]', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }

  const verwaist = await schritt('Verwaiste', () => gen.verwaisteEntfernen());
  const stand = await schritt('Stand', () => gen.stand());
  const angestossen = stand?.offen > 0 ? await erzeugungAnstossen(event) : false;

  console.log(
    `[poster-abgleich] soll=${stand?.soll ?? '–'} ready=${stand?.ready ?? '–'} failed=${stand?.failed ?? '–'}`
    + ` offen=${stand?.offen ?? '–'} verwaist=${verwaist ?? '–'} angestossen=${angestossen}`,
  );
  return { statusCode: 200, body: JSON.stringify({ stand, verwaist, angestossen }) };
};
