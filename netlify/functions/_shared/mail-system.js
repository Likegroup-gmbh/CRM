// _shared/mail-system.js
// Brücke zum zentralen Mail-System (supabase/functions/_shared/mail/).
// Es gibt genau eine Quelle für Layout, Farben und Templates. Diese Datei reicht sie
// nur an die Netlify-Functions (CommonJS) durch, es steht keine Mail-Logik darin.
//
// Produktion: esbuild (netlify.toml, node_bundler = "esbuild") bündelt den TypeScript-Import mit.
// Vitest/Node lokal: Node führt .ts direkt aus (Type-Stripping, Node >= 22.18).

module.exports = require('../../../supabase/functions/_shared/mail/index.ts');
