// selection/story
// Reine Versions-/Asset-Logik fuer Story-Slots plus Auswahl-State
// (session.story = { version, finalAssetId }). Die Assets haengen bereits am
// Slot (kein eigener Fetch). Als Funktionen statt Methoden, damit Player und
// Prefetcher dieselbe Regel nutzen (kein ungebundenes `this`).

import { pickLatestAsset } from '../../../stills/stillAssets.js';

/** Waehlbare Feedbackschleifen-Versionen eines Slots (aufsteigend). */
export function storyVersions(slot) {
  if (slot.existingVersions?.length) return slot.existingVersions;
  if (slot.versions?.length) return slot.versions;
  return [...new Set((slot.assets || []).filter(a => !a.is_final).map(a => a.version_number || 1))]
    .sort((a, b) => a - b);
}

/** Finale Varianten (is_final) eines Slots. */
export function storyFinalVariants(slot) {
  return (slot.assets || []).filter(a => !!a.is_final);
}

/**
 * Asset zu Version ('final' oder Nummer). Bei 'final' gewinnt die Variante mit
 * `finalAssetId`, sonst die erste.
 */
export function storyAssetFor(slot, version, finalAssetId = null) {
  if (version === 'final') {
    const finals = storyFinalVariants(slot);
    return finals.find(a => a.id === finalAssetId) || finals[0] || null;
  }
  const variants = (slot.assets || []).filter(a => !a.is_final && (a.version_number || 1) === version);
  return pickLatestAsset(variants);
}

/**
 * Default beim Oeffnen: hoechste Schleifen-Version; gibt es nur finale Assets,
 * direkt die Finale; sonst Version 1.
 * @returns {{ version: number|'final', finalAssetId: string|null }}
 */
export function defaultStorySelection(slot) {
  const versions = storyVersions(slot);
  if (versions.length) return { version: versions[versions.length - 1], finalAssetId: null };
  const finals = storyFinalVariants(slot);
  if (finals.length) return { version: 'final', finalAssetId: finals[0].id };
  return { version: 1, finalAssetId: null };
}

// ---- Session-gebundene Helfer ----

/** Setzt die Default-Auswahl des aktuellen Story-Items. */
export function applyStoryDefault(session) {
  session.story = defaultStorySelection(session.current.slot);
}

/** Aktuell gewaehltes Story-Asset der Session. */
export function currentStoryAsset(session) {
  return storyAssetFor(session.current.slot, session.story.version, session.story.finalAssetId);
}

/** Versions-Select: bei 'final' die erste finale Variante vorwaehlen. */
export function selectStoryVersion(session, raw) {
  if (raw === 'final') {
    const finals = storyFinalVariants(session.current?.slot || {});
    session.story = { version: 'final', finalAssetId: finals[0]?.id || null };
  } else {
    session.story = { version: Number(raw), finalAssetId: null };
  }
}

/** Varianten-Select (9:16 / 4:5) der finalen Story-Version. */
export function selectStoryFinalVariant(session, assetId) {
  session.story = { ...session.story, finalAssetId: assetId };
}
