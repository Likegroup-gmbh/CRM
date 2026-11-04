#!/usr/bin/env node
// vorschau-spike.mjs
// Spike fuer die Vorschaudatei: echte Originale durch Cloudflare Stream schicken und
// pruefen, ob der MP4-Download fuer die Sichtung taugt (Aufloesung, fps, Dauer,
// Bitrate, Faststart, Range-Requests) und ob lokal signierte Links funktionieren.
// Nutzt denselben Client wie die Functions (_shared/cloudflare-stream.js).
//
//   node --env-file=.env scripts/vorschau-spike.mjs --dropbox "/Pfad/clip.mov" --dropbox "/Pfad/b.mp4"
//   node --env-file=.env scripts/vorschau-spike.mjs --url "https://…/clip.mp4" --keep
//
// Ohne --keep werden die Test-Videos am Ende bei Cloudflare geloescht.
// Env: CLOUDFLARE_* wie in den Functions, fuer --dropbox zusaetzlich DROPBOX_*.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createStreamClient, streamConfig, signStreamToken, downloadUrl,
} = require('../netlify/functions/_shared/cloudflare-stream.js');
const { getAccessToken } = require('../netlify/functions/_shared/dropbox.js');
const { probeMp4 } = require('../netlify/functions/_shared/mp4-probe.js');

const READY_TIMEOUT_MS = 20 * 60 * 1000;
const POLL_MS = 5000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function args(argv) {
  const out = { dropbox: [], url: [], keep: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dropbox') out.dropbox.push(argv[++i]);
    else if (argv[i] === '--url') out.url.push(argv[++i]);
    else if (argv[i] === '--keep') out.keep = true;
  }
  return out;
}

async function dropboxLink(path) {
  const token = await getAccessToken();
  const resp = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!resp.ok) throw new Error(`Dropbox ${resp.status}: ${await resp.text()}`);
  return (await resp.json()).link;
}

/* ---- Ablauf je Datei ---- */

async function waitFor(label, fn) {
  const until = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    const result = await fn();
    if (result) return result;
    if (Date.now() > until) throw new Error(`${label}: Timeout`);
    await sleep(POLL_MS);
  }
}

async function spike(client, cfg, { label, url }) {
  const t0 = Date.now();
  const original = await fetch(url, { method: 'HEAD' }).catch(() => null);
  const originalBytes = Number(original?.headers.get('content-length')) || null;

  const { uid } = await client.copyFromUrl({ url, name: `spike: ${label}`, meta: { spike: '1' } });
  console.log(`  ${label}: uid ${uid}, warte auf readyToStream …`);
  const video = await waitFor('ready', async () => {
    const v = await client.getVideo(uid);
    if (v?.status?.state === 'error') throw new Error(`Cloudflare: ${v.status.errReasonCode} ${v.status.errReasonText}`);
    return v?.readyToStream ? v : null;
  });
  const tReady = Date.now();

  await client.enableDownload(uid);
  await waitFor('mp4', async () => {
    const d = await client.getDownload(uid);
    if (d?.status === 'error') throw new Error('MP4-Download: error');
    return d?.status === 'ready' ? d : null;
  });
  const tMp4 = Date.now();

  const signed = downloadUrl(cfg, signStreamToken(cfg, uid, { ttlSec: 600 }));
  const unsigned = await fetch(downloadUrl(cfg, uid), { method: 'HEAD' });
  const range = await fetch(signed, { headers: { Range: 'bytes=0-1' } });
  const tDl = Date.now();
  const mp4 = Buffer.from(await (await fetch(signed)).arrayBuffer());
  const dlMs = Date.now() - tDl;

  return {
    uid,
    label,
    original: { bytes: originalBytes, breite: video.input?.width, hoehe: video.input?.height, dauer: video.duration },
    vorschau: { bytes: mp4.length, ...probeMp4(mp4) },
    zeiten_s: {
      bis_ready: Math.round((tReady - t0) / 1000),
      bis_mp4: Math.round((tMp4 - t0) / 1000),
      download_ms: dlMs,
    },
    checks: {
      signierter_link: range.status === 206 ? 'ok (206)' : `FEHLER ${range.status}`,
      ohne_token_gesperrt: unsigned.status >= 400 ? `ok (${unsigned.status})` : `FEHLER ${unsigned.status}`,
      accept_ranges: range.headers.get('accept-ranges') || range.headers.get('content-range') ? 'ok' : 'fehlt',
    },
  };
}

async function main() {
  const opts = args(process.argv.slice(2));
  const cfg = streamConfig();
  const missing = ['accountId', 'apiToken', 'customerCode', 'keyId', 'keyPem'].filter((k) => !cfg[k]);
  if (missing.length) throw new Error(`Env fehlt: ${missing.join(', ')}`);
  const sources = [
    ...await Promise.all(opts.dropbox.map(async (p) => ({ label: p, url: await dropboxLink(p) }))),
    ...opts.url.map((u) => ({ label: u.split('?')[0].split('/').pop(), url: u })),
  ];
  if (!sources.length) throw new Error('Mindestens eine --dropbox oder --url angeben');

  const client = createStreamClient(cfg);
  const results = [];
  for (const source of sources) {
    try {
      results.push(await spike(client, cfg, source));
    } catch (err) {
      results.push({ label: source.label, fehler: err.message });
    }
  }

  console.log(JSON.stringify(results, null, 2));
  console.table(results.map((r) => ({
    datei: r.label,
    original: r.original ? `${r.original.breite}x${r.original.hoehe}, ${Math.round((r.original.bytes || 0) / 1e6)} MB` : '–',
    vorschau: r.vorschau ? `${r.vorschau.breite}x${r.vorschau.hoehe} @ ${r.vorschau.fps} fps, ${r.vorschau.kbps} kbps, ${Math.round(r.vorschau.bytes / 1e6)} MB` : r.fehler,
    dauer: r.vorschau ? `${r.original.dauer} s → ${r.vorschau.dauer} s` : '–',
    faststart: r.vorschau?.faststart,
    bis_mp4_s: r.zeiten_s?.bis_mp4,
    link: r.checks ? `${r.checks.signierter_link}, ohne Token ${r.checks.ohne_token_gesperrt}` : '–',
  })));

  if (!opts.keep) {
    for (const r of results) if (r.uid) await client.deleteVideo(r.uid).catch(() => {});
    console.log('Test-Videos bei Cloudflare geloescht (--keep behaelt sie).');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
