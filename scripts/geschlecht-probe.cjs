// geschlecht-probe.cjs
// Trockenlauf fuer die Geschlechts-Ableitung: laedt Creator ohne geschlecht,
// schickt sie durch dieselbe Logik wie backfill-geschlecht.js und zeigt das
// Ergebnis an. Schreibt NICHTS in die Datenbank.
//
// Aufruf:
//   SUPABASE_SERVICE_KEY=... ANTHROPIC_API_KEY=... node scripts/geschlecht-probe.cjs [anzahl]
//
// Die Supabase-URL kommt aus der .env im Projektwurzelverzeichnis.
// Fuer den scharfen Lauf die Netlify-Function nutzen:
//   POST /.netlify/functions/backfill-geschlecht

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// .env einlesen, ohne dotenv als Dependency zu ziehen
function ladeEnvDatei() {
  const datei = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(datei)) return;
  for (const zeile of fs.readFileSync(datei, 'utf8').split('\n')) {
    const treffer = zeile.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!treffer) continue;
    const [, name, wert] = treffer;
    if (!process.env[name]) process.env[name] = wert.replace(/^["']|["']$/g, '');
  }
}

ladeEnvDatei();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ SUPABASE_URL und SUPABASE_SERVICE_KEY muessen gesetzt sein');
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY muss gesetzt sein');
    process.exit(1);
  }

  // Erst nach der Env-Pruefung laden: das Modul liest den Key beim Aufruf
  const { erkenneGeschlecht, MIN_KONFIDENZ } = require('../netlify/functions/_shared/geschlecht-erkennen');

  const limit = Math.max(1, Number(process.argv[2]) || 200);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: offen, error } = await supabase
    .from('creator')
    .select('id, vorname, nachname, ig_username, ig_biography')
    .is('geschlecht', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error(`❌ Laden fehlgeschlagen: ${error.message}`);
    process.exit(1);
  }
  if (!offen.length) {
    console.log('Kein Creator ohne Geschlecht gefunden.');
    return;
  }

  console.log(`🔍 ${offen.length} Creator ohne Geschlecht, Schwelle bei ${MIN_KONFIDENZ}\n`);

  const start = Date.now();
  const { treffer, fehler } = await erkenneGeschlecht(offen, { supabase, feature: 'geschlecht_probe' });

  const namen = new Map(offen.map((c) => [c.id, [c.vorname, c.nachname].filter(Boolean).join(' ')]));
  const verteilung = {};

  for (const t of treffer) {
    const name = (namen.get(t.id) || t.id).padEnd(28).slice(0, 28);
    const wert = t.geschlecht || `— (wollte: ${t.vorschlag || 'nichts'})`;
    console.log(`${name} ${String(wert).padEnd(30)} ${t.konfidenz ?? '-'}`);
    const schluessel = t.geschlecht || 'unsicher';
    verteilung[schluessel] = (verteilung[schluessel] || 0) + 1;
  }

  console.log(`\n📊 ${JSON.stringify(verteilung)}  (${Math.round((Date.now() - start) / 1000)}s)`);
  if (fehler.length) console.log(`⚠️ Fehlgeschlagene Batches: ${JSON.stringify(fehler)}`);
  console.log('\nEs wurde nichts geschrieben.');
}

main().catch((err) => {
  console.error('❌ Unerwarteter Fehler:', err);
  process.exit(1);
});
