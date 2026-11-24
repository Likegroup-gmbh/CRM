// Ein Klick legt eine Kooperation ohne Creator an.

import { PLATZHALTER_NAME, offenePlatzhalterAnzahl } from './platzhalter.js';

export function offenePlatzhalterBeschriftung(koops) {
  return `${offenePlatzhalterAnzahl(koops)} offen`;
}

export function setOffenePlatzhalterZahl(koops) {
  const el = document.querySelector('[data-offene-platzhalter]');
  if (el) el.textContent = offenePlatzhalterBeschriftung(koops);
}

export function bindPlatzhalterButton(detail, signal, briefingId = null) {
  const button = document.getElementById('btn-new-platzhalter');
  button?.addEventListener('click', (event) => {
    event.preventDefault();
    void legePlatzhalterAn(detail, { briefingId: typeof briefingId === 'function' ? briefingId(detail) : briefingId });
  }, { signal });
}

export async function legePlatzhalterAn(detail, { briefingId = null } = {}) {
  const client = window.supabase;
  const kampagne = detail?.kampagneData;
  if (!client || !kampagne?.id) return;

  const { error } = await client.from('kooperationen').insert({
    name: PLATZHALTER_NAME,
    kampagne_id: kampagne.id,
    unternehmen_id: kampagne.unternehmen_id || null,
    produktion_id: detail.produktionId || null,
    briefing_id: briefingId || null,
    assignee_id: window.currentUser?.id || null,
    creator_id: null
  });

  if (error) {
    console.error('Platzhalter anlegen fehlgeschlagen:', error);
    window.toastSystem?.show(error.message || 'Platzhalter konnte nicht angelegt werden.', 'error');
    return;
  }

  window.toastSystem?.show('Platzhalter angelegt.', 'success');
  await detail.reloadKooperationTable?.();
}
