// Drawer "Neue Masterliste" / "Masterliste bearbeiten": Name, Beschreibung
// und optional das Unternehmen, in dessen Ordner die Liste liegt.

import { escapeHtml } from './masterliste.js';

const OVERLAY_ID = 'masterliste-form-overlay';
const PANEL_ID = 'masterliste-form-drawer';
const KEIN_UNTERNEHMEN = 'Kein Unternehmen (für alle Kunden)';

async function ladeUnternehmenOptionen() {
  const { data, error } = await window.supabase
    .from('unternehmen')
    .select('id, firmenname')
    .order('firmenname', { ascending: true });
  if (error) {
    console.warn('Masterliste: Unternehmen konnten nicht geladen werden', error);
    return [];
  }
  return (data || []).map(row => ({ value: row.id, label: row.firmenname || 'Ohne Namen' }));
}

function optionenHtml(optionen, aktuell) {
  return [{ value: '', label: KEIN_UNTERNEHMEN }, ...optionen]
    .map(o => `<option value="${escapeHtml(o.value)}"${o.value === aktuell ? ' selected' : ''}>${escapeHtml(o.label)}</option>`)
    .join('');
}

async function fuelleUnternehmen(select, aktuell, aktuellName) {
  const geladen = await ladeUnternehmenOptionen();
  if (!select.isConnected) return;
  const optionen = aktuell && !geladen.some(o => o.value === aktuell)
    ? [{ value: aktuell, label: aktuellName || 'Unternehmen' }, ...geladen]
    : geladen;
  select.innerHTML = optionenHtml(optionen, aktuell);
  select.value = aktuell;
  if (!window.formSystem?.createSimpleSearchableSelect) return;
  window.formSystem.createSimpleSearchableSelect(select, [
    { value: '', label: KEIN_UNTERNEHMEN },
    ...optionen.map(o => ({ ...o, selected: o.value === aktuell }))
  ], { placeholder: 'Unternehmen suchen…' });
}

/** Formularwerte; leeres Unternehmen heißt: die Liste gehört der ganzen Agentur. */
export function leseListenFormular(form) {
  return {
    name: form.querySelector('#masterliste-name')?.value.trim() || '',
    beschreibung: form.querySelector('#masterliste-beschreibung')?.value.trim() || null,
    unternehmen_id: form.querySelector('#masterliste-unternehmen')?.value || null
  };
}

/**
 * list: bestehende Liste ({ id, name, beschreibung, unternehmenId, unternehmenName }) oder null.
 * unternehmen: Vorbelegung beim Anlegen aus einem Unternehmens-Ordner ({ id, name }).
 * onSubmit(values) -> true schließt den Drawer.
 */
export function openMasterlisteFormDrawer({ list = null, unternehmen = null, onSubmit }) {
  closeMasterlisteFormDrawer(true);
  const editing = Boolean(list?.id);
  const aktuell = (editing ? list.unternehmenId : unternehmen?.id) || '';
  const aktuellName = (editing ? list.unternehmenName : unternehmen?.name) || '';

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = OVERLAY_ID;
  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.className = 'drawer-panel';
  panel.id = PANEL_ID;
  const startOptionen = aktuell ? [{ value: aktuell, label: aktuellName || 'Unternehmen' }] : [];
  panel.innerHTML = `
    <div class="drawer-header">
      <div>
        <span class="drawer-title">${editing ? 'Masterliste bearbeiten' : 'Neue Masterliste'}</span>
        <p class="drawer-subtitle">${editing ? 'Name, Beschreibung und Unternehmen dieser Liste' : 'Eine Liste, aus der das Team später Creator auswählt'}</p>
      </div>
      <div><button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button></div>
    </div>
    <div class="drawer-body">
      <form id="masterliste-form">
        <div class="form-group">
          <label class="form-label" for="masterliste-name">Name</label>
          <input type="text" id="masterliste-name" class="form-input" value="${escapeHtml(list?.name || '')}" required maxlength="120" placeholder="z. B. Beauty DACH">
        </div>
        <div class="form-group">
          <label class="form-label" for="masterliste-beschreibung">Beschreibung</label>
          <textarea id="masterliste-beschreibung" class="form-input" rows="3" maxlength="500" placeholder="Wofür das Team diese Liste nutzt">${escapeHtml(list?.beschreibung || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="masterliste-unternehmen">Unternehmen</label>
          <select id="masterliste-unternehmen" name="unternehmen_id" class="form-input">${optionenHtml(startOptionen, aktuell)}</select>
          <p class="form-hint">Die Liste liegt im Ordner dieses Unternehmens. Ohne Unternehmen liegt sie unter „Ohne Unternehmen“.</p>
        </div>
        <div class="drawer-footer u-mt-lg">
          <button type="submit" class="mdc-btn">${editing ? 'Speichern' : 'Anlegen'}</button>
          <button type="button" class="mdc-btn mdc-btn--secondary" data-action="close-masterliste-form">Abbrechen</button>
        </div>
      </form>
    </div>
  `;

  const close = () => closeMasterlisteFormDrawer();
  overlay.addEventListener('click', close);
  panel.querySelector('.drawer-close-btn').addEventListener('click', close);
  panel.querySelector('[data-action="close-masterliste-form"]').addEventListener('click', close);
  const form = panel.querySelector('#masterliste-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = leseListenFormular(form);
    if (!values.name) {
      window.toastSystem?.show('Name darf nicht leer sein.', 'warning');
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const ok = await onSubmit?.(values);
    if (ok) closeMasterlisteFormDrawer();
    else button.disabled = false;
  });

  document.body.appendChild(overlay);
  document.body.appendChild(panel);
  requestAnimationFrame(() => panel.classList.add('show'));
  panel.querySelector('#masterliste-name')?.focus();
  void fuelleUnternehmen(panel.querySelector('#masterliste-unternehmen'), aktuell, aktuellName);
}

export function closeMasterlisteFormDrawer(immediate = false) {
  const overlay = document.getElementById(OVERLAY_ID);
  const panel = document.getElementById(PANEL_ID);
  if (!panel) {
    overlay?.remove();
    return;
  }
  if (immediate) {
    overlay?.remove();
    panel.remove();
    return;
  }
  panel.classList.remove('show');
  setTimeout(() => {
    overlay?.remove();
    panel.remove();
  }, 300);
}
