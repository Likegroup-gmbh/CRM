// ablage-link.js
// Kurzlebige Links fuer Wiedergabe und Download (SharePoint: Graph-downloadUrl, Dropbox: Temp-Link).
// Fuer Team, Kunden und Gaeste; Sichtbarkeit ueber RLS mit dem JWT des Aufrufers.
// Body: { items: [{ typ, id }] } | { dokument_urls: [url] } | { frei: { kooperation_id } } | { frei_datei: { item_id } }
// Dokumente (vertrag, rechnung, ...) liefern Schluessel `${typ}:${id}` bzw. die gespeicherte URL.

const { ablageHandler } = require('./_shared/ablage/http');
const { createLesen } = require('./_shared/ablage/lesen');

exports.handler = ablageHandler('ablage-link', (ctx) => {
  const lesen = createLesen(ctx);
  if (ctx.body.frei) return lesen.frei(ctx);
  if (ctx.body.frei_datei) return lesen.freiDatei(ctx);
  return lesen.links(ctx);
}, { auth: 'optional' });
