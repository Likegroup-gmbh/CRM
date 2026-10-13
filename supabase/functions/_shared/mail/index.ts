/**
 * Zentrales Mail-System der Plattform: der einzige Einstieg.
 *
 *   tokens.ts    Farben, Schrift, Namen (aus variables.css)
 *   shell.ts     Grundgerüst (Kopf, Karte, Fußzeile)
 *   sections.ts  Bausteine, die ein Template kombiniert
 *   templates/   ein Template pro Bereich
 *
 * Neuer Bereich: neue Datei in templates/ und ein Export hier. Sonst nichts.
 *
 * Läuft in Edge Functions (Deno), Netlify-Functions (esbuild) und Vitest. Deshalb
 * keine Deno- oder Node-Globals in diesem Ordner und Imports mit .ts-Endung.
 */

export { einladungMail, BRIEFING_SCHRITTE, BRIEFING_TYP_LABEL } from './templates/einladung.ts';
export type { EinladungMail } from './templates/einladung.ts';
export { einreichungMail } from './templates/einreichung.ts';
export type { EinreichungMail } from './templates/einreichung.ts';
export { teilenMail } from './templates/teilen.ts';
export type { TeilenMail } from './templates/teilen.ts';
export { creatorUploadMail } from './templates/creatorUpload.ts';
export type { CreatorUploadMail } from './templates/creatorUpload.ts';
export { anschreibenMail } from './templates/anschreiben.ts';
export type { AnschreibenMail } from './templates/anschreiben.ts';
export { authMail } from './templates/auth.ts';
export type { AuthArt } from './templates/auth.ts';
export type { MailErgebnis } from './templates/typen.ts';
