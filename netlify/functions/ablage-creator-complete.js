// ablage-creator-complete.js
// Alle Bytes sind in der Upload-Session: pruefen, freischalten (Commit), Asset-Zeile anlegen.

const { ablageHandler } = require('./_shared/ablage/http');
const { createCreatorAblage } = require('./_shared/ablage/creator');

exports.handler = ablageHandler('ablage-creator-complete', (ctx) => createCreatorAblage(ctx).complete(ctx.body), { auth: false });
