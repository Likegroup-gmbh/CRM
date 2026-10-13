// produktEinreichungen.js
// Produktliste: Button „Kunde einladen“ und Eingang der offenen Produkt-Einreichungen (ADR 0055).
// Der Button gilt für den Kontext der Liste: Marke, sonst Unternehmen. Der Eingang zeigt die
// offenen Einreichungen dieses Kontexts; ohne Kontext (Unternehmensübersicht) alle.

import { openEinladungDialog } from './EinladungDrawer.js';
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

/** Kontext der Liste: Marke vor Unternehmen. */
export function einladungsKontext(list) {
  const unternehmenId = list.embedScope?.unternehmenId || list.currentUnternehmenId || null;
  const markeId = list.embedScope?.markeId || (list._ohneMarke ? null : list.currentMarkeId) || null;
  const name = markeId
    ? [list.currentUnternehmenName, list.currentMarkeName].filter(Boolean).join(' · ')
    : (list.currentUnternehmenName || '');
  return { unternehmenId, markeId, name };
}

function renderZeile(einreichung) {
  const einladung = einreichung.einladung || {};
  const produktName = einreichung.payload?.formData?.name || 'Produkt';
  const wo = [einladung.unternehmen?.firmenname, einladung.marke?.markenname].filter(Boolean).join(' · ');
  const meta = [einreichungDatum(einreichung), `von ${einreichung.absender_name}`, wo].filter(Boolean).join(' · ');
  return `
    <div class="einreichung-inbox__zeile" data-einreichung-id="${esc(einreichung.id)}">
      <div class="einreichung-inbox__info">
        <span class="einreichung-inbox__titel">${esc(produktName)}</span>
        <span class="einreichung-inbox__meta">${esc(meta)}</span>
      </div>
      <div class="einreichung-inbox__aktionen">
        <button type="button" class="mdc-btn" data-einreichung-pruefen>Prüfen</button>
        <button type="button" class="mdc-btn mdc-btn--secondary" data-einreichung-verwerfen>Verwerfen</button>
      </div>
    </div>`;
}

async function renderInbox(list, host, kontext) {
  let offen = [];
  try {
    offen = await listOffeneEinreichungen({
      art: 'produkt',
      markeId: kontext.markeId,
      unternehmenId: kontext.unternehmenId
    });
  } catch (error) {
    console.warn('Produkt-Einreichungen konnten nicht geladen werden:', error);
  }
  if (!host.isConnected) return;

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
    const einreichung = zeile && offen.find((x) => x.id === zeile.dataset.einreichungId);
    if (!einreichung) return;

    if (e.target.closest('[data-einreichung-pruefen]')) {
      window.navigateTo(reviewUrl(einreichung));
      return;
    }
    if (e.target.closest('[data-einreichung-verwerfen]')) {
      const { confirmed } = (await window.confirmationModal?.open({
        title: 'Einreichung verwerfen',
        message: `Die Einreichung von ${einreichung.absender_name} wird verworfen. Hochgeladene Bilder werden gelöscht.`,
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
      await renderInbox(list, host, kontext);
    }
  };
}

/**
 * Nach dem Rendern der Produktliste aufrufen (Grid und Liste).
 * Setzt den Button in `.table-actions` und den Eingang unter die Filterleiste. Idempotent.
 */
export async function mountProduktEinladung(list, root = list.mountRoot || document) {
  // Die eingebettete Liste einer Produktion (Produkte-Tab) hat keinen Eingang.
  if (!istStaff() || !list.canEdit || list.embedScope) return;
  const kontext = einladungsKontext(list);

  const actions = root.querySelector('.table-actions');
  if (actions && kontext.unternehmenId && !actions.querySelector('#btn-produkt-einladen')) {
    actions.insertAdjacentHTML(
      'afterbegin',
      '<button type="button" id="btn-produkt-einladen" class="mdc-btn mdc-btn--secondary">Kunde einladen</button>'
    );
    actions.querySelector('#btn-produkt-einladen').addEventListener('click', () => {
      openEinladungDialog({
        art: 'produkt',
        unternehmenId: kontext.unternehmenId,
        markeId: kontext.markeId,
        kontextName: kontext.name
      });
    });
  }

  const anker = root.querySelector('.table-filter-wrapper');
  if (!anker) return;
  let host = root.querySelector('[data-produkt-einreichungen]');
  if (!host) {
    host = document.createElement('div');
    host.className = 'einreichung-inbox';
    host.dataset.produktEinreichungen = '';
    host.hidden = true;
    anker.insertAdjacentElement('afterend', host);
  }
  await renderInbox(list, host, kontext);
}
