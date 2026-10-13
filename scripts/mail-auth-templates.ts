// Rendert die Supabase-Auth-Mails aus dem zentralen Mail-System nach supabase/templates/*.html.
//
// Aufruf:  node scripts/mail-auth-templates.ts
//
// Supabase deployt Auth-Templates nicht per Code. Nach einer Änderung am Layout
// (supabase/functions/_shared/mail/) das Skript laufen lassen und die HTML-Dateien im
// Dashboard unter Authentication > Email Templates einfügen. Betreff steht in der Ausgabe.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authMail } from '../supabase/functions/_shared/mail/index.ts';
import type { AuthArt } from '../supabase/functions/_shared/mail/index.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'supabase', 'templates');

const DATEIEN: Array<{ art: AuthArt; datei: string; dashboard: string }> = [
  { art: 'bestaetigen', datei: 'confirm.html', dashboard: 'Confirm signup' },
  { art: 'passwort', datei: 'recovery.html', dashboard: 'Reset password' },
  { art: 'einladung', datei: 'invite.html', dashboard: 'Invite user' },
];

mkdirSync(outDir, { recursive: true });
for (const { art, datei, dashboard } of DATEIEN) {
  const { betreff, html } = authMail(art);
  writeFileSync(join(outDir, datei), `${html}\n`);
  console.log(`supabase/templates/${datei}  ->  Dashboard "${dashboard}", Betreff: ${betreff}`);
}
