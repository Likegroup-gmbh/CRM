// UrlHelper.js (ES6-Modul)
// Webseiten dürfen im Formular ohne Schema eingegeben werden. Ohne Schema
// landen Werte wie "www.canon.de/" in der DB, die als href zu einer
// App-internen Navigation führen statt zur Zielseite.
// normalizeUrl() macht daraus eine absolute URL, safeExternalUrl() liefert
// zusätzlich den '#'-Fallback für Render-Stellen.

/**
 * Normalisiert eine Benutzereingabe zu einer absoluten http(s)-URL.
 * Nicht-http(s)-Schemas (javascript:, data:, ...) werden verworfen.
 * @param {string} value
 * @returns {string} absolute URL oder '' wenn unbrauchbar
 */
export function normalizeUrl(value) {
  if (!value || typeof value !== 'string') return '';

  const trimmed = value.trim();
  if (!trimmed) return '';

  // Bewusst nur auf http(s) prüfen und sonst immer https:// voranstellen:
  // ein generisches Schema-Muster würde bei "firma.de:8080" das "firma.de:"
  // als Protokoll lesen und die URL verwerfen.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

/**
 * Wie normalizeUrl(), aber mit '#' als Fallback für href-Attribute.
 * @param {string} value
 * @returns {string}
 */
export function safeExternalUrl(value) {
  return normalizeUrl(value) || '#';
}

/**
 * Normalisiert alle URL-Felder eines Formulars (input[data-url-field="true"])
 * direkt im gesammelten Datenobjekt. Wird von den Submit-Pfaden genutzt.
 * @param {HTMLFormElement} form
 * @param {Object} data - gesammelte Formulardaten (wird mutiert)
 * @returns {Object} dasselbe Objekt
 */
export function normalizeFormUrlFields(form, data) {
  if (!form || !data) return data;

  form.querySelectorAll('input[data-url-field="true"]').forEach((input) => {
    const name = input.name;
    if (!name || !Object.prototype.hasOwnProperty.call(data, name)) return;
    if (typeof data[name] !== 'string') return;
    data[name] = normalizeUrl(data[name]);
  });

  return data;
}
