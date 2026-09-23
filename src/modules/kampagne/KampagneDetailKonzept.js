// KampagneDetailKonzept.js
// Mountet das volle Konzept-Worksheet in den Kampagnen-Workflow-Pane.

import { StrategieDetail } from '../strategie/StrategieDetail.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';

const esc = (t) => window.validatorSystem?.sanitizeHtml(String(t ?? '')) || '';

function getKonzeptTools() {
  return document.getElementById('kampagne-konzept-tools');
}

export function unmountKonzeptWorksheet(detail) {
  if (detail.konzeptWorksheet) {
    detail.konzeptWorksheet.destroy();
    detail.konzeptWorksheet = null;
  }
  const tools = getKonzeptTools();
  if (tools) tools.innerHTML = '';
}

export async function mountKonzeptPane(detail) {
  const pane = document.getElementById('workflow-pane-konzepte');
  if (!pane) return;

  pane.innerHTML = '<div class="table-loading-container"><div class="table-loading-spinner"></div></div>';

  try {
    const listen = await loadKonzepte(detail);
    if (!pane.isConnected) return;
    detail.strategien = listen;

    if (!listen.length) {
      pane.innerHTML = renderEmptyKonzept();
      return;
    }

    const selectedId = listen.some(l => l.id === detail._konzeptSelectedId)
      ? detail._konzeptSelectedId
      : listen[0].id;
    detail._konzeptSelectedId = selectedId;

    pane.innerHTML = renderKonzeptShell(listen, selectedId);
    bindSwitcher(detail, pane);
    await mountWorksheet(detail, pane.querySelector('.kampagne-konzept-worksheet'), selectedId);
  } catch (error) {
    console.error('❌ KAMPAGNEDETAIL: Konzept-Pane fehlgeschlagen:', error);
    if (pane.isConnected) {
      pane.innerHTML = renderEmptyState({
        icon: 'info',
        title: 'Fehler beim Laden',
        text: 'Das Konzept konnte nicht geladen werden.'
      });
    }
  }
}

export async function remountKonzeptPane(detail) {
  unmountKonzeptWorksheet(detail);
  if (detail._workflowLoaded) detail._workflowLoaded.konzepte = false;
  await mountKonzeptPane(detail);
  if (detail._workflowLoaded) detail._workflowLoaded.konzepte = true;
}

async function loadKonzepte(detail) {
  let query = window.supabase
    .from('strategie')
    .select('id, name')
    .eq('kampagne_id', detail.kampagneId)
    .order('created_at', { ascending: true });
  if (detail.produktionId) query = query.eq('produktion_id', detail.produktionId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

function renderEmptyKonzept() {
  return renderEmptyState({
    icon: 'clipboard',
    title: 'Kein Konzept',
    text: 'Für diese Kampagne wurde noch kein Konzept angelegt.'
  });
}

function renderKonzeptShell(listen, selectedId) {
  const switcher = listen.length > 1
    ? `<div class="kampagne-konzept-listen-switcher">
        <label class="kampagne-konzept-listen-switcher__label" for="kampagne-konzept-liste">Konzept</label>
        <select id="kampagne-konzept-liste" class="form-input">
          ${listen.map(l => `
            <option value="${esc(l.id)}"${l.id === selectedId ? ' selected' : ''}>${esc(l.name || 'Unbenannt')}</option>
          `).join('')}
        </select>
      </div>`
    : '';

  return `
    ${switcher}
    <div class="kampagne-konzept-worksheet"></div>
  `;
}

function bindSwitcher(detail, pane) {
  const select = pane.querySelector('#kampagne-konzept-liste');
  if (!select) return;
  select.addEventListener('change', async () => {
    detail._konzeptSelectedId = select.value;
    const root = pane.querySelector('.kampagne-konzept-worksheet');
    if (!root) return;
    if (detail.konzeptWorksheet) {
      detail.konzeptWorksheet.destroy();
      detail.konzeptWorksheet = null;
    }
    await mountWorksheet(detail, root, select.value);
  });
}

async function mountWorksheet(detail, root, strategieId) {
  if (!root) return;
  detail.konzeptWorksheet = new StrategieDetail();
  await detail.konzeptWorksheet.init(strategieId, {
    root,
    chromeRoot: getKonzeptTools(),
    embedded: true
  });
}
