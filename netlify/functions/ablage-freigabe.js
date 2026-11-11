// ablage-freigabe.js
// Kunden-Leselink auf den Videos-Ordner einer Kooperation (30 Tage, ohne Anmeldung).
// Body: { aktion: 'erstellen', kooperation_id, typ?: 'videos' ('storys' = Alias) } | { aktion: 'liste', kooperation_id }
//     | { aktion: 'widerrufen', id }

const { ablageHandler, AblageFehler } = require('./_shared/ablage/http');
const { createFreigabe } = require('./_shared/ablage/freigabe');

const AKTIONEN = new Set(['erstellen', 'liste', 'widerrufen']);

exports.handler = ablageHandler('ablage-freigabe', (ctx) => {
  const aktion = ctx.body.aktion;
  if (!AKTIONEN.has(aktion)) throw new AblageFehler(400, 'Unbekannte Aktion');
  return createFreigabe(ctx)[aktion](ctx);
});
