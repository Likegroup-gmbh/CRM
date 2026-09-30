// KampagneDetailKatalog.js
// Produkte- und Personas-Tab der Produktion: die flache Liste, nur das
// Produkt und die Personas dieses Briefings.

import { renderEmptyState } from '../../core/components/EmptyState.js';
import { ProduktList } from '../produkt/ProduktList.js';
import { PersonaList } from '../persona/PersonaList.js';
import { bumpPaneGen, isPaneGenCurrent, paneGeneration } from './KampagneDetailWorkflow.js';

export function katalogScope(detail) {
  const produktion = detail?.produktion || {};
  const kampagne = detail?.kampagneData || {};
  const resolved = Array.isArray(produktion.resolvedBriefingIds)
    ? produktion.resolvedBriefingIds.filter(Boolean)
    : [];
  const briefingId = produktion.briefing_id || (resolved.length === 1 ? resolved[0] : null);

  return {
    briefingId: briefingId || null,
    briefingName: produktion.briefing?.aktivierung_name || null,
    produktId: produktion.produkt_id || null,
    produktName: produktion.produkt?.name || null,
    produktionId: detail?.produktionId || produktion.id || null,
    unternehmenId: kampagne.unternehmen_id || null,
    unternehmenName: kampagne.unternehmen?.firmenname || null,
    markeId: kampagne.marke_id || null,
    markeName: kampagne.marke?.markenname || null
  };
}

function unmountList(detail, key) {
  const list = detail[key];
  if (!list) return;
  list.destroy();
  detail[key] = null;
}

export function unmountKatalogPanes(detail) {
  bumpPaneGen(detail, 'produkte');
  bumpPaneGen(detail, 'personas');
  unmountList(detail, 'produktList');
  unmountList(detail, 'personaList');
}

async function mountList(detail, { tabId, key, List }) {
  const pane = document.getElementById(`workflow-pane-${tabId}`);
  if (!pane) return;
  const gen = paneGeneration(detail, tabId);

  unmountList(detail, key);
  pane.innerHTML = '<div class="table-loading-container"><div class="table-loading-spinner"></div></div>';

  const list = new List();
  detail[key] = list;

  try {
    await list.mountEmbedded(pane, katalogScope(detail));
    if (!isPaneGenCurrent(detail, tabId, gen) || !pane.isConnected) {
      list.destroy();
      if (detail[key] === list) detail[key] = null;
    }
  } catch (error) {
    console.error(`❌ KAMPAGNEDETAIL: ${tabId}-Pane fehlgeschlagen:`, error);
    if (pane.isConnected) {
      pane.innerHTML = renderEmptyState({
        icon: 'info',
        title: 'Fehler beim Laden',
        text: 'Die Liste konnte nicht geladen werden.'
      });
    }
  }
}

export function mountProduktePane(detail) {
  return mountList(detail, { tabId: 'produkte', key: 'produktList', List: ProduktList });
}

export function mountPersonasPane(detail) {
  return mountList(detail, { tabId: 'personas', key: 'personaList', List: PersonaList });
}
