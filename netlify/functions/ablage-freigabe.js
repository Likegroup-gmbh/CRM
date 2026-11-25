// ablage-freigabe.js
// Kunden-Leselink (365 Tage, ohne Anmeldung) auf den Videos-Ordner einer Kooperation oder,
// nur fürs Team, auf den ganzen Produktions-Ordner (ADR 0071).
// Body: { aktion: 'erstellen', kooperation_id, typ?: 'videos' ('storys' = Alias) } | { aktion: 'erstellen', produktion_id }
//     | { aktion: 'liste', kooperation_id } | { aktion: 'liste', produktion_id } | { aktion: 'widerrufen', id }

const { ablageHandler, AblageFehler } = require('./_shared/ablage/http');
const { createFreigabe } = require('./_shared/ablage/freigabe');

const AKTIONEN = new Set(['erstellen', 'liste', 'widerrufen']);

exports.handler = ablageHandler('ablage-freigabe', (ctx) => {
  const aktion = ctx.body.aktion;
  if (!AKTIONEN.has(aktion)) throw new AblageFehler(400, 'Unbekannte Aktion');
  return createFreigabe(ctx)[aktion](ctx);
});
