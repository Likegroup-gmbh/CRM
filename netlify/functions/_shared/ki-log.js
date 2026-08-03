// Zentrales KI-Nutzungsprotokoll + Frequenz-Limits fuer alle Claude-Calls.
//
// Ablauf pro Anfrage (siehe ki_requests-Migration):
//   1. starteKiRequest zaehlt die juengsten Anfragen des Users (und global)
//      und wirft KiLimitError, wenn ein Fenster ueberschritten ist. Der
//      Versuch wird als 'blocked' protokolliert (zaehlt selbst nicht mit,
//      sonst verlaengert eine Flut geblockter Requests die Sperre endlos).
//   2. Sonst entsteht die Zeile mit status 'running' VOR dem API-Call -
//      parallel abgefeuerte Anfragen zaehlen dadurch sofort mit und koennen
//      nicht alle gleichzeitig am Zaehler vorbeirutschen.
//   3. abschliessen()/fehlgeschlagen() updaten die Zeile mit Tokens, Kosten
//      (claude-cost.js) und Status. Logging ist best effort und wirft nie -
//      ein kaputtes Protokoll darf keine Generierung verhindern.
//
// Limits per Env, zentral hier aufgeloest. Feature-spezifische Variablen
// gewinnen vor den User-Defaults:
//   KI_LIMIT_USER_MINUTE (10) / KI_LIMIT_USER_STUNDE (60) / KI_LIMIT_USER_TAG (200)
//   KI_LIMIT_<FEATURE>_<FENSTER>, z.B. KI_LIMIT_SKRIPT_GENERIERUNG_MINUTE=3
//   KI_LIMIT_GLOBAL_TAG (500) - Notbremse ueber alle Benutzer

const { calculateCost } = require('./claude-cost');

const FENSTER = [
  { name: 'MINUTE', ms: 60 * 1000, defaultLimit: 10, label: 'pro Minute' },
  { name: 'STUNDE', ms: 60 * 60 * 1000, defaultLimit: 60, label: 'pro Stunde' },
  { name: 'TAG', ms: 24 * 60 * 60 * 1000, defaultLimit: 200, label: 'pro Tag' }
];

const GLOBAL_TAG_DEFAULT = 500;

/** Wird geworfen, wenn ein Frequenz-Limit greift - Meldung ist UI-tauglich. */
class KiLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'KiLimitError';
  }
}

function envZahl(name, fallback) {
  const wert = Number(process.env[name]);
  return Number.isFinite(wert) && wert > 0 ? wert : fallback;
}

/** Limit fuer ein Fenster: Feature-Override vor User-Default. */
function limitFuer(feature, fenster) {
  const featureKey = `KI_LIMIT_${String(feature).toUpperCase()}_${fenster.name}`;
  const featureLimit = Number(process.env[featureKey]);
  if (Number.isFinite(featureLimit) && featureLimit > 0) return featureLimit;
  return envZahl(`KI_LIMIT_USER_${fenster.name}`, fenster.defaultLimit);
}

/** Geblockte Zeilen zaehlen nicht mit - siehe Kopfkommentar. */
const ZAEHLBARE_STATUS = ['running', 'ok', 'error'];

async function zaehleRequests(supabase, { userId, seitMs }) {
  const seit = new Date(Date.now() - seitMs).toISOString();
  let query = supabase.from('ki_requests')
    .select('id', { count: 'exact', head: true })
    .in('status', ZAEHLBARE_STATUS)
    .gte('created_at', seit);
  if (userId) query = query.eq('created_by', userId);
  const { count, error } = await query;
  if (error) throw new Error(`ki_requests-Zaehlung fehlgeschlagen: ${error.message}`);
  return count || 0;
}

/**
 * Prueft die Frequenz-Limits und legt die Protokoll-Zeile an.
 *
 * @param {object} supabase Service-Role-Client
 * @param {object} opts { userId, feature, pruefeLimit = true }
 * @returns {{ abschliessen: Function, fehlgeschlagen: Function }}
 * @throws {KiLimitError} wenn ein Limit ueberschritten ist
 */
async function starteKiRequest(supabase, { userId, feature, pruefeLimit = true }) {
  const startZeit = Date.now();

  if (pruefeLimit) {
    let grund = null;
    try {
      for (const fenster of FENSTER) {
        const limit = limitFuer(feature, fenster);
        const anzahl = await zaehleRequests(supabase, { userId, seitMs: fenster.ms });
        if (anzahl >= limit) {
          grund = `KI-Limit erreicht: maximal ${limit} Anfragen ${fenster.label}. Bitte kurz warten und erneut versuchen.`;
          break;
        }
      }
      if (!grund) {
        const globalLimit = envZahl('KI_LIMIT_GLOBAL_TAG', GLOBAL_TAG_DEFAULT);
        const globalAnzahl = await zaehleRequests(supabase, { userId: null, seitMs: 24 * 60 * 60 * 1000 });
        if (globalAnzahl >= globalLimit) {
          grund = 'KI-Limit erreicht: das globale Tageskontingent ist ausgeschoepft. Bitte einen Admin informieren.';
        }
      }
    } catch (err) {
      // Zaehlung kaputt (z.B. Tabelle fehlt): Anfrage NICHT blockieren,
      // aber laut im Function-Log meckern
      console.error(`[ki-log] Limit-Pruefung fehlgeschlagen (${feature}): ${err.message}`);
    }

    if (grund) {
      try {
        await supabase.from('ki_requests').insert({
          created_by: userId || null,
          feature,
          status: 'blocked',
          error_message: grund
        });
      } catch (_) { /* Protokoll ist best effort */ }
      throw new KiLimitError(grund);
    }
  }

  // Zeile VOR dem API-Call anlegen (zaehlt ab jetzt in die Fenster)
  let zeileId = null;
  try {
    const { data, error } = await supabase.from('ki_requests')
      .insert({ created_by: userId || null, feature, status: 'running' })
      .select('id').single();
    if (error) throw new Error(error.message);
    zeileId = data.id;
  } catch (err) {
    console.error(`[ki-log] Protokoll-Insert fehlgeschlagen (${feature}): ${err.message}`);
  }

  const update = async (felder) => {
    if (!zeileId) return;
    try {
      const { error } = await supabase.from('ki_requests')
        .update({ ...felder, dauer_ms: Date.now() - startZeit })
        .eq('id', zeileId);
      if (error) throw new Error(error.message);
    } catch (err) {
      console.error(`[ki-log] Protokoll-Update fehlgeschlagen (${feature}): ${err.message}`);
    }
  };

  return {
    /**
     * Nach erfolgreichem Call: Tokens + Kosten festschreiben.
     * Nimmt entweder ein callClaude-Ergebnis ({ model, usage }) oder ein
     * vorab berechnetes cost-Objekt aus calculateCost ({ usd, eur, tokens, model }).
     */
    abschliessen: async ({ model, usage, cost } = {}) => {
      const kosten = cost || calculateCost(model, usage);
      await update({
        status: 'ok',
        model: kosten?.model || model || null,
        input_tokens: kosten?.tokens?.input ?? usage?.input_tokens ?? null,
        output_tokens: kosten?.tokens?.output ?? usage?.output_tokens ?? null,
        cache_read_tokens: kosten?.tokens?.cacheRead ?? usage?.cache_read_input_tokens ?? null,
        cache_write_tokens: kosten?.tokens?.cacheWrite ?? usage?.cache_creation_input_tokens ?? null,
        cost_usd: kosten?.usd ?? null,
        cost_eur: kosten?.eur ?? null
      });
    },
    fehlgeschlagen: async (error) => {
      await update({
        status: 'error',
        error_message: String(error?.message || error || 'Unbekannter Fehler').slice(0, 1000)
      });
    }
  };
}

module.exports = { starteKiRequest, KiLimitError };
