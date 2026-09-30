import { describe, it, expect, afterEach } from 'vitest';
import { getSpec } from '../../netlify/functions/_shared/extract-specs.js';
import { renderProduktDoc } from '../modules/produkt/ProduktDoc.js';
import {
  applyChatUrl,
  markPdfUrlSource,
  bindProduktUrlSync
} from '../modules/produkt/produktUrlSync.js';

describe('Produkt-URL Spec', () => {
  it('fragt die kanonische Produkt-URL als Fact ab', () => {
    const url = getSpec('produkt').fields.find((f) => f.name === 'url');
    expect(url?.kind).toBe('fact');
    expect(url?.label).toBe('Produkt-URL');
  });
});

describe('applyChatUrl', () => {
  it('füllt ein leeres Feld und ersetzt PDF-Autofill, manuelle Eingabe bleibt', () => {
    const input = { value: '', dataset: {} };

    expect(applyChatUrl(input, 'shop.example/p')).toBe(true);
    expect(input.value).toBe('https://shop.example/p');
    expect(input.dataset.urlSource).toBe('chat');

    input.dataset.urlSource = 'pdf';
    input.value = 'https://from-pdf.example/a';
    expect(applyChatUrl(input, 'other.example/b')).toBe(true);
    expect(input.value).toBe('https://other.example/b');
    expect(input.dataset.urlSource).toBe('chat');

    input.dataset.urlSource = 'manual';
    input.value = 'https://keep.example/c';
    expect(applyChatUrl(input, 'other.example/d')).toBe(false);
    expect(input.value).toBe('https://keep.example/c');
    expect(input.dataset.urlSource).toBe('manual');
  });

  it('leeres Feld nach manueller Eingabe nimmt die Chat-URL wieder an', () => {
    const input = { value: '', dataset: { urlSource: 'manual' } };
    expect(applyChatUrl(input, 'shop.example/neu')).toBe(true);
    expect(input.value).toBe('https://shop.example/neu');
    expect(input.dataset.urlSource).toBe('chat');
  });

  it('ungültiger Chat-Text lässt die Produkt-URL stehen', () => {
    const input = { value: 'https://keep.example/c', dataset: { urlSource: 'chat' } };
    expect(applyChatUrl(input, 'keine url')).toBe(false);
    expect(input.value).toBe('https://keep.example/c');
  });
});

describe('markPdfUrlSource', () => {
  it('markiert nur eine URL, die in ein vorher leeres Feld übernommen wurde', () => {
    const input = { value: 'https://shop.example/p', dataset: {} };
    expect(markPdfUrlSource(input, 'https://shop.example/p', { wasEmpty: true })).toBe(true);
    expect(input.dataset.urlSource).toBe('pdf');

    input.dataset.urlSource = 'manual';
    input.value = 'https://shop.example/p';
    expect(markPdfUrlSource(input, 'https://shop.example/p', { wasEmpty: true })).toBe(true);
    expect(input.dataset.urlSource).toBe('pdf');

    input.dataset.urlSource = 'chat';
    expect(markPdfUrlSource(input, 'https://shop.example/p', { wasEmpty: true })).toBe(false);
    expect(input.dataset.urlSource).toBe('chat');

    input.dataset.urlSource = '';
    expect(markPdfUrlSource(input, 'https://shop.example/p', { wasEmpty: false })).toBe(false);
    expect(input.dataset.urlSource).toBe('');

    input.value = 'https://andere.example/x';
    expect(markPdfUrlSource(input, 'https://shop.example/p', { wasEmpty: true })).toBe(false);
  });
});

describe('bindProduktUrlSync', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('schreibt die Shop-URL aus dem Chat ins Dokumentfeld', () => {
    document.body.innerHTML = renderProduktDoc(null, {
      mitMarkenFeld: false,
      mitUnternehmenFeld: false,
      unternehmenId: 'u1'
    });
    const form = document.getElementById('produkt-form');
    bindProduktUrlSync(form);

    const chat = form.querySelector('[name="extract_quelle"]');
    const url = form.querySelector('[name="url"]');
    expect(url).toBeTruthy();
    expect(url.hasAttribute('data-url-field')).toBe(true);

    chat.value = 'shop.example/produkte/case';
    chat.dispatchEvent(new Event('input', { bubbles: true }));

    expect(url.value).toBe('https://shop.example/produkte/case');
    expect(url.dataset.urlSource).toBe('chat');
  });
});
