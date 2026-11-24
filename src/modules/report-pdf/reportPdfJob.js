// reportPdfJob.js
// Probe-PDF aus PDF-Vorlagen: Job in report_pdf_jobs anlegen (View-Model als `eingabe`),
// report-pdf-background anstoßen, auf done/error warten und die Datei über einen Signed URL
// herunterladen. Gewartet wird per Polling; Realtime weckt die Schleife früher.

import { authorizedFetch } from '../../core/auth/getAccessToken.js';

const ENDPOINT = '/.netlify/functions/report-pdf-background';
const TABELLE = 'report_pdf_jobs';
const BUCKET = 'report-pdfs';
const POLL_MS = 2000;
// Chromium-Kaltstart samt Pack-Download plus Poster-Downloads
const FRIST_MS = 3 * 60 * 1000;
const LINK_SEKUNDEN = 300;

export const SCHRITTE = {
  chromium: 'Chromium startet …',
  render: 'Seiten werden gesetzt …',
  upload: 'PDF wird abgelegt …'
};

/** „Report-PDF Herbst-Kampagne – Produktion 1.pdf“, ohne Zeichen, die Dateisysteme stören. */
export function dateinameFuer(titel) {
  const sauber = String(titel || 'Report').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return `Report-PDF ${sauber || 'Report'}.pdf`;
}

function schlafen(ms, wecker) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    wecker.jetzt = () => { clearTimeout(timer); resolve(); };
  });
}

async function warteAufJob(jobId, onSchritt) {
  const sb = window.supabase;
  const wecker = { jetzt: () => {} };
  const kanal = sb.channel?.(`report-pdf-${jobId}`)
    ?.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: TABELLE, filter: `id=eq.${jobId}` }, () => wecker.jetzt())
    ?.subscribe();
  const frist = Date.now() + FRIST_MS;
  try {
    while (Date.now() < frist) {
      await schlafen(POLL_MS, wecker);
      const { data: row, error } = await sb.from(TABELLE)
        .select('status, progress_step, result, error_message').eq('id', jobId).maybeSingle();
      if (error || !row) continue;
      if (row.status === 'done') return row;
      if (row.status === 'error') throw new Error(row.error_message || 'Das PDF konnte nicht erzeugt werden.');
      if (row.progress_step) onSchritt?.(row.progress_step);
    }
  } finally {
    if (kanal) sb.removeChannel?.(kanal);
  }
  throw new Error('Zeitlimit erreicht – bitte erneut versuchen.');
}

function herunterladen(url, dateiname) {
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * @param {{ vm: object, maxJeSeite: number, onSchritt?: (schritt: string) => void }} auftrag
 * @returns {Promise<{ pfad: string, url: string }>}
 */
export async function erzeugeReportPdf({ vm, maxJeSeite, onSchritt }) {
  const sb = window.supabase;
  const { data: sitzung } = await sb.auth.getSession();
  const userId = sitzung?.session?.user?.id;
  if (!userId) throw new Error('Keine aktive Sitzung');

  const { data: job, error } = await sb.from(TABELLE)
    .insert({ eingabe: { vm, maxJeSeite }, created_by: userId })
    .select('id').single();
  if (error) {
    const grund = error.message || error.code || (error.status ? `HTTP ${error.status}` : 'unbekannt');
    throw new Error(`Job konnte nicht angelegt werden: ${grund}`);
  }

  const resp = await authorizedFetch(ENDPOINT, { method: 'POST', body: JSON.stringify({ jobId: job.id }) });
  if (resp.status !== 202 && !resp.ok) throw new Error(`PDF konnte nicht gestartet werden (HTTP ${resp.status})`);

  const row = await warteAufJob(job.id, onSchritt);
  const pfad = row.result?.pfad;
  if (!pfad) throw new Error('Die Function hat keine Datei gemeldet.');

  const dateiname = dateinameFuer(vm?.titel);
  const { data: link, error: linkError } = await sb.storage.from(BUCKET)
    .createSignedUrl(pfad, LINK_SEKUNDEN, { download: dateiname });
  if (linkError || !link?.signedUrl) throw new Error(`Download-Link fehlt: ${linkError?.message || 'unbekannt'}`);
  herunterladen(link.signedUrl, dateiname);
  return { pfad, url: link.signedUrl };
}
