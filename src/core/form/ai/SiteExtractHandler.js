// SiteExtractHandler.js
// Verbindet den "Auslesen"-Button am URL-Feld mit der Netlify Background
// Function site-extract-background. Voellig generisch: welche Felder
// zurueckkommen, bestimmt ausschliesslich netlify/functions/_shared/extract-specs.js.
//
// Ablauf: Job-Zeile in extract_jobs anlegen, Function mit der jobId anstossen
// (antwortet sofort 202), danach die Job-Zeile pollen. Der Fortschritt aus
// progress_step steht waehrenddessen am Button. Noetig, weil synchrone
// Netlify Functions hart nach 30s gekillt werden - eine Extraktion mit
// Browser-Fallback und Claude-Call braucht real oft laenger.
//
// Freischalten eines weiteren Formulars: `aiExtract: true` am URL-Feld im
// FormConfig plus ein Spec-Eintrag im Backend. Ohne URL-Feld (Persona)
// ruft das Panel requestExtractJob direkt.

import { ExtractReviewLayer } from './ExtractReviewLayer.js';
import { applyExtractedLogo, clearExtractedLogo } from './ExtractLogoApplier.js';
import { ExtractCostBadge } from './ExtractCostBadge.js';
import { logExtractDiagnostics, nullergebnisHinweis } from './ExtractDiagnostics.js';
import { likyCanExtractPdf } from '../../chat/likyCapabilities.js';
import { likyPdfTagHtml } from '../../chat/likyComposer.js';

const ENDPOINT = '/.netlify/functions/site-extract-background';
const PDF_ENDPOINT = '/.netlify/functions/produkt-pdf-background';
const PDF_MAX_BYTES = 20 * 1024 * 1024;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

// progress_step aus der Job-Zeile -> Kurztext am Button
const STEP_LABELS = {
  start: 'Startet…',
  cache: 'Liest…',
  laden: 'Seite laden…',
  unterseite: 'Unterseiten…',
  auswerten: 'KI wertet aus…',
  bilder: 'Bilder…'
};

// Chat-Labels fuer den Thinking-Slot (nicht der Button). Fallback, falls
// die Job-Zeile noch keine progress_steps hat.
const STEP_CHAT_LABELS = {
  start: 'Ich schaue mir die Seite an',
  cache: 'Die Seite kenne ich schon',
  laden: 'Seite wird geladen',
  unterseite: 'Ich gehe die Unterseiten durch',
  auswerten: 'USPs und Pain Points werden durchsucht',
  bilder: 'Produktbilder zusammengesucht'
};

/**
 * Fortschritt nach draussen geben, damit ein Modul ihn anders darstellen kann
 * als am Button (siehe ProduktExtractPanel). Rein additiv - wer nicht
 * zuhoert, merkt nichts davon.
 */
function emit(name, detail) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

function notifyError(message) {
  console.error(`❌ SITE-EXTRACT: ${message}`);
  window.toastSystem?.error?.(message);
}

function notifyWarning(message) {
  console.warn(`⚠️ SITE-EXTRACT: ${message}`);
  window.toastSystem?.warning?.(message);
}

/** Eingabe des Nutzers zu einer vollstaendigen URL machen. */
export function toAbsoluteUrl(rawValue) {
  const value = (rawValue || '').trim();
  if (!value) return null;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    return url.hostname.includes('.') ? url.href : null;
  } catch {
    return null;
  }
}

async function getSession() {
  const session = await window.supabase?.auth?.getSession();
  return session?.data?.session || null;
}

function warte(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Job anlegen, Background Function anstossen, Ergebnis aus extract_jobs pollen.
 * Ohne Formularfeld - PersonaLikyPanel ruft das direkt, der Handler am
 * URL-Button ebenfalls.
 * @param {Object} opts
 * @param {string} opts.entity
 * @param {string} opts.url
 * @param {string} [opts.endpoint] - Default Shop-URL. Produkt-PDF geht an produkt-pdf-background.
 * @param {Function} [opts.onStep] - ({ step, label, steps }) => void
 */
export async function requestExtractJob({ entity, url, endpoint = ENDPOINT, onStep = () => {} } = {}) {
  const db = window.supabase;
  const session = await getSession();
  if (!db || !session) throw new Error('Keine aktive Sitzung');
  if (!entity || !url) throw new Error('Entity oder URL fehlt');

  const { data: job, error: insertError } = await db.from('extract_jobs')
    .insert({ url, entity_type: entity, created_by: session.user.id })
    .select('id').single();
  if (insertError) throw new Error(`Job konnte nicht angelegt werden: ${insertError.message}`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ jobId: job.id })
  });
  if (response.status !== 202 && !response.ok) {
    throw new Error(`Extraktion konnte nicht gestartet werden (HTTP ${response.status})`);
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let letzterStep = null;

  while (Date.now() < deadline) {
    await warte(POLL_INTERVAL_MS);

    const { data: row, error: pollError } = await db.from('extract_jobs')
      .select('status, progress_step, progress_steps, result, error_message')
      .eq('id', job.id).maybeSingle();
    if (pollError || !row) continue;

    if (row.status === 'done') {
      const payload = row.result || {};
      logExtractDiagnostics({ url, entity, payload });
      if (!payload.success) throw new Error(payload.error || 'Extraktion ohne Ergebnis beendet');
      return payload;
    }

    if (row.status === 'error') {
      logExtractDiagnostics({ url, entity, payload: row.result || null });
      throw new Error(row.error_message || 'Extraktion fehlgeschlagen');
    }

    if (row.progress_step && row.progress_step !== letzterStep) {
      letzterStep = row.progress_step;
      const steps = Array.isArray(row.progress_steps) ? row.progress_steps : [];
      const last = steps[steps.length - 1];
      onStep({
        step: last?.step || row.progress_step,
        label: last?.label || STEP_CHAT_LABELS[row.progress_step] || 'Ich arbeite',
        steps
      });
    }
  }

  throw new Error('Zeitlimit erreicht - die Extraktion läuft ungewöhnlich lange. Bitte später erneut versuchen.');
}

class ButtonState {
  constructor(button) {
    this.button = button;
    this.label = button.querySelector('.url-extract-btn__label');
    this.originalLabel = this.label?.textContent || '';
  }

  busy() {
    this.button.disabled = true;
    this.button.classList.add('is-loading');
    if (this.label) this.label.textContent = 'Liest…';
  }

  step(text) {
    if (this.label && text) this.label.textContent = text;
  }

  idle() {
    this.button.disabled = false;
    this.button.classList.remove('is-loading');
    if (this.label) this.label.textContent = this.originalLabel;
  }
}

export class SiteExtractHandler {
  /**
   * @param {HTMLFormElement} form
   * @param {string} entity - Entitaetsname, bestimmt die Spec im Backend
   */
  constructor(form, entity) {
    this.form = form;
    this.entity = entity;
    this.review = new ExtractReviewLayer(form);
    this.running = false;
    this.pendingPdf = null;
  }

  bind() {
    const buttons = this.form.querySelectorAll('[data-ai-extract]');
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        if (this.pendingPdf) {
          const file = this.pendingPdf;
          this.clearPendingPdf();
          this.runPdf(button, file);
          return;
        }
        this.run(button);
      });
    });
    if (likyCanExtractPdf(this.entity)) this.bindPdfDrop();
    return buttons.length;
  }

  bindPdfDrop() {
    const side = this.form.querySelector('.doc__side');
    const composer = this.form.querySelector('#produkt-liky-composer');
    if (!side || !composer) return;

    side.addEventListener('dragover', (e) => {
      if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
      e.preventDefault();
      composer.classList.add('is-dragover');
    });
    side.addEventListener('dragleave', (e) => {
      if (!side.contains(e.relatedTarget)) composer.classList.remove('is-dragover');
    });
    side.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      e.preventDefault();
      composer.classList.remove('is-dragover');
      this.attachPdf(file);
    });

    this.form.querySelector('[data-url-field="true"]')?.addEventListener('paste', (e) => {
      const file = [...(e.clipboardData?.files || [])][0];
      if (!file) return;
      e.preventDefault();
      this.attachPdf(file);
    });
  }

  attachPdf(file) {
    const istPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    if (!istPdf) {
      notifyError('Nur PDF.');
      return;
    }
    if (file.size > PDF_MAX_BYTES) {
      notifyError('PDF zu groß. Maximal 20 MB.');
      return;
    }
    this.pendingPdf = file;
    this.renderPdfChip();
  }

  clearPendingPdf() {
    this.pendingPdf = null;
    this.renderPdfChip();
  }

  renderPdfChip() {
    const chips = this.form.querySelector('#produkt-liky-chips');
    if (!chips) return;
    if (!this.pendingPdf) {
      chips.innerHTML = '';
      return;
    }
    chips.innerHTML = likyPdfTagHtml(this.pendingPdf.name, { remove: true });
    chips.querySelector('button')?.addEventListener('click', () => this.clearPendingPdf());
  }

  async runPdf(button, file) {
    if (this.running) return;
    const state = new ButtonState(button);
    const session = await getSession();
    if (!window.supabase || !session) {
      notifyError('Keine aktive Sitzung');
      return;
    }

    this.running = true;
    state.busy();
    emit('siteExtractStarted', { entity: this.entity, form: this.form, url: file.name });
    emit('siteExtractProgress', { entity: this.entity, step: 'start', label: 'Ich lese das PDF' });

    try {
      this.review.revertAll();
      const path = await this.uploadPdf(file, session.user.id);
      const result = await this.request(`pdf:${path}`, state, PDF_ENDPOINT);
      this.applyFields(result.fields || {}, null);
      new ExtractCostBadge(this.form, button).show(result);
      this.announce(result);
      const felder = Object.keys(result.fields || {}).length;
      if (!felder) notifyWarning(nullergebnisHinweis(result));
      emit('siteExtractFinished', {
        entity: this.entity,
        form: this.form,
        ok: true,
        felder,
        fields: result.fields || {}
      });
    } catch (error) {
      notifyError(`PDF konnte nicht ausgelesen werden: ${error.message}`);
      emit('siteExtractFinished', {
        entity: this.entity,
        form: this.form,
        ok: false,
        error: error.message
      });
    } finally {
      state.idle();
      this.running = false;
    }
  }

  async uploadPdf(file, userId) {
    const safeName = String(file.name || 'produkt.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const dateiname = /\.pdf$/i.test(safeName) ? safeName : `${safeName}.pdf`;
    const path = `produkt-pdfs/${userId}/${Date.now()}_${dateiname}`;
    const { error } = await window.supabase.storage
      .from('documents')
      .upload(path, file, { upsert: false, contentType: 'application/pdf' });
    if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`);
    return path;
  }

  async run(button) {
    if (this.running) return;

    const triggerField = button.dataset.aiExtract;
    const input = this.form.querySelector(`[name="${triggerField}"]`);
    const url = toAbsoluteUrl(input?.value);

    if (!url) {
      notifyError('Bitte zuerst eine gültige Webseiten-Adresse eingeben.');
      input?.focus();
      return;
    }

    const state = new ButtonState(button);
    const costBadge = new ExtractCostBadge(this.form, button);
    this.running = true;
    state.busy();
    emit('siteExtractStarted', { entity: this.entity, form: this.form, url });
    emit('siteExtractProgress', {
      entity: this.entity,
      step: 'start',
      label: STEP_CHAT_LABELS.start
    });

    try {
      // Ergebnis eines vorherigen Laufs zurueckziehen, damit neue Werte
      // nicht an den alten haengen bleiben
      this.review.revertAll();
      clearExtractedLogo(this.form);
      costBadge.clear();

      const result = await this.request(url, state);
      this.applyFields(result.fields || {}, triggerField);
      costBadge.show(result);

      if (result.logo) applyExtractedLogo(this.form, result.logo);
      this.announce(result);

      const felder = Object.keys(result.fields || {}).length;
      if (!felder && !result.logo) notifyWarning(nullergebnisHinweis(result));

      emit('siteExtractFinished', {
        entity: this.entity,
        form: this.form,
        ok: true,
        felder,
        cached: !!result.cached,
        source: result.source || null,
        // Rohfelder inkl. fact/guess-Markierung - z.B. der Persona-Job am
        // Produkt braucht die Arten und Werte, die kein Formularfeld haben
        fields: result.fields || {}
      });
    } catch (error) {
      notifyError(`Webseite konnte nicht ausgelesen werden: ${error.message}`);
      emit('siteExtractFinished', {
        entity: this.entity,
        form: this.form,
        ok: false,
        error: error.message
      });
    } finally {
      state.idle();
      this.running = false;
    }
  }

  /**
   * Job anlegen, Background Function anstossen, Ergebnis aus extract_jobs
   * pollen. Liefert dasselbe Antwortobjekt wie frueher die synchrone Function.
   */
  async request(url, state, endpoint = ENDPOINT) {
    return requestExtractJob({
      entity: this.entity,
      url,
      endpoint,
      onStep: ({ step, label, steps }) => {
        state?.step(STEP_LABELS[step] || 'Liest…');
        emit('siteExtractProgress', {
          entity: this.entity,
          step,
          label,
          steps
        });
      }
    });
  }

  /**
   * Ergebnisse, die kein Formularfeld sind (Produktbilder, Varianten), gehen
   * per Event an das aufrufende Modul. So bleibt der Handler generisch und
   * muss keine entitaetsspezifische Logik kennen.
   */
  announce(result) {
    const images = Array.isArray(result.images) ? result.images : [];
    const varianten = Array.isArray(result.varianten) ? result.varianten : [];
    if (!images.length && !varianten.length) return;

    document.dispatchEvent(new CustomEvent('siteExtractApplied', {
      detail: { entity: this.entity, form: this.form, images, varianten }
    }));
  }

  /**
   * Uebernimmt die Werte. Bereits gefuellte Felder bleiben unangetastet - die
   * Eingabe des Nutzers hat immer Vorrang. Einzige Ausnahme ist das URL-Feld
   * selbst: dort ersetzen wir die Eingabe durch die normalisierte Hauptdomain.
   */
  applyFields(fields, triggerField) {
    for (const [name, entry] of Object.entries(fields)) {
      if (!entry?.value) continue;

      const input = this.review.findInput(name);
      if (!input) continue;

      if (name === triggerField) {
        const normalized = this.review.formatForInput(entry.value);
        if (normalized !== input.value) this.review.mark(name, entry);
        continue;
      }

      if (input.value.trim()) continue;
      this.review.mark(name, entry);
    }
  }
}

/**
 * Haengt das Feature an ein Formular, falls es dort ein Feld mit aiExtract hat.
 * Wird zentral aus FormEvents.bindFormEvents aufgerufen.
 */
export function setupSiteExtract(form, entity) {
  if (!form || !entity) return null;
  if (!form.querySelector('[data-ai-extract]')) return null;
  if (form.dataset.siteExtractBound === 'true') return null;

  const handler = new SiteExtractHandler(form, entity);
  const count = handler.bind();
  if (!count) return null;

  form.dataset.siteExtractBound = 'true';
  form.__siteExtractHandler = handler;
  return handler;
}
