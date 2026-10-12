// briefingEinreichungen.js
// Eingang der Kunden-Einreichungen auf dem Briefing-Tab einer Produktion (ADR 0055).
// Offene Einreichungen stehen hier, nicht in der Briefing-Liste. Aktionen: Prüfen, Verwerfen.
// Der Zähler hängt am Tab "Briefing".

import { BEREICH_LABELS } from '../briefing/create/fieldConfig.js';
import {
  einreichungDatum,
  listOffeneEinreichungen,
  reviewUrl,
  verwirfEinreichung
} from './einreichungService.js';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function istStaff() {
  return window.isInternal?.() !== false;
}

/** Zähler am Tab "Briefing": Badge setzen oder entfernen. */
export function setzeEinreichungsZaehler(anzahl) {
  const tab = document.querySelector('[data-workflow-tab="briefing"]');
  if (!tab) return;
  let badge = tab.querySelector('[data-einreichung-count]');
  if (!anzahl) {
    badge?.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'tab-count';
    badge.dataset.einreichungCount = '';
    badge.title = 'Offene Kundeneinreichungen';
    tab.appendChild(badge);
  }
  badge.textContent = String(anzahl);
}

async function lade(detail) {
  if (detail.mode !== 'workflow' || !detail.produktionId || !istStaff()) return [];
  try {
    return await listOffeneEinreichungen({ art: 'briefing', produktionId: detail.produktionId });
  } catch (error) {
    console.warn('Einreichungen konnten nicht geladen werden:', error);
    return [];
  }
}

/** Nur den Zähler aktualisieren (z. B. wenn der Briefing-Tab nicht offen ist). */
export async function syncEinreichungsZaehler(detail) {
  const offen = await lade(detail);
  setzeEinreichungsZaehler(offen.length);
}

function renderZeile(einreichung) {
  const einladung = einreichung.einladung || {};
  const typ = BEREICH_LABELS[einladung.briefing_typ] || '';
  const meta = [einreichungDatum(einreichung), typ, einladung.label].filter(Boolean).join(' · ');
  return `
    <div class="einreichung-inbox__zeile" data-einreichung-id="${esc(einreichung.id)}">
      <div class="einreichung-inbox__info">
        <span class="einreichung-inbox__titel">Briefing von ${esc(einreichung.absender_name)}</span>
        <span class="einreichung-inbox__meta">${esc(meta)}</span>
      </div>
      <div class="einreichung-inbox__aktionen">
        <button type="button" class="mdc-btn" data-einreichung-pruefen>Prüfen</button>
        <button type="button" class="mdc-btn mdc-btn--secondary" data-einreichung-verwerfen>Verwerfen</button>
      </div>
    </div>`;
}

/** Eingang in `host` rendern. Ohne offene Einreichungen bleibt der Host verborgen. */
export async function mountEinreichungInbox(detail, host) {
  if (!host) return;
  const offen = await lade(detail);
  if (!host.isConnected) return;
  setzeEinreichungsZaehler(offen.length);

  if (!offen.length) {
    host.hidden = true;
    host.innerHTML = '';
    return;
  }

  host.hidden = false;
  host.innerHTML = `
    <div class="einreichung-inbox__kopf">
      <strong>Kundeneinreichungen</strong>
      <span class="einreichung-inbox__anzahl">${offen.length} offen</span>
    </div>
    ${offen.map(renderZeile).join('')}`;

  host.onclick = async (e) => {
    const zeile = e.target.closest('[data-einreichung-id]');
    if (!zeile) return;
    const einreichung = offen.find((x) => x.id === zeile.dataset.einreichungId);
    if (!einreichung) return;

    if (e.target.closest('[data-einreichung-pruefen]')) {
      window.navigateTo(reviewUrl(einreichung, { kampagneId: detail.kampagneId }));
      return;
    }

    if (e.target.closest('[data-einreichung-verwerfen]')) {
      const { confirmed } = (await window.confirmationModal?.open({
        title: 'Einreichung verwerfen',
        message: `Die Einreichung von ${einreichung.absender_name} wird verworfen. Hochgeladene Dateien werden gelöscht.`,
        confirmText: 'Verwerfen',
        cancelText: 'Abbrechen',
        danger: true
      })) || { confirmed: false };
      if (!confirmed) return;
      try {
        const ok = await verwirfEinreichung(einreichung);
        window.toastSystem?.[ok ? 'success' : 'warning'](
          ok ? 'Einreichung verworfen.' : 'Die Einreichung ist schon erledigt.'
        );
      } catch (error) {
        console.error('Verwerfen fehlgeschlagen:', error);
        window.toastSystem?.error('Verwerfen fehlgeschlagen.');
      }
      await mountEinreichungInbox(detail, host);
    }
  };
}
