// Beschreibung einer Videoreferenz neu analysieren: gespeichertes Transkript und Caption
// durch Llama, Ergebnis als Struktur (Titel, Angle, Hook, Visual Hook, Hauptteil, CTA).
// Kein erneutes Scrapen. Ersetzt die vorhandene Beschreibung (auch von Hand geschriebene);
// den Schutz davor setzt die UI per Bestaetigung.

const { starteKiRequest } = require('./ki-log');
const { cloudflareCredentials, runDescription } = require('./video-transcribe');
const { normalisiereStruktur, strukturZuText } = require('./beschreibung-struktur');
const { gesperrterHook } = require('./hook-sperre');

function beschreibungBlocker(item) {
  if (!item?.video_link) return 'Nur eine Videoreferenz';
  if (!String(item.transkript || '').trim()) return 'Transkript fehlt';
  return null;
}

async function ersetzeBeschreibung(supabase, { userId, itemId }) {
  const { data: item, error } = await supabase.from('strategie_items')
    .select('id, video_link, transkript, caption, hook_gesperrt, beschreibung, beschreibung_struktur')
    .eq('id', itemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!item) throw new Error('Videoidee nicht gefunden');

  const blocker = beschreibungBlocker(item);
  if (blocker) throw new Error(blocker);

  const { accountId, aiToken } = cloudflareCredentials();
  if (!accountId || !aiToken) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_AI_TOKEN nicht gesetzt (Netlify Env-Vars)');
  }
  const ki = await starteKiRequest(supabase, { userId, feature: 'beschreibung_analyse' });

  let beschreibung;
  try {
    beschreibung = await runDescription(item.transkript, item.caption, accountId, aiToken);
  } catch (e) {
    await ki.fehlgeschlagen(e);
    throw e;
  }
  if (!String(beschreibung.text || '').trim()) {
    const e = new Error('Die KI hat keine Beschreibung geliefert');
    await ki.fehlgeschlagen(e);
    throw e;
  }

  const updates = {
    beschreibung: beschreibung.text,
    beschreibung_quelle: 'ki',
    beschreibung_struktur: beschreibung.struktur || null
  };

  // Hook-Sperre (ADR 0054): der freigegebene Hook bleibt, alle anderen Zeilen kommen neu
  const gesperrt = gesperrterHook(item);
  if (gesperrt) {
    const basis = beschreibung.struktur || normalisiereStruktur(item.beschreibung_struktur) || {};
    const struktur = normalisiereStruktur({ ...basis, hook: gesperrt });
    updates.beschreibung_struktur = struktur;
    updates.beschreibung = strukturZuText(struktur);
  }
  const { error: writeError } = await supabase.from('strategie_items')
    .update(updates)
    .eq('id', itemId);
  if (writeError) {
    await ki.fehlgeschlagen(writeError);
    throw new Error(writeError.message);
  }
  await ki.abschliessen({ model: 'cloudflare-llama' });
  return updates;
}

module.exports = { beschreibungBlocker, ersetzeBeschreibung };
