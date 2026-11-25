// run.cjs
// Evaluation der Persona-Generierung (Startrun) gegen echte Job-Inputs.
//
//   node scripts/persona-eval/run.cjs --baseline        # nur die Zahlen der bisherigen Personas
//   node scripts/persona-eval/run.cjs --dry             # Prompts bauen, kein API-Call
//   ANTHROPIC_API_KEY=... node scripts/persona-eval/run.cjs [--runs=3] [--produkt=Duo]
//
// Fixtures: fixtures.json (Input-Snapshots aus produkt_persona_jobs, dazu
// bisher_oberbegriff/bisher_beruf der alten Generierung und berufsgebunden als
// Erwartung: bei true muss der Beruf bleiben, sonst muss er leer sein).
//
// Metriken je Lauf (Heuristik, ersetzt keinen Blick auf die Texte):
//   - kontext_identitaet: Oberbegriff/Beschreibung hangen an Arbeit/Beruf/Pendeln/Reisen/Sport
//   - beruf_gesetzt:      beruf nicht leer
//   - gruppen:            Anzahl Kaeufergruppen der Analyse
// Das Ziel: kontext_identitaet und beruf_gesetzt sinken bei berufsgebunden=false,
// bleiben bei berufsgebunden=true (B2B-Gegenprobe).

const fixtures = require('./fixtures.json');
const {
  buildPrompt, personaTool, validateVorschlaege, istBreiterLauf, gefilterteUnisexNamen
} = require('../../netlify/functions/_shared/produkt-persona');

const KONTEXT_RE = /(arbeit|beruf|pendl|reis|sport|training|home.?office|manager|freiberuf|angestellt|selbstst)/i;

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));

function kontextIdentitaet(text) {
  return KONTEXT_RE.test(String(text || ''));
}

function zeile(label, werte) {
  console.log(`${label.padEnd(48)} ${werte}`);
}

function baseline() {
  const nichtB2b = fixtures.filter((f) => !f.berufsgebunden);
  const kontext = nichtB2b.filter((f) => kontextIdentitaet(f.bisher_oberbegriff));
  const beruf = nichtB2b.filter((f) => f.bisher_beruf);
  console.log(`Baseline (alte Generierung, ${nichtB2b.length} Produkte ohne Berufsbindung)`);
  zeile('Oberbegriff haengt an Kontext/Beruf', `${kontext.length}/${nichtB2b.length}`);
  zeile('beruf gesetzt', `${beruf.length}/${nichtB2b.length}`);
  for (const f of fixtures) zeile(`  ${f.produkt.slice(0, 44)}`, `${f.bisher_oberbegriff} | ${f.bisher_beruf}`);
}

async function lauf(fixture) {
  const { callClaude, extractJson, MODELS } = require('../../netlify/functions/_shared/anthropic');
  const input = {
    modus: 'initial',
    felder: fixture.felder,
    behalten: [],
    bestehende_use_cases: [],
    marke_ids: []
  };
  const breit = istBreiterLauf(input);
  const namen = gefilterteUnisexNamen({});
  const { stable, task } = buildPrompt(input, { pool: [], poolQuelle: 'leer' });
  const tool = personaTool({ unisexNamen: true, namen, breit });

  const entwerfen = async (userPrompt) => {
    const antwort = await callClaude({
      model: MODELS.persona,
      systemBlocks: [{ text: stable, cache: true }],
      userPrompt,
      maxTokens: 12000,
      thinking: true,
      tool,
      toolForced: true
    });
    const json = antwort.json || extractJson(antwort.text);
    if (!json) throw new Error('kein strukturiertes Ergebnis');
    return validateVorschlaege(json, {
      useCaseCount: Array.isArray(json.use_cases) ? json.use_cases.length : 0,
      maxVorschlaege: 1,
      unisexNamen: true,
      breit
    });
  };

  let geprueft = await entwerfen(task);
  let retry = false;
  if (!geprueft.vorschlaege.length && geprueft.verworfen.length) {
    retry = true;
    geprueft = await entwerfen(`${task}\n\n# KORREKTUR\nWaehle einen Namen aus der Liste und nenne 2 bis 4 Kaeufergruppen.`);
  }
  return { geprueft, retry };
}

async function main() {
  if (args.baseline) return baseline();

  const runs = Number(args.runs) || 3;
  const liste = fixtures.filter((f) => !args.produkt || f.produkt.toLowerCase().includes(String(args.produkt).toLowerCase()));

  if (args.dry) {
    for (const f of liste) {
      const input = { modus: 'initial', felder: f.felder, behalten: [], bestehende_use_cases: [] };
      const { stable, task } = buildPrompt(input, { pool: [], poolQuelle: 'leer' });
      zeile(f.produkt.slice(0, 48), `stable ${stable.length} Zeichen, task ${task.length} Zeichen`);
    }
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY fehlt. Mit --dry nur Prompts bauen, mit --baseline nur die Altwerte zeigen.');
    process.exit(1);
  }

  const summe = { laeufe: 0, kontext: 0, beruf: 0, gruppen2: 0, fehler: 0, b2bBerufOk: 0, b2bLaeufe: 0 };
  for (const f of liste) {
    console.log(`\n== ${f.produkt}  (berufsgebunden erwartet: ${f.berufsgebunden})`);
    console.log(`   vorher: ${f.bisher_oberbegriff} | ${f.bisher_beruf}`);
    for (let i = 0; i < runs; i++) {
      summe.laeufe += 1;
      try {
        const { geprueft, retry } = await lauf(f);
        const v = geprueft.vorschlaege[0];
        if (!v) {
          summe.fehler += 1;
          console.log(`   lauf ${i + 1}: KEIN VORSCHLAG (${geprueft.verworfen.map((x) => x.grund).join(', ')})`);
          continue;
        }
        const p = v.persona;
        const kontext = kontextIdentitaet(`${p.oberbegriff} ${p.beschreibung}`);
        const gruppen = geprueft.analyse.kaeufergruppen.map((g) => g.name).join(' / ');
        if (!f.berufsgebunden) {
          if (kontext) summe.kontext += 1;
          if (p.beruf) summe.beruf += 1;
        } else {
          summe.b2bLaeufe += 1;
          if (p.beruf) summe.b2bBerufOk += 1;
        }
        if (geprueft.analyse.kaeufergruppen.length >= 2) summe.gruppen2 += 1;
        console.log(`   lauf ${i + 1}${retry ? ' (retry)' : ''}: ${p.oberbegriff} | beruf=${p.beruf || '-'} | kontext=${kontext ? 'JA' : 'nein'}`);
        console.log(`            gruppen: ${gruppen}`);
        console.log(`            nenner:  ${geprueft.analyse.gemeinsamer_nenner}`);
      } catch (err) {
        summe.fehler += 1;
        console.log(`   lauf ${i + 1}: FEHLER ${err.message}`);
      }
    }
  }

  const nichtB2b = summe.laeufe - summe.b2bLaeufe - summe.fehler;
  console.log('\nSumme');
  zeile('Laeufe / Fehler', `${summe.laeufe} / ${summe.fehler}`);
  zeile('Oberbegriff haengt an Kontext/Beruf (nicht B2B)', `${summe.kontext}/${nichtB2b}`);
  zeile('beruf gesetzt (nicht B2B, soll 0 sein)', `${summe.beruf}/${nichtB2b}`);
  zeile('beruf erhalten (B2B, soll alle sein)', `${summe.b2bBerufOk}/${summe.b2bLaeufe}`);
  zeile('mindestens 2 Kaeufergruppen', `${summe.gruppen2}/${summe.laeufe - summe.fehler}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
