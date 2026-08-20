#!/usr/bin/env node
// icon-audit.mjs
// Read-only Audit: findet alle inline <svg> in src/**/*.js, normalisiert und
// fingerprintet sie, matcht gegen ICON_DEFS und schreibt icon-audit.json.
// Nutzung: node scripts/icon-audit.mjs

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'icon-audit.json');
const DEFS_PATH = path.join(SRC, 'core/icons/iconDefs.js');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

// Extrahiert <svg ...>...</svg>-Literale (greedy genug fuer unsere Sources,
// verschachtelte <svg> kommen praktisch nicht vor).
function extractSvgs(src) {
  const results = [];
  const re = /<svg[\s\S]*?<\/svg>/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const line = src.slice(0, m.index).split('\n').length;
    results.push({ svg: m[0], line });
  }
  return results;
}

function stripOuterSvg(svg) {
  const open = svg.match(/<svg[^>]*>/);
  if (!open) return null;
  const attrs = {};
  for (const am of open[0].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[am[1]] = am[2];
  let body = svg.slice(open[0].length, svg.lastIndexOf('</svg>'));
  return { attrs, body };
}

// Normalisieren: Whitespace kollabieren, Attribut-Reihenfolge egalisieren,
// nicht-visuelle Attribute strippen. Ergebnis = vergleichbarer Body.
function normalizeBody(body) {
  let b = body;
  // Reihenfolge der Attribute pro Element egalisieren
  b = b.replace(/<([a-zA-Z-]+)([^>]*)>/g, (_, tag, attrStr) => {
    const attrs = [];
    for (const am of attrStr.matchAll(/([\w-]+)="([^"]*)"/g)) {
      const name = am[1];
      if (name === 'class' || name === 'id' || name === 'style') continue;
      attrs.push([name, am[2]]);
    }
    attrs.sort((a, b) => a[0].localeCompare(b[0]));
    const rendered = attrs.map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<${tag}${rendered ? ' ' + rendered : ''}>`;
  });
  b = b.replace(/\s+/g, ' ').trim();
  // Whitespace zwischen Tags entfernen
  b = b.replace(/>\s+</g, '><');
  return b;
}

function fingerprint(normalized) {
  return crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 10);
}

// ICON_DEFS parsen ohne Import (iconDefs.js ist plain JS mit Templatefreien Strings).
function loadDefs() {
  const src = fs.readFileSync(DEFS_PATH, 'utf8');
  const defs = {};
  const re = /'([\w-]+)':\s*\{\s*viewBox:\s*'([^']+)',\s*body:\s*'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    defs[m[1]] = { viewBox: m[2], body: m[3].replace(/\\'/g, "'") };
  }
  return defs;
}

function main() {
  const defs = loadDefs();
  const defByFingerprint = {};
  for (const [key, def] of Object.entries(defs)) {
    defByFingerprint[fingerprint(normalizeBody(def.body))] = key;
  }

  const files = walk(SRC);
  const occurrences = [];
  const unknown = new Map(); // fingerprint -> { count, files, sampleBody, attrs }

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file);
    for (const { svg, line } of extractSvgs(src)) {
      const parsed = stripOuterSvg(svg);
      if (!parsed) continue;
      const normalized = normalizeBody(parsed.body);
      const fp = fingerprint(normalized);
      const knownKey = defByFingerprint[fp] || null;
      const cls = parsed.attrs.class || null;
      const entry = { file: rel, line, fingerprint: fp, knownKey, class: cls };
      occurrences.push(entry);
      if (!knownKey) {
        if (!unknown.has(fp)) {
          unknown.set(fp, { count: 0, files: [], normalized, attrs: parsed.attrs });
        }
        const u = unknown.get(fp);
        u.count++;
        u.files.push(`${rel}:${line}`);
      }
    }
  }

  const unknownList = [...unknown.entries()]
    .map(([fp, u]) => ({ fingerprint: fp, count: u.count, files: u.files, attrs: u.attrs, normalized: u.normalized }))
    .sort((a, b) => b.count - a.count);

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      filesScanned: files.length,
      svgOccurrences: occurrences.length,
      uniqueUnknown: unknownList.length,
      knownHits: occurrences.filter(o => o.knownKey).length,
    },
    occurrences,
    unknown: unknownList,
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`Scanned ${files.length} files, ${occurrences.length} svg occurrences`);
  console.log(`Known matches: ${report.totals.knownHits}, unique unknown: ${unknownList.length}`);
  console.log(`Report -> ${OUT}`);
}

main();
