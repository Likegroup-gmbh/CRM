// strategie-idee/validierung.js
// Tool-Antwort der KI auf gueltige Ideen ziehen: Aliase, Ausschluss, leere
// Ideen, Funnel-Stufe. Dazu die Diagnose, wenn ein Lauf leer bleibt.

const { ANZAHL } = require('./anzahl');
const { FUNNEL_WERTE } = require('./prompt');

function erstzeile(text) {
  const s = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!s) return '';
  return s.split('\n')[0].trim();
}

function formatBeschreibung({ titel, pain_point, hook, kernbotschaft, ablauf } = {}) {
  const bloecke = [
    String(titel || '').trim(),
    pain_point ? `Pain Point: ${String(pain_point).trim()}` : '',
    hook ? `Hook: ${String(hook).trim()}` : '',
    kernbotschaft ? `Kernbotschaft: ${String(kernbotschaft).trim()}` : '',
    ablauf ? `Ablauf: ${String(ablauf).trim()}` : ''
  ].filter(Boolean);
  return bloecke.join('\n\n');
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  const s = value.trim();
  if (!s) return value;
  try {
    return JSON.parse(s);
  } catch (_) {
    return value;
  }
}

function pickIdeenArray(obj) {
  const parsed = parseMaybeJson(obj);
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];
  for (const key of ['ideen', 'videoideen', 'ideas']) {
    const val = parseMaybeJson(parsed[key]);
    if (Array.isArray(val)) return val;
  }
  if (parsed.videoideen_abgeben != null) return pickIdeenArray(parsed.videoideen_abgeben);
  return [];
}

/** Tool-Input auf ein Ideen-Array ziehen: String, Wrapper, Aliase. */
function normalizeIdeenJson(json) {
  return pickIdeenArray(json);
}

function ideeTitel(raw) {
  return String(raw?.titel || raw?.title || raw?.Titel || '').trim();
}

function jsonKeys(json) {
  if (json == null) return [];
  if (Array.isArray(json)) return ['<array>'];
  if (typeof json === 'object') return Object.keys(json).slice(0, 20);
  return [typeof json];
}

function ideenDiagnose(json, geprueft, result) {
  return {
    json_keys: jsonKeys(json),
    verworfen: (geprueft?.verworfen || []).slice(0, 20),
    stop_reason: result?.stop_reason || null
  };
}

function leerGrund(geprueft) {
  const gruende = (geprueft?.verworfen || []).map((v) => v.grund);
  if (!gruende.length) return 'leeres Array';
  const unique = [...new Set(gruende)];
  if (unique.length === 1 && unique[0] === 'ohne_titel') return 'ohne Titel';
  if (unique.length === 1 && unique[0] === 'ausschluss') return 'alles Ausschluss';
  if (unique.length === 1 && unique[0] === 'leer') return 'leere Felder';
  return unique.join(', ');
}

function leerFehler(geprueft) {
  return `Die KI konnte keine tragfähigen Videoideen liefern (${leerGrund(geprueft)})`;
}

/**
 * Stufe einer Idee: nur eine der erlaubten Stufen. Gibt es genau eine, gilt sie;
 * ohne gueltige Angabe bleibt die Stufe leer (keine Vorgabe).
 */
function waehleFunnelStufe(rawStufe, stufen) {
  const erlaubt = (stufen || []).filter((w) => FUNNEL_WERTE.includes(w));
  if (!erlaubt.length) return null;
  const wert = String(rawStufe || '').trim().toLowerCase();
  if (erlaubt.includes(wert)) return wert;
  return erlaubt.length === 1 ? erlaubt[0] : null;
}

function validateIdeen(json, { ausschluss = [], anzahl = ANZAHL, stufen = [] } = {}) {
  const raw = normalizeIdeenJson(json);
  const belegt = new Set((ausschluss || []).map((t) => erstzeile(t).toLowerCase()).filter(Boolean));
  const ideen = [];
  const verworfen = [];

  for (const rawIdee of raw) {
    const titel = ideeTitel(rawIdee);
    if (!titel) {
      verworfen.push({ grund: 'ohne_titel' });
      continue;
    }
    const key = titel.toLowerCase();
    if (belegt.has(key)) {
      verworfen.push({ grund: 'ausschluss', titel });
      continue;
    }
    const pain_point = String(rawIdee?.pain_point || '').trim();
    const hook = String(rawIdee?.hook || '').trim();
    const kernbotschaft = String(rawIdee?.kernbotschaft || '').trim();
    const ablauf = String(rawIdee?.ablauf || '').trim();
    if (!pain_point && !hook && !kernbotschaft && !ablauf) {
      verworfen.push({ grund: 'leer', titel });
      continue;
    }
    belegt.add(key);
    ideen.push({
      titel,
      pain_point,
      hook,
      kernbotschaft,
      ablauf,
      funnel_stufe: waehleFunnelStufe(rawIdee?.funnel_stufe, stufen),
      beschreibung: formatBeschreibung({ titel, pain_point, hook, kernbotschaft, ablauf })
    });
    if (ideen.length >= anzahl) break;
  }

  return { ideen, verworfen };
}

module.exports = {
  erstzeile, formatBeschreibung, normalizeIdeenJson, ideenDiagnose, leerFehler, validateIdeen
};
