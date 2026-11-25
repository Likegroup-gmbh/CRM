// reportPdfQuelle.js
// Daten für PDF-Vorlagen: Beispieldaten oder eine echte Produktion. Die Produktion läuft durch
// dieselbe Strecke wie der Auswertungs-Tab (ladeAuswertung, baueModell). Poster kommen als
// signierte https-Links von poster-urls (RLS des Aufrufers, wenige Minuten gültig), weil die
// Function sie selbst lädt; das Kundenlogo geht als data-URL mit.

import { authorizedFetch } from '../../core/auth/getAccessToken.js';
import { loadCustomerLogoPng, toPdfImageDataUrl } from '../../core/pdf/pdfImage.js';
import { ladeAuswertung } from '../auswertung/auswertungDaten.js';
import { baueModell } from '../auswertung/auswertungModell.js';
import { listProduktionen } from '../produktion/ProduktionService.js';
import { beispielDaten } from './reportPdfBeispiel.js';
import { posterRefs, reportPdfVm } from './reportPdfModell.js';

const POSTER_ENDPOINT = '/.netlify/functions/poster-urls';
// Obergrenze von poster-urls je Call
const POSTER_MAX = 200;
const LOGO_MAX_ZEICHEN = 400 * 1024;
const KAMPAGNEN_LIMIT = 20;

// Inner-Join auf bestätigte Posts: nur Kampagnen mit Auswertungsdaten, und die Posts nennen
// gleich die Produktionen, in denen es welche gibt
const KAMPAGNE_SELECT = 'id, kampagnenname, unternehmen:unternehmen_id(firmenname, logo_url), '
  + 'marke:marke_id(markenname, logo_url), posts:kooperation_post!inner(produktion_id)';

/** Kampagnen mit bestätigten Posts nach Name, ohne Suchtext die neuesten. */
export async function sucheKampagnen(text = '') {
  let query = window.supabase.from('kampagne').select(KAMPAGNE_SELECT)
    .eq('posts.status', 'confirmed')
    .order('created_at', { ascending: false }).limit(KAMPAGNEN_LIMIT);
  const such = String(text).trim();
  if (such) query = query.ilike('kampagnenname', `%${such}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(({ posts, ...kampagne }) => ({
    ...kampagne,
    produktionIds: [...new Set((posts || []).map(p => p.produktion_id).filter(Boolean))]
  }));
}

/** Produktionen der Kampagne, die bestätigte Posts haben. */
export async function ladeProduktionen(kampagne) {
  const mitPosts = new Set(kampagne?.produktionIds || []);
  const produktionen = await listProduktionen(kampagne.id);
  return (produktionen || []).filter(p => mitPosts.has(p.id));
}

/**
 * Signierte Poster-Links je Datei. Fehlt ein Poster (noch in Arbeit, kein Zugriff), fehlt es
 * in der Map und die Kachel zeigt den Platzhalter.
 * @param {Map<string, { typ: string, id: string }>} refs - posterRefs
 * @returns {Promise<Map<string, string>>} dateiId → URL
 */
export async function posterLinks(refs) {
  const eintraege = [...(refs || new Map()).entries()];
  const urls = new Map();
  for (let i = 0; i < eintraege.length; i += POSTER_MAX) {
    const teil = eintraege.slice(i, i + POSTER_MAX);
    const resp = await authorizedFetch(POSTER_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({ items: teil.map(([, ref]) => ref) })
    });
    if (!resp.ok) {
      console.warn(`Report-PDF: poster-urls ${resp.status}`);
      continue;
    }
    const { posters = {} } = await resp.json().catch(() => ({}));
    teil.forEach(([dateiId, ref]) => { if (posters[ref.id]) urls.set(dateiId, posters[ref.id]); });
  }
  return urls;
}

/** Logo der Marke, sonst des Unternehmens, als data-URL; große Dateien als JPEG verkleinert. */
async function logoDataUrl(url) {
  const roh = await loadCustomerLogoPng(url);
  if (!roh || roh.length <= LOGO_MAX_ZEICHEN) return roh;
  return (await toPdfImageDataUrl(roh, { maxEdge: 400 }))?.dataUrl || null;
}

export function kundeVon(kampagne) {
  return {
    name: kampagne?.marke?.markenname || kampagne?.unternehmen?.firmenname || '',
    logoQuelle: kampagne?.marke?.logo_url || kampagne?.unternehmen?.logo_url || ''
  };
}

/** View-Model der Beispieldaten. */
export function beispielVm(anzahl) {
  const { basis, produktionId, kontext } = beispielDaten(anzahl);
  return reportPdfVm(baueModell(basis, { ebene: 'produktion', produktionId }), kontext);
}

/**
 * View-Model einer echten Produktion mit frischen Poster-Links.
 * @param {{ kampagne: object, produktion: object }} auswahl - Kampagne aus sucheKampagnen,
 *   Produktion aus ladeProduktionen
 */
export async function produktionVm({ kampagne, produktion }) {
  const basis = await ladeAuswertung({ kampagneId: kampagne.id, produktion, ebene: 'produktion' });
  const modell = baueModell(basis, { ebene: 'produktion', produktionId: produktion.id });
  const kunde = kundeVon(kampagne);
  const [posterUrls, logoUrl] = await Promise.all([posterLinks(posterRefs(modell)), logoDataUrl(kunde.logoQuelle)]);
  return reportPdfVm(modell, {
    titel: produktion.name,
    untertitel: kampagne.kampagnenname || '',
    kunde: { name: kunde.name, logoUrl },
    posterUrls
  });
}
