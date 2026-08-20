#!/usr/bin/env node
// icon-migrate.mjs
// Ersetzt inline <svg>...</svg>-Literale in src/**/*.js durch icon('<key>', {...}).
// Mapping: icon-audit.json -> NAME_BY_FINGERPRINT (kuratiert) -> Fallback icon-<hash>.
//
//   node scripts/icon-migrate.mjs          Dry-Run
//   node scripts/icon-migrate.mjs --apply  in-place
//   node scripts/icon-migrate.mjs --apply --only=src/modules/kampagne  Scope

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const AUDIT = path.join(ROOT, 'icon-audit.json');
const APPLY = process.argv.includes('--apply');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1] || null;

// Fingerprint -> kanonischer Key in ICON_DEFS
const NAME_BY_FINGERPRINT = {
  // sehr haeufig
  '9eefb021f3': 'spinner',              // circle 50er (wird uebersprungen, animiert)
  'b9fda583': 'check-filled',
  'c3fdedd409': 'x-circle-filled',
  '6ed30e93': 'arrow-top-right',
  'b5f1d1c5': 'plus-lg',
  '3a75ec07': 'check-bold',
  '93872aad64': 'trash-alt',
  '29076273': 'upload',
  '12240be0': 'dots-vertical-filled',
  'a6ac24f21d': 'table-grid',
  '182402b116': 'x-mark',
  'a01d8814': 'eye-outline',
  '8ab6c48d': 'calendar-days',
  '1347a308': 'folder-open',
  '6744457533': 'eye-outline',
  '7e3b9253': 'dots-grid',
  '85794b4fa7': 'arrow-top-right',
  '6474789d57': 'tag',
  'd896f7e8e6': 'plus',
  'd365640835': 'SKIP',                  // InfluencerPdf Brand-Logo
  'd8f85edab4': 'instagram',
  'bdecc939e3': 'tiktok',
  '0cc7bc6198': 'cog',
  '8a2705351f': 'link',
  'fcbc3040ce': 'check-circle',
  '81d50c3e0a': 'chevron-down',
  'ccfb119361': 'filter-alt',
  'bb8a267474': 'folder',
  '067a2b3404': 'plus',
  '78c25ba312': 'trash-alt',
  '156c9c11ed': 'trash-alt',
  '6235fefd7d': 'chevron-down-bold',
  '57a9c7b37f': 'puzzle',
  'b5678f5759': 'share-nodes',
  '83fcc185c3': 'check-bold',
  '16d81110a8': 'SKIP',                  // Phosphor arrow (256er viewBox, ungewoehnlich)
  'cb87d2b1f0': 'search',
  'cd33d9ff95': 'clock',
  '2f368d77e2': 'exclamation-circle',
  '4010078811': 'arrow-path',
  '83af31120e': 'device-phone',
  '0c4d4dd82e': 'youtube',
  '34283bc3fe': 'tiktok',
  '428e454859': 'instagram',
  '757fe1d8f1': 'check',
  'ec40843a3a': 'x-mark',
  '9b0c09724b': 'information-circle',
  '85a2b3493b': 'arrow-left-on-rectangle',
  '5faf60923c': 'exclamation-circle',
  'ef5016e88f': 'exclamation-triangle',
  '73d2cd0566': 'chevron-left',
  '2fce7de4ec': 'chevron-right',
  '313da6f61c': 'download',
  '63f859be3d': 'document-chart',
  '35182f17d6': 'upload',
  'a18ede94ed': 'chevron-down',
  '4a49555506': 'chevron-up',
  'b17de2d0af': 'chevron-down-filled',
  '3f4e51ecd6': 'check-filled',
  'd6fe477c4b': 'link',
  '790a8b40f5': 'SKIP',                  // Phosphor hand (256er)
  '79e20a5219': 'x-mark',
  'a88a4ea629': 'chevron-right',
  '47828c3374': 'SKIP',                  // Phosphor flag (256er)
  'd96d5f25f2': 'SKIP',                  // Phosphor x (256er)
  '99f69e72a1': 'bolt',
  '3120733789': 'credit-card',
  '00512d8737': 'plus',
  '773d147e36': 'SKIP',                  // MediaLightbox x
  'd6c4eacc95': 'chevron-left',
  'f6ae885822': 'chevron-right',
  '376360e1be': 'download',
  '80f995a226': 'check-circle',
  'b808a89742': 'information-circle',
  '66c2fd13b2': 'eye-outline',
  '974a40a412': 'document-text',
  '1ff4cd5d4a': 'clipboard',
  'a65fb0c015': 'arrow-left',
  '0616bf060e': 'star',
  'a4cca470a0': 'instagram',
  '01f0b13a24': 'tiktok',
  '0ed470b634': 'heart',
  // Runde 2
  '81d50c3e0a': 'chevron-down',
  '66bb153c27': 'bookmark',
  'fe72d0fc64': 'bookmark-slash',
  'a88fc19557': 'phone',
  '5954c0ef6c': 'book-open',
  'b43b40e71d': 'video',
  'a63da588ac': 'table-grid',
  'f0cb613f4b': 'speaker-wave',
  '6fdcf8a726': 'dots-grid',
  'cb87d2b1f0': 'search',
  'cd33d9ff95': 'clock',
  '73d2cd0566': 'chevron-left',
  '2fce7de4ec': 'chevron-right',
  '8a2705351f': 'link',
  '83fcc185c3': 'check-bold',
  '01f0b13a24': 'tiktok',
  '6235fefd7d': 'chevron-down-bold',
  '16d81110a8': 'SKIP',
  '790a8b40f5': 'SKIP',
  '47828c3374': 'SKIP',
  'd96d5f25f2': 'SKIP',
  '99f69e72a1': 'bolt',
  '3120733789': 'credit-card',
  '00512d8737': 'plus',
  '6356667558': 'SKIP', // IconSystem intern
  'fa7efaf156': 'SKIP',
  '9c6b6f75fb': 'SKIP',
  '156c9c11ed': 'trash-alt',
  '78c25ba312': 'trash-alt',
  '35182f17d6': 'upload',
  'a18ede94ed': 'chevron-down',
  '4a49555506': 'chevron-up',
  '79e20a5219': 'x-mark',
  'a88a4ea629': 'chevron-right',
  '63f859be3d': 'document-chart',
  '4010078811': 'arrow-path',
  '182402b116': 'x-mark',
  '9eefb021f3': 'spinner',
  'c3fdedd409': 'x-circle-filled',
  '93872aad64': 'trash-alt',
  '6744457533': 'eye-outline',
  'a6ac24f21d': 'table-grid',
  'd365640835': 'SKIP',
  '757fe1d8f1': 'check',
  'ec40843a3a': 'x-mark',
  '9b0c09724b': 'information-circle',
  '85a2b3493b': 'arrow-left-on-rectangle',
  '5faf60923c': 'exclamation-circle',
  'fcbc3040ce': 'check-circle',
  'ef5016e88f': 'exclamation-triangle',
  // Runde 3
  '0434fcbe63': 'SKIP', // Phosphor arrow 256
  '8b2f565855': 'bookmark',
  '7779482ba5': 'search-circle',
  '0370c8ddd0': 'play-circle',
  'bbfed1e66d': 'cog',
  'f2f0343a93': 'squares-2x2',
  '1fa9cb207b': 'check',
  '610e0b7549': 'trash-alt',
  'c7180769a0': 'chevron-down',
  'd6fccfb239': 'upload',
  'a4a5dfb9e3': 'paper-airplane',
  '3f65a0a0d9': 'SKIP', // animated progress circle
  '9dd647e38b': 'photo',
  'da94ff8685': 'SKIP', // Phosphor invoice 256
  '574ff233cd': 'building',
  '3638c9fb4d': 'arrow-right',
  'de376bd821': 'SKIP', // Phosphor 256 skript
  '3faefec6eb': 'SKIP',
  'b349997ede': 'SKIP',
  '67d8cfa3f1': 'SKIP',
  '978697e418': 'SKIP',
  'd5a438b686': 'SKIP',
  'e2b66fb0d9': 'SKIP', // donut chart segments
  '7b6f3faec0': 'globe',
  '2d55016fef': 'pencil-square',
  'c61bcb03c7': 'globe',
  '8e251aa34e': 'spinner',
  '9addc5ae59': 'paper-clip',
  '3b234213a6': 'calendar-days',
  'b79a573901': 'user-plus',
  '8557ae0e18': 'link',
  '326fc04147': 'document-text',
  '00e7339fda': 'inbox',
  'd498fd86cd': 'plus',
  'e6170d3ad5': 'SKIP', // ContractingPdf brand logo
  '610e0b7549': 'trash-alt',
  '2d55016fef': 'pencil-square',
  'c61bcb03c7': 'globe',
  '8e251aa34e': 'spinner',
  '3638c9fb4d': 'arrow-right',
  'b79a573901': 'user-plus',
  '8557ae0e18': 'link',
  '326fc04147': 'document-text',
  '00e7339fda': 'inbox',
  'd498fd86cd': 'plus',
  '3b234213a6': 'calendar-days',
  '9addc5ae59': 'paper-clip',
  'da94ff8685': 'SKIP',
  '3f65a0a0d9': 'SKIP',
};

// Defs, die wir bewusst nie ersetzen (animiert / Brand-Logo / komplex)
const SKIP = new Set(['SKIP', 'spinner']);

const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
const byFile = new Map();
for (const occ of audit.occurrences) {
  const key = occ.knownKey || NAME_BY_FINGERPRINT[occ.fingerprint];
  if (!key || SKIP.has(key)) continue;
  if (ONLY && !occ.file.startsWith(ONLY)) continue;
  if (!byFile.has(occ.file)) byFile.set(occ.file, []);
  byFile.get(occ.file).push({ ...occ, key });
}

function classToOptions(cls) {
  if (!cls) return '';
  const keep = cls.split(/\s+/).filter(c => /^(icon-|size-|w-\d|h-\d)/.test(c));
  return keep.length ? `, { className: '${keep.join(' ')}' }` : '';
}

let total = 0;
const touched = [];
for (const [file, list] of byFile) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) continue;
  let src = fs.readFileSync(abs, 'utf8');
  let changed = false;
  list.sort((a, b) => b.line - a.line);
  for (const occ of list) {
    const re = /<svg[\s\S]*?<\/svg>/g;
    let m;
    let target = null;
    while ((m = re.exec(src)) !== null) {
      const line = src.slice(0, m.index).split('\n').length;
      if (line === occ.line) { target = [m.index, m.index + m[0].length]; break; }
    }
    if (!target) continue;
    const q1 = src[target[0] - 1];
    const after = src[target[1]];
    let replacement;
    if ((q1 === "'" || q1 === '"') && after === q1) {
      // '...'/"..."-String-Literal: durch nackten icon()-Aufruf ersetzen (Quotes mit)
      replacement = `icon('${occ.key}'${classToOptions(occ.class)})`;
      target = [target[0] - 1, target[1] + 1];
    } else {
      // Template-String/HTML-Kontext
      replacement = `\${icon('${occ.key}'${classToOptions(occ.class)})}`;
    }
    src = src.slice(0, target[0]) + replacement + src.slice(target[1]);
    total++;
    changed = true;
  }
  if (changed && APPLY) {
    if (!/IconSystem\.js/.test(src)) {
      const depth = file.split('/').length - 2;
      const rel = (depth <= 0 ? './' : '../'.repeat(depth)) + 'core/icons/IconSystem.js';
      const lastImport = src.lastIndexOf('import ');
      if (lastImport !== -1) {
        const eol = src.indexOf('\n', src.indexOf(';', lastImport));
        src = src.slice(0, eol + 1) + `import { icon } from '${rel}';\n` + src.slice(eol + 1);
      }
    }
    fs.writeFileSync(abs, src);
    touched.push(file);
  } else if (changed) touched.push(file);
}

console.log(`${APPLY ? 'replaced' : 'would replace'}: ${total} in ${touched.length} files`);
if (!APPLY) console.log('Dry-run. Mit --apply ausfuehren.');
