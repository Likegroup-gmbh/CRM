// InstagramDiscoveryService.js
// Client fuer die Instagram-Discovery-Functions. Auth: Supabase Session-Token
// als Bearer (wie CreatorAuswahlService.scrapeCreator).

async function authHeaders() {
  const session = await window.supabase.auth.getSession();
  const token = session?.data?.session?.access_token || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

async function postFunction(name, payload) {
  const res = await fetch(`/.netlify/functions/${name}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload || {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.hint ? `${data.error} (${data.hint})` : (data.error || `HTTP ${res.status}`);
    throw new Error(msg);
  }
  return data;
}

export class InstagramDiscoveryService {
  /** Verbindung pruefen: eigener IG-Business-Account (Function instagram-graph) */
  async status() {
    return postFunction('instagram-graph', { action: 'status' });
  }

  /**
   * KI-/Filter-Query gegen den Pool.
   * @param {{message?: string, currentFilters?: object, limit?: number}} opts
   * @returns {Promise<{filters: object, reply: string, results: Array}>}
   */
  async query({ message = '', currentFilters = {}, limit = 25 } = {}) {
    return postFunction('instagram-query', { message, currentFilters, limit });
  }

  /** CRM-Backfill anstossen (Background-Function, antwortet 202) */
  async startBackfill() {
    return postFunction('instagram-backfill-background', {});
  }

  /** Pool-Refresh: alle vorhandenen Pool-Creator neu anreichern (Posts, ER, Kooperationen) */
  async startRefresh() {
    return postFunction('instagram-backfill-background', { mode: 'refresh' });
  }

  /** Harvest manuell anstossen (Background-Function, antwortet 202) */
  async startHarvest() {
    return postFunction('instagram-harvest-background', {});
  }
}
