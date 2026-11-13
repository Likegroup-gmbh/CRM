// DocumentUrlHelper.js (ES6-Modul)
// Die Dokument-Buckets (Verträge/Rechnungen) sind privat. In der DB und im
// bestehenden Render-Code stecken aber noch Public-URLs bzw. per getPublicUrl()
// gebaute Links (Form: .../storage/v1/object/public/<bucket>/<pfad>). Statt
// jede Render-Stelle umzubauen, werden diese URLs on-demand (beim Klick bzw.
// vor einem fetch-Download) in kurzlebige Signed URLs umgewandelt.
// Dokumente in SharePoint (ADR 0068): die gespeicherte webUrl braucht eine Microsoft-Anmeldung,
// aufgelöst wird über ablage-link (data-ablage-dokument="typ:id" oder die webUrl selbst).
// Dropbox-Links und Public-Bild-Buckets sind nicht betroffen.

import {
  dokumentLink,
  dokumentLinkNachUrl,
  inNeuemTabOeffnen,
  istSharePointDokumentUrl,
} from './ablage/dokumentAblage.js';

const PRIVATE_DOCUMENT_BUCKETS = new Set([
  'vertraege',
  'unterschriebene-vertraege',
  'rechnungen',
  'rechnung-belege'
]);

// Kurzlebig, wird nie gespeichert/gecacht – vermeidet das frühere Problem
// abgelaufener Signed URLs in <img>-Tags.
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Extrahiert { bucket, path } aus einer Supabase-Storage-URL, sofern sie auf
 * einen privaten Dokument-Bucket zeigt. Sonst null.
 */
export function extractPrivateDocumentRef(url) {
  if (typeof url !== 'string' || !url) return null;
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?#]+)/);
  if (!match) return null;
  const bucket = decodeURIComponent(match[1]);
  if (!PRIVATE_DOCUMENT_BUCKETS.has(bucket)) return null;
  return { bucket, path: decodeURIComponent(match[2]) };
}

/**
 * Erzeugt eine kurzlebige Signed URL für einen Pfad in einem privaten Bucket.
 */
export async function getSignedDocumentUrl(bucket, path, ttl = SIGNED_URL_TTL_SECONDS) {
  const { data, error } = await window.supabase.storage
    .from(bucket)
    .createSignedUrl(path, ttl);
  if (error) throw error;
  return data?.signedUrl || '';
}

/**
 * Wandelt eine (ggf. tote Public-)URL bei Bedarf in eine Signed URL um.
 * Nicht-Storage-URLs (z.B. Dropbox) werden unverändert zurückgegeben.
 */
export async function resolveDocumentUrl(url) {
  if (istSharePointDokumentUrl(url)) return (await dokumentLinkNachUrl(url)) || '';
  const ref = extractPrivateDocumentRef(url);
  if (!ref) return url || '';
  return getSignedDocumentUrl(ref.bucket, ref.path);
}

/**
 * Öffnet eine Dokument-URL in neuem Tab. Das leere Fenster wird synchron
 * geöffnet (Popup-Blocker), die Signed URL danach gesetzt.
 */
export async function openDocumentUrl(url) {
  if (istSharePointDokumentUrl(url)) {
    // Kein Treffer (z. B. Datei nur im Finder abgelegt): webUrl mit Microsoft-Anmeldung
    return inNeuemTabOeffnen(() => dokumentLinkNachUrl(url), { fallbackUrl: url });
  }
  const ref = extractPrivateDocumentRef(url);
  if (!ref) {
    if (url) window.open(url, '_blank', 'noopener');
    return;
  }
  const win = window.open('', '_blank');
  try {
    const signedUrl = await getSignedDocumentUrl(ref.bucket, ref.path);
    if (win) win.location = signedUrl;
  } catch (err) {
    if (win) win.close();
    console.error('❌ Dokument konnte nicht geöffnet werden:', err);
    window.toastSystem?.show('Dokument konnte nicht geöffnet werden (fehlende Berechtigung?)', 'error');
  }
}

/**
 * Globaler Klick-Interceptor: fängt Klicks auf <a>-Links ab, deren href auf
 * einen privaten Dokument-Bucket zeigt, und öffnet stattdessen eine Signed
 * URL. Deckt alle bestehenden Render-Stellen (Vertrags-/Rechnungs-Links) ab,
 * ohne dass jede einzelne umgebaut werden muss.
 */
export function installDocumentLinkInterceptor() {
  document.addEventListener('click', (e) => {
    const anchor = e.target?.closest?.('a[href], a[data-ablage-dokument]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    const dok = anchor.getAttribute('data-ablage-dokument');
    if (dok) {
      const i = dok.indexOf(':');
      e.preventDefault();
      e.stopPropagation();
      inNeuemTabOeffnen(() => dokumentLink(dok.slice(0, i), dok.slice(i + 1)), {
        fallbackUrl: href && href !== '#' ? href : null,
      });
      return;
    }
    if (!extractPrivateDocumentRef(href) && !istSharePointDokumentUrl(href)) return;
    e.preventDefault();
    e.stopPropagation();
    openDocumentUrl(href);
  }, true);
}
