// skriptWahlSwitch.js
// Skriptwahl rechts in der Workflow-Tab-Zeile, solange ein Skript offen ist (ADR 0074).
// Einträge für detailWahlSwitch: Titel, Creator und Status. "Alle Skripte" führt zur Tabelle.

import { escapeHtml, STATUS_LABELS, STATUS_TAG_VARIANT } from '../skripte/SkripteUtils.js';
import { creatorDisplayName, creatorsFuerListe } from '../skripte/editor/SkriptEditorDocRenderer.js';
import { renderDetailWahl } from './detailWahlSwitch.js';

export const SKRIPT_WAHL_ATTR = 'data-skript-wahl';

export function skriptTitel(skript) {
  return String(skript?.titel || skript?.hook?.slice(0, 50) || '(ohne Titel)');
}

function statusTag(status) {
  if (!status) return '';
  const variant = STATUS_TAG_VARIANT[status] || 'tag--type';
  return `<span class="tag tag--status ${variant}">${escapeHtml(STATUS_LABELS[status] || status)}</span>`;
}

/**
 * @param {{ items: object[], aktivId: string|null, verknuepfungenFuer: (s: object) => object[] }} opts
 */
export function renderSkriptWahl({ items, aktivId, verknuepfungenFuer = () => [] }) {
  const eintraege = (items || []).map((s) => ({
    id: s.id,
    label: [s.skript_nr ? `${s.skript_nr}.` : '', skriptTitel(s)].filter(Boolean).join(' '),
    triggerLabel: skriptTitel(s),
    sub: creatorsFuerListe(s, verknuepfungenFuer(s) || []).map(creatorDisplayName).join(', '),
    tagHtml: statusTag(s.status)
  }));
  return renderDetailWahl({
    attr: SKRIPT_WAHL_ATTR,
    items: eintraege,
    aktivId,
    alleLabel: 'Alle Skripte',
    leerLabel: 'Skript wählen',
    title: 'Skript wechseln'
  });
}
