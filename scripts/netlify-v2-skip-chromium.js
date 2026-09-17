#!/usr/bin/env node
// Nur im Netlify-Build-Container (context.v2). Erstes Branch-Deploy hängt
// am Upload von 4× ~60MB Chromium-Zips. Die Entry-Points fliegen raus,
// Vite + die restlichen Functions gehen durch. Staging/main unberührt.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dest = path.join(root, 'netlify/_v2_skip_chromium');
const files = [
  'creator-scrape.js',
  'site-extract-background.js',
  'strategie-item-background.js',
  'transcribe-background.js'
];

fs.mkdirSync(dest, { recursive: true });
for (const name of files) {
  const from = path.join(root, 'netlify/functions', name);
  if (!fs.existsSync(from)) {
    console.warn(`v2-skip-chromium: fehlt ${name}`);
    continue;
  }
  fs.renameSync(from, path.join(dest, name));
  console.log(`v2-skip-chromium: ${name}`);
}
