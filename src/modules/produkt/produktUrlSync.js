// produktUrlSync.js
// Die gespeicherte Produkt-URL liegt im Dokument (name="url"). Der Liky-Chat
// ist nur die Quelle: eine gültige Shop-URL wird übernommen, solange das Feld
// leer ist oder zuletzt automatisch kam. Eine manuelle Eingabe bleibt stehen.
// PDF-Extrakt füllt nur leere Felder (SiteExtractHandler.applyFields) und
// markiert die Quelle danach, damit ein späterer Chat-Link sie noch ersetzen darf.

import { toAbsoluteUrl } from '../../core/form/ai/SiteExtractHandler.js';

const AUTO_SOURCES = new Set(['chat', 'pdf']);

/**
 * @param {HTMLInputElement|{ value: string, dataset: Record<string, string> }} urlInput
 * @param {string} chatValue
 * @returns {boolean} true, wenn das Dokumentfeld geschrieben wurde
 */
export function applyChatUrl(urlInput, chatValue) {
  if (!urlInput) return false;
  const absolute = toAbsoluteUrl(chatValue);
  if (!absolute) return false;

  const source = urlInput.dataset.urlSource || '';
  const empty = !String(urlInput.value || '').trim();
  if (!empty && !AUTO_SOURCES.has(source)) return false;
  if (urlInput.value === absolute && source === 'chat') return false;

  urlInput.value = absolute;
  urlInput.dataset.urlSource = 'chat';
  return true;
}

/**
 * Nach einem PDF-Lauf. Nur wenn das Feld vorher leer war und jetzt genau
 * die extrahierte URL trägt. Eine schon aus dem Chat gesetzte URL bleibt chat.
 * @param {HTMLInputElement|{ value: string, dataset: Record<string, string> }} urlInput
 * @param {string} extractedValue
 * @param {{ wasEmpty?: boolean }} [opts]
 * @returns {boolean}
 */
export function markPdfUrlSource(urlInput, extractedValue, { wasEmpty = false } = {}) {
  if (!urlInput || !wasEmpty) return false;
  if ((urlInput.dataset.urlSource || '') === 'chat') return false;

  const extracted = String(extractedValue || '').trim();
  if (!extracted) return false;
  if (String(urlInput.value || '').trim() !== extracted) return false;

  urlInput.dataset.urlSource = 'pdf';
  return true;
}

/**
 * Hängt Chat-Input und manuelle Bearbeitung an das Dokumentfeld.
 * @param {HTMLFormElement} form
 * @param {{ signal?: AbortSignal }} [opts]
 */
export function bindProduktUrlSync(form, { signal } = {}) {
  if (!form) return;
  const listen = signal ? { signal } : undefined;
  const urlInput = form.querySelector('[name="url"]');
  if (!urlInput) return;

  urlInput.addEventListener('input', (e) => {
    if (!e.isTrusted) return;
    urlInput.dataset.urlSource = 'manual';
  }, listen);

  const chat = form.querySelector('.doc__side [data-url-field="true"]')
    || form.querySelector('[name="extract_quelle"]');
  if (!chat) return;

  const sync = () => applyChatUrl(urlInput, chat.value);
  chat.addEventListener('input', sync, listen);
  sync();
}
