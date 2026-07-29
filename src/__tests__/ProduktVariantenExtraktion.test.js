// Regression: bei mehrfarbigen Produkten kamen bisher nur ein bis zwei
// Varianten an. Der sichtbare Text nennt sie naemlich nicht - sie stehen im
// Bestellformular (das der Text-Extraktor verwirft) und im Shop-JSON.

import { describe, it, expect } from 'vitest';
import {
  extractShopJson,
  extractVariantOptions,
  distill,
  toPromptBlock
} from '../../netlify/functions/site-extract-utils/html-distill.js';

const SHOPIFY_HTML = `
<html><head><title>Clear Case</title>
<script type="application/json" data-product-json>
{"id":1,"title":"Clear Case",
 "options":[{"name":"Farbe","values":["Sand","Schwarz","Blau","Gruen"]}],
 "variants":[
  {"id":11,"title":"Sand","option1":"Sand","price":19900,"compare_at_price":39900,"available":true},
  {"id":12,"title":"Schwarz","option1":"Schwarz","price":19900,"compare_at_price":39900,"available":true},
  {"id":13,"title":"Blau","option1":"Blau","price":21900,"compare_at_price":null,"available":false},
  {"id":14,"title":"Gruen","option1":"Gruen","price":21900,"compare_at_price":39900,"available":true}
 ]}
</script>
</head><body>
<form>
  <select name="Groesse"><option value="">Bitte waehlen</option><option>S</option><option>M</option><option>L</option></select>
  <select name="quantity"><option>1</option><option>2</option></select>
  <input type="radio" name="option-farbe" value="Sand">
  <input type="radio" name="option-farbe" value="Schwarz">
  <input type="radio" name="option-farbe" value="Blau">
  <input type="radio" name="option-farbe" value="Gruen">
  <input type="checkbox" name="newsletter" value="ja">
</form>
<p>Jetzt fuer 199,00 EUR statt 399,00 EUR</p>
</body></html>`;

describe('extractShopJson', () => {
  it('liefert alle Varianten inklusive Streichpreis', () => {
    const daten = JSON.parse(extractShopJson(SHOPIFY_HTML));
    expect(daten.varianten).toHaveLength(4);
    expect(daten.varianten.map(v => v.titel)).toEqual(['Sand', 'Schwarz', 'Blau', 'Gruen']);
  });

  it('rechnet Shopify-Centbetraege in Euro um', () => {
    const daten = JSON.parse(extractShopJson(SHOPIFY_HTML));
    expect(daten.varianten[0]).toMatchObject({ preis: '199.00', uvp: '399.00' });
  });

  it('markiert ausverkaufte Varianten und laesst fehlende UVPs leer', () => {
    const daten = JSON.parse(extractShopJson(SHOPIFY_HTML));
    expect(daten.varianten[2]).toMatchObject({ preis: '219.00', uvp: null, ausverkauft: true });
  });

  it('bleibt leer, wenn die Seite keine Variantenliste mitliefert', () => {
    expect(extractShopJson('<html><body><p>Nur Text</p></body></html>')).toBe('');
  });

  it('ueberspringt kaputtes JSON, statt zu werfen', () => {
    const html = '<script type="application/json">{"variants":[ kaputt }</script>';
    expect(() => extractShopJson(html)).not.toThrow();
    expect(extractShopJson(html)).toBe('');
  });
});

describe('extractVariantOptions', () => {
  it('findet Dropdown-Werte und Radio-Swatches', () => {
    const gruppen = extractVariantOptions(SHOPIFY_HTML);
    const werte = Object.fromEntries(gruppen.map(g => [g.label, g.values]));
    expect(werte.Groesse).toEqual(['S', 'M', 'L']);
    expect(werte['option-farbe']).toEqual(['Sand', 'Schwarz', 'Blau', 'Gruen']);
  });

  it('ignoriert Mengenauswahl und Newsletter-Checkbox', () => {
    const labels = extractVariantOptions(SHOPIFY_HTML).map(g => g.label);
    expect(labels).not.toContain('quantity');
    expect(labels).not.toContain('newsletter');
  });

  it('faellt auf data-Attribute zurueck, wenn es kein Formular gibt', () => {
    const html = '<div><a data-value="Rot"></a><a data-value="Gelb"></a><a data-value="Rot"></a></div>';
    expect(extractVariantOptions(html)).toEqual([{ label: 'Swatch-Werte', values: ['Rot', 'Gelb'] }]);
  });
});

describe('distill + toPromptBlock', () => {
  it('reicht die Variantenquellen nur bei withVarianten in den Prompt', () => {
    const seite = distill(SHOPIFY_HTML, 'https://shop.de/p', { withVarianten: true });
    const prompt = toPromptBlock([{ url: 'https://shop.de/p', role: 'Produktseite', ...seite }]);
    expect(prompt).toContain('Varianten-Rohdaten des Shops');
    expect(prompt).toContain('Auswaehlbare Optionen im Bestellformular');
    expect(prompt).toContain('Gruen');

    const ohne = distill(SHOPIFY_HTML, 'https://shop.de/p');
    expect(ohne.shopJson).toBe('');
    expect(ohne.variantOptions).toEqual([]);
  });

  it('stellt Product-Knoten im JSON-LD nach vorn', () => {
    const html = `
      <script type="application/ld+json">{"@type":"WebSite","name":"Shop"}</script>
      <script type="application/ld+json">{"@type":"Product","name":"Clear Case"}</script>`;
    const prompt = toPromptBlock([{ url: 'https://shop.de/p', ...distill(html, 'https://shop.de/p') }]);
    expect(prompt.indexOf('"Product"')).toBeLessThan(prompt.indexOf('"WebSite"'));
  });
});
