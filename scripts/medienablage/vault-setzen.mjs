// vault-setzen.mjs
// Schreibt Schluessel und Zertifikat der Entra-App in den Supabase Vault
// (medienablage_schluessel, medienablage_zertifikat) und liest zur Kontrolle zurueck.
//
// Aufruf:
//   node scripts/medienablage/vault-setzen.mjs [--env .env] [--key .secrets/medienablage-app.key] [--cert .secrets/medienablage-app.crt]
// Braucht die Migration 20261201_medienablage.sql im Zielprojekt.

import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { ladeEnv, argumente, supabaseService } from './_env.mjs';

async function main() {
  const args = argumente();
  ladeEnv(args.env || '.env');
  const keyPem = readFileSync(args.key || '.secrets/medienablage-app.key', 'utf8');
  const certPem = readFileSync(args.cert || '.secrets/medienablage-app.crt', 'utf8');

  const x509 = new crypto.X509Certificate(certPem);
  if (!x509.checkPrivateKey(crypto.createPrivateKey(keyPem))) {
    throw new Error('Schluessel passt nicht zum Zertifikat');
  }
  const x5t = crypto.createHash('sha1').update(x509.raw).digest('base64url');

  const db = supabaseService();
  for (const [name, wert] of [['medienablage_schluessel', keyPem], ['medienablage_zertifikat', certPem]]) {
    const { error } = await db.rpc('ablage_geheimnis_setzen', { p_name: name, p_wert: wert });
    if (error) throw new Error(`${name}: ${error.message}`);
    const back = await db.rpc('ablage_geheimnis', { p_name: name });
    if (back.error) throw new Error(`${name} lesen: ${back.error.message}`);
    if (back.data !== wert) throw new Error(`${name}: Rueckgelesener Wert weicht ab`);
    console.log(`ok  ${name}`);
  }

  const ablauf = new Date(x509.validTo);
  const tage = Math.round((ablauf - Date.now()) / 86400000);
  console.log(`Zertifikat gueltig bis ${ablauf.toISOString().slice(0, 10)} (${tage} Tage), x5t ${x5t}`);
  const { error } = await db.from('ablage_stand').update({ zert_ablauf: ablauf.toISOString() }).neq('drive_id', '');
  if (error) console.warn(`Hinweis: zert_ablauf nicht gesetzt (${error.message})`);
}

main().catch((err) => {
  console.error(`FEHLER: ${err.message}`);
  process.exit(1);
});
