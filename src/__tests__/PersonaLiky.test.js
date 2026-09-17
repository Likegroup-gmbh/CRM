import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import { LIKY_CAPABILITIES, likyHasChat, likyCanExtractUrl } from '../core/chat/likyCapabilities.js';
import { renderPersonaLikySlot } from '../modules/persona/PersonaLikySlot.js';
import { PersonaLikyPanel, decidePersonaLikyAktion } from '../modules/persona/PersonaLikyPanel.js';
import { PersonaAudienceSituationPanel } from '../modules/persona/PersonaAudienceSituationPanel.js';
import { ExtractReviewLayer } from '../core/form/ai/ExtractReviewLayer.js';

const require = createRequire(import.meta.url);
const { hasSpec, getSpec, buildFieldInstructions } = require('../../netlify/functions/_shared/extract-specs.js');
const { sanitizePatches, sanitizeChatResult, CHAT_TOOL } = require('../../netlify/functions/_shared/persona-liky.js');

describe('Liky Capabilities Persona', () => {
  it('persona: URL-Extract und Chat an', () => {
    expect(LIKY_CAPABILITIES.persona).toEqual({ extract: 'url', chat: true, specFrom: 'server' });
    expect(likyCanExtractUrl('persona')).toBe(true);
    expect(likyHasChat('persona')).toBe(true);
  });
});

describe('renderPersonaLikySlot', () => {
  it('Composer ist aktiv, kein disabled', () => {
    const html = renderPersonaLikySlot();
    expect(html).toContain('id="persona-liky-feed"');
    expect(html).toContain('id="persona-liky-input"');
    expect(html).toContain('id="persona-liky-send"');
    expect(html).toContain('Shop-URL oder ein paar Sätze');
    expect(html).not.toContain('disabled');
    expect(html).not.toContain('doc-chat__composer--bald');
    expect(html).not.toContain('data-ai-extract');
  });
});

describe('decidePersonaLikyAktion', () => {
  it('leerer Input -> null', () => {
    expect(decidePersonaLikyAktion('')).toBeNull();
    expect(decidePersonaLikyAktion('   ')).toBeNull();
  });

  it('reine URL -> extract', () => {
    expect(decidePersonaLikyAktion('https://shop.example/p')).toEqual({
      aktion: 'extract',
      url: 'https://shop.example/p',
      text: 'https://shop.example/p'
    });
    expect(decidePersonaLikyAktion('shop.example/p').aktion).toBe('extract');
    expect(decidePersonaLikyAktion('shop.example/p').url).toMatch(/^https:\/\/shop\.example\/p/);
  });

  it('Freitext oder URL plus Satz -> chat', () => {
    expect(decidePersonaLikyAktion('Berufstätige Mutter, 35, Berlin')).toEqual({
      aktion: 'chat',
      text: 'Berufstätige Mutter, 35, Berlin'
    });
    expect(decidePersonaLikyAktion('schau dir https://shop.example an').aktion).toBe('chat');
  });
});

describe('extract-specs persona', () => {
  it('hat Spec mit Audience Situations und Persona-Feldern', () => {
    expect(hasSpec('persona')).toBe(true);
    const spec = getSpec('persona');
    expect(spec.audienceSituations).toBe(true);
    expect(spec.fields.some(f => f.name === 'name')).toBe(true);
    expect(spec.fields.some(f => f.name === 'pain_points')).toBe(true);
    expect(spec.fields.some(f => f.name === 'unternehmen_id')).toBe(false);
    expect(spec.fields.some(f => f.name === 'branche_id')).toBe(false);
    const text = buildFieldInstructions(spec);
    expect(text).toContain('_audience_situations');
    expect(text).toContain('TYP MENSCH');
  });
});

describe('persona-liky Chat-Sanitize', () => {
  it('CHAT_TOOL heisst persona_chat_abgeben', () => {
    expect(CHAT_TOOL.name).toBe('persona_chat_abgeben');
    expect(CHAT_TOOL.input_schema.required).toContain('reply');
  });

  it('sanitizePatches laesst nur Persona-Felder durch und setzt force', () => {
    const out = sanitizePatches({
      name: { value: 'Sarah', force: true, kind: 'guess' },
      unbekannt: { value: 'x' },
      alter_von: { value: 28 },
      oberbegriff: '  Sparsame Studentin  '
    });
    expect(out.name).toEqual({ value: 'Sarah', kind: 'guess', from: 'Chat', force: true });
    expect(out.alter_von.value).toBe(28);
    expect(out.oberbegriff.value).toBe('Sparsame Studentin');
    expect(out.unbekannt).toBeUndefined();
  });

  it('sanitizeChatResult validiert Situationen und faellt bei zu wenig auf []', () => {
    const ok = sanitizeChatResult({
      reply: 'Passt.',
      patches: { name: { value: 'Lena' } },
      audience_situations: [
        { name: 'morgens unter Zeitdruck', beschreibung: 'Kita' },
        { name: 'nach der Schicht' }
      ]
    });
    expect(ok.reply).toBe('Passt.');
    expect(ok.patches.name.value).toBe('Lena');
    expect(ok.audience_situations).toHaveLength(2);

    const wenig = sanitizeChatResult({
      reply: '',
      audience_situations: [{ name: 'nur eine' }]
    });
    expect(wenig.reply).toBe('Verstanden.');
    expect(wenig.audience_situations).toEqual([]);
  });
});

describe('PersonaLikyPanel.applyFields', () => {
  let form;
  let panel;

  beforeEach(() => {
    form = document.createElement('form');
    form.innerHTML = `
      <div id="persona-liky-feed"></div>
      <input name="name" value="">
      <input name="oberbegriff" value="schon da">
      <select name="geschlecht">
        <option value=""></option>
        <option value="Weiblich">Weiblich</option>
      </select>
    `;
    document.body.appendChild(form);
    panel = new PersonaLikyPanel();
    panel.mount(form);
  });

  afterEach(() => {
    panel.destroy();
    form.remove();
  });

  it('fuellt leere Felder, laesst volle in Ruhe, force ueberschreibt', () => {
    const { applied, skipped } = panel.applyFields({
      name: { value: 'Sarah', kind: 'guess' },
      oberbegriff: { value: 'KI will das' },
      geschlecht: { value: 'Weiblich' }
    });
    expect(form.querySelector('[name="name"]').value).toBe('Sarah');
    expect(form.querySelector('[name="oberbegriff"]').value).toBe('schon da');
    expect(form.querySelector('[name="geschlecht"]').value).toBe('Weiblich');
    expect(applied).toEqual(['name', 'geschlecht']);
    expect(skipped).toEqual(['oberbegriff']);

    panel.applyFields({
      oberbegriff: { value: 'Berufstätige Mutter', force: true }
    });
    expect(form.querySelector('[name="oberbegriff"]').value).toBe('Berufstätige Mutter');
  });

  it('verwirft Select-Werte, die keine Option sind', () => {
    panel.applyFields({ geschlecht: { value: 'Apache Helicopter' } });
    expect(form.querySelector('[name="geschlecht"]').value).toBe('');
  });
});

describe('PersonaAudienceSituationPanel.applyKi', () => {
  let form;
  let panel;

  beforeEach(() => {
    form = document.createElement('form');
    form.innerHTML = '<div id="persona-audience-situations-panel"></div>';
    document.body.appendChild(form);
    panel = new PersonaAudienceSituationPanel();
  });

  afterEach(() => {
    panel.destroy();
    form.remove();
  });

  it('schreibt nur wenn das Panel leer bzw. nur Seeds hat', async () => {
    await panel.mount(form, { personaId: null });
    expect(panel.applyKi([])).toBe(false);
    expect(panel.applyKi([
      { name: 'morgens unter Zeitdruck', beschreibung: 'Kita' },
      { name: 'nach der Schicht' }
    ])).toBe(true);
    expect(panel.visible().map(r => r.quelle)).toEqual(['ki', 'ki']);
    expect(panel.visible()[0].name).toBe('morgens unter Zeitdruck');

    expect(panel.applyKi([{ name: 'abends auf der Couch', beschreibung: 'x' }, { name: 'im Zug' }])).toBe(false);
    expect(panel.visible()[0].name).toBe('morgens unter Zeitdruck');
  });

  it('markiert persistierte Seeds geloescht', async () => {
    await panel.mount(form, { personaId: null });
    panel.rows = [{
      key: 's1', id: 's1', name: 'Alltag', beschreibung: 'Kita', quelle: 'migration', deleted: false
    }];
    expect(panel.applyKi([
      { name: 'morgens unter Zeitdruck' },
      { name: 'nach der Schicht' }
    ])).toBe(true);
    expect(panel.rows.some(r => r.id === 's1' && r.deleted)).toBe(true);
    expect(panel.visible().every(r => r.quelle === 'ki')).toBe(true);
  });
});

describe('PersonaLikyPanel Unternehmen-Gate', () => {
  it('ohne Unternehmen kein Lauf, Hinweis im Verlauf', async () => {
    const form = document.createElement('form');
    form.innerHTML = `
      <div id="persona-liky-feed"></div>
      <input id="persona-liky-input" value="https://shop.example/p">
      <button type="button" id="persona-liky-send"></button>
    `;
    document.body.appendChild(form);
    const panel = new PersonaLikyPanel();
    panel.mount(form);
    await panel.onSend();
    expect(form.querySelector('#persona-liky-feed').textContent).toContain('Erst das Unternehmen');
    expect(form.querySelector('#persona-liky-input').value).toBe('');
    panel.destroy();
    form.remove();
  });
});

describe('ExtractReviewLayer bleibt die Markierung', () => {
  it('mark setzt Vorschlag-Tag', () => {
    const form = document.createElement('form');
    form.innerHTML = '<div class="form-field"><label>Name</label><input name="name"></div>';
    document.body.appendChild(form);
    const review = new ExtractReviewLayer(form);
    review.mark('name', { value: 'Sarah', kind: 'guess' });
    expect(form.querySelector('[name="name"]').value).toBe('Sarah');
    expect(form.querySelector('.tag--extract')).not.toBeNull();
    form.remove();
  });
});
