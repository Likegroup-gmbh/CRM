// medienablage-spike.mjs
// Prototyp gegen die Test-Site "Medienablage-Test": prueft die offenen Risiken des Plans
// mit dem echten Server-Modul (_shared/ablage). Schreibt nur unter /_Spike.
//
// Aufruf:
//   node scripts/medienablage-spike.mjs --datei <video.mov> [--env .env.staging]
//     [--origin http://localhost:3002] [--webhook https://<staging>.netlify.app/.netlify/functions/ablage-webhook]
//     [--konto mitarbeiter@firma.de] [--aufraeumen]
// Env: MS_TENANT_ID, MS_CLIENT_ID, SP_SITE_URL, SP_SITE_ID, SP_DRIVE_ID (+ Zertifikat in .secrets).
// Ergebnis: Konsole + .secrets/spike/bericht.json, Browser-Test: .secrets/spike/browser-test.html

import { readFileSync, writeFileSync, mkdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { basename } from 'node:path';
import { createRequire } from 'node:module';
import { ladeEnv, argumente } from './medienablage/_env.mjs';

const require = createRequire(import.meta.url);

const { zertifikatLesen, createTokenQuelle } = require('../netlify/functions/_shared/ablage/graph-auth.js');
const { createSharePoint } = require('../netlify/functions/_shared/ablage/sharepoint.js');
const { createSpRechte } = require('../netlify/functions/_shared/ablage/sp-rechte.js');
const { sharePointKonfig, CHUNK_BYTES } = require('../netlify/functions/_shared/ablage/konfig.js');

const args = argumente();
ladeEnv(args.env || '.env.staging');
const AUS = '.secrets/spike';
mkdirSync(AUS, { recursive: true });

const bericht = { start: new Date().toISOString(), schritte: [] };
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

async function schritt(name, fn) {
  const t0 = Date.now();
  try {
    const ergebnis = await fn();
    bericht.schritte.push({ name, ok: true, ms: Date.now() - t0, ergebnis });
    console.log(`ok    ${name}${ergebnis?.kurz ? ` — ${ergebnis.kurz}` : ''}`);
    return ergebnis;
  } catch (err) {
    bericht.schritte.push({ name, ok: false, ms: Date.now() - t0, fehler: err.message, status: err.status, code: err.code });
    console.log(`FEHLER ${name}: ${err.status || ''} ${err.code || ''} ${err.message}`);
    return null;
  }
}

function chunkLesen(datei, start, laenge) {
  const fd = openSync(datei, 'r');
  try {
    const buf = Buffer.alloc(laenge);
    const n = readSync(fd, buf, 0, laenge, start);
    return buf.subarray(0, n);
  } finally {
    closeSync(fd);
  }
}

async function main() {
  const datei = args.datei;
  if (!datei) throw new Error('--datei <video> fehlt (am besten ein HEVC-.mov vom iPhone, > 20 MB)');
  const groesse = statSync(datei).size;
  const origin = args.origin || 'http://localhost:3002';

  const konfig = sharePointKonfig();
  const zert = zertifikatLesen(
    readFileSync(args.key || '.secrets/medienablage-app.key', 'utf8'),
    readFileSync(args.cert || '.secrets/medienablage-app.crt', 'utf8'),
  );
  const tokenQuelle = createTokenQuelle({ konfig, zertifikat: async () => zert });
  const sp = createSharePoint({ konfig, tokenQuelle });

  const root = await schritt('Graph-Token + Bibliothek', async () => {
    const r = await sp.wurzel();
    const q = await sp.quota();
    return { root: r.id, webUrl: r.webUrl, quota: q, kurz: `${Math.round((q.used || 0) / 1e9)} von ${Math.round((q.total || 0) / 1e9)} GB belegt` };
  });
  if (!root) return;

  const spike = (await sp.ordnerAnlegen(root.root, '_Spike')).item;
  const name = `spike-${Date.now()}-${basename(datei)}`;

  // 1) Upload-Session mit deferCommit, in Chunks, mit Fortsetzen
  const upload = await schritt('Upload-Session deferCommit + Fortsetzen + Commit', async () => {
    const { uploadUrl } = await sp.uploadSession(spike.id, name, { conflict: 'fail', deferCommit: true });
    const chunk = Math.min(CHUNK_BYTES, Math.max(320 * 1024, Math.floor(groesse / 3 / (320 * 1024)) * 320 * 1024));
    const erst = await sp.chunkHochladen(uploadUrl, chunkLesen(datei, 0, chunk), 0, groesse);
    const status = await sp.sessionStatus(uploadUrl);
    const weiter = Number(String(status?.nextExpectedRanges?.[0] || '0-').split('-')[0]);
    let pos = weiter;
    let letzte = erst;
    while (pos < groesse) {
      const buf = chunkLesen(datei, pos, Math.min(chunk, groesse - pos));
      letzte = await sp.chunkHochladen(uploadUrl, buf, pos, groesse);
      pos += buf.length;
    }
    const vorCommit = await sp.kindNachName(spike.id, name);
    const item = letzte.fertig ? letzte.body : await sp.sessionAbschliessen(uploadUrl);
    return {
      chunk, nextExpectedRanges: status?.nextExpectedRanges, fortgesetztAb: weiter,
      unsichtbarVorCommit: !vorCommit, letzterStatus: letzte.status, itemId: item?.id, uploadUrl,
      kurz: `${!vorCommit ? 'vor Commit unsichtbar' : 'VOR COMMIT SICHTBAR'}, item ${item?.id}`,
    };
  });

  // 2) CORS der Upload-URL (Preflight wie aus dem Browser)
  await schritt('CORS Upload-URL (Preflight)', async () => {
    const { uploadUrl } = await sp.uploadSession(spike.id, `cors-${name}`, { conflict: 'rename', deferCommit: true });
    const resp = await fetch(uploadUrl, {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-range' },
    });
    await sp.sessionVerwerfen(uploadUrl);
    const h = Object.fromEntries([...resp.headers].filter(([k]) => k.startsWith('access-control')));
    return { status: resp.status, header: h, kurz: `${resp.status} ACAO=${h['access-control-allow-origin'] || '—'}` };
  });

  const itemId = upload?.itemId;
  if (!itemId) return;

  // 3) downloadUrl: Range + CORS
  const dl = await schritt('downloadUrl mit Range (Wiedergabe)', async () => {
    const d = await sp.downloadUrl(itemId);
    const resp = await fetch(d.url, { headers: { Range: 'bytes=0-1023', Origin: origin } });
    await resp.arrayBuffer();
    return {
      url: d.url, status: resp.status, acceptRanges: resp.headers.get('accept-ranges'),
      contentType: resp.headers.get('content-type'), acao: resp.headers.get('access-control-allow-origin'),
      kurz: `${resp.status} ${resp.headers.get('content-type')} ACAO=${resp.headers.get('access-control-allow-origin') || '—'}`,
    };
  });

  // 4) video-Facet + Thumbnails (Verarbeitung dauert, bis 90 s pollen)
  await schritt('video-Facet (Breite/Höhe/Dauer)', async () => {
    for (let i = 0; i < 18; i++) {
      const it = await sp.item(itemId, 'id,video,image,file');
      if (it?.video?.width) return { video: it.video, mime: it.file?.mimeType, nachSek: i * 5, kurz: `${it.video.width}x${it.video.height} nach ${i * 5}s` };
      await warte(5000);
    }
    throw new Error('kein video-Facet nach 90 s');
  });

  await schritt('Thumbnail c480x480', async () => {
    for (let i = 0; i < 18; i++) {
      const [t] = await sp.thumbnailUrls([itemId]);
      if (t.ok) {
        const resp = await fetch(t.url);
        const buf = Buffer.from(await resp.arrayBuffer());
        writeFileSync(`${AUS}/thumbnail.jpg`, buf);
        return { bytes: buf.length, typ: resp.headers.get('content-type'), nachSek: i * 5, kurz: `${buf.length} Bytes nach ${i * 5}s → ${AUS}/thumbnail.jpg` };
      }
      await warte(5000);
    }
    throw new Error('kein Thumbnail nach 90 s');
  });

  // 5) Delta: Cursor holen, umbenennen, Aenderung sehen
  await schritt('Delta-Feed (token=latest, Umbenennung)', async () => {
    const link = await sp.deltaJetzt();
    await sp.umbenennen(itemId, `umbenannt-${name}`);
    await warte(3000);
    let seite = await sp.deltaSeite(link);
    const gesehen = [];
    for (let i = 0; i < 5; i++) {
      gesehen.push(...(seite.value || []));
      if (!seite['@odata.nextLink']) break;
      seite = await sp.deltaSeite(seite['@odata.nextLink']);
    }
    const treffer = gesehen.find((x) => x.id === itemId);
    return {
      anzahl: gesehen.length, treffer: !!treffer, felder: treffer ? Object.keys(treffer) : [],
      pfadImDelta: !!treffer?.parentReference?.path, deltaLink: !!seite['@odata.deltaLink'],
      kurz: `${treffer ? 'Umbenennung gesehen' : 'NICHT gesehen'}, parentReference.path ${treffer?.parentReference?.path ? 'da' : 'fehlt'}`,
    };
  });

  // 6) Webhook-Abo (geht das mit Sites.Selected?)
  await schritt('Webhook-Abo auf /drives/{id}/root', async () => {
    if (!args.webhook) return { uebersprungen: true, kurz: 'übersprungen (--webhook fehlt)' };
    const abo = await sp.aboAnlegen({ notificationUrl: args.webhook, clientState: process.env.SP_WEBHOOK_CLIENT_STATE || 'spike', tage: 1 });
    await sp.aboLoeschen(abo.id);
    return { id: abo.id, ablauf: abo.expirationDateTime, kurz: `Abo ${abo.id} angelegt und wieder gelöscht` };
  });

  // 7) Kunden-Leselink
  await schritt('Leselink "Jeder mit dem Link", Ablauf 1 Tag', async () => {
    const l = await sp.leselink(spike.id, Date.now() + 86400000);
    const ok = await sp.freigabeEntfernen(spike.id, l.permissionId);
    return { url: l.url, ablauf: l.ablauf, widerrufen: ok, kurz: `${l.url} (widerrufen: ${ok})` };
  });

  // 8) Rechte: Stufe, Vererbung, Testkonto mit "Bearbeiten ohne Löschen"
  await schritt('Rechte: Stufe + Vererbung + Testkonto', async () => {
    const rechte = createSpRechte({ konfig, tokenQuelle });
    const stufen = await rechte.stufen();
    const listeId = await sp.listeId();
    const listItemId = await sp.listItemId(spike.id);
    if (!(await rechte.hatEigeneRechte(listeId, listItemId))) await rechte.vererbungUnterbrechen(listeId, listItemId);
    let konto = null;
    if (args.konto) {
      const pid = await rechte.benutzer(args.konto);
      if (!pid) throw new Error(`Konto ${args.konto} unbekannt`);
      await rechte.zuweisen(listeId, listItemId, pid, stufen.ohne_loeschen);
      konto = { principalId: pid };
    }
    const ist = await rechte.zuweisungen(listeId, listItemId);
    return { stufen, listeId, listItemId, konto, ist, kurz: `${ist.length} Zuweisungen auf _Spike${konto ? `, ${args.konto} = ohne Löschen` : ''}` };
  });

  // Browser-Test: Upload aus dem Browser (CORS echt), Wiedergabe der downloadUrl
  const { uploadUrl: browserUrl } = await sp.uploadSession(spike.id, `browser-${Date.now()}.mov`, { conflict: 'rename' });
  writeFileSync(`${AUS}/browser-test.html`, browserTestHtml({ uploadUrl: browserUrl, downloadUrl: dl?.url }));
  console.log(`\nBrowser-Test: Datei über den Vite-Server öffnen (gleiche Origin wie das CRM):`);
  console.log(`  cp ${AUS}/browser-test.html public/spike.html && npx vite --mode staging --port 3002  →  ${origin}/spike.html`);
  console.log('  (danach public/spike.html wieder löschen; die Upload-URL gilt ca. 1 Stunde)');

  console.log('\nVon Hand prüfen:');
  console.log(`  - OneDrive-Client am Mac mit ${args.konto || '<Testkonto>'}: _Spike synchronisieren, Datei löschen → was zeigt der Finder?`);
  console.log('  - Wiedergabe HEVC-.mov in Safari und Chrome (Browser-Test, Abschnitt 2)');
  console.log('  - Migration Manager (SharePoint Admin Center → Migration → Dropbox): wird euer Dropbox-Plan angeboten?');

  if (args.aufraeumen) {
    await schritt('Aufräumen /_Spike', async () => ({ geloescht: await sp.loeschen(spike.id) }));
  }
}

function browserTestHtml({ uploadUrl, downloadUrl }) {
  return `<!doctype html><meta charset="utf-8"><title>Medienablage-Spike</title>
<style>body{font:14px system-ui;margin:2rem;max-width:56rem}pre{background:#f4f4f4;padding:1rem;white-space:pre-wrap}</style>
<h1>1. Upload aus dem Browser (CORS, Fortsetzen)</h1>
<input type="file" id="f"> <button id="go">Hochladen</button> <button id="stop">Abbrechen</button> <button id="weiter">Fortsetzen</button>
<pre id="log"></pre>
<h1>2. Wiedergabe über downloadUrl</h1>
<video id="v" controls playsinline style="max-width:100%;max-height:60vh" src="${downloadUrl || ''}"></video>
<script>
const URL_ = ${JSON.stringify(uploadUrl)};
const CHUNK = 10 * 1024 * 1024;
const log = (m) => { document.getElementById('log').textContent += m + '\\n'; };
let ctrl = null;
async function hoch(file, ab = 0) {
  ctrl = new AbortController();
  for (let pos = ab; pos < file.size; pos += CHUNK) {
    const ende = Math.min(pos + CHUNK, file.size) - 1;
    const r = await fetch(URL_, { method: 'PUT', headers: { 'Content-Range': 'bytes ' + pos + '-' + ende + '/' + file.size }, body: file.slice(pos, ende + 1), signal: ctrl.signal });
    log(r.status + ' ' + pos + '-' + ende);
    if (r.status === 200 || r.status === 201) { log('fertig: ' + (await r.json()).id); return; }
  }
}
document.getElementById('go').onclick = () => hoch(document.getElementById('f').files[0]).catch((e) => log('Fehler: ' + e.message));
document.getElementById('stop').onclick = () => ctrl?.abort();
document.getElementById('weiter').onclick = async () => {
  const s = await (await fetch(URL_)).json();
  log('nextExpectedRanges: ' + JSON.stringify(s.nextExpectedRanges));
  const ab = Number(String(s.nextExpectedRanges?.[0] || '0-').split('-')[0]);
  hoch(document.getElementById('f').files[0], ab).catch((e) => log('Fehler: ' + e.message));
};
document.getElementById('v').onerror = () => log('Video-Fehler: ' + (document.getElementById('v').error?.message || 'unbekannt'));
document.getElementById('v').onloadedmetadata = (e) => log('Video: ' + e.target.videoWidth + 'x' + e.target.videoHeight + ', ' + Math.round(e.target.duration) + ' s');
</script>`;
}

main()
  .catch((err) => {
    console.error(`FEHLER: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    bericht.ende = new Date().toISOString();
    writeFileSync(`${AUS}/bericht.json`, JSON.stringify(bericht, null, 2));
    console.log(`\nBericht: ${AUS}/bericht.json`);
  });
