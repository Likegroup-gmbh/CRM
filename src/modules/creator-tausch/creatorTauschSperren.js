// creatorTauschSperren.js
// Sperrgruende des Creator-Tauschs als reine Funktionen (Dialog und Tests).
// Die Schluessel gelten 1:1 in der RPC creator_tausch (supabase/migrations/20261002_*).

import { castingUmsetzungGate } from '../creator-auswahl/sourcingStatusOptions.js';
import { isSignedVertrag } from '../vertrag/vertragStatus.js';

export const TAUSCH_GRUENDE = Object.freeze({
  gleicher_eintrag: 'Der Ersatz ist derselbe Casting-Eintrag.',
  andere_liste: 'Der Ersatz steht in einem anderen Casting.',
  alter_ohne_creator: 'Der abspringende Eintrag hat keinen Creator in den Stammdaten.',
  ersatz_ohne_creator: 'Der Ersatz hat noch keinen Creator in den Stammdaten.',
  gleicher_creator: 'Der Ersatz ist derselbe Creator.',
  ersatz_abgesagt: 'Der Ersatz hat selbst abgesagt.',
  ersatz_gate: 'Der Ersatz braucht Kunden-Prio 1 oder 2 und Zusage oder Gebucht.',
  vertrag_unterschrieben: 'Ein Vertrag ist schon unterschrieben.',
  rechnung: 'Zur Kooperation existiert schon eine Rechnung.',
  upload: 'Es ist schon ein Video hochgeladen.'
});

export function tauschGrundText(key) {
  return TAUSCH_GRUENDE[key] || 'Der Tausch ist nicht möglich.';
}

/** Sperrgrund am Ersatz-Eintrag oder null. */
export function ersatzSperre(alt, ersatz) {
  if (!alt || !ersatz) return 'ersatz_ohne_creator';
  if (alt.id === ersatz.id) return 'gleicher_eintrag';
  if (alt.creator_auswahl_id !== ersatz.creator_auswahl_id) return 'andere_liste';
  if (!alt.creator_id) return 'alter_ohne_creator';
  if (!ersatz.creator_id) return 'ersatz_ohne_creator';
  if (ersatz.creator_id === alt.creator_id) return 'gleicher_creator';
  if (ersatz.absage) return 'ersatz_abgesagt';
  if (!castingUmsetzungGate(ersatz)) return 'ersatz_gate';
  return null;
}

/** Sperrgrund an den Daten des Abspringers (Vertraege, Rechnungen, Videos) oder null. */
export function datenSperre({ vertraege = [], rechnungen = [], videos = [] } = {}) {
  if (vertraege.some(isSignedVertrag) || vertraege.some((v) => v?.status === 'unterschrieben')) {
    return 'vertrag_unterschrieben';
  }
  if (rechnungen.length) return 'rechnung';
  if (videos.some((v) => v?.asset_url)) return 'upload';
  return null;
}

/** Grund-Schluessel aus der RPC-Exception ('tausch_gesperrt:<grund>'). */
export function tauschFehlerKey(error) {
  const treffer = /tausch_gesperrt:([a-z_]+)/.exec(error?.message || '');
  return treffer ? treffer[1] : null;
}
