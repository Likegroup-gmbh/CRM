// auswertungDaten.js
// Daten des Reports für eine Ebene: Einheiten, Verbrauch und die Posts aus kooperation_post.
// Kurz zwischengespeichert, damit Linien- und Ebenenwechsel nicht jedes Mal den Videos-Baum laden.
// Sind die Daten der Kampagne schon da, bedient die Produktion sich daraus.

import { ladeEinheiten } from './auswertungEinheiten.js';
import { ladePosts } from './auswertungPostsDaten.js';

const HALTBAR_MS = 2 * 60 * 1000;
const cache = new Map();

const schluessel = (kampagneId, ebene, produktionId) => `${kampagneId}|${ebene === 'kampagne' ? 'kampagne' : produktionId}`;

function frisch(key) {
  const eintrag = cache.get(key);
  if (!eintrag || Date.now() - eintrag.zeit > HALTBAR_MS) return null;
  return eintrag.promise;
}

async function ladeEinmal({ kampagneId, produktion, ebene }) {
  const produktionId = ebene === 'kampagne' ? null : produktion?.id || null;
  const [roh, posts] = await Promise.all([
    ladeEinheiten({ kampagneId, produktion, ebene }),
    ladePosts({ kampagneId, produktionId })
  ]);
  // Ziel Aufrufe kommt aus dem Briefing, sobald es dort ein Feld gibt
  return { ...roh, posts, zielFuer: () => null };
}

const PAUSEN_MS = [400, 1200];

/**
 * Der Report liest viele Tabellen in einem Rutsch; ein einzelner Aussetzer (Netz, Token-Wechsel,
 * 5xx) soll nicht als „Inhalt konnte nicht geladen werden“ enden. Zweimal nachfassen, dann Fehler.
 */
async function lade(scope) {
  for (let versuch = 0; ; versuch += 1) {
    try {
      return await ladeEinmal(scope);
    } catch (error) {
      if (versuch >= PAUSEN_MS.length) throw error;
      console.warn(`Auswertung: Laden fehlgeschlagen, neuer Versuch ${versuch + 2}`, error?.message || error);
      await new Promise(resolve => setTimeout(resolve, PAUSEN_MS[versuch]));
    }
  }
}

/**
 * @param {{ kampagneId: string, produktion?: object|null, ebene: 'produktion'|'kampagne' }} scope
 * @returns {Promise<object>} Basis für baueModell
 */
export function ladeAuswertung({ kampagneId, produktion = null, ebene }) {
  const key = schluessel(kampagneId, ebene, produktion?.id);
  const vorhanden = frisch(key) || (ebene !== 'kampagne' && frisch(schluessel(kampagneId, 'kampagne')));
  if (vorhanden) return vorhanden;
  const promise = lade({ kampagneId, produktion, ebene });
  cache.set(key, { zeit: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  return promise;
}

/** Nach dem Speichern eines Posts: alle Stände der Kampagne verwerfen. */
export function vergiss(kampagneId) {
  [...cache.keys()].filter(k => k.startsWith(`${kampagneId}|`)).forEach(k => cache.delete(k));
}
