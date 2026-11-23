// skriptWahlSwitch.js
// Skriptwahl rechts in der Workflow-Tab-Zeile, solange ein Skript offen ist (ADR 0074).
// Gleiches Dropdown wie die Casting- und Konzept-Listen (linienScope), je Eintrag
// Titel, Creator und Status. "Alle Skripte" führt zurück zur Tabelle.

import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml, STATUS_LABELS, STATUS_TAG_VARIANT } from '../skripte/SkripteUtils.js';
import { creatorDisplayName, creatorsFuerListe } from '../skripte/editor/SkriptEditorDocRenderer.js';

export const SKRIPT_WAHL_ATTR = 'data-skript-wahl';

export function skriptTitel(skript) {
  return String(skript?.titel || skript?.hook?.slice(0, 50) || '(ohne Titel)');
}

function statusTag(status) {
  if (!status) return '';
  const variant = STATUS_TAG_VARIANT[status] || 'tag--type';
  return `<span class="tag tag--status ${variant}">${escapeHtml(STATUS_LABELS[status] || status)}</span>`;
}

function eintragHtml(skript, { aktiv, creator }) {
  const titel = [skript.skript_nr ? `${skript.skript_nr}.` : '', skriptTitel(skript)].filter(Boolean).join(' ');
  return `
    <button type="button" class="linien-switch__item skript-wahl__item${aktiv ? ' active' : ''}" role="option"
      aria-selected="${aktiv ? 'true' : 'false'}" ${SKRIPT_WAHL_ATTR}="${escapeHtml(skript.id)}" title="${escapeHtml(titel)}">
      <span class="skript-wahl__text">
        <span class="linien-switch__name">${escapeHtml(titel)}</span>
        ${creator ? `<span class="skript-wahl__creator">${escapeHtml(creator)}</span>` : ''}
      </span>
      ${statusTag(skript.status)}
    </button>`;
}

/**
 * @param {{ items: object[], aktivId: string|null, verknuepfungenFuer: (s: object) => object[] }} opts
 */
export function renderSkriptWahl({ items, aktivId, verknuepfungenFuer = () => [] }) {
  const liste = items || [];
  const aktiv = liste.find((s) => s.id === aktivId) || null;
  const label = aktiv ? skriptTitel(aktiv) : 'Skript wählen';
  const eintraege = liste.map((s) => {
    const creators = creatorsFuerListe(s, verknuepfungenFuer(s) || []);
    const creator = creators.map(creatorDisplayName).join(', ');
    return eintragHtml(s, { aktiv: s.id === aktivId, creator });
  }).join('');

  return `
    <div class="linien-switch linien-switch--liste skript-wahl" data-linien-switch data-liste-switch>
      <button type="button" class="linien-switch__trigger" data-linien-toggle aria-haspopup="listbox" aria-expanded="false" title="Skript wechseln">
        <span class="linien-switch__label">${escapeHtml(label)}</span>
        <span class="linien-switch__chevron">${icon('chevron-down')}</span>
      </button>
      <div class="linien-switch__menu skript-wahl__menu" role="listbox" data-linien-menu>
        <button type="button" class="linien-switch__item skript-wahl__alle" role="option" aria-selected="false" ${SKRIPT_WAHL_ATTR}="">
          <span class="linien-switch__name">Alle Skripte</span>
        </button>
        ${eintraege}
      </div>
    </div>`;
}
