// run.cjs
// Neuigkeiten-Pipeline nach Push auf main. Laeuft in der GitHub Action
// .github/workflows/neuigkeiten.yml:
//
//   1. Deduplizierung: SHA schon in neuigkeit? -> fertig
//   2. Diff seit dem letzten verarbeiteten Stand
//   3. Claude: user-sichtbar? -> Post (titel/kurztext)
//   4. Insert in neuigkeit (published bzw. skipped)
//
// Benoetigte Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY,
// GITHUB_SHA. Optional: GITHUB_EVENT_BEFORE.

const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const { callClaude, MODELS } = require('../../netlify/functions/_shared/anthropic');
const { NEUIGKEIT_TOOL, buildSystemPrompt, buildUserPrompt, sanitizeTitel, sanitizeKurztext } = require('./prompt.cjs');

const DIFF_MAX_CHARS = 100000;
const DIFF_MAX_LINES_PER_FILE = 200;

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

async function generatePost({ commits, stat, diff }) {
  const result = await callClaude({
    model: MODELS.distill,
    systemBlocks: [{ text: buildSystemPrompt() }],
    userPrompt: buildUserPrompt({ commits, stat, diff }),
    maxTokens: 1024,
    tool: NEUIGKEIT_TOOL
  });
  const json = result.json;
  if (!json) throw new Error('Claude hat kein strukturiertes Ergebnis geliefert');
  return json;
}

async function main() {
  requireEnv([
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'ANTHROPIC_API_KEY',
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

  // 3. Claude
  const post = await generatePost({ commits, stat, diff });

  if (!post.user_relevant) {
    const { error } = await supabase.from('neuigkeit').insert({
      titel: 'Keine sichtbaren Aenderungen',
      status: 'skipped',
      commit_sha: sha
    });
    if (error) throw new Error(`Insert (skipped): ${error.message}`);
    console.log(`⏭️ ${sha.slice(0, 7)}: nichts User-sichtbares, als skipped gespeichert`);
    return;
  }

  // 4. Insert
  const { error } = await supabase.from('neuigkeit').insert({
    titel: sanitizeTitel(post.titel) || 'Update',
    kurztext: sanitizeKurztext(post.kurztext),
    audience: 'intern',
    status: 'published',
    commit_sha: sha,
    published_at: new Date().toISOString()
  });
  if (error) throw new Error(`Insert (published): ${error.message}`);
  console.log(`🎉 Neuigkeit "${post.titel}" ist live`);
}

main().catch((err) => {
  console.error(`❌ Neuigkeiten-Pipeline: ${err.message}`);
  process.exit(1);
});
