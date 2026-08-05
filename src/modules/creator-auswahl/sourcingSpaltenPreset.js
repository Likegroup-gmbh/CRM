// Listenkonfiguration einer Sourcing-Liste: welche Werte es gibt und welche
// Spalten daraus folgen. Reine Funktionen ohne DOM-Zugriff, damit die Matrix
// testbar bleibt.
//
// Genutzt vom Anlege-Formular (SourcingFormConfig) und vom Drawer
// "Tabelle anpassen" (SourcingTabelleAnpassenDrawer) - beide ziehen Optionen
// und Preset aus dieser Datei, damit sie nicht auseinanderlaufen.
//
//   liste_typ   'ugc' | 'influencer' | 'mix'
//   plattformen 'instagram' | 'tiktok' | 'instagram,tiktok'
//   ig_formate  'reel' | 'story' | 'reel,story'

export const LISTE_TYP_OPTIONEN = [
  { value: 'ugc', label: 'UGC' },
  { value: 'influencer', label: 'Influencer' },
  { value: 'mix', label: 'Mix' }
];

// "Instagram + TikTok" statt "beides": DependentFields entscheidet anhand des
// Options-Textes, ob das Format-Feld sichtbar wird (siehe SourcingFormConfig).
export const PLATTFORM_OPTIONEN = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram,tiktok', label: 'Instagram + TikTok' }
];

export const IG_FORMAT_OPTIONEN = [
  { value: 'reel', label: 'Reel' },
  { value: 'story', label: 'Story' },
  { value: 'reel,story', label: 'Reel + Story' }
];

/** Instagram-Basisspalten: Link und Follower */
export const IG_BASIS_SPALTEN = ['cp-col-link-ig', 'cp-col-follower-ig'];

/**
 * Reels-Spalten: die beiden berechneten Preise (8er- und 30er-Fenster, jeweils
 * ohne Ausreisser und ohne Werbe-Reels) plus der von Hand gepflegte Reel-Preis.
 */
export const IG_REELS_SPALTEN = [
  'cp-col-cpm-ig-8', 'cp-col-cpm-ig-30', 'cp-col-preis-reels'
];

/** Manuell gepflegte Story-Spalten */
export const IG_STORY_SPALTEN = ['cp-col-reichweite-story', 'cp-col-preis-story'];

/** TikTok-Spalten: Link und Follower */
export const TT_SPALTEN = ['cp-col-link-tt', 'cp-col-follower-tt'];

/**
 * Spalten, die eine neue Liste ausgeblendet startet, obwohl das Preset sie
 * nicht steuert. Bewusst getrennt von PRESET_SPALTEN: wendePresetAn() setzt
 * nur die Preset-Spalten neu, diese hier bleiben eingeschaltet, sobald sie
 * jemand im Drawer eingeblendet hat.
 */
export const STANDARD_VERSTECKTE_SPALTEN = ['cp-col-typ'];

/** Alle Spalten, die das Preset ueberhaupt steuert */
export const PRESET_SPALTEN = [
  ...IG_BASIS_SPALTEN, ...IG_REELS_SPALTEN, ...IG_STORY_SPALTEN, ...TT_SPALTEN
];

function toListe(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(v => String(v).trim());
  if (typeof value !== 'string') return [];
  return value.split(',').map(v => v.trim()).filter(Boolean);
}

/**
 * @param {{liste_typ?: string, plattformen?: string|string[], ig_formate?: string|string[]}} auswahl
 * @returns {string[]} Spaltenklassen, die ausgeblendet werden
 */
export function berechneHiddenColumns(auswahl = {}) {
  const typ = (auswahl.liste_typ || '').toLowerCase();

  // UGC braucht keine Reichweiten-Preislogik: der Preis ist eine Pauschale.
  // Link und Follower bleiben, damit der Instagram-Abruf weiter nutzbar ist.
  if (typ === 'ugc') {
    return [...IG_REELS_SPALTEN, ...IG_STORY_SPALTEN, ...TT_SPALTEN];
  }

  // Mix zeigt alles - dort landen UGC- und Influencer-Creator in einer Liste.
  if (typ !== 'influencer') return [];

  const plattformen = toListe(auswahl.plattformen);
  const formate = toListe(auswahl.ig_formate);

  // Ohne Angabe gilt die weiteste Auswahl, sonst wuerde eine unvollstaendig
  // ausgefuellte Liste komplett leer starten.
  const hatInstagram = plattformen.length === 0 || plattformen.includes('instagram');
  const hatTiktok = plattformen.length === 0 || plattformen.includes('tiktok');
  const hatReel = formate.length === 0 || formate.includes('reel');
  const hatStory = formate.length === 0 || formate.includes('story');

  const hidden = [];

  if (!hatInstagram) {
    hidden.push(...IG_BASIS_SPALTEN, ...IG_REELS_SPALTEN, ...IG_STORY_SPALTEN);
  } else {
    if (!hatReel) hidden.push(...IG_REELS_SPALTEN);
    if (!hatStory) hidden.push(...IG_STORY_SPALTEN);
  }

  if (!hatTiktok) hidden.push(...TT_SPALTEN);

  return hidden;
}

/**
 * Preset auf eine bestehende Sichtbarkeit anwenden. Nur die Plattform- und
 * Formatspalten werden neu gesetzt; manuell abgeschaltete Spalten wie Mail,
 * Telefon oder eigene Spalten bleiben unangetastet.
 *
 * @param {string[]} hiddenColumns bisherige hidden_columns
 * @param {object} auswahl liste_typ / plattformen / ig_formate
 * @returns {string[]} neue hidden_columns
 */
export function wendePresetAn(hiddenColumns = [], auswahl = {}) {
  const gesteuert = new Set(PRESET_SPALTEN);
  const unberuehrt = (hiddenColumns || []).filter(col => !gesteuert.has(col));
  return [...unberuehrt, ...berechneHiddenColumns(auswahl)];
}
