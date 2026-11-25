// AuftragsdetailsPayload.js
// Baut den Speicher-Payload für auftrag_details aus dem Formular (ohne Seiteneffekte)

import { PREFIXES_WITHOUT_LEGACY_COLUMNS } from './KampagnenartenMapping.js';

// Felder, die nicht in auftrag_details persistiert werden
// - art_der_kampagne: wird über auftrag_kampagne_art gespeichert
// - unternehmen_id: dient nur der Filterung im Formular
const SKIPPED_KEYS = new Set(['art_der_kampagne', 'art_der_kampagne[]', 'unternehmen_id']);

const NUMERIC_KEYS = new Set(['gesamt_videos', 'gesamt_creator', 'kampagnenanzahl']);

function isNumericKey(key) {
  return key.endsWith('_anzahl') || NUMERIC_KEYS.has(key);
}

/**
 * Sammelt die Formularfelder und normalisiert sie für den Upsert.
 * @param {HTMLFormElement} form
 * @returns {Object} Payload (ohne created_by_id)
 */
export function buildAuftragsdetailsPayload(form) {
  const data = {};

  for (const [key, value] of new FormData(form).entries()) {
    if (SKIPPED_KEYS.has(key)) continue;

    if (value === '' || value === null) {
      // Leere Werte als null speichern
      data[key] = null;
    } else if (isNumericKey(key)) {
      data[key] = value ? parseInt(value, 10) : null;
    } else {
      data[key] = value;
    }
  }

  // Toggle-Hilfsfelder nicht persistieren; bei deaktiviertem Toggle Zahl explizit nullen
  form.querySelectorAll('input[data-video-toggle="true"]').forEach(toggleInput => {
    const toggleName = toggleInput.name;
    if (toggleName && Object.prototype.hasOwnProperty.call(data, toggleName)) {
      delete data[toggleName];
    }

    const videoFieldName = toggleInput.dataset.target;
    if (!videoFieldName) return;

    if (!toggleInput.checked) {
      data[videoFieldName] = null;
    }
  });

  // Keys für Präfixe ohne DB-Spalten entfernen (whitelisting_*, darkposting_*)
  for (const key of Object.keys(data)) {
    for (const prefix of PREFIXES_WITHOUT_LEGACY_COLUMNS) {
      if (key.startsWith(`${prefix}_`)) {
        delete data[key];
        break;
      }
    }
  }

  return data;
}
