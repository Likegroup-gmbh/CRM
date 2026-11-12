// ablage-umsortieren-background.js
// Struktur-Umzug in SharePoint je Unternehmen: Marken/Kampagnen nach Medien/ (ADR 0067), dann
// Storys/, Bilder/ und Varianten-Ordner in die Runden unter Videos/Video_N (ADR 0065)
// (Background Function, bis zu 15 Minuten). Angestossen von der
// Admin-Seite, geschuetzt ueber x-ablage-secret. Reicht das Budget nicht, stoesst der Lauf sich
// selbst erneut an (hoechstens MAX_RUNDEN). Pausiert bei Notschalter.
// Body: { unternehmen_id, runde? }

const { secretOk, istUuid, anstossen } = require('./_shared/ablage/konfig');
const { ablageAusEnv } = require('./_shared/ablage');
const { createUmsortieren } = require('./_shared/ablage/umsortieren');

const MAX_RUNDEN = 20;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!secretOk(event)) return { statusCode: 401, body: 'Nicht autorisiert' };

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Ungültiger Body' };
  }
  if (!istUuid(body.unternehmen_id)) return { statusCode: 400, body: 'unternehmen_id fehlt' };

  const ablage = ablageAusEnv();
  if (!ablage) return { statusCode: 200, body: JSON.stringify({ nicht_konfiguriert: true }) };

  try {
    const runde = Number(body.runde) || 1;
    const r = await createUmsortieren({ supabase: ablage.supabase, ablage }).lauf({ unternehmenId: body.unternehmen_id });
    if (r.unvollstaendig && runde < MAX_RUNDEN) {
      r.weiter = await anstossen(event, 'ablage-umsortieren-background', { unternehmen_id: body.unternehmen_id, runde: runde + 1 });
    }
    console.log(`[ablage-umsortieren] ${body.unternehmen_id} Runde ${runde}: ${JSON.stringify(r)}`);
    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (err) {
    console.error('[ablage-umsortieren]', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
