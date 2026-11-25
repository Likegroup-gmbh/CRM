// Netlify Background Function: Report-PDF (ADR 0080)
// Druckt die Vorlage aus src/modules/report-pdf mit Chromium zu PDF. Der Client legt den Job
// in report_pdf_jobs mit dem fertigen View-Model an (eingabe.vm) und stoesst diese Function
// mit { jobId } an; Fortschritt und Ergebnis laufen ueber die Job-Zeile (Realtime).
// Das PDF landet privat unter report-pdfs/vorlagen/<uid>/<jobId>.pdf.

const fs = require('fs/promises');
const path = require('path');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { chromiumExecutablePath, lokalesChrome } = require('./screenshot-utils/chromium-path');
const { createJobUpdater } = require('./_shared/job-updater');
const { aufrufer, istAdmin } = require('./_shared/ablage/zugriff');
const { serviceClient, supabaseEnv, parseBody, json, istUuid } = require('./_shared/ablage/konfig');

const TABELLE = 'report_pdf_jobs';
const BUCKET = 'report-pdfs';
const SCHRIFTEN = {
  latin: 'geist-latin-wght-normal.woff2',
  latinExt: 'geist-latin-ext-wght-normal.woff2',
};
// A4 quer bei 96 dpi; die Seitengroesse selbst setzt @page in der Vorlage
const VIEWPORT = { width: 1123, height: 794 };
const LADE_TIMEOUT_MS = 60000;

// Erst beim Aufruf laden: esbuild zieht die ESM-Module aus src/ ins Bundle
async function ladeVorlage() {
  const [{ renderReportPdf }, { schriftCss }] = await Promise.all([
    import('../../src/modules/report-pdf/reportPdfVorlage.js'),
    import('../../src/modules/report-pdf/reportPdfStil.js'),
  ]);
  return { renderReportPdf, schriftCss };
}

async function schriftDataUrl(name) {
  const kandidaten = [
    path.resolve(__dirname, '../../assets/fonts', name),
    path.resolve(process.cwd(), 'assets/fonts', name),
  ];
  for (const datei of kandidaten) {
    try {
      const buf = await fs.readFile(datei);
      return `data:font/woff2;base64,${buf.toString('base64')}`;
    } catch (_) { /* naechster Kandidat */ }
  }
  console.warn(`[report-pdf] Schrift ${name} nicht gefunden, Chromium nimmt die Ersatzschrift`);
  return null;
}

/** Lambda-Chromium hat keine Schriften: Geist geht als data:-URL mit. */
async function eingebetteteSchrift(schriftCss) {
  const [latin, latinExt] = await Promise.all([schriftDataUrl(SCHRIFTEN.latin), schriftDataUrl(SCHRIFTEN.latinExt)]);
  return latin ? schriftCss({ latin, latinExt: latinExt || latin }) : '';
}

/** Chromium laedt nur eingebettete Daten und Signed URLs aus dem eigenen Supabase-Storage. */
function erlaubteAnfrage(storagePrefix) {
  return (url) => url.startsWith('data:') || (!!storagePrefix && url.startsWith(storagePrefix));
}

async function druckePdf(html, erlaubt) {
  const lokal = lokalesChrome();
  const browser = await puppeteer.launch({
    args: lokal ? [] : chromium.args,
    executablePath: lokal || await chromiumExecutablePath(),
    headless: lokal ? true : chromium.headless,
    defaultViewport: VIEWPORT,
  });
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (erlaubt(req.url())) req.continue();
      else req.abort('blockedbyclient');
    });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: LADE_TIMEOUT_MS });
    await page.evaluate(() => document.fonts.ready);
    return Buffer.from(await page.pdf({ printBackground: true, preferCSSPageSize: true }));
  } finally {
    await browser.close().catch(() => {});
  }
}

async function raeumeAlteProben(supabase, ordner) {
  const { data, error } = await supabase.storage.from(BUCKET).list(ordner, { limit: 100 });
  if (error || !data?.length) return;
  await supabase.storage.from(BUCKET).remove(data.map((f) => `${ordner}/${f.name}`));
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Nur POST' });
  const supabase = serviceClient();
  if (!supabase) return json(500, { error: 'Supabase nicht konfiguriert' });

  const wer = await aufrufer(event, supabase);
  if (!wer.ok) return wer.antwort;
  if (!istAdmin(wer.benutzer)) return json(403, { error: 'Nur Admins' });

  const { jobId } = parseBody(event) || {};
  if (!istUuid(jobId)) return json(400, { error: 'jobId fehlt' });

  // Atomar claimen (pending -> running), nur der eigene Job: Retry und Doppelaufruf laufen leer
  const { data: claimed, error: claimError } = await supabase
    .from(TABELLE)
    .update({ status: 'running' })
    .eq('id', jobId)
    .eq('created_by', wer.user.id)
    .eq('status', 'pending')
    .select('id, eingabe')
    .maybeSingle();
  if (claimError) {
    console.error('[report-pdf] Claim fehlgeschlagen', claimError);
    return json(500, { error: 'Job nicht lesbar' });
  }
  if (!claimed) return json(409, { error: 'Job unbekannt, fremd oder schon gelaufen' });

  const job = createJobUpdater(supabase, jobId, { table: TABELLE, withLogs: false });
  try {
    const { vm, maxJeSeite } = claimed.eingabe || {};
    if (!vm || !Array.isArray(vm.kacheln)) throw new Error('Eingabe ohne View-Model');

    job.step('chromium', 'Chromium startet …');
    const { renderReportPdf, schriftCss } = await ladeVorlage();
    const fontCss = await eingebetteteSchrift(schriftCss);
    const html = renderReportPdf(vm, { maxJeSeite: Number(maxJeSeite) || undefined, fontCss });

    job.step('render', 'Seiten werden gesetzt …');
    const { url } = supabaseEnv();
    const storagePrefix = url ? `${url.replace(/\/+$/, '')}/storage/v1/` : null;
    const pdf = await druckePdf(html, erlaubteAnfrage(storagePrefix));

    job.step('upload', 'PDF wird abgelegt …');
    const ordner = `vorlagen/${wer.user.id}`;
    await raeumeAlteProben(supabase, ordner);
    const pfad = `${ordner}/${jobId}.pdf`;
    const { error: upErr } = await supabase.storage.from(BUCKET)
      .upload(pfad, pdf, { contentType: 'application/pdf', upsert: true });
    if (upErr) throw new Error(`Upload fehlgeschlagen: ${upErr.message}`);

    await job.flushAndUpdate({ status: 'done', progress_step: 'fertig', result: { pfad, bytes: pdf.length } });
    return json(200, { ok: true });
  } catch (e) {
    console.error(`[report-pdf] Job ${jobId} fehlgeschlagen`, e);
    await job.flushAndUpdate({ status: 'error', error_message: String(e?.message || e).slice(0, 500) });
    return json(500, { error: 'PDF fehlgeschlagen' });
  }
};
