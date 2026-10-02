// CreatorTauschDialog.js
// Drawer "Creator tauschen": Ersatz-Eintrag waehlen, optionaler Grund, Sperrgruende.
// Eine Stelle fuer beide Einstiege (Casting-Zeile und Skript-Kopf).

import { escapeAttr } from '../../core/VideoUploadUtils.js';
import { tauschGrundText } from './creatorTauschSperren.js';
import { ladeTauschKontext, tauscheCreator, itemCreatorName } from './CreatorTauschService.js';

const DRAWER_ID = 'creator-tausch-drawer';

function personaLabel(item) {
  const p = item?.persona;
  if (!p?.name) return 'ohne Persona';
  return p.oberbegriff ? `${p.oberbegriff} (${p.name})` : p.name;
}

function optionHtml({ item, sperre }) {
  const label = `${itemCreatorName(item)} · ${personaLabel(item)}`;
  const suffix = sperre ? ` – ${tauschGrundText(sperre)}` : '';
  return `<option value="${escapeAttr(item.id)}"${sperre ? ' disabled' : ''}>${escapeAttr(label + suffix)}</option>`;
}

function bodyHtml(kontext) {
  const altName = itemCreatorName(kontext.alt);
  if (kontext.datenSperre) {
    return `
      <div class="form-field">
        <p><strong>${escapeAttr(altName)}</strong> kann nicht getauscht werden.</p>
        <p class="drawer-subtitle">${escapeAttr(tauschGrundText(kontext.datenSperre))}</p>
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
          <span class="mdc-btn__label">Schließen</span>
        </button>
      </div>`;
  }
  const waehlbar = kontext.kandidaten.some((k) => !k.sperre);
  return `
    <div class="form-field">
      <label for="${DRAWER_ID}-ersatz">Ersatz aus diesem Casting</label>
      <select id="${DRAWER_ID}-ersatz" class="form-input">
        <option value="">– Ersatz wählen –</option>
        ${kontext.kandidaten.map(optionHtml).join('')}
      </select>
      <p class="drawer-subtitle">${waehlbar
        ? 'Der Ersatz muss im Casting stehen, Kunden-Prio 1 oder 2 haben und zugesagt oder gebucht sein.'
        : 'Noch kein Ersatz im Casting bereit. Lege den Creator zuerst im Casting an und hole Prio und Zusage ein.'}</p>
      <p class="drawer-subtitle" id="${DRAWER_ID}-persona" hidden>
        Der Ersatz gehört zu einer anderen Persona. Skript-Alltag und Besetzung sind auf die bisherige geschrieben.
      </p>
    </div>
    <div class="form-field">
      <label for="${DRAWER_ID}-grund">Grund (optional)</label>
      <textarea id="${DRAWER_ID}-grund" class="form-input" rows="2"
        placeholder="z.B. krank, Zeitplan nicht machbar"></textarea>
    </div>
    <p class="drawer-subtitle">
      Videoideen, Skripte und Kooperation wechseln zum Ersatz. ${escapeAttr(altName)} wird als Abgesagt vermerkt,
      offene Verträge werden abgelehnt, der Upload-Link wird entwertet. Es gehen keine Mails raus.
    </p>
    <div class="drawer-footer">
      <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
        <span class="mdc-btn__label">Abbrechen</span>
      </button>
      <button type="button" id="${DRAWER_ID}-confirm" class="mdc-btn mdc-btn--create" disabled>
        <span class="mdc-btn__label">Tauschen</span>
      </button>
    </div>`;
}

function mount(kontext, onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = `${DRAWER_ID}-overlay`;
  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.className = 'drawer-panel';
  panel.id = DRAWER_ID;
  panel.innerHTML = `
    <div class="drawer-header">
      <div>
        <span class="drawer-title">Creator tauschen</span>
        <p class="drawer-subtitle">${escapeAttr(itemCreatorName(kontext.alt))} springt ab</p>
      </div>
      <div><button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button></div>
    </div>
    <div class="drawer-body">${bodyHtml(kontext)}</div>`;

  let fertig = false;
  const finish = (erfolg) => {
    if (fertig) return;
    fertig = true;
    panel.classList.remove('show');
    overlay.classList.remove('active');
    setTimeout(() => { overlay.remove(); panel.remove(); }, 250);
    onDone(erfolg);
  };
  overlay.addEventListener('click', () => finish(false));
  panel.querySelector('.drawer-close-btn').addEventListener('click', () => finish(false));
  panel.querySelectorAll('[data-action="close"]').forEach((b) => b.addEventListener('click', () => finish(false)));
  document.body.append(overlay, panel);
  requestAnimationFrame(() => { overlay.classList.add('active'); panel.classList.add('show'); });
  return { panel, finish };
}

function bindForm(panel, kontext, finish) {
  const select = panel.querySelector(`#${DRAWER_ID}-ersatz`);
  const confirm = panel.querySelector(`#${DRAWER_ID}-confirm`);
  if (!select || !confirm) return;
  select.addEventListener('change', () => {
    confirm.disabled = !select.value;
    const gewaehlt = kontext.kandidaten.find((k) => k.item.id === select.value);
    panel.querySelector(`#${DRAWER_ID}-persona`).hidden = !gewaehlt?.anderePersona;
  });
  confirm.addEventListener('click', async () => {
    if (!select.value) return;
    confirm.disabled = true;
    try {
      await tauscheCreator({
        alterItemId: kontext.alt.id,
        ersatzItemId: select.value,
        grund: panel.querySelector(`#${DRAWER_ID}-grund`).value
      });
      window.toastSystem?.show('Creator getauscht', 'success');
      finish(true);
    } catch (error) {
      console.error('Creator-Tausch fehlgeschlagen:', error);
      window.toastSystem?.show(error.message || 'Tausch fehlgeschlagen', 'error');
      confirm.disabled = false;
    }
  });
}

/** @returns {Promise<boolean>} true nach erfolgreichem Tausch. */
export async function openCreatorTauschDialog(alterItemId) {
  let kontext;
  try {
    kontext = await ladeTauschKontext(alterItemId);
  } catch (error) {
    console.error('Creator-Tausch: Laden fehlgeschlagen', error);
    window.toastSystem?.show(error.message || 'Fehler beim Laden', 'error');
    return false;
  }
  document.getElementById(DRAWER_ID)?.remove();
  document.getElementById(`${DRAWER_ID}-overlay`)?.remove();
  return new Promise((resolve) => {
    const { panel, finish } = mount(kontext, resolve);
    bindForm(panel, kontext, finish);
  });
}
