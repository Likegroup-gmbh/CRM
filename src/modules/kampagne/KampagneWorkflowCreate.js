// KampagneWorkflowCreate.js
// Create-CTAs der Kampagnen-Workflow-Tabs: Registry + Chrome + Handler.
// Gate ist generisch (CreateActionGate); hier sitzt nur die Kampagnen-Policy.

import { resolveCreateAction, renderCreateButton } from '../../core/actions/CreateActionGate.js';
import { openSkriptCreateDrawer } from '../skripte/SkriptCreateDrawer.js';
import { lineNames } from '../produktion/produktionNames.js';
import { openProduktionBriefingDrawer } from '../produktion/ProduktionBriefingDrawer.js';
import { withProduktionHerkunft } from '../../core/navHerkunft.js';

const EXISTS_REASON = {
  briefing: 'Diese Produktion hat bereits ein Briefing.'
};

const ACTION_SPECS = {
  briefing: {
    permission: 'briefing',
    label: 'Briefing anlegen',
    mode: 'navigate',
    exists(detail) {
      const ids = detail.produktion?.resolvedBriefingIds;
      if (Array.isArray(ids) && ids.length > 0) return true;
      if (detail.produktion?.briefing_id) return true;
      return (detail.briefings || []).length > 0;
    },
    url(detail) {
      const u = detail.kampagneData?.unternehmen_id || '';
      const m = detail.kampagneData?.marke_id || '';
      return `/briefing/new?unternehmen=${encodeURIComponent(u)}&marke=${encodeURIComponent(m)}`;
    }
  },
  skripte: {
    permission: 'skripte',
    label: 'Skript anlegen',
    mode: 'drawer'
  },
  vertraege: {
    permission: 'vertraege',
    label: 'Vertrag anlegen',
    mode: 'navigate',
    url(detail) {
      const u = detail.kampagneData?.unternehmen_id || '';
      const k = detail.kampagneId || '';
      const params = new URLSearchParams({ unternehmen: u, kampagne: k });
      if (detail.produktionId) params.set('produktion', detail.produktionId);
      return `/vertraege/new?${params.toString()}`;
    }
  }
};

function campaignPrefill(detail) {
  const k = detail.kampagneData || {};
  const names = lineNames(detail.lineTitle);
  return {
    unternehmen_id: k.unternehmen_id,
    kampagne_id: detail.kampagneId,
    produktion_id: detail.produktionId || null,
    briefing_id: detail.produktion?.briefing_id
      || (detail.produktion?.resolvedBriefingIds?.length === 1 ? detail.produktion.resolvedBriefingIds[0] : null)
      || null,
    lineTitle: detail.lineTitle || '',
    castingName: names.casting,
    konzeptName: names.konzept,
    unternehmenName: k.unternehmen?.firmenname || k.unternehmen?.internes_kuerzel || 'Unternehmen'
  };
}

function resolveAction(action, detail) {
  const spec = ACTION_SPECS[action];
  if (!spec) return { spec: null, state: { renderable: false, enabled: false, reason: '' } };
  return {
    spec,
    state: resolveCreateAction({
      permission: spec.permission,
      exists: spec.exists ? spec.exists(detail) : false,
      existsReason: EXISTS_REASON[action] || ''
    })
  };
}

export function renderWorkflowCreateChrome(action, detail) {
  const { spec, state } = resolveAction(action, detail);
  const button = spec ? renderCreateButton({ action, label: spec.label, state }) : '';
  if (action === 'casting') return `${button}<div id="kampagne-casting-tools"></div>`;
  if (action === 'konzepte') return `${button}<div id="kampagne-konzept-tools"></div>`;
  if (!spec) return '';
  return button;
}

export function syncWorkflowCreateChrome(detail, action = null) {
  const ids = action ? [action] : Object.keys(ACTION_SPECS);
  for (const id of ids) {
    const slot = document.querySelector(`.kampagne-tab-chrome[data-chrome="${id}"]`);
    if (!slot) continue;
    const toolsId = id === 'casting'
      ? 'kampagne-casting-tools'
      : (id === 'konzepte' ? 'kampagne-konzept-tools' : null);
    const liveTools = toolsId ? slot.querySelector(`#${toolsId}`) : null;
    slot.innerHTML = renderWorkflowCreateChrome(id, detail);
    if (liveTools) {
      const placeholder = slot.querySelector(`#${toolsId}`);
      if (placeholder) placeholder.replaceWith(liveTools);
    }
  }
}

export function handleWorkflowCreate(detail, action) {
  const { spec, state } = resolveAction(action, detail);
  if (!spec || !state.enabled) return;

  if (action === 'briefing') {
    openProduktionBriefingDrawer(detail, { produktionId: detail.produktionId || null });
    return;
  }

  if (spec.mode === 'navigate') {
    window.navigateTo(withProduktionHerkunft(
      spec.url(detail),
      detail.produktionId,
      detail.activeWorkflowTab
    ));
    return;
  }

  if (action === 'skripte') {
    openSkriptCreateDrawer(campaignPrefill(detail));
  }
}
