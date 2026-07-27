// SiteExtractHandler.js
// Verbindet den "Auslesen"-Button am URL-Feld mit der Netlify Function
// site-extract. Voellig generisch: welche Felder zurueckkommen, bestimmt
// ausschliesslich netlify/functions/_shared/extract-specs.js.
//
// Freischalten eines weiteren Formulars: `aiExtract: true` am URL-Feld im
// FormConfig plus ein Spec-Eintrag im Backend.

import { ExtractReviewLayer } from './ExtractReviewLayer.js';
import { applyExtractedLogo, clearExtractedLogo } from './ExtractLogoApplier.js';
import { ExtractCostBadge } from './ExtractCostBadge.js';

const ENDPOINT = '/.netlify/functions/site-extract';

function notifyError(message) {
  if (window.toast?.error) window.toast.error(message);
  else console.error(`❌ SITE-EXTRACT: ${message}`);
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

async function getAccessToken() {
  const session = await window.supabase?.auth?.getSession();
  return session?.data?.session?.access_token || '';
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

    try {
      // Ergebnis eines vorherigen Laufs zurueckziehen, damit neue Werte
      // nicht an den alten haengen bleiben
      this.review.revertAll();
      clearExtractedLogo(this.form);
      costBadge.clear();

      const result = await this.request(url);
      this.applyFields(result.fields || {}, triggerField);
      costBadge.show(result);

      if (result.logo) applyExtractedLogo(this.form, result.logo);
      if (Array.isArray(result.notes) && result.notes.length) {
        console.log('ℹ️ SITE-EXTRACT Hinweise:', result.notes);
      }
      const preis = result.cached ? 'aus Cache' : `${((result.cost?.eur || 0) * 100).toFixed(3)} ct`;
      console.log(`✅ SITE-EXTRACT: ${Object.keys(result.fields || {}).length} Felder von ${url} (${result.source}, ${preis})`);
    } catch (error) {
      notifyError(`Webseite konnte nicht ausgelesen werden: ${error.message}`);
    } finally {
      state.idle();
      this.running = false;
    }
  }

  async request(url) {
    const token = await getAccessToken();
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ url, entityType: this.entity })
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`Unerwartete Antwort (HTTP ${response.status})`);
    }

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    return payload;
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
        const normalized = this.review.formatForInput(input, entry.value);
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
