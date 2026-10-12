// ProduktionBriefingDrawer.js
// Auf der Produktion: Titel (Basis = Produktionsname, sonst Projektname, + optionaler Zusatz), dann Briefing-Anlage.
// Das Produkt entsteht danach.
// Zwei Wege: "Neu" geht ins Briefing-Formular, "Aus Briefing kopieren" legt sofort ein
// Duplikat eines Briefings der Kampagne in dieser Produktion an.

import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { EntitySearchInput } from '../../core/components/EntitySearchInput.js';
import { duplicateBriefingMitHinweis, listKopierQuellen } from '../briefing/duplicateBriefing.js';
import { briefingBasis, briefingTitel, freierTitel, kopieTitel } from './produktionNames.js';

function esc(value) {
  return window.validatorSystem?.sanitizeHtml(String(value ?? '')) || '';
}

const ZUSATZ_PLATZHALTER_NEU = 'z.B. Serum Launch';
const ZUSATZ_PLATZHALTER_KOPIE = 'leer lässt „– Kopie“ anhängen';

export async function openProduktionBriefingDrawer(detail, { produktionId = null } = {}) {
  const k = detail.kampagneData || {};
  const produktionName = detail.produktion?.name || detail.lineTitle || '';
  const basis = briefingBasis(k, produktionName) || KampagneUtils.getDisplayName(k) || '';
  // Das Duplikat landet immer in der aktuellen Produktion
  const zielProduktionId = produktionId || detail.produktionId || null;
  const vorhandeneTitel = () => (detail.linien || []).map(l => l.name);

  const modal = document.createElement('div');
  modal.className = 'modal overlay-modal';
  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3>Briefing anlegen</h3>
        <button type="button" class="modal-close" data-action="close">×</button>
      </div>
      <form class="modal-body" id="produktion-briefing-form">
        <div class="form-field">
          <div class="view-toggle" data-modus-toggle>
            <button type="button" class="mdc-btn mdc-btn--secondary active" data-modus="neu">Neu</button>
            <button type="button" class="mdc-btn mdc-btn--secondary" data-modus="kopie">Aus Briefing kopieren</button>
          </div>
        </div>
        <div class="form-field" data-quelle-feld hidden>
          <label>Briefing der Kampagne</label>
          <div data-quelle-suche></div>
          <div class="briefing-quelle-chip" data-quelle-chip hidden>
            <span class="briefing-quelle-chip__text">
              <span class="briefing-quelle-chip__label" data-quelle-label></span>
              <span class="briefing-quelle-chip__sub" data-quelle-sub></span>
            </span>
            <button type="button" class="briefing-quelle-chip__remove" data-quelle-entfernen aria-label="Auswahl entfernen">×</button>
          </div>
        </div>
        <div class="form-field">
          <label for="produktion-briefing-basis">Projektname</label>
          <input id="produktion-briefing-basis" name="basis" class="form-input" value="${esc(basis)}" readonly>
        </div>
        <div class="form-field">
          <label for="produktion-briefing-zusatz">Zusatz (optional)</label>
          <input id="produktion-briefing-zusatz" name="zusatz" class="form-input" placeholder="${ZUSATZ_PLATZHALTER_NEU}" autocomplete="off">
          <small class="form-hint" data-vorschau></small>
        </div>
      </form>
      <div class="modal-footer">
        <button type="button" class="mdc-btn mdc-btn--secondary" data-action="cancel">Abbrechen</button>
        <button type="button" class="mdc-btn" data-action="confirm">Weiter zum Briefing</button>
      </div>
    </div>`;

  const form = modal.querySelector('form');
  const zusatzInput = modal.querySelector('[name="zusatz"]');
  const vorschau = modal.querySelector('[data-vorschau]');
  const confirmBtn = modal.querySelector('[data-action="confirm"]');
  const quelleFeld = modal.querySelector('[data-quelle-feld]');
  const quelleSuche = modal.querySelector('[data-quelle-suche]');
  const quelleChip = modal.querySelector('[data-quelle-chip]');
  const kopieBtn = modal.querySelector('[data-modus="kopie"]');

  let modus = 'neu';
  let quelle = null;
  let suche = null;

  const zusatz = () => zusatzInput.value.trim();

  const aktuellerTitel = () => {
    if (modus === 'kopie') {
      if (zusatz()) return freierTitel(briefingTitel(basis, zusatz()), vorhandeneTitel());
      return quelle ? kopieTitel(quelle.label, vorhandeneTitel()) : '';
    }
    return briefingTitel(basis, zusatz());
  };

  const aktualisiere = () => {
    const titel = aktuellerTitel();
    vorschau.textContent = titel ? `Titel: ${titel}` : '';
    if (modus === 'kopie') confirmBtn.disabled = !quelle;
    else confirmBtn.disabled = false;
  };

  const zeigeQuelle = () => {
    quelleChip.hidden = !quelle;
    if (quelle) {
      quelleChip.querySelector('[data-quelle-label]').textContent = quelle.label;
      quelleChip.querySelector('[data-quelle-sub]').textContent = quelle.sub || '';
    }
    aktualisiere();
  };

  const mountSuche = () => {
    if (suche) return;
    suche = new EntitySearchInput({
      placeholder: 'Briefing suchen …',
      emptyText: 'Kein Briefing gefunden',
      persistent: true,
      search: (term) => listKopierQuellen(detail.kampagneId, term),
      onSelect: (item) => {
        quelle = item;
        zeigeQuelle();
      }
    });
    suche.mount(quelleSuche);
  };

  const setzeModus = (neuerModus) => {
    modus = neuerModus;
    modal.querySelectorAll('[data-modus]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.modus === modus);
    });
    const kopie = modus === 'kopie';
    quelleFeld.hidden = !kopie;
    confirmBtn.textContent = kopie ? 'Duplizieren' : 'Weiter zum Briefing';
    zusatzInput.placeholder = kopie ? ZUSATZ_PLATZHALTER_KOPIE : ZUSATZ_PLATZHALTER_NEU;
    if (kopie) mountSuche();
    aktualisiere();
  };

  zusatzInput.addEventListener('input', aktualisiere);
  form.addEventListener('submit', (e) => e.preventDefault());
  modal.querySelectorAll('[data-modus]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!btn.disabled) setzeModus(btn.dataset.modus);
    });
  });
  modal.querySelector('[data-quelle-entfernen]').addEventListener('click', () => {
    quelle = null;
    zeigeQuelle();
  });
  aktualisiere();

  const close = () => {
    suche?.destroy();
    modal.remove();
  };
  modal.querySelector('[data-action="close"]').onclick = close;
  modal.querySelector('[data-action="cancel"]').onclick = close;

  const weiterZumFormular = () => {
    const titel = aktuellerTitel();
    if (!titel) {
      window.toastSystem?.show('Titel ist Pflicht.', 'warning');
      return;
    }
    const params = new URLSearchParams({
      unternehmen: k.unternehmen_id || '',
      marke: k.marke_id || '',
      kampagne: detail.kampagneId || '',
      titel
    });
    if (produktionId) params.set('produktion', produktionId);
    close();
    window.navigateTo(`/briefing/new?${params.toString()}`);
  };

  const dupliziere = async () => {
    if (!quelle) {
      window.toastSystem?.show('Bitte ein Briefing zum Kopieren wählen.', 'warning');
      return;
    }
    confirmBtn.disabled = true;
    const kopie = await duplicateBriefingMitHinweis(quelle.id, {
      produktionId: zielProduktionId,
      titel: zusatz() ? briefingTitel(basis, zusatz()) : null
    });
    if (!kopie) {
      confirmBtn.disabled = false;
      return;
    }
    close();
    if (detail.mode === 'workflow' && typeof detail.reloadLinien === 'function') {
      await detail.reloadLinien({ linieId: kopie.id });
    } else {
      window.navigateTo(`/produktion/${kopie.produktion_id}?tab=briefing&linie=${kopie.id}`);
    }
  };

  confirmBtn.onclick = () => {
    if (modus === 'kopie') void dupliziere();
    else weiterZumFormular();
  };

  document.body.appendChild(modal);

  // Kopieren geht nur in eine konkrete Produktion und nur, wenn die Kampagne schon ein Briefing hat
  if (!zielProduktionId) {
    kopieBtn.disabled = true;
    kopieBtn.title = 'Kopieren geht nur innerhalb einer Produktion';
    return;
  }
  try {
    const vorhanden = await listKopierQuellen(detail.kampagneId, '');
    if (!vorhanden.length) {
      kopieBtn.disabled = true;
      kopieBtn.title = 'In dieser Kampagne gibt es noch kein Briefing zum Kopieren';
    }
  } catch (error) {
    console.error('Kopier-Quellen konnten nicht geprüft werden:', error);
  }
}
