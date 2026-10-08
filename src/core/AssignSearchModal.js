// AssignSearchModal.js
// Gemeinsame Hülle für "Suchen, auswählen, zuordnen"-Modals im Actions-Dropdown.
// Der Aufrufer liefert nur Texte, Suche, Item-Darstellung und die Speicher-Aktion.

import { icon } from './icons/IconSystem.js';

export const esc = (value) => {
  const sanitize = window.validatorSystem?.sanitizeHtml;
  return sanitize ? sanitize.call(window.validatorSystem, value ?? '') : (value ?? '');
};

export const errorWithMessage = (err) => 'Fehler beim Hinzufügen: ' + (err?.message || 'Unbekannter Fehler');

function buildModalHtml({ idPrefix, searchId, dropdownId, title, fieldLabel, placeholder, confirmLabel }) {
  return `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" id="${idPrefix}-close">×</button>
      </div>
      <div class="modal-body">
        <label class="form-label">${fieldLabel}</label>
        <input type="text" id="${searchId}" class="form-input auto-suggest-input" placeholder="${placeholder}" />
        <div id="${dropdownId}" class="auto-suggest-dropdown auto-suggest-dropdown--modal"></div>
      </div>
      <div class="modal-footer">
        <button class="mdc-btn mdc-btn--cancel" id="${idPrefix}-cancel">
          <span class="mdc-btn__icon" aria-hidden="true">
            ${icon('x-circle-filled')}
          </span>
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button class="mdc-btn mdc-btn--create" id="${idPrefix}-confirm" disabled>
          <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
            ${icon('check-filled')}
          </span>
          <span class="mdc-btn__spinner" aria-hidden="true">
            <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16"><circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/></svg>
          </span>
          <span class="mdc-btn__label">${confirmLabel}</span>
        </button>
      </div>
    </div>`;
}

/**
 * @param {object} opts
 * @param {string} opts.idPrefix        ID-Präfix für Close/Cancel/Confirm (`${idPrefix}-close` usw.)
 * @param {string} opts.searchId        ID des Suchfelds
 * @param {string} opts.dropdownId      ID der Trefferliste (CSS hängt daran)
 * @param {string} opts.title
 * @param {string} opts.fieldLabel
 * @param {string} opts.placeholder
 * @param {string} opts.confirmLabel
 * @param {string} opts.emptyText       Text bei 0 Treffern
 * @param {string} [opts.hint]          Gesetzt: Liste erst nach Eingabe, Hinweistext vorher.
 *                                      Nicht gesetzt: Liste lädt sofort mit search('').
 * @param {boolean} [opts.inlineDropdown] Liste im Fluss statt absolut positioniert
 * @param {() => Promise<void>} [opts.prepare] Läuft vor dem Öffnen (z. B. Ausschluss-IDs laden)
 * @param {(term: string) => Promise<object[]>} opts.search
 * @param {(item: object) => string} opts.renderItem  Inner-HTML eines Treffers (bereits escaped)
 * @param {(id: string) => Promise<void>} opts.onConfirm  Speichern + Events; wirft bei Fehler
 * @param {string} opts.successAlert
 * @param {string | ((err: Error) => string)} opts.errorAlert
 */
export async function openAssignSearchModal(opts) {
  const {
    idPrefix, searchId, dropdownId, title, fieldLabel, placeholder, confirmLabel,
    emptyText, hint = null, inlineDropdown = false, prepare, search, renderItem,
    onConfirm, successAlert, errorAlert
  } = opts;

  await prepare?.();

  const modal = document.createElement('div');
  modal.className = 'modal overlay-modal';
  modal.innerHTML = buildModalHtml({ idPrefix, searchId, dropdownId, title, fieldLabel, placeholder, confirmLabel });
  document.body.appendChild(modal);

  const input = modal.querySelector(`#${searchId}`);
  const ddEl = modal.querySelector(`#${dropdownId}`);
  const confirmBtn = modal.querySelector(`#${idPrefix}-confirm`);
  let selectedId = null;

  const renderItems = (items) => {
    ddEl.innerHTML = items.length
      ? items.map(item => `<div class="dropdown-item" data-id="${item.id}">${renderItem(item)}</div>`).join('')
      : `<div class="dropdown-item no-results">${emptyText}</div>`;
    ddEl.classList.add('show');
  };

  if (hint) {
    ddEl.innerHTML = `<div class="dropdown-item no-results">${hint}</div>`;
  } else {
    try { renderItems(await search('')); } catch { renderItems([]); }
  }
  if (inlineDropdown) {
    ddEl.style.position = 'relative';
    ddEl.style.display = 'block';
  }

  input.addEventListener('focus', () => { if (!hint || input.value.trim()) ddEl.classList.add('show'); });
  input.addEventListener('blur', () => { setTimeout(() => ddEl.classList.remove('show'), 150); });

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const term = input.value.trim();
      if (hint && !term) { ddEl.classList.remove('show'); return; }
      try {
        renderItems(await search(term));
      } catch (err) {
        console.warn('Suche fehlgeschlagen', err);
      }
    }, 200);
  });

  ddEl.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item || item.classList.contains('no-results')) return;
    selectedId = item.dataset.id;
    input.value = (item.querySelector('.dropdown-item-main')?.textContent || item.textContent).trim();
    confirmBtn.disabled = false;
    ddEl.classList.remove('show');
  });

  const onEsc = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { document.removeEventListener('keydown', onEsc); modal.remove(); };
  document.addEventListener('keydown', onEsc);
  modal.querySelector(`#${idPrefix}-close`).onclick = close;
  modal.querySelector(`#${idPrefix}-cancel`).onclick = close;

  confirmBtn.onclick = async () => {
    if (!selectedId) return;
    confirmBtn.disabled = true;
    confirmBtn.classList.add('is-loading');
    try {
      await onConfirm(selectedId);
      close();
      alert(successAlert);
    } catch (err) {
      console.error('Zuordnung fehlgeschlagen', err);
      alert(typeof errorAlert === 'function' ? errorAlert(err) : errorAlert);
      confirmBtn.disabled = false;
      confirmBtn.classList.remove('is-loading');
    }
  };

  input.focus();
  return modal;
}
