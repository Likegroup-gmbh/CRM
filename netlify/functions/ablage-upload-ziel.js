// ablage-upload-ziel.js
// Upload-Session in SharePoint fuer genau diese eine Datei: { ziel:'sharepoint', upload_url, ... }.
// Ohne SharePoint-Konfiguration 503 (nicht_konfiguriert).

const { ablageHandler } = require('./_shared/ablage/http');
const { createSchreiben } = require('./_shared/ablage/schreiben');

exports.handler = ablageHandler('ablage-upload-ziel', (ctx) => createSchreiben(ctx).uploadZiel(ctx));
