// KampagneDetailCasting.js
// Mountet das volle Casting-Worksheet in den Kampagnen-Workflow-Pane.

import { CreatorAuswahlDetail } from '../creator-auswahl/CreatorAuswahlDetail.js';
import { creatorAuswahlService } from '../creator-auswahl/CreatorAuswahlService.js';
import { berechneHiddenColumns, STANDARD_VERSTECKTE_SPALTEN } from '../creator-auswahl/sourcingSpaltenPreset.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { prefillAndLockField } from '../../core/form/data/PrefillHandler.js';
import { AutoGeneration } from '../../core/form/logic/AutoGeneration.js';
import { KampagneUtils } from './KampagneUtils.js';

const esc = (t) => window.validatorSystem?.sanitizeHtml(String(t ?? '')) || '';

function getCastingTools() {
  return document.getElementById('kampagne-casting-tools');
}

export function unmountCastingWorksheet(detail) {
  if (detail.castingWorksheet) {
    detail.castingWorksheet.destroy();
    detail.castingWorksheet = null;
  }
  const tools = getCastingTools();
  if (tools) tools.innerHTML = '';
  closeCreateDrawer();
}

export async function mountCastingPane(detail) {
  const pane = document.getElementById('workflow-pane-casting');
  if (!pane) return;

  pane.innerHTML = '<div class="table-loading-container"><div class="table-loading-spinner"></div></div>';

  try {
    const listen = await creatorAuswahlService.getListenByKampagneId(detail.kampagneId);
    if (!pane.isConnected) return;
    detail._castingListen = listen;
    detail.sourcingListenCount = listen.length;

    if (!listen.length) {
      pane.innerHTML = renderEmptyCasting();
      return;
    }

    const selectedId = listen.some(l => l.id === detail._castingSelectedListeId)
      ? detail._castingSelectedListeId
      : listen[0].id;
    detail._castingSelectedListeId = selectedId;

    pane.innerHTML = renderCastingShell(listen, selectedId);
    bindSwitcher(detail, pane);
    await mountWorksheet(detail, pane.querySelector('.kampagne-casting-worksheet'), selectedId);
  } catch (error) {
    console.error('❌ KAMPAGNEDETAIL: Casting-Pane fehlgeschlagen:', error);
    if (pane.isConnected) {
      pane.innerHTML = renderEmptyState({
        icon: 'info',
        title: 'Fehler beim Laden',
        text: 'Die Casting-Liste konnte nicht geladen werden.'
      });
    }
  }
}

async function remountCastingPane(detail) {
  unmountCastingWorksheet(detail);
  if (detail._workflowLoaded) detail._workflowLoaded.casting = false;
  await mountCastingPane(detail);
  if (detail._workflowLoaded) detail._workflowLoaded.casting = true;
}

function renderEmptyCasting() {
  return renderEmptyState({
    icon: 'users',
    title: 'Keine Casting-Liste',
    text: 'Für diese Kampagne wurde noch keine Casting-Liste angelegt.'
  });
}

function renderCastingShell(listen, selectedId) {
  const switcher = listen.length > 1
    ? `<div class="kampagne-casting-listen-switcher">
        <label class="kampagne-casting-listen-switcher__label" for="kampagne-casting-liste">Liste</label>
        <select id="kampagne-casting-liste" class="form-input">
          ${listen.map(l => `
            <option value="${esc(l.id)}"${l.id === selectedId ? ' selected' : ''}>${esc(l.name || 'Unbenannt')}</option>
          `).join('')}
        </select>
      </div>`
    : '';

  return `
    ${switcher}
    <div class="kampagne-casting-worksheet"></div>
  `;
}

function bindSwitcher(detail, pane) {
  const select = pane.querySelector('#kampagne-casting-liste');
  if (!select) return;
  select.addEventListener('change', async () => {
    detail._castingSelectedListeId = select.value;
    const root = pane.querySelector('.kampagne-casting-worksheet');
    if (!root) return;
    if (detail.castingWorksheet) {
      detail.castingWorksheet.destroy();
      detail.castingWorksheet = null;
    }
    await mountWorksheet(detail, root, select.value);
  });
}

async function mountWorksheet(detail, root, listeId) {
  if (!root) return;
  detail.castingWorksheet = new CreatorAuswahlDetail();
  await detail.castingWorksheet.init(listeId, {
    root,
    chromeRoot: getCastingTools(),
    embedded: true
  });
}

export function openCastingCreateDrawer(detail, options = {}) {
  if ((detail._castingListen?.length || detail.sourcingListenCount || 0) > 0) return;
  closeCreateDrawer();

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = 'kampagne-casting-create-overlay';

  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.className = 'drawer-panel';
  panel.id = 'kampagne-casting-create-drawer';

  const header = document.createElement('div');
  header.className = 'drawer-header';
  header.innerHTML = `
    <div>
      <span class="drawer-title">Neue Casting-Liste</span>
      <p class="drawer-subtitle">Für diese Kampagne</p>
    </div>
    <div>
      <button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button>
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'drawer-body';
  body.innerHTML = window.formSystem.renderFormOnly('sourcing');

  panel.appendChild(header);
  panel.appendChild(body);

  overlay.addEventListener('click', () => closeCreateDrawer());
  header.querySelector('.drawer-close-btn').addEventListener('click', () => closeCreateDrawer());

  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  requestAnimationFrame(() => {
    panel.classList.add('show');
  });

  void (async () => {
    await window.formSystem.bindFormEvents('sourcing', null);
    const form = panel.querySelector('#sourcing-form');
    if (!form) return;

    await prefillCampaignFields(form, detail);

    form.onsubmit = async (e) => {
      e.preventDefault();
      await handleCreateSubmit(detail, form, options);
    };

    const cancelBtn = form.querySelector('.mdc-btn--cancel');
    if (cancelBtn) {
      cancelBtn.onclick = (e) => {
        e.preventDefault();
        closeCreateDrawer();
      };
    }
  })();
}

async function prefillCampaignFields(form, detail) {
  const k = detail.kampagneData || {};
  const unternehmenName = k.unternehmen?.firmenname || k.unternehmen?.internes_kuerzel || 'Unternehmen';
  const markeName = k.marke?.markenname || 'Marke';
  const kampagneName = KampagneUtils.getDisplayName(k);

  if (k.unternehmen_id) {
    await prefillAndLockField(form, 'unternehmen_id', k.unternehmen_id, unternehmenName);
  }
  if (k.marke_id) {
    await prefillAndLockField(form, 'marke_id', k.marke_id, markeName);
  }
  if (detail.kampagneId) {
    await prefillAndLockField(form, 'kampagne_id', detail.kampagneId, kampagneName);
  }

  form.querySelector('#unternehmen_id')?.dispatchEvent(new Event('change', { bubbles: true }));
}

async function handleCreateSubmit(detail, form, options = {}) {
  try {
    const submitData = window.formSystem.collectSubmitData(form);
    applySpaltenPreset(submitData);

    if (!submitData.kampagne_id) submitData.kampagne_id = detail.kampagneId;
    if (!submitData.unternehmen_id) submitData.unternehmen_id = detail.kampagneData?.unternehmen_id;
    if (!submitData.marke_id) submitData.marke_id = detail.kampagneData?.marke_id;

    if (!submitData.name || submitData.name.trim() === '') {
      const auto = new AutoGeneration();
      const generatedName = await auto.autoGenerateSourcingName(
        submitData.kampagne_id,
        submitData.marke_id,
        submitData.unternehmen_id
      );
      if (generatedName) submitData.name = generatedName;
    }

    const newListe = await creatorAuswahlService.createListe(submitData);
    if (!newListe?.id) throw new Error('Keine ID zurückgegeben');

    window.toastSystem?.show('Casting-Liste erfolgreich erstellt', 'success');
    closeCreateDrawer();
    detail._castingSelectedListeId = newListe.id;
    await remountCastingPane(detail);
    if (typeof options.onCreated === 'function') await options.onCreated();
  } catch (error) {
    console.error('❌ Fehler beim Erstellen der Casting-Liste:', error);
    window.toastSystem?.show(`Fehler beim Erstellen: ${error.message}`, 'error');
  }
}

function applySpaltenPreset(submitData) {
  submitData.hidden_columns = [
    ...berechneHiddenColumns(submitData),
    ...STANDARD_VERSTECKTE_SPALTEN
  ];
  if (!submitData.plattformen) submitData.plattformen = null;
  if (!submitData.ig_formate) submitData.ig_formate = null;
  const tkp = Number(submitData.tkp);
  submitData.tkp = Number.isFinite(tkp) && tkp >= 0 ? tkp : 25;
}

function closeCreateDrawer() {
  const overlay = document.getElementById('kampagne-casting-create-overlay');
  const panel = document.getElementById('kampagne-casting-create-drawer');

  if (panel) {
    panel.classList.remove('show');
    setTimeout(() => {
      overlay?.remove();
      panel?.remove();
    }, 300);
  } else {
    overlay?.remove();
  }
}
