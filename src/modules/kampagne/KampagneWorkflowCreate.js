// KampagneWorkflowCreate.js
// Create-CTAs der Kampagnen-Workflow-Tabs: Registry + Chrome + Handler.
// Gate ist generisch (CreateActionGate); hier sitzt nur die Kampagnen-Policy.

import { resolveCreateAction, renderCreateButton } from '../../core/actions/CreateActionGate.js';
import { KampagneUtils } from './KampagneUtils.js';
import { openCastingCreateDrawer } from './KampagneDetailCasting.js';
import { remountKonzeptPane } from './KampagneDetailKonzept.js';
import { openCreateDrawer as openKonzeptCreateDrawer } from '../strategie/StrategieListCrud.js';
import { openSkriptCreateDrawer } from '../skripte/SkriptCreateDrawer.js';

const EXISTS_REASON = {
  casting: 'Für diese Kampagne existiert bereits eine Casting-Liste.',
  konzepte: 'Für diese Kampagne existiert bereits ein Konzept.'
};

const ACTION_SPECS = {
  briefing: {
    permission: 'briefing',
    label: 'Briefing anlegen',
    mode: 'navigate',
    url(detail) {
      const u = detail.kampagneData?.unternehmen_id || '';
      const m = detail.kampagneData?.marke_id || '';
      return `/briefing/new?unternehmen=${encodeURIComponent(u)}&marke=${encodeURIComponent(m)}`;
    }
  },
  casting: {
    permission: 'sourcing',
    label: 'Casting anlegen',
    mode: 'drawer',
    exists: hasCasting
  },
  konzepte: {
    permission: 'strategie',
    label: 'Konzept anlegen',
    mode: 'drawer',
    exists: hasKonzept
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
      return `/vertraege/new?unternehmen=${encodeURIComponent(u)}`;
    }
  }
};

function hasCasting(detail) {
  if (Array.isArray(detail._castingListen) && detail._castingListen.length > 0) return true;
  return (detail.sourcingListenCount || 0) > 0;
}

function hasKonzept(detail) {
  return (detail.strategien || []).length > 0;
}

function campaignPrefill(detail) {
  const k = detail.kampagneData || {};
  return {
    unternehmen_id: k.unternehmen_id,
    marke_id: k.marke_id,
    kampagne_id: detail.kampagneId,
    unternehmenName: k.unternehmen?.firmenname || k.unternehmen?.internes_kuerzel || 'Unternehmen',
    markeName: k.marke?.markenname || 'Marke',
    kampagneName: KampagneUtils.getDisplayName(k)
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
  if (!spec) return '';
  const button = renderCreateButton({ action, label: spec.label, state });
  if (action === 'casting') return `${button}<div id="kampagne-casting-tools"></div>`;
  if (action === 'konzepte') return `${button}<div id="kampagne-konzept-tools"></div>`;
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

  if (spec.mode === 'navigate') {
    window.navigateTo(spec.url(detail));
    return;
  }

  if (action === 'casting') {
    openCastingCreateDrawer(detail, {
      onCreated: () => {
        detail.sourcingListenCount = detail._castingListen?.length || 1;
        syncWorkflowCreateChrome(detail, 'casting');
      }
    });
    return;
  }

  if (action === 'konzepte') {
    const prefill = campaignPrefill(detail);
    const listen = detail._castingListen || [];
    if (listen.length === 1) {
      prefill.creator_auswahl_id = listen[0].id;
      prefill.creatorAuswahlName = listen[0].name || 'Casting';
    }
    openKonzeptCreateDrawer(null, {
      prefill,
      onCreated: async (strategie) => {
        detail.strategien = [...(detail.strategien || []), strategie];
        detail._konzeptSelectedId = strategie.id;
        syncWorkflowCreateChrome(detail, 'konzepte');
        await remountKonzeptPane(detail);
      }
    });
    return;
  }

  if (action === 'skripte') {
    openSkriptCreateDrawer(campaignPrefill(detail));
  }
}
