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
// FormConfig plus ein Spec-Eintrag im Backend.

import { ExtractReviewLayer } from './ExtractReviewLayer.js';
import { applyExtractedLogo, clearExtractedLogo } from './ExtractLogoApplier.js';
import { ExtractCostBadge } from './ExtractCostBadge.js';
import { logExtractDiagnostics, nullergebnisHinweis } from './ExtractDiagnostics.js';

const ENDPOINT = '/.netlify/functions/site-extract-background';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

// progress_step aus der Job-Zeile -> Beschriftung am Button
const STEP_LABELS = {
  start: 'Startet…',
  cache: 'Liest…',
  laden: 'Seite laden…',
  unterseite: 'Unterseiten…',
  auswerten: 'KI wertet aus…',
  bilder: 'Bilder…'
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
function toAbsoluteUrl(rawValue) {
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
  }

  bind() {
    const buttons = this.form.querySelectorAll('[data-ai-extract]');
    buttons.forEach((button) => {
      button.addEventListener('click', () => this.run(button));
    });
    return buttons.length;
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
    emit('siteExtractProgress', { entity: this.entity, step: 'start' });

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
        source: result.source || null
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
  async request(url, state) {
    const db = window.supabase;
    const session = await getSession();
    if (!db || !session) throw new Error('Keine aktive Sitzung');

    // 1. Job-Zeile anlegen (RLS: nur eigene Jobs lesbar). URL und Entitaet
    //    stehen in der Zeile - die Function liest sie von dort, nicht aus
    //    dem POST-Body.
    const { data: job, error: insertError } = await db.from('extract_jobs')
      .insert({ url, entity_type: this.entity, created_by: session.user.id })
      .select('id').single();
    if (insertError) throw new Error(`Job konnte nicht angelegt werden: ${insertError.message}`);

    // 2. Background Function anstossen - sie antwortet sofort mit 202,
    //    der eigentliche Lauf schreibt asynchron in die Job-Zeile
    const response = await fetch(ENDPOINT, {
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

    // 3. Job-Zeile pollen, bis done oder error
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let letzterStep = null;

    while (Date.now() < deadline) {
      await warte(POLL_INTERVAL_MS);

      const { data: row, error: pollError } = await db.from('extract_jobs')
        .select('status, progress_step, result, error_message')
        .eq('id', job.id).maybeSingle();
      // Voruebergehende Poll-Fehler (Netz, Zeile noch nicht sichtbar)
      // aussitzen - der naechste Umlauf kommt in 2s
      if (pollError || !row) continue;

      if (row.status === 'done') {
        const payload = row.result || {};
        logExtractDiagnostics({ url, entity: this.entity, payload });
        if (!payload.success) throw new Error(payload.error || 'Extraktion ohne Ergebnis beendet');
        return payload;
      }

      if (row.status === 'error') {
        // Diagnose ist im Fehlerfall am wertvollsten
        logExtractDiagnostics({ url, entity: this.entity, payload: row.result || null });
        throw new Error(row.error_message || 'Extraktion fehlgeschlagen');
      }

      if (row.progress_step && row.progress_step !== letzterStep) {
        letzterStep = row.progress_step;
        state?.step(STEP_LABELS[row.progress_step] || 'Liest…');
        emit('siteExtractProgress', { entity: this.entity, step: row.progress_step });
      }
    }

    throw new Error('Zeitlimit erreicht - die Extraktion laeuft ungewoehnlich lange. Bitte spaeter erneut versuchen.');
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
