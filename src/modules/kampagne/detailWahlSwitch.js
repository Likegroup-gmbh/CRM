// detailWahlSwitch.js
// Wahl rechts in der Workflow-Tab-Zeile, solange ein Tab eine Ansicht zeigt (ADR 0074, 0079):
// Skript, Produkt, Persona. Gleiches Dropdown wie die Casting- und Konzept-Listen
// (linienScope, bindListenSwitch). Der erste Eintrag ("Alle …", Wert '') führt zur Liste.

import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml } from '../../core/format.js';

function eintragHtml(item, attr, aktiv) {
  return `
    <button type="button" class="linien-switch__item detail-wahl__item${aktiv ? ' active' : ''}" role="option"
      aria-selected="${aktiv ? 'true' : 'false'}" ${attr}="${escapeHtml(item.id)}" title="${escapeHtml(item.label)}">
      <span class="detail-wahl__text">
        <span class="linien-switch__name">${escapeHtml(item.label)}</span>
        ${item.sub ? `<span class="detail-wahl__sub">${escapeHtml(item.sub)}</span>` : ''}
      </span>
      ${item.tagHtml || ''}
    </button>`;
}

/**
 * @param {object} opts
 * @param {string} opts.attr       Attribut der Einträge, dasselbe bekommt bindListenSwitch
 * @param {{ id: string, label: string, triggerLabel?: string, sub?: string, tagHtml?: string }[]} opts.items
 *   tagHtml ist fertiges Markup (z. B. Status-Tag)
 * @param {string|null} opts.aktivId
 * @param {string} opts.alleLabel  z. B. "Alle Skripte"
 * @param {string} opts.leerLabel  Trigger, solange nichts gewählt ist
 * @param {string} [opts.title]    Tooltip des Triggers
 */
export function renderDetailWahl({ attr, items, aktivId, alleLabel, leerLabel, title = 'Wechseln' }) {
  const liste = items || [];
  const aktiv = liste.find((item) => item.id === aktivId) || null;
  const label = aktiv ? (aktiv.triggerLabel || aktiv.label) : leerLabel;
  const eintraege = liste.map((item) => eintragHtml(item, attr, item.id === aktivId)).join('');

  return `
    <div class="linien-switch linien-switch--liste detail-wahl" data-linien-switch data-liste-switch>
      <button type="button" class="linien-switch__trigger" data-linien-toggle aria-haspopup="listbox" aria-expanded="false" title="${escapeHtml(title)}">
        <span class="linien-switch__label">${escapeHtml(label)}</span>
        <span class="linien-switch__chevron">${icon('chevron-down')}</span>
      </button>
      <div class="linien-switch__menu detail-wahl__menu" role="listbox" data-linien-menu>
        <button type="button" class="linien-switch__item detail-wahl__alle" role="option" aria-selected="false" ${attr}="">
          <span class="linien-switch__name">${escapeHtml(alleLabel)}</span>
        </button>
        ${eintraege}
      </div>
    </div>`;
}
