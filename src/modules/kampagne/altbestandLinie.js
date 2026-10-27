// altbestandLinie.js
// Altbestand-Linie (ADR 0058): Linie aus V1 ohne eigenes Briefing-Dokument
// (campaign_briefings.ist_altbestand = true). Casting, Konzept, Kooperationen und
// Skripte hängen daran, das Briefing-Formular bleibt gesperrt, bis jemand
// "Briefing ausfüllen" wählt.

import { renderEmptyState, bindEmptyStateActions } from '../../core/components/EmptyState.js';

export const ALTBESTAND_BADGE = 'Altbestand';

export function istAltbestand(linie) {
  return Boolean(linie?.ist_altbestand ?? linie?.briefing?.ist_altbestand);
}

/** Kunden sehen die Linie neutral, ohne das interne Wort "Altbestand". */
export function zeigeAltbestandBadge(linie) {
  return istAltbestand(linie) && !window.isKunde?.();
}

export function kannBriefingAusfuellen() {
  return !window.isKunde?.() && (window.canEdit?.('briefing') ?? false);
}

/** Ersatz für die Dokumentansicht im Briefing-Tab einer Altbestand-Linie. */
export function renderAltbestandHinweis() {
  if (window.isKunde?.()) {
    return renderEmptyState({
      icon: 'document',
      title: 'Kein Briefing vorhanden',
      text: 'Für diese Linie liegt kein Briefing-Dokument vor.'
    });
  }
  return renderEmptyState({
    icon: 'document',
    title: 'Altbestand-Linie ohne Briefing',
    text: 'Diese Linie stammt aus dem alten System. Casting, Konzept, Kooperationen und Skripte sind verknüpft, ein Briefing gibt es nicht.',
    actions: kannBriefingAusfuellen()
      ? [{ label: 'Briefing ausfüllen', action: 'briefing-ausfuellen', variant: 'primary' }]
      : []
  });
}

/**
 * Hebt die Sperre auf: ab dann ist die Linie eine normale Linie. Beim ersten Speichern
 * des Briefings gleicht V2 Namen, Listentyp und TKP des Castings mit dem Briefing ab.
 * @returns {Promise<boolean>} true, wenn freigeschaltet
 */
export async function briefingAusfuellen(briefingId) {
  if (!briefingId || !window.supabase) return false;
  const res = await window.confirmationModal?.open({
    title: 'Briefing ausfüllen?',
    message: 'Die Linie wird zu einer normalen Linie. Beim Speichern des Briefings werden Name, Listentyp und TKP des Castings sowie der Konzept-Name an das Briefing angepasst. Liky und Casting-Vorschläge sind danach freigeschaltet.',
    confirmText: 'Briefing ausfüllen',
    cancelText: 'Abbrechen',
    danger: true
  });
  if (!res?.confirmed) return false;

  const { error } = await window.supabase
    .from('campaign_briefings')
    .update({ ist_altbestand: false })
    .eq('id', briefingId);
  if (error) {
    console.error('Briefing ausfüllen fehlgeschlagen:', error);
    window.toastSystem?.show?.('Die Linie konnte nicht freigeschaltet werden.', 'error');
    return false;
  }
  return true;
}

/** Hinweis rendern und die Aktion anbinden. `onFreigeschaltet` lädt die Linien neu. */
export function mountAltbestandHinweis(host, briefingId, { onFreigeschaltet } = {}) {
  host.innerHTML = renderAltbestandHinweis();
  bindEmptyStateActions(host, {
    'briefing-ausfuellen': async () => {
      if (await briefingAusfuellen(briefingId)) await onFreigeschaltet?.();
    }
  });
}
