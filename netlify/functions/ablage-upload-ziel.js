// ablage-upload-ziel.js
// Wohin geht dieser Upload? { ziel:'dropbox' } -> der Client nimmt den bisherigen Weg.
// { ziel:'sharepoint', upload_url, ... } -> Upload-Session fuer genau diese eine Datei.

const { ablageHandler } = require('./_shared/ablage/http');
const { createSchreiben } = require('./_shared/ablage/schreiben');

exports.handler = ablageHandler('ablage-upload-ziel', (ctx) => createSchreiben(ctx).uploadZiel(ctx));
