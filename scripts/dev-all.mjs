// dev-all.mjs
// Vite (3001) und Netlify-Functions (9999) zusammen starten. Endet einer der beiden, stoppt
// auch der andere: Vite ohne Functions sieht aus wie kaputte Daten (keine Lese-Links, keine
// Poster, überall „Vorschau nicht verfügbar“).

import { spawn } from 'node:child_process';

const SERVER = [
  ['functions', 'dev:functions'],
  ['vite', 'dev']
];

let stoppt = false;
const kinder = SERVER.map(([name, script]) => {
  const kind = spawn('npm', ['run', script], { stdio: 'inherit' });
  kind.on('exit', (code, signal) => stoppeAlle(`${name} beendet (${signal || `Code ${code}`})`, code || 1));
  return kind;
});

function stoppeAlle(grund, exitCode) {
  if (stoppt) return;
  stoppt = true;
  if (grund) console.error(`\n[dev:all] ${grund}, stoppe auch den anderen Server.`);
  for (const kind of kinder) {
    if (kind.exitCode === null && kind.signalCode === null) kind.kill('SIGTERM');
  }
  process.exitCode = exitCode;
}

process.on('SIGINT', () => stoppeAlle(null, 0));
process.on('SIGTERM', () => stoppeAlle(null, 0));
