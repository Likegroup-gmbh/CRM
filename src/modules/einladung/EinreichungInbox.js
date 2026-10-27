// EinreichungInbox.js
// Zentraler Eingang der Kunden-Einreichungen (ADR 0055, 0057). Briefing-Tab der Produktion,
// Produkte-Tab der Linie und die Produktliste rendern alle über diesen einen Pfad:
// Zeilen, Prüfen, Verwerfen und der Zähler am Tab. Was je Art anders ist, steht in ARTEN.
// Aktionen: Prüfen (Vollseite des jeweiligen Formulars), Verwerfen.

import { BEREICH_LABELS } from '../briefing/create/fieldConfig.js';
import {
  einreichungDatum,
  listOffeneEinreichungen,
  reviewUrl,
  verwirfEinreichung
} from './einreichungService.js';
import { ladeThumbs, renderProduktEinreichungTabelle } from './produktEinreichungTabelle.js';

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function istStaff() {
  return window.isInternal?.() !== false;
}

/**
 * Was je Art anders ist: Tab des Zählers, Zeilentitel, Meta und Verwerfen-Hinweis.
 * `zeigeLinie`: Hinweis „für Linie X“ nur dort, wo nicht schon die Linie selbst offen ist.
 */
export const ARTEN = {
  briefing: {
    tabId: 'briefing',
    titel: (e) => `Briefing von ${e.absender_name}`,
    meta: (e) => {
      const einladung = e.einladung || {};
      return [einreichungDatum(e), BEREICH_LABELS[einladung.briefing_typ] || '', einladung.label];
    },
    verwerfenHinweis: 'Hochgeladene Dateien werden gelöscht.'
  },
  produkt: {
    tabId: 'produkte',
    // Zeilen kommen als Tabelle aus produktEinreichungTabelle.js, nicht aus titel/meta.
    verwerfenHinweis: 'Hochgeladene Bilder werden gelöscht.'
  }
};

/** Zähler am Tab der Art: Badge setzen oder entfernen. Ohne Tab im DOM passiert nichts. */
export function setzeEinreichungsZaehler(art, anzahl) {
  const tab = document.querySelector(`[data-workflow-tab="${ARTEN[art].tabId}"]`);
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

/**
 * Offene Einreichungen der Art. `filter` null heißt: kein Kontext, nichts laden.
 * Fehler werden geloggt und ergeben eine leere Liste.
 */
async function ladeOffene(art, filter) {
  if (!filter || !istStaff()) return [];
  try {
    return await listOffeneEinreichungen({ art, ...filter });
  } catch (error) {
    console.warn(`Einreichungen (${art}) konnten nicht geladen werden:`, error);
    window.toastSystem?.warning('Kundeneinreichungen konnten nicht geladen werden.');
    return [];
  }
}

/** Nur den Zähler aktualisieren (z. B. wenn der Tab nicht offen ist). */
export async function syncEinreichungsZaehler(art, filter) {
  const offen = await ladeOffene(art, filter);
  setzeEinreichungsZaehler(art, offen.length);
}

function renderZeile(art, einreichung, optionen) {
  const konfig = ARTEN[art];
  const meta = konfig.meta(einreichung, optionen).filter(Boolean).join(' · ');
  return `
    <div class="einreichung-inbox__zeile" data-einreichung-id="${esc(einreichung.id)}">
      <div class="einreichung-inbox__info">
        <span class="einreichung-inbox__titel">${esc(konfig.titel(einreichung))}</span>
        <span class="einreichung-inbox__meta">${esc(meta)}</span>
      </div>
      <div class="einreichung-inbox__aktionen">
        <button type="button" class="mdc-btn" data-einreichung-pruefen>Prüfen</button>
        <button type="button" class="mdc-btn mdc-btn--secondary" data-einreichung-verwerfen>Verwerfen</button>
      </div>
    </div>`;
}

/**
 * Eingang in `host` rendern. Ohne offene Einreichungen bleibt der Host verborgen.
 * @param {{
 *   art: 'briefing'|'produkt',
 *   host: HTMLElement|null,
 *   filter: object|null,          // an listOffeneEinreichungen (produktionId, briefingId, markeId, unternehmenId)
 *   reviewKontext?: object,       // an reviewUrl (kampagneId)
 *   tabBadge?: boolean            // Zähler am Tab der Art mitführen
 * }} opts
 */
export async function mountEinreichungInbox({ art, host, filter, reviewKontext = {}, tabBadge = false }) {
  if (!host) return;
  const offen = await ladeOffene(art, filter);
  if (!host.isConnected) return;
  if (tabBadge) setzeEinreichungsZaehler(art, offen.length);

  if (!offen.length) {
    host.hidden = true;
    host.innerHTML = '';
    host.onclick = null;
    return;
  }

  const optionen = { zeigeLinie: !filter?.briefingId };
  const alsTabelle = art === 'produkt';
  const thumbs = alsTabelle ? await ladeThumbs(offen) : null;
  if (!host.isConnected) return;
  host.hidden = false;
  host.classList.toggle('einreichung-inbox--tabelle', alsTabelle);
  host.innerHTML = `
    ${alsTabelle ? '' : `<div class="einreichung-inbox__kopf">
      <strong>Kundeneinreichungen</strong>
      <span class="einreichung-inbox__anzahl">${offen.length} offen</span>
    </div>`}
    ${alsTabelle
      ? renderProduktEinreichungTabelle(offen, { thumbs, ...optionen })
      : offen.map((e) => renderZeile(art, e, optionen)).join('')}`;

  host.onclick = async (e) => {
    const zeile = e.target.closest('[data-einreichung-id]');
    const einreichung = zeile && offen.find((x) => x.id === zeile.dataset.einreichungId);
    if (!einreichung) return;

    if (e.target.closest('[data-einreichung-pruefen]')) {
      e.preventDefault();
      window.navigateTo(reviewUrl(einreichung, reviewKontext));
      return;
    }

    if (e.target.closest('[data-einreichung-verwerfen]')) {
      const { confirmed } = (await window.confirmationModal?.open({
        title: 'Einreichung verwerfen',
        message: `Die Einreichung von ${einreichung.absender_name} wird verworfen. ${ARTEN[art].verwerfenHinweis}`,
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
      await mountEinreichungInbox({ art, host, filter, reviewKontext, tabBadge });
    }
  };
}
