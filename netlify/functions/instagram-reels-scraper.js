// instagram-reels-scraper.js
// Admin-Seite Instagram-CPM (nur Admins). Startet den Apify-Actor apify/instagram-reel-scraper
// fuer ein Profil und liefert Stand und vorgefilterte Reels (Ablauf in _shared/tiktok/laufHandler.js).
//
// POST { aktion: 'starten', profil, anzahl } -> { ok, lauf, ergebnis? }
// POST { aktion: 'stand', runId }            -> { ok, lauf, ergebnis? }
// POST { aktion: 'abbrechen', runId }        -> { ok, lauf }
// ergebnis kommt, sobald der Lauf fertig ist: { profil, reels, gefiltert, fehler, roh }

const { createLaufHandler } = require('./_shared/tiktok/laufHandler');
const { pruefeEingabe } = require('./_shared/instagram-reels/eingabe');
const { auswerten } = require('./_shared/instagram-reels/ergebnis');

const ACTOR = { actorVar: 'APIFY_INSTAGRAM_ACTOR', actorStandard: 'apify~instagram-reel-scraper' };

const createHandler = (deps = {}) => createLaufHandler({
  name: 'instagram-reels-scraper',
  pruefeEingabe,
  auswerten,
  actor: ACTOR,
}, deps);

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.ACTOR = ACTOR;
