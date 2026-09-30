// strategieItemPicker.js
// Gruppierte Optionen fuer Strategie-Item-Selects (Skript-Generator).
// Filter/Subtitle kommen vom Caller, der Builder sortiert und formatiert nur.

import { beschreibungErstzeile } from './videoideeVorschlag.js';

export function truncateText(text, max = 80) {
  const s = beschreibungErstzeile(text) || String(text || '').trim();
  if (s.length <= max) return s || 'Ohne Beschreibung';
  return `${s.slice(0, max - 1)}…`;
}

function resolveStrategie(item, strategieMap) {
  if (item.strategie?.name) return item.strategie;
  return strategieMap?.get(item.strategie_id) || null;
}

function sortPickerOptions(options) {
  return options.sort((a, b) => {
    const g = a.group.localeCompare(b.group, 'de');
    if (g !== 0) return g;
    return a.label.localeCompare(b.label, 'de');
  });
}

export function buildPickerOptions(items, { strategieMap = null, subtitleFor, groupFor } = {}) {
  const options = [];

  (items || []).forEach((item) => {
    const strategie = resolveStrategie(item, strategieMap);
    const subtitle = subtitleFor ? subtitleFor(item) : null;
    options.push({
      value: item.id,
      label: truncateText(item.beschreibung),
      group: groupFor ? groupFor(item, strategie) : (strategie?.name || 'Konzept'),
      ...(subtitle ? { subtitle } : {})
    });
  });

  return sortPickerOptions(options);
}

function creatorLabel(item) {
  const eintrag = item.casting_eintrag;
  if (eintrag?.name) return eintrag.name;
  const c = eintrag?.creator;
  if (c) return `${c.vorname || ''} ${c.nachname || ''}`.trim();
  return item.creator_name || 'Creator';
}

/** Create-Drawer: freigegebene Ideen eines Konzepts. */
export function buildFreigegebeneVideoideePickerOptions(items) {
  const usable = (items || []).filter((item) => item.skript_freigabe && !item.nicht_umsetzen && !item.ist_vorschlag);
  return buildPickerOptions(usable, {
    groupFor: (item, strategie) => strategie?.name || 'Konzept',
    subtitleFor: (item) => {
      const teile = [creatorLabel(item)];
      if (item.hasSkript) teile.push('hat bereits Skript');
      return teile.join(' · ');
    }
  });
}
