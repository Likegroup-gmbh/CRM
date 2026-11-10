// ablage-creator-start.js
// Creator-Token-Seite: gleicher Body wie creator-upload-start. { ziel:'dropbox' } -> die Seite
// nimmt den bisherigen TUS-Weg ueber creator-upload-start; sonst Upload-Session mit deferCommit.

const { ablageHandler } = require('./_shared/ablage/http');
const { createCreatorAblage } = require('./_shared/ablage/creator');

exports.handler = ablageHandler('ablage-creator-start', (ctx) => createCreatorAblage(ctx).start(ctx.body), { auth: false });
