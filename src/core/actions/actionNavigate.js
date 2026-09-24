// actionNavigate.js
// view / edit / continue — Routen-Tabelle plus Produkt-/Persona-Kontext

import { produktFormRoute, produktListDetailRoute } from '../../modules/produkt/ProduktService.js';
import { personaFormRoute } from '../../modules/persona/PersonaService.js';
import { isAllowedHerkunft, withHerkunft } from '../navHerkunft.js';

const VIEW_ROUTES = {
  strategie: (id) => `/konzepte/${id}`,
  creator_auswahl: (id) => `/castings/${id}`,
  contract: (id) => `/contracts/${id}`,
};

const EDIT_ROUTES = {
  strategie: (id) => `/konzepte/${id}/edit`,
  creator_auswahl: (id) => `/castings/${id}/edit`,
  auftrag: (id) => `/projekt-erstellen/edit/${id}`,
  contract: (id) => `/projekt-erstellen/edit/${id}`,
};

export function dispatchVertragListAction(action, vertragId) {
  window.dispatchEvent(new CustomEvent('vertrag-list-action', {
    detail: { action, vertragId }
  }));
}

export async function handleView(entityId, entityType) {
  if (entityType === 'vertraege') {
    dispatchVertragListAction('view', entityId);
    return;
  }
  if (entityType === 'produkt') {
    await navigateToProduktForm(entityId);
    return;
  }
  if (entityType === 'persona') {
    await navigateToPersonaForm(entityId);
    return;
  }
  const route = VIEW_ROUTES[entityType]?.(entityId) ?? `/${entityType}/${entityId}`;
  window.navigateTo(route);
}

export async function handleEdit(entityId, entityType, actionItem) {
  if (entityType === 'produkt') {
    await navigateToProduktForm(entityId);
    return;
  }
  if (entityType === 'persona') {
    await navigateToPersonaForm(entityId);
    return;
  }
  if (entityType === 'auftragsdetails') {
    const auftragId = await resolveAuftragIdForDetails(entityId);
    if (auftragId) {
      window.navigateTo(`/projekt-erstellen/edit/${auftragId}`);
      return;
    }
  } else if (entityType === 'kampagne') {
    const auftragId = await resolveAuftragIdForKampagne(entityId);
    if (auftragId) {
      window.navigateTo(`/projekt-erstellen/edit/${auftragId}?step=kampagnen`);
      return;
    }
  } else if (EDIT_ROUTES[entityType]) {
    window.navigateTo(EDIT_ROUTES[entityType](entityId));
    return;
  }

  const requested = actionItem?.dataset?.returnTo;
  const herkunft = requested && isAllowedHerkunft(requested) ? requested : undefined;
  window.navigateTo(withHerkunft(`/${entityType}/${entityId}/edit`, herkunft));
}

export function handleContinue(entityId) {
  window.navigateTo(`/vertraege/${entityId}/edit`);
}

async function resolveAuftragIdForDetails(detailsId) {
  if (!detailsId || !window.supabase) return null;
  try {
    const { data, error } = await window.supabase
      .from('auftrag_details')
      .select('auftrag_id')
      .eq('id', detailsId)
      .single();
    if (error) throw error;
    return data?.auftrag_id || null;
  } catch {
    return null;
  }
}

async function resolveAuftragIdForKampagne(kampagneId) {
  if (!kampagneId || !window.supabase) return null;
  try {
    const { data, error } = await window.supabase
      .from('kampagne')
      .select('auftrag_id')
      .eq('id', kampagneId)
      .single();
    if (error) throw error;
    return data?.auftrag_id || null;
  } catch {
    return null;
  }
}

async function navigateToProduktForm(produktId) {
  const markeDetail = window.moduleRegistry?.modules?.get('marke-detail');
  if (markeDetail?.markeId && location.pathname.includes('/marke/')) {
    window.navigateTo(`/marke/${markeDetail.markeId}/produkt?produkt=${produktId}`);
    return;
  }
  const unternehmenDetail = window.moduleRegistry?.modules?.get('unternehmen-detail');
  if (unternehmenDetail?.unternehmenId && location.pathname.includes('/unternehmen/')) {
    window.navigateTo(produktFormRoute(unternehmenDetail.unternehmenId, produktId));
    return;
  }
  window.navigateTo(produktListDetailRoute(produktId));
}

async function navigateToPersonaForm(personaId) {
  const markeDetail = window.moduleRegistry?.modules?.get('marke-detail');
  if (markeDetail?.markeId && location.pathname.includes('/marke/')) {
    window.navigateTo(personaFormRoute('marke', markeDetail.markeId, personaId));
    return;
  }
  const unternehmenDetail = window.moduleRegistry?.modules?.get('unternehmen-detail');
  if (unternehmenDetail?.unternehmenId && location.pathname.includes('/unternehmen/')) {
    window.navigateTo(personaFormRoute('unternehmen', unternehmenDetail.unternehmenId, personaId));
    return;
  }
  const { data, error } = await window.supabase
    .from('personas')
    .select('unternehmen_id')
    .eq('id', personaId)
    .maybeSingle();
  if (error || !data?.unternehmen_id) {
    window.toastSystem?.error?.('Persona konnte nicht geöffnet werden.');
    return;
  }
  window.navigateTo(personaFormRoute('unternehmen', data.unternehmen_id, personaId));
}
