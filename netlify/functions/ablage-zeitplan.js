// ablage-zeitplan.js
// Scheduled Function (jede Minute, siehe netlify.toml): Sicherheitsnetz fuer den Webhook.
// 1. Abo auf die Bibliothek anlegen bzw. verlaengern, wenn es in weniger als 3 Tagen ablaeuft.
// 2. ablage-abgleich-background anstossen, wenn gerade kein Lauf die Lease haelt. Die Arbeit
//    laeuft dort: Scheduled Functions haben nur 30 Sekunden.
// 3. ablage-rechte-background anstossen: sofort bei rechte_faellig (Trigger auf Zuordnungen,
//    Rollen, Klassen, Ordnern), sonst alle 15 Minuten.
// 4. ablage-umzug-background: so viele Laeufer anstossen, dass bis zu ABLAGE_UMZUG_PARALLEL
//    (Standard 2) gleichzeitig offene Umzugs-Zeilen abarbeiten.
// 5. Alarme pruefen (Stillstand, Abo, Zertifikat, Speicher, Rechte) und Admins mailen.
// Laeuft nur auf dem veroeffentlichten Production-Deploy; Staging ist eine eigene Site.

const { webhookUrl, anstossen } = require('./_shared/ablage/konfig');
const { ablageAusEnv } = require('./_shared/ablage');
const { createAbgleich } = require('./_shared/ablage/abgleich');
const { createUmzug, PARALLEL } = require('./_shared/ablage/umzug');
const { createAlarm } = require('./_shared/ablage/alarm');

const RECHTE_MS = 15 * 60 * 1000;

function rechteFaellig(stand, jetzt = Date.now()) {
  if (!stand?.drive_id) return false;
  if (stand.rechte_lease_bis && Date.parse(stand.rechte_lease_bis) > jetzt) return false;
  return !!stand.rechte_faellig || !stand.rechte_lauf || jetzt - Date.parse(stand.rechte_lauf) >= RECHTE_MS;
}

async function schritt(name, fn) {
  try {
    return await fn();
  } catch (err) {
    console.error(`[ablage-zeitplan] ${name}:`, err.message);
    return { fehler: err.message };
  }
}

exports.handler = async (event) => {
  const ablage = ablageAusEnv();
  if (!ablage) return { statusCode: 200, body: JSON.stringify({ nicht_konfiguriert: true }) };
  const a = createAbgleich({ supabase: ablage.supabase, ablage });

  const abo = await schritt('Abo', () => a.aboSicherstellen({ notificationUrl: webhookUrl(), clientState: ablage.konfig.clientState }));
  const stand = await schritt('Stand', () => a.stand());
  const laeuft = !!stand?.lease_bis && Date.parse(stand.lease_bis) > Date.now();
  const angestossen = laeuft ? false : await anstossen(event, 'ablage-abgleich-background', { grund: 'zeitplan' });
  const rechte = rechteFaellig(stand) ? await anstossen(event, 'ablage-rechte-background', { grund: 'zeitplan' }) : false;

  const parallel = Math.max(1, Number(process.env.ABLAGE_UMZUG_PARALLEL) || PARALLEL);
  const bedarf = await schritt('Umzug', () => createUmzug({ supabase: ablage.supabase, ablage }).laeuferBedarf({ parallel }));
  let umzug = 0;
  for (let i = 0; i < (Number(bedarf) || 0); i++) {
    if (await anstossen(event, 'ablage-umzug-background', { grund: 'zeitplan' })) umzug++;
  }

  const alarm = await schritt('Alarm', () => createAlarm({ supabase: ablage.supabase, ablage }).lauf(stand));

  console.log(`[ablage-zeitplan] abo=${abo?.abo || abo?.fehler || '–'} laeuft=${laeuft} angestossen=${angestossen} rechte=${rechte} umzug=${umzug} alarme=${alarm?.aktiv?.join(',') || alarm?.fehler || '–'}`);
  return { statusCode: 200, body: JSON.stringify({ abo, laeuft, angestossen, rechte, umzug, alarm }) };
};

exports.rechteFaellig = rechteFaellig;
