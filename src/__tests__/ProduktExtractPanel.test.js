// ProduktExtractPanel.test.js
// Thinking-Slot: Labels kommen aus dem Event, nicht aus einem Panel-Katalog.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProduktExtractPanel } from '../modules/produkt/ProduktExtractPanel.js';

function mountPanel() {
  const form = document.createElement('form');
  form.innerHTML = '<div id="produkt-extract-feed"></div>';
  document.body.appendChild(form);
  const panel = new ProduktExtractPanel();
  panel.mount(form);
  return { form, panel };
}

describe('ProduktExtractPanel Thinking', () => {
  let form;
  let panel;

  beforeEach(() => {
    ({ form, panel } = mountPanel());
  });

  afterEach(() => {
    panel.destroy();
    form.remove();
  });

  it('siteExtractProgress rendert Label aus dem Payload', () => {
    document.dispatchEvent(new CustomEvent('siteExtractStarted', {
      detail: { entity: 'produkt', url: 'https://shop.example/p' }
    }));
    document.dispatchEvent(new CustomEvent('siteExtractProgress', {
      detail: { entity: 'produkt', step: 'laden', label: 'Seite wird geladen' }
    }));

    const html = form.querySelector('#produkt-extract-feed').innerHTML;
    expect(html).toContain('chat-thinking');
    expect(html).toContain('Seite wird geladen');
    expect(html).toContain('is-active');
  });

  it('steps[] ersetzt die Liste, finish markiert alle erledigt', () => {
    document.dispatchEvent(new CustomEvent('siteExtractStarted', {
      detail: { entity: 'produkt', url: 'https://shop.example/p' }
    }));
    document.dispatchEvent(new CustomEvent('siteExtractProgress', {
      detail: {
        entity: 'produkt',
        step: 'auswerten',
        label: 'USPs und Pain Points werden durchsucht',
        steps: [
          { step: 'start', label: 'Ich schaue mir die Seite an' },
          { step: 'auswerten', label: 'USPs und Pain Points werden durchsucht' }
        ]
      }
    }));
    document.dispatchEvent(new CustomEvent('siteExtractFinished', {
      detail: { entity: 'produkt', ok: true, felder: 3 }
    }));

    const html = form.querySelector('#produkt-extract-feed').innerHTML;
    expect(html).toContain('Ich schaue mir die Seite an');
    expect(html).toContain('USPs und Pain Points werden durchsucht');
    expect(html).not.toContain('is-active');
    expect(html).toContain('Fertig, schau es dir an');
  });
});
