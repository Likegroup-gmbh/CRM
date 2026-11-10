// Gemeinsame Helfer fuer die Medienablage-Skripte: Env-Datei laden, Argumente lesen.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

export const require = createRequire(import.meta.url);

/** Liest KEY=VALUE aus der Datei. Die Datei gewinnt gegen die Prozess-Env (Staging vs. Live). */
export function ladeEnv(datei = '.env') {
  let text;
  try {
    text = readFileSync(datei, 'utf8');
  } catch {
    throw new Error(`Env-Datei ${datei} nicht gefunden`);
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export function argumente(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

export function pflicht(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} fehlt in der Env-Datei`);
  return v;
}

export function supabaseService() {
  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY fehlen in der Env-Datei');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
