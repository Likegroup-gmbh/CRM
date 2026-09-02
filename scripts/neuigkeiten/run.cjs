// run.cjs
// Neuigkeiten-Pipeline nach Push auf main. Laeuft in der GitHub Action
// .github/workflows/neuigkeiten.yml, NACHDEM der Production-Deploy dieser
// SHA auf Netlify fertig ist:
//
//   1. Deduplizierung: SHA schon in neuigkeit? -> fertig
//   2. Diff seit dem letzten verarbeiteten Stand
//   3. Netlify-Poll bis der Production-Deploy der SHA ready ist
//   4. Claude: user-sichtbar? -> Post (titel/teaser/inhalt/schritte)
//   5. Puppeteer-Screenshots der betroffenen Routen -> Bucket neuigkeiten
//   6. Insert in neuigkeit (published bzw. skipped)
//
// Benoetigte Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY,
// NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID, PRODUCTION_URL, GITHUB_SHA.
// Optional: GITHUB_EVENT_BEFORE, WHATSNEW_LOGIN_EMAIL, WHATSNEW_LOGIN_PASSWORD
// (ohne Login-Daten geht der Post ohne Screenshots raus).

const { execSync } = require('child_process');
const { randomUUID } = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { callClaude, MODELS } = require('../../netlify/functions/_shared/anthropic');
const { NEUIGKEIT_TOOL, buildSystemPrompt, buildUserPrompt, sanitizeSchritte, slugify } = require('./prompt.cjs');
const { shootRoutes } = require('./screenshots.cjs');

const NETLIFY_API = 'https://api.netlify.com/api/v1';
const DEPLOY_TIMEOUT_MS = 15 * 60 * 1000;
const DEPLOY_POLL_MS = 15000;
const DIFF_MAX_CHARS = 100000;
const DIFF_MAX_LINES_PER_FILE = 200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function requireEnv(names) {
  const fehlend = names.filter((n) => !process.env[n]);
  if (fehlend.length) {
    throw new Error(`Fehlende Umgebungsvariablen: ${fehlend.join(', ')}`);
  }
}

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: 'utf8' }).trim();
}

function shaExists(sha) {
  try {
    git(`cat-file -e ${sha}^{commit}`);
    return true;
  } catch (_) {
    return false;
  }
}

// Diff-Range: bevorzugt die before-SHA des Push-Events. Bei Force-Push oder
// fehlender History: die zuletzt verarbeitete SHA aus der DB.
async function diffRange(supabase, sha) {
  const before = process.env.GITHUB_EVENT_BEFORE;
  if (before && !/^0+$/.test(before) && before !== sha && shaExists(before)) {
    return { from: before, to: sha };
  }
  const { data } = await supabase
    .from('neuigkeit')
    .select('commit_sha')
    .not('commit_sha', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);
  const letzte = data?.[0]?.commit_sha;
  if (letzte && letzte !== sha && shaExists(letzte)) {
    console.log(`ℹ️ before-SHA ungueltig, nutze letzte verarbeitete SHA ${letzte.slice(0, 7)}`);
    return { from: letzte, to: sha };
  }
  return { from: `${sha}~1`, to: sha };
}

// Diff auf das Wesentliche kuerzen: dist/ und Lockfile raus, pro Datei
// gekappt, Gesamtbudget begrenzt.
function buildDiff(from, to) {
  const scope = `-- . ':!dist' ':!package-lock.json'`;
  const commits = git(`log --format='- %s' ${from}..${to}`);
  const stat = git(`diff --stat ${from}..${to} ${scope}`);
  let diff = git(`diff ${from}..${to} ${scope}`);

  const teile = diff.split(/(?=^diff --git )/m).map((teil) => {
    const zeilen = teil.split('\n');
    return zeilen.length > DIFF_MAX_LINES_PER_FILE
      ? zeilen.slice(0, DIFF_MAX_LINES_PER_FILE).join('\n') + '\n... (gekuerzt)'
      : teil;
  });
  diff = teile.join('');
  if (diff.length > DIFF_MAX_CHARS) {
    diff = diff.slice(0, DIFF_MAX_CHARS) + '\n... (Gesamt-Diff gekuerzt)';
  }
  return { commits, stat, diff };
}

async function waitForDeploy(siteId, sha, token) {
  const deadline = Date.now() + DEPLOY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`${NETLIFY_API}/sites/${siteId}/deploys?per_page=20`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Netlify API: HTTP ${res.status}`);
    const deploys = await res.json();
    const deploy = deploys.find((d) => d.commit_ref === sha && d.context === 'production');
    if (deploy?.state === 'ready') {
      console.log(`✅ Production-Deploy ${deploy.id} ist live`);
      return deploy;
    }
    if (deploy?.state === 'error') {
      throw new Error(`Netlify Deploy ${deploy.id} fehlgeschlagen`);
    }
    console.log(`⏳ Warte auf Production-Deploy von ${sha.slice(0, 7)} (${deploy?.state || 'noch nicht gestartet'})`);
    await sleep(DEPLOY_POLL_MS);
  }
  throw new Error(`Timeout: kein fertiger Production-Deploy fuer ${sha.slice(0, 7)}`);
}

async function generatePost({ commits, stat, diff }) {
  const result = await callClaude({
    model: MODELS.distill,
    systemBlocks: [{ text: buildSystemPrompt() }],
    userPrompt: buildUserPrompt({ commits, stat, diff }),
    maxTokens: 4096,
    tool: NEUIGKEIT_TOOL
  });
  const json = result.json;
  if (!json) throw new Error('Claude hat kein strukturiertes Ergebnis geliefert');
  return json;
}

async function uploadScreenshots(supabase, neuigkeitId, schritte) {
  const email = process.env.WHATSNEW_LOGIN_EMAIL;
  const password = process.env.WHATSNEW_LOGIN_PASSWORD;
  if (!email || !password) {
    console.warn('⚠️ WHATSNEW_LOGIN_EMAIL/PASSWORD nicht gesetzt - Post geht ohne Screenshots raus');
    return schritte;
  }

  const routes = schritte.map((s) => s.route).filter(Boolean);
  let shots;
  try {
    shots = await shootRoutes({
      baseUrl: process.env.PRODUCTION_URL.replace(/\/$/, ''),
      email,
      password,
      routes
    });
  } catch (err) {
    console.error(`⚠️ Screenshot-Lauf fehlgeschlagen: ${err.message}`);
    return schritte;
  }

  for (const schritt of schritte) {
    const buffer = schritt.route ? shots.get(schritt.route) : null;
    if (!buffer) continue;
    const pfad = `${neuigkeitId}/${slugify(schritt.route)}.png`;
    const { error } = await supabase.storage
      .from('neuigkeiten')
      .upload(pfad, buffer, { contentType: 'image/png', upsert: true });
    if (error) {
      console.error(`⚠️ Upload ${pfad} fehlgeschlagen: ${error.message}`);
      continue;
    }
    schritt.screenshot_path = pfad;
  }
  return schritte;
}

async function main() {
  requireEnv([
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'ANTHROPIC_API_KEY',
    'NETLIFY_AUTH_TOKEN',
    'NETLIFY_SITE_ID',
    'PRODUCTION_URL',
    'GITHUB_SHA'
  ]);
  const sha = process.env.GITHUB_SHA;
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  // 1. Deduplizierung
  const { data: vorhanden } = await supabase
    .from('neuigkeit')
    .select('id, status')
    .eq('commit_sha', sha)
    .maybeSingle();
  if (vorhanden) {
    console.log(`ℹ️ ${sha.slice(0, 7)} bereits verarbeitet (${vorhanden.status}), kein zweiter Lauf`);
    return;
  }

  // 2. Diff
  const { from, to } = await diffRange(supabase, sha);
  const { commits, stat, diff } = buildDiff(from, to);
  console.log(`📝 Diff ${from.slice(0, 7)}..${to.slice(0, 7)}: ${stat.split('\n').pop() || 'leer'}`);

  // 3. Warten, bis genau diese SHA live ist - sonst zeigen die Screenshots
  // noch die alte Version
  await waitForDeploy(process.env.NETLIFY_SITE_ID, sha, process.env.NETLIFY_AUTH_TOKEN);

  // 4. Claude
  const post = await generatePost({ commits, stat, diff });

  if (!post.user_relevant) {
    const { error } = await supabase.from('neuigkeit').insert({
      slug: `deploy-${sha.slice(0, 7)}`,
      titel: 'Keine sichtbaren Aenderungen',
      status: 'skipped',
      commit_sha: sha
    });
    if (error) throw new Error(`Insert (skipped): ${error.message}`);
    console.log(`⏭️ ${sha.slice(0, 7)}: nichts User-sichtbares, als skipped gespeichert`);
    return;
  }

  // 5. Screenshots + 6. Insert
  const id = randomUUID();
  const schritte = await uploadScreenshots(supabase, id, sanitizeSchritte(post.schritte));
  const { error } = await supabase.from('neuigkeit').insert({
    id,
    slug: `${slugify(post.titel)}-${sha.slice(0, 7)}`,
    titel: String(post.titel || 'Update').slice(0, 120),
    teaser: post.teaser ? String(post.teaser).slice(0, 200) : null,
    inhalt: post.inhalt || null,
    schritte,
    audience: 'intern',
    status: 'published',
    commit_sha: sha,
    published_at: new Date().toISOString()
  });
  if (error) throw new Error(`Insert (published): ${error.message}`);
  console.log(`🎉 Neuigkeit "${post.titel}" ist live (${schritte.filter((s) => s.screenshot_path).length} Screenshots)`);
}

main().catch((err) => {
  console.error(`❌ Neuigkeiten-Pipeline: ${err.message}`);
  process.exit(1);
});
