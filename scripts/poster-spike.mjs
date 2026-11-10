// poster-spike.mjs
// Spike fuer die Poster der Showcase (ADR 0064): liefert Dropbox ueber
// files/get_thumbnail_batch brauchbare Standbilder fuer Videos (.mp4, .mov/HEVC)
// und Bilder (.jpg, .png, .heic)?
//
// Aufruf:
//   node scripts/poster-spike.mjs <ausgabe-ordner> <dropbox-pfad> [<dropbox-pfad> ...]
// Liest DROPBOX_REFRESH_TOKEN / DROPBOX_APP_KEY / DROPBOX_APP_SECRET aus .env.
// Schreibt je Pfad eine Datei <n>.<format> und druckt Status, Groesse, Maße und Dauer.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const SIZE = process.env.POSTER_SIZE || 'w480h320';
const MODE = process.env.POSTER_MODE || 'fitone_bestfit';
const FORMAT = process.env.POSTER_FORMAT || 'jpeg';

function loadEnv() {
  try {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* ohne .env: nur Prozess-Env */ }
}

async function token() {
  const resp = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.DROPBOX_REFRESH_TOKEN,
      client_id: process.env.DROPBOX_APP_KEY,
      client_secret: process.env.DROPBOX_APP_SECRET,
    }),
  });
  if (!resp.ok) throw new Error(`Token ${resp.status}: ${await resp.text()}`);
  return (await resp.json()).access_token;
}

async function main() {
  loadEnv();
  const [outDir, ...paths] = process.argv.slice(2);
  if (!outDir || !paths.length) {
    console.error('Aufruf: node scripts/poster-spike.mjs <ausgabe-ordner> <dropbox-pfad> [...]');
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });
  const t = await token();

  const t0 = Date.now();
  const resp = await fetch('https://content.dropboxapi.com/2/files/get_thumbnail_batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entries: paths.map((path) => ({ path, format: FORMAT, size: SIZE, mode: MODE })),
    }),
  });
  const ms = Date.now() - t0;
  if (!resp.ok) throw new Error(`Batch ${resp.status}: ${await resp.text()}`);
  const { entries } = await resp.json();
  console.log(`Batch: ${paths.length} Dateien in ${ms} ms (size=${SIZE}, mode=${MODE}, format=${FORMAT})\n`);

  for (const [i, entry] of entries.entries()) {
    const path = paths[i];
    const ext = (path.match(/\.([a-z0-9]+)$/i)?.[1] || '?').toLowerCase();
    if (entry['.tag'] !== 'success') {
      console.log(`#${i} ${ext.padEnd(5)} FEHLER ${JSON.stringify(entry.failure || entry)}`);
      continue;
    }
    const buf = Buffer.from(entry.thumbnail, 'base64');
    const file = join(outDir, `${i}.${FORMAT === 'jpeg' ? 'jpg' : FORMAT}`);
    writeFileSync(file, buf);
    const meta = await sharp(buf).metadata();
    const stats = await sharp(buf).stats();
    const media = entry.metadata?.media_info?.metadata;
    console.log(
      `#${i} ${ext.padEnd(5)} ok ${String(buf.length).padStart(6)} B  ${meta.width}x${meta.height}`
      + `  Helligkeit ${Math.round(stats.channels[0].mean)}`
      + (media?.dimensions ? `  Original ${media.dimensions.width}x${media.dimensions.height}` : '')
      + (media?.duration ? `  ${Math.round(media.duration / 1000)} s` : '')
      + `  -> ${file}`,
    );
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
