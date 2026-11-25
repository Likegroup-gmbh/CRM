// _shared/teams/webhook.js
// POST an den Workflow-Link eines Teams-Kanals. Workflows antworten mit 202 (angenommen,
// nicht zwingend schon gepostet). Nur Microsoft-Hosts: die URL kommt aus der Datenbank,
// der Server soll damit nicht beliebige Ziele anfragen.

const ERLAUBTE_HOSTS = [/\.powerplatform\.com$/i, /\.logic\.azure\.com$/i];
const TIMEOUT_MS = 8000;

/** @returns {string|null} Fehlertext oder null, wenn die URL passt */
function pruefeUrl(url) {
  let u;
  try {
    u = new URL(String(url || ''));
  } catch {
    return 'Webhook-URL ist ungültig';
  }
  if (u.protocol !== 'https:') return 'Webhook-URL muss mit https:// beginnen';
  if (!ERLAUBTE_HOSTS.some((re) => re.test(u.hostname))) {
    return 'Webhook-URL gehört nicht zu Microsoft Workflows (powerplatform.com oder logic.azure.com)';
  }
  return null;
}

async function fehlerText(resp) {
  const roh = await resp.text().catch(() => '');
  let detail = roh;
  try {
    const j = JSON.parse(roh);
    detail = j?.error?.message || j?.message || roh;
  } catch {
    // Klartext
  }
  detail = String(detail || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  return detail ? `HTTP ${resp.status}: ${detail}` : `HTTP ${resp.status}`;
}

/**
 * @returns {Promise<{ ok: true, status: number } | { ok: false, permanent: boolean, status?: number, fehler: string }>}
 *   permanent: Wiederholen bringt nichts (URL falsch, Workflow geloescht oder ohne Recht)
 */
async function senden(url, nachricht, { fetchImpl = (...a) => fetch(...a), timeoutMs = TIMEOUT_MS } = {}) {
  const ungueltig = pruefeUrl(url);
  if (ungueltig) return { ok: false, permanent: true, fehler: ungueltig };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nachricht),
      signal: ctrl.signal,
    });
    if (resp.status >= 200 && resp.status < 300) return { ok: true, status: resp.status };
    const permanent = resp.status >= 400 && resp.status < 500 && resp.status !== 408 && resp.status !== 429;
    return { ok: false, permanent, status: resp.status, fehler: await fehlerText(resp) };
  } catch (err) {
    const fehler = err?.name === 'AbortError' ? 'Zeitüberschreitung beim Workflow' : (err?.message || 'Netzwerkfehler');
    return { ok: false, permanent: false, fehler };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { pruefeUrl, senden };
