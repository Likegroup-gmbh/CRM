// tiktok-scraper.js
// Admin-Seite TikTok-API (nur Admins). Startet den Apify-Actor clockworks/tiktok-scraper und
// liefert Stand und Ergebnisse eines Laufs (Ablauf in _shared/tiktok/laufHandler.js).
//
// POST { aktion: 'starten', videos, profile, anzahl } -> { ok, lauf, ergebnis? }
// POST { aktion: 'stand', runId }                     -> { ok, lauf, ergebnis? }
// POST { aktion: 'abbrechen', runId }                 -> { ok, lauf }
// ergebnis kommt, sobald der Lauf fertig ist: { videos, profile, fehler, roh }

const { createLaufHandler } = require('./_shared/tiktok/laufHandler');
const { pruefeEingabe } = require('./_shared/tiktok/eingabe');
const { auswerten } = require('./_shared/tiktok/ergebnis');

const createHandler = (deps = {}) => createLaufHandler({ name: 'tiktok-scraper', pruefeEingabe, auswerten }, deps);

exports.handler = createHandler();
exports.createHandler = createHandler;
