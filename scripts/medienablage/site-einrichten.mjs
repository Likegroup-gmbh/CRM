// site-einrichten.mjs
// Richtet eine Medienablage-Site ein: Bibliothek "Daten" (falls fehlt; eine alte Bibliothek
// "Videos" wird umbenannt, ihre URL /Videos bleibt), Versionslimit 5, Berechtigungsstufe
// "Bearbeiten ohne Löschen". Gibt Site-ID und Drive-ID als KEY=VALUE aus.
//
// Aufruf:
//   node scripts/medienablage/site-einrichten.mjs --site https://<tenant>.sharepoint.com/sites/Medienablage-Test \
//     --env-prefix SP_TEST_ [--env .env] [--key .secrets/medienablage-app.key] [--cert .secrets/medienablage-app.crt]
// Braucht MS_TENANT_ID und MS_CLIENT_ID; die App muss auf der Site fullcontrol haben.

import { readFileSync, existsSync } from 'node:fs';
import { ladeEnv, argumente, pflicht, require } from './_env.mjs';

const { createTokenQuelle, zertifikatLesen, scopeFuerSharePoint, GRAPH_SCOPE } = require('../../netlify/functions/_shared/ablage/graph-auth.js');
const { createHttp } = require('../../netlify/functions/_shared/ablage/graph.js');
const { createSpRechte } = require('../../netlify/functions/_shared/ablage/sp-rechte.js');

const BIBLIOTHEK = 'Daten';
// Name vor ADR 0067; dieselbe Bibliothek (gleiche Drive-ID), nur umbenannt
const BIBLIOTHEK_ALT = 'Videos';
const VERSIONEN = 5;

async function main() {
  const args = argumente();
  ladeEnv(args.env || '.env');
  const site = String(args.site || '').replace(/\/+$/, '');
  const prefix = args['env-prefix'] || 'SP_';
  if (!/^https:\/\/[^/]+\.sharepoint\.com\/sites\/[^/]+$/.test(site)) {
    throw new Error('--site muss https://<tenant>.sharepoint.com/sites/<Name> sein');
  }
  const keyFile = args.key || '.secrets/medienablage-app.key';
  const certFile = args.cert || '.secrets/medienablage-app.crt';
  if (!existsSync(keyFile) || !existsSync(certFile)) throw new Error(`Zertifikat fehlt (${keyFile}, ${certFile})`);
  const zert = zertifikatLesen(readFileSync(keyFile, 'utf8'), readFileSync(certFile, 'utf8'));

  const { host, pathname } = new URL(site);
  const konfig = { tenantId: pflicht('MS_TENANT_ID'), clientId: pflicht('MS_CLIENT_ID'), siteUrl: site, host };
  const quelle = createTokenQuelle({ konfig, zertifikat: async () => zert });
  const graph = createHttp({ token: (o) => quelle(GRAPH_SCOPE, o) });

  const s = await graph.get(`/sites/${host}:${pathname}?$select=id,webUrl,displayName`);
  console.error(`Site: ${s.displayName} (${s.webUrl})`);

  const drives = async () => (await graph.get(`/sites/${s.id}/drives?$select=id,name,webUrl`))?.value || [];
  const vorhanden = await drives();
  let drive = vorhanden.find((dr) => dr.name === BIBLIOTHEK) || vorhanden.find((dr) => dr.name === BIBLIOTHEK_ALT);
  if (!drive) {
    await graph.post(`/sites/${s.id}/lists`, { displayName: BIBLIOTHEK, list: { template: 'documentLibrary' } });
    drive = (await drives()).find((dr) => dr.name === BIBLIOTHEK);
    if (!drive) throw new Error(`Bibliothek ${BIBLIOTHEK} wurde angelegt, Drive aber nicht gefunden`);
    console.error(`Bibliothek ${BIBLIOTHEK} angelegt`);
  } else if (drive.name === BIBLIOTHEK_ALT) {
    console.error(`Bibliothek ${BIBLIOTHEK_ALT} vorhanden, wird in ${BIBLIOTHEK} umbenannt (${drive.webUrl} bleibt)`);
  } else {
    console.error(`Bibliothek ${BIBLIOTHEK} vorhanden`);
  }
  const liste = await graph.get(`/drives/${drive.id}/list?$select=id`);

  const rest = createHttp({ token: (o) => quelle(scopeFuerSharePoint(host), o), basis: `${site}/_api` });
  await rest.anfrage(`/web/lists(guid'${liste.id}')`, {
    method: 'POST',
    headers: {
      Accept: 'application/json;odata=nometadata',
      'Content-Type': 'application/json;odata=verbose',
      'X-HTTP-Method': 'MERGE',
      'IF-MATCH': '*',
    },
    rawBody: JSON.stringify({ __metadata: { type: 'SP.List' }, Title: BIBLIOTHEK, EnableVersioning: true, MajorVersionLimit: VERSIONEN }),
  });
  console.error(`Titel ${BIBLIOTHEK}, Versionslimit ${VERSIONEN} gesetzt`);

  const rechte = createSpRechte({ konfig, tokenQuelle: quelle, siteUrl: site });
  const stufen = await rechte.stufen();
  console.error(`Stufen: Lesen=${stufen.lesen}, Bearbeiten ohne Löschen=${stufen.ohne_loeschen}, Bearbeiten=${stufen.bearbeiten}`);

  console.log(`${prefix}SITE_ID=${s.id}`);
  console.log(`${prefix}DRIVE_ID=${drive.id}`);
}

main().catch((err) => {
  console.error(`FEHLER: ${err.message}`);
  process.exit(1);
});
