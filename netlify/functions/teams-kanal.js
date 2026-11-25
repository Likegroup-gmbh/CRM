// teams-kanal.js
// Admin-Seite Teams-Kanäle (nur Admins). Body: { aktion: 'test', kanal_id }
// Postet eine Testkarte an den gespeicherten Workflow-Link und hält das Ergebnis am Kanal fest.

const { serviceClient, parseBody, json, istUuid } = require('./_shared/ablage/konfig');
const { aufrufer, istAdmin } = require('./_shared/ablage/zugriff');
const { senden } = require('./_shared/teams/webhook');
const { testKarte } = require('./_shared/teams/karte');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const body = parseBody(event);
  if (!body || typeof body !== 'object') return json(400, { error: 'Ungueltiger Request' });
  const supabase = serviceClient();
  if (!supabase) return json(500, { error: 'Serverkonfiguration unvollständig' });

  try {
    const wer = await aufrufer(event, supabase);
    if (!wer.ok) return wer.antwort;
    if (!istAdmin(wer.benutzer)) return json(403, { error: 'Nur für Admins' });
    if (body.aktion !== 'test') return json(400, { error: 'Unbekannte Aktion' });
    if (!istUuid(body.kanal_id)) return json(400, { error: 'kanal_id fehlt' });

    const { data: kanal, error } = await supabase
      .from('teams_kanal').select('id, name, webhook_url').eq('id', body.kanal_id).maybeSingle();
    if (error) throw error;
    if (!kanal) return json(404, { error: 'Kanal nicht gefunden' });

    const r = await senden(kanal.webhook_url, testKarte(kanal.name));
    const jetzt = new Date().toISOString();
    const patch = r.ok
      ? { letzte_meldung_at: jetzt, letzter_fehler: null, letzter_fehler_at: null }
      : { letzter_fehler: r.fehler, letzter_fehler_at: jetzt };
    await supabase.from('teams_kanal').update(patch).eq('id', kanal.id);
    return json(200, r.ok ? { ok: true } : { ok: false, fehler: r.fehler });
  } catch (err) {
    console.error('[teams-kanal]', err?.message || err);
    return json(500, { error: 'Interner Fehler' });
  }
};
