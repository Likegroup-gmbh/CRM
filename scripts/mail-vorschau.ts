// Vorschau aller Plattform-Mails in einer Seite: docs/mail-vorschau.html
//
// Aufruf:  node scripts/mail-vorschau.ts
//
// Rendert jedes Template aus dem zentralen Mail-System mit Beispieldaten, je Mail ein iframe.
// Die Datei ist generiert, nicht von Hand ändern.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  anschreibenMail, authMail, creatorUploadMail, einladungMail, einreichungMail, teilenMail,
} from '../supabase/functions/_shared/mail/index.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASIS = 'https://vorschau.invalid';
const LINK = `${BASIS}/einladung/k7Qm2xR9`;

const mails: Array<{ name: string; betreff: string; html: string }> = [];
const add = (name: string, m: { betreff: string; html: string }) => mails.push({ name, ...m });

add('Einladung: Briefing (Paid)', einladungMail({
  art: 'briefing', briefingTyp: 'paid_creator_ads', absenderName: 'Oliver Mackeldanz',
  kunde: 'FORGEWORKS AG · IRONCLAD', nachricht: 'Hallo zusammen,\nbitte bis Freitag ausfüllen. Danke!',
  code: '924113', link: LINK, basisUrl: BASIS,
}));
add('Einladung: Produkt', einladungMail({
  art: 'produkt', absenderName: 'Oliver Mackeldanz', kunde: 'FORGEWORKS AG',
  code: '481516', link: LINK, basisUrl: BASIS,
}));
add('Teilen: Sourcing-Liste', teilenMail({
  entityLabel: 'Sourcing-Liste', entityArticle: 'die', entityName: 'Sommer 2026 Creator', sharedByName: 'Lisa Beispiel',
  rechte: 'feedback', link: `${BASIS}/share/abc`, code: '123456', message: 'Schau dir die Auswahl an und gib kurz Feedback.', basisUrl: BASIS,
}));
add('Teilen: Skripte einer Kampagne', teilenMail({
  entityLabel: 'Skript', entityArticle: 'das', entityName: 'Glow Up', sharedByName: 'Lisa Beispiel',
  rechte: 'ansehen', link: `${BASIS}/share/abc`, code: '654321', allScripts: true, basisUrl: BASIS,
}));
add('Einreichung (intern)', einreichungMail({
  art: 'briefing', einreicherName: 'Kim Kunde', einladungLabel: 'Briefing-Einladung', kunde: 'FORGEWORKS AG · IRONCLAD',
  link: `${BASIS}/produktion/1?tab=briefing`, basisUrl: BASIS,
}));
add('Creator-Upload (DE/EN)', creatorUploadMail({
  creatorVorname: 'Lisa', kampagneName: 'Sommer 2026', link: `${BASIS}/up#t=abc`, expiresAt: '2026-12-24T10:00:00Z', basisUrl: BASIS,
}));
add('Anschreiben mit PDF', anschreibenMail({
  betreff: 'Briefing: Glow Up',
  textHtml: '<p>Hallo Lisa,</p><p>anbei das Briefing für VHV.<br>Melde dich gern bei Fragen.</p><p>Viele Grüße<br>Oliver</p>',
  basisUrl: BASIS,
}));
add('Auth: E-Mail bestätigen', authMail('bestaetigen'));
add('Auth: Passwort zurücksetzen', authMail('passwort'));
add('Auth: Einladung', authMail('einladung'));

// Logo aus public/, Platzhalter in den Auth-Mails mit Beispielwerten füllen.
const lokal = (html: string) => html
  .replaceAll(`${BASIS}/apple-touch-icon.png`, '../public/apple-touch-icon.png')
  .replaceAll('{{ .SiteURL }}/apple-touch-icon.png', '../public/apple-touch-icon.png')
  .replaceAll('{{ .ConfirmationURL }}', 'https://vorschau.invalid/bestaetigen?token=abc');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const seite = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>Mail-Vorschau</title>
<style>
  body { margin: 0; padding: 32px; font-family: Inter, system-ui, sans-serif; background: #e5e5e5; color: #171717; }
  h1 { font-size: 20px; margin: 0 0 24px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(620px, 1fr)); gap: 24px; }
  figure { margin: 0; }
  figcaption { font-size: 13px; margin-bottom: 8px; }
  figcaption b { display: block; font-size: 14px; }
  figcaption span { color: #737373; }
  iframe { width: 100%; height: 900px; border: 1px solid #d4d4d4; border-radius: 8px; background: #fff; }
</style></head><body>
<h1>Mail-Vorschau (generiert mit scripts/mail-vorschau.ts)</h1>
<div class="grid">
${mails.map((m) => `<figure><figcaption><b>${esc(m.name)}</b><span>Betreff: ${esc(m.betreff)}</span></figcaption><iframe srcdoc="${esc(lokal(m.html))}"></iframe></figure>`).join('\n')}
</div>
</body></html>
`;

writeFileSync(join(root, 'docs', 'mail-vorschau.html'), seite);
console.log(`docs/mail-vorschau.html mit ${mails.length} Mails geschrieben`);
