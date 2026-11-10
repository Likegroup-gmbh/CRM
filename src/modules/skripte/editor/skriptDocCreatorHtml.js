// skriptDocCreatorHtml.js
// Creator und Videos am Skript: Aufloesung, Sidebar-Sortierung, Bubbles und Chips im Doc-Kopf.

import { escapeHtml } from '../SkripteUtils.js';
import { icon } from '../../../core/icons/IconSystem.js';
import { avatarBubbles } from '../../../core/components/AvatarBubbles.js';
import { tauschSkriptButtonHtml } from './skriptTauschBanner.js';

function creatorDisplayName(creator) {
  const crm = `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim();
  return crm || creator?.name || 'Creator';
}

/** Creator am Skript: Name aus dem Casting, sonst Stammdaten, sonst Altbestand.
 *  Vorname und Nachname bleiben leer, sobald der Casting-Name gilt, damit
 *  Listen und Chips nicht weiter den alten Stammdaten-Namen zeigen. */
export function konzeptCreatorFromSkript(skript) {
  const item = skript?.strategie_item;
  if (!item) return null;
  const eintrag = item.casting_eintrag;
  const crm = eintrag?.creator;
  const castingName = String(eintrag?.name || '').trim();
  const crmName = `${crm?.vorname || ''} ${crm?.nachname || ''}`.trim();
  const name = castingName || crmName || String(item.creator_name || '').trim();
  if (!name) return null;
  const stammdatenZeigen = !castingName;
  return {
    id: crm?.id || null,
    vorname: stammdatenZeigen ? (crm?.vorname || '') : '',
    nachname: stammdatenZeigen ? (crm?.nachname || '') : '',
    name,
    profilbild_url: crm?.profilbild_url || null,
    profilbild_thumb_url: crm?.profilbild_thumb_url || null
  };
}

/** Sidebar: Video-/Konzept-Creator, sonst die Gast-Anzeige (liste_creators). */
export function creatorsFuerListe(skript, verknuepfungen) {
  const resolved = creatorsFuerKopf(verknuepfungen, konzeptCreatorFromSkript(skript));
  if (resolved.length) return resolved;
  return Array.isArray(skript?.liste_creators) ? skript.liste_creators : [];
}

/**
 * Sidebar-Reihenfolge: nach Creator (A-Z), darin nach Videonummer aufsteigend
 * (Video 1, 2, 3 ...). Skripte ohne Creator kommen ans Ende, Skripte ohne
 * Videonummer hinter die nummerierten ihres Creators; sonst bleibt die
 * Eingangsreihenfolge (neueste zuerst) erhalten.
 * `verknuepfungenFuer(skript)` liefert die Video-Zeilen je Skript.
 */
export function sortListeSkripte(skripte, verknuepfungenFuer) {
  const rows = (skripte || []).map((skript, index) => {
    const verknuepfungen = verknuepfungenFuer(skript) || [];
    const creators = creatorsFuerListe(skript, verknuepfungen);
    const positionen = verknuepfungen
      .map((v) => (v?.position == null || v.position === '' ? NaN : Number(v.position)))
      .filter(Number.isFinite);
    return {
      skript,
      index,
      creator: creators.length ? creatorDisplayName(creators[0]) : null,
      position: positionen.length ? Math.min(...positionen) : null
    };
  });
  rows.sort((a, b) => {
    if ((a.creator === null) !== (b.creator === null)) return a.creator === null ? 1 : -1;
    if (a.creator !== null) {
      const byName = a.creator.localeCompare(b.creator, 'de', { sensitivity: 'base' });
      if (byName) return byName;
    }
    if ((a.position === null) !== (b.position === null)) return a.position === null ? 1 : -1;
    if (a.position !== null && a.position !== b.position) return a.position - b.position;
    return a.index - b.index;
  });
  return rows.map((r) => r.skript);
}

export function creatorsFuerKopf(verknuepfungen, konzeptCreator) {
  const proCreator = new Map();
  for (const row of verknuepfungen || []) {
    const creator = row.kooperation?.creator;
    if (!creator) continue;
    const key = creator.id || creatorDisplayName(creator);
    if (!proCreator.has(key)) proCreator.set(key, creator);
  }
  if (proCreator.size) return [...proCreator.values()];
  return konzeptCreator ? [konzeptCreator] : [];
}

function creatorBubblesHtml(creators) {
  return avatarBubbles.renderBubbles(creators.map((c) => ({
    name: creatorDisplayName(c),
    type: 'person',
    profile_image_url: c.profilbild_thumb_url || c.profilbild_url || null
  })), { maxVisible: creators.length });
}

/** Sidebar-Zeile: Bubble + Name, kein Button (die Zeile ist schon ein Link). */
export function listeCreatorHtml(creators) {
  if (!creators?.length) return '';
  const namen = creators.map(creatorDisplayName).join(', ');
  return `
    <span class="skripte-editor-liste-creator" title="${escapeHtml(namen)}">
      <span class="skripte-editor-liste-creator-bubbles">${creatorBubblesHtml(creators)}</span>
      <span class="skripte-editor-liste-creator-name">${escapeHtml(namen)}</span>
    </span>`;
}

function creatorChipHtml(creators) {
  const namen = creators.map(creatorDisplayName).join(', ');
  return `
    <button type="button" class="skripte-editor-zuweisen-chip" id="ed-skript-zuweisen"
      title="${escapeHtml(namen)}">
      <span class="skripte-editor-zuweisen-bubbles">${creatorBubblesHtml(creators)}</span>
      <span class="skripte-editor-zuweisen-name">${escapeHtml(namen)}</span>
    </button>`;
}

/** "Video 2/4" je verknuepftem Video; ohne Position kein Label. */
function videoLabel(row) {
  const pos = row?.position;
  if (pos == null || pos === '') return '';
  const total = row.kooperation?.videoanzahl;
  return total ? `Video ${pos}/${total}` : `Video ${pos}`;
}

/** Reiner Anzeige-Chip neben dem Creator-Chip. */
function videoChipHtml(verknuepfungen) {
  const label = (verknuepfungen || []).map(videoLabel).filter(Boolean).join(', ');
  if (!label) return '';
  return `<span class="skripte-editor-video-chip" title="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
}

/** Sidebar-Zeile: Video-Tag ("Video 2/4") unter dem Titel; ohne Position leer. */
export function listeVideoHtml(verknuepfungen) {
  const label = (verknuepfungen || []).map(videoLabel).filter(Boolean).join(', ');
  if (!label) return '';
  return `<span class="skripte-editor-liste-video" title="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
}

/** Doc-Kopf: Zuweisen-CTA oder Chip (Bubble + Name) plus Video-Chip. */
export function verknuepfungenHtml({
  verknuepfungen = [], konzeptCreator = null, kannZuweisen = false
} = {}) {
  if (!kannZuweisen) return '';
  const creators = creatorsFuerKopf(verknuepfungen, konzeptCreator);
  if (!creators.length) {
    return `
      <button type="button" class="mdc-btn mdc-btn--secondary skripte-editor-zuweisen-btn" id="ed-skript-zuweisen"
        title="Creator zuweisen">
        <span class="mdc-btn__icon">${icon('user-add')}</span>
        <span class="mdc-btn__label">Creator zuweisen</span>
      </button>`;
  }
  return creatorChipHtml(creators) + videoChipHtml(verknuepfungen) + tauschSkriptButtonHtml();
}
