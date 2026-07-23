// InstagramDiscoveryService.js
// Duenner Client fuer die Netlify Function instagram-graph.
// Auth: Supabase Session-Token als Bearer (wie CreatorAuswahlService.scrapeCreator).

const FUNCTION_URL = '/.netlify/functions/instagram-graph';

export class InstagramDiscoveryService {
  async _call(payload) {
    const session = await window.supabase.auth.getSession();
    const token = session?.data?.session?.access_token || '';

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data.hint ? `${data.error} (${data.hint})` : (data.error || `HTTP ${response.status}`);
      throw new Error(msg);
    }
    return data;
  }

  /** Verbindung pruefen: eigener IG-Business-Account */
  async status() {
    return this._call({ action: 'status' });
  }

  /**
   * Business Discovery fuer eine Liste von Usernames (max 20).
   * @param {string[]} usernames
   * @returns {Promise<{ok: boolean, requested: number, results: Array}>}
   */
  async lookup(usernames) {
    return this._call({ action: 'lookup', usernames });
  }
}
