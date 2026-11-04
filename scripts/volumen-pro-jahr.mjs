// Auftragsvolumen je Jahr: alte Regel (Jahr von start) gegen die
// Jahreszuordnung des Dashboards (teilrechnungJahr.js). Nur lesen.
//
// Nutzung:
//   node scripts/volumen-pro-jahr.mjs <bestand.json> [jahr]
// bestand.json = Ergebnis von stakeholder_finanzbestand() (auftraege mit
// start/ende/created_at/auftragtype, unternehmen, teilrechnungen mit position).

import { readFileSync } from 'node:fs';
import { dropTestunternehmenBestand } from '../src/core/budget/testunternehmen.js';
import { isContracting } from '../src/core/budget/leistungsbereich.js';
import { jahresanteile } from '../src/core/budget/teilrechnungJahr.js';
import { auftragYear } from '../src/modules/stakeholder/kern/stakeholderOverviewLogic.js';

const [, , datei, jahrArg] = process.argv;
if (!datei) {
  console.error('Aufruf: node scripts/volumen-pro-jahr.mjs <bestand.json> [jahr]');
  process.exit(1);
}

const bestand = dropTestunternehmenBestand(JSON.parse(readFileSync(datei, 'utf8')));
const zahl = v => parseFloat(v) || 0;
const euro = n => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

const trByAuftrag = new Map();
(bestand.teilrechnungen || []).forEach(t => {
  if (!trByAuftrag.has(t.auftrag_id)) trByAuftrag.set(t.auftrag_id, []);
  trByAuftrag.get(t.auftrag_id).push(t);
});

const alt = { mit: new Map(), ohne: new Map() };
const neu = { mit: new Map(), ohne: new Map() };
const add = (map, jahr, betrag) => map.set(jahr, (map.get(jahr) || 0) + betrag);
const verschoben = [];

for (const a of bestand.auftraege) {
  const netto = zahl(a.nettobetrag);
  const contracting = isContracting(a);
  const jahrAlt = auftragYear(a);
  add(alt.mit, jahrAlt, netto);
  if (!contracting) add(alt.ohne, jahrAlt, netto);

  const anteile = jahresanteile(a, trByAuftrag.get(a.id) || []);
  anteile.forEach(({ jahr, anteil }) => {
    add(neu.mit, jahr, netto * anteil);
    if (!contracting) add(neu.ohne, jahr, netto * anteil);
  });
  if (anteile.length > 1 || anteile[0].jahr !== jahrAlt) {
    verschoben.push({ id: a.id, netto, jahre: anteile.map(z => `${z.jahr}: ${euro(netto * z.anteil)}`).join(' | ') });
  }
}

const jahre = [...new Set([...alt.mit.keys(), ...neu.mit.keys()])].sort();
console.log(`Aufträge im Bestand: ${bestand.auftraege.length} (ohne Entwürfe/Test)\n`);
console.log('Jahr   | alt ohne Contracts   | neu ohne Contracts  | Differenz');
for (const j of jahre) {
  const a = alt.ohne.get(j) || 0;
  const n = neu.ohne.get(j) || 0;
  console.log(`${j}   | ${euro(a).padStart(20)} | ${euro(n).padStart(19)} | ${euro(n - a)}`);
}
console.log('\nGESAMT mit Contracts:');
for (const j of jahre) {
  console.log(`${j}   | ${euro(alt.mit.get(j) || 0).padStart(20)} | ${euro(neu.mit.get(j) || 0).padStart(19)}`);
}
console.log(`\nAufträge mit anderer Jahreszuordnung: ${verschoben.length}`);
verschoben
  .filter(v => !jahrArg || v.jahre.includes(jahrArg))
  .sort((x, y) => y.netto - x.netto)
  .forEach(v => console.log(`  ${v.id}  ${euro(v.netto)}  ->  ${v.jahre}`));
