// KampagneDetailBriefing.js
// Briefing-Tab der Produktion: die Dokumentansicht der aktiven Linie, dieselbe
// wie auf /briefing/:id (BriefingDetail im Embed-Modus). Anlegen, Bearbeiten,
// Anschreiben und Löschen laufen über die vorhandenen Pfade des Briefings.

import { renderEmptyState } from '../../core/components/EmptyState.js';
import { BriefingDetail } from '../briefing/BriefingDetail.js';
import { effectiveLinie } from './linienScope.js';
import { bumpPaneGen, isPaneGenCurrent, paneGeneration } from './KampagneDetailWorkflow.js';

const TAB_ID = 'briefing';

function destroyDoc(detail) {
  const doc = detail?._briefingDoc;
  if (!doc) return;
  doc.destroy();
  detail._briefingDoc = null;
}

export function unmountBriefingPane(detail) {
  bumpPaneGen(detail, TAB_ID);
  destroyDoc(detail);
}

export async function mountBriefingPane(detail) {
  const pane = document.getElementById(`workflow-pane-${TAB_ID}`);
  if (!pane) return;

  destroyDoc(detail);
  const gen = paneGeneration(detail, TAB_ID);
  const briefingId = effectiveLinie(detail, TAB_ID);

  if (!briefingId) {
    pane.innerHTML = renderEmptyState({
      icon: 'document',
      title: 'Keine Briefings vorhanden',
      text: 'Für diese Produktion wurde noch kein Briefing zugeordnet.'
    });
    return;
  }

  pane.innerHTML = '<div class="table-loading-container"><div class="table-loading-spinner"></div></div>';

  const doc = new BriefingDetail();
  detail._briefingDoc = doc;

  try {
    await doc.mountEmbedded(pane, briefingId, {
      // Löschen feuert entityUpdated; die Produktion lädt ihre Linien neu.
      onDeleted: () => { void detail.reloadLinien?.(); }
    });
    if (!isPaneGenCurrent(detail, TAB_ID, gen) || !pane.isConnected) {
      doc.destroy();
      if (detail._briefingDoc === doc) detail._briefingDoc = null;
    }
  } catch (error) {
    console.error('❌ KAMPAGNEDETAIL: Briefing-Pane fehlgeschlagen:', error);
    doc.destroy();
    if (detail._briefingDoc === doc) detail._briefingDoc = null;
    if (pane.isConnected) {
      pane.innerHTML = renderEmptyState({
        icon: 'info',
        title: 'Fehler beim Laden',
        text: 'Das Briefing konnte nicht geladen werden.'
      });
    }
  }
}
