// ablage-upload-commit.js
// Nach dem letzten Chunk: prueft die Datei in SharePoint und liefert die Spalten der Asset-Zeile.

const { ablageHandler } = require('./_shared/ablage/http');
const { createSchreiben } = require('./_shared/ablage/schreiben');

exports.handler = ablageHandler('ablage-upload-commit', (ctx) => createSchreiben(ctx).uploadCommit(ctx));
