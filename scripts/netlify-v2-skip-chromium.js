#!/usr/bin/env node
// Nur im Netlify-Build-Container (context.v2). Chromium-Zips (~60MB) haengen
// den Function-Upload. site-extract-background ist wieder live (Liky-URL /
// Produkt-Auslesen). Die drei restlichen erst nachziehen, wenn der Deploy
// mit einer zusaetzlichen Chromium-Function durch ist. Staging/main unberuehrt.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dest = path.join(root, 'netlify/_v2_skip_chromium');
const files = [
  'creator-scrape.js',
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
