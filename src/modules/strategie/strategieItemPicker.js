// strategieItemPicker.js
// Gruppierte Optionen fuer Strategie-Item-Selects (Drawer + Skript-Generator).
// Filter/Subtitle kommen vom Caller, der Builder sortiert und formatiert nur.

export function truncateText(text, max = 80) {
  const s = String(text || '').trim();
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

export function buildPickerOptions(items, { strategieMap = null, subtitleFor } = {}) {
  const options = [];

  (items || []).forEach((item) => {
    const strategie = resolveStrategie(item, strategieMap);
    const subtitle = subtitleFor ? subtitleFor(item) : null;
    options.push({
      value: item.id,
      label: truncateText(item.beschreibung),
      group: strategie?.name || 'Strategie',
      ...(subtitle ? { subtitle } : {})
    });
  });

  return sortPickerOptions(options);
}

/** Drawer: freie Items + das am aktuellen Video haengende. */
export function buildStrategieItemPickerOptions(strategien, items, linkedByItemId, currentVideoId) {
  const strategieMap = new Map((strategien || []).map((s) => [s.id, s]));
  const filtered = (items || []).filter((item) => {
    const linkedVideoId = linkedByItemId.get(item.id);
    return !linkedVideoId || linkedVideoId === currentVideoId;
  });

  return buildPickerOptions(filtered, {
    strategieMap,
    subtitleFor: (item) => (item.video_link ? 'Mit Referenz-Video' : 'Idee ohne Link')
  });
}

/** Skript-Generator: alle umsetzbaren Items der Kampagne, Transkript sichtbar. */
export function buildSkriptVorlagePickerOptions(items) {
  const usable = (items || []).filter((item) => !item.nicht_umsetzen);
  return buildPickerOptions(usable, {
    subtitleFor: (item) => {
      const base = item.video_link ? 'Mit Referenz-Video' : 'Idee ohne Link';
      // transkript_quelle als schlankes Flag - das Transkript selbst laedt
      // der Picker nicht (kommt beim Select bzw. serverseitig aus der DB)
      const hatTranskript = item.transkript_quelle || (item.transkript || '').trim();
      return hatTranskript ? `${base} · Mit Transkript` : base;
    }
  });
}
