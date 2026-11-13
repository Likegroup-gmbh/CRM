// ablage-stand.js
// Admin-Seite Medienablage (nur Admins). Body: { aktion: 'stand' } | { aktion: 'notschalter', an }
//   | { aktion: 'weiche', unternehmen_id, ziel } | { aktion: 'erneut' | 'ignorieren', item_id }
//   | { aktion: 'jetzt_abgleichen' } | { aktion: 'voll_abgleich' } | { aktion: 'umzug_starten', unternehmen_id }
//   | { aktion: 'umsortieren_planen' | 'umsortieren_starten', unternehmen_id }
//   | { aktion: 'final_spiegel_planen' | 'final_spiegel_starten' }

const { ablageHandler, AblageFehler } = require('./_shared/ablage/http');
const { istAdmin } = require('./_shared/ablage/zugriff');
const { createStand, AKTIONEN } = require('./_shared/ablage/stand');

exports.handler = ablageHandler('ablage-stand', (ctx) => {
  if (!istAdmin(ctx.benutzer)) throw new AblageFehler(403, 'Nur für Admins');
  const aktion = ctx.body.aktion;
  if (!AKTIONEN.has(aktion)) throw new AblageFehler(400, 'Unbekannte Aktion');
  return createStand(ctx)[aktion](ctx.body);
});
