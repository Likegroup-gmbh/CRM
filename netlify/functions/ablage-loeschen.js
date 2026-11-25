// ablage-loeschen.js
// Loeschkaskade (DSGVO) vor dem DB-Delete einer Entitaet: Ordner und Dateien endgueltig,
// am Papierkorb vorbei. Ohne SharePoint-Bestand oder -Konfiguration nur Nullen.

const { ablageHandler } = require('./_shared/ablage/http');
const { createSchreiben } = require('./_shared/ablage/schreiben');

exports.handler = ablageHandler('ablage-loeschen', (ctx) => createSchreiben(ctx).entityLoeschen(ctx));
