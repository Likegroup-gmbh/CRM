// Laedt ein bestehendes PDF (URL / Dropbox-Shared-Link) als Blob fuer den Anhang.
// Kernel-Hilfe: Adapter rufen das auf, Seiten nicht.

import { resolveDocumentUrl } from '../DocumentUrlHelper.js';

function asDownloadUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  return raw.replace(/[?&]dl=0/, (m) => (m[0] === '?' ? '?raw=1' : '&raw=1'));
}

export async function fetchDokumentPdf({ url, dateiname }) {
  const resolved = asDownloadUrl(await resolveDocumentUrl(url));
  if (!resolved) throw new Error('PDF-URL fehlt');
  const resp = await fetch(resolved);
  if (!resp.ok) throw new Error(`PDF konnte nicht geladen werden (${resp.status})`);
  const blob = await resp.blob();
  const name = dateiname || 'dokument.pdf';
  return { blob, dateiname: name.endsWith('.pdf') ? name : `${name}.pdf` };
}
