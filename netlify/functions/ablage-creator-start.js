// ablage-creator-start.js
// Creator-Token-Seite: Upload-Session mit deferCommit im Zielordner (SharePoint).
// Body: { token, targetType, targetId, fileName, fileSize, contentType }.

const { ablageHandler } = require('./_shared/ablage/http');
const { createCreatorAblage } = require('./_shared/ablage/creator');

exports.handler = ablageHandler('ablage-creator-start', (ctx) => createCreatorAblage(ctx).start(ctx.body), { auth: false });
