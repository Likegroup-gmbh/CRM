// _shared/ablage/schalter.js
// Medienablage-Schalter (Server). Gleiche Quelle wie der Client: src/core/ablage/schalter.json,
// Env VITE_DROPBOX_UPLOAD=on|off uebersteuert (Scope in Netlify: auch Functions).
// An: SharePoint gilt als nicht konfiguriert, Uploads gehen nach Dropbox, ohne dass
// ablage_*-Tabellen oder -Spalten gelesen werden (auf Live fehlt Migration 20261201).

const schalter = require('../../../../src/core/ablage/schalter.json');

function dropboxUpload(env = process.env) {
  const wert = String(env.VITE_DROPBOX_UPLOAD || '').toLowerCase();
  if (wert === 'on') return true;
  if (wert === 'off') return false;
  return schalter.dropboxUpload !== false;
}

module.exports = { dropboxUpload };
