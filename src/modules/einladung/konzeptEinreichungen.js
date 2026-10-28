// konzeptEinreichungen.js
// Konzept-Seite des zentralen Eingangs (EinreichungInbox, ADR 0059): offene Creator-Ideen stehen auf
// dem Konzepte-Tab der Produktion in der Ansicht „Creator-Ideen“ (Switch neben dem Konzept-Dropdown),
// als Tabelle. „Prüfen“ öffnet den Videoidee-Drawer (kein eigener Screen); der Zähler hängt am Tab
// „Konzepte“ und am Switch.

import { mountEinreichungInbox, syncEinreichungsZaehler, istStaff } from './EinreichungInbox.js';
import { effectiveLinie } from '../kampagne/linienScope.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';

/**
 * Filter des Konzept-Eingangs: die gewählte Linie, bei „Alle Linien“ alle Linien der Produktion.
 * Nur im Workflow-Modus, sonst nichts.
 */
export function konzeptEinreichungFilter(detail) {
  if (detail?.mode !== 'workflow') return null;
  const linieId = effectiveLinie(detail, 'konzepte');
  if (linieId) return { briefingId: linieId };
  const ids = (detail.linien || []).map((l) => l.id).filter(Boolean);
  return ids.length ? { briefingIds: ids } : null;
}

/**
 * Konzept, in das die Idee kommt: das Konzept der Linie, an der die Einladung hängt.
 * Gibt es mehrere, gewinnt das gerade gewählte.
 */
export async function konzeptFuerEinreichung(detail, einreichung) {
  const briefingId = einreichung?.einladung?.briefing_id;
  if (!briefingId || !detail?.kampagneId) return null;
  const { data, error } = await window.supabase
    .from('strategie')
    .select('id')
    .eq('kampagne_id', detail.kampagneId)
    .eq('briefing_id', briefingId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const ids = (data || []).map((s) => s.id);
  return ids.includes(detail._konzeptSelectedId) ? detail._konzeptSelectedId : (ids[0] || null);
}

async function pruefen(detail, einreichung, neuLaden) {
  try {
    const strategieId = await konzeptFuerEinreichung(detail, einreichung);
    if (!strategieId) {
      window.toastSystem?.show('Für diese Linie gibt es noch kein Konzept.', 'warning');
      return;
    }
    const { oeffneKonzeptEinreichung } = await import('../strategie/KonzeptEinreichungDrawer.js');
    await oeffneKonzeptEinreichung({ strategieId, einreichung, onAngelegt: neuLaden });
  } catch (error) {
    console.error('Konzept-Einreichung prüfen fehlgeschlagen:', error);
    window.toastSystem?.show('Die Einreichung konnte nicht geöffnet werden.', 'error');
  }
}

const leerHtml = () => renderEmptyState({
  icon: 'info',
  title: 'Keine offenen Ideen',
  text: 'Sobald ein Creator eine Idee über die Einladung einreicht, steht sie hier.'
});

/** Creator-Ideen als Tabelle in den Host der Ideen-Ansicht mounten. */
export function mountKonzeptEinreichungen(detail, host) {
  if (!istStaff()) return Promise.resolve();
  return mountEinreichungInbox({
    art: 'konzept',
    host,
    filter: konzeptEinreichungFilter(detail),
    tabBadge: true,
    leerHtml: leerHtml(),
    onPruefen: (einreichung, neuLaden) => pruefen(detail, einreichung, neuLaden)
  });
}

/** Nur den Zähler aktualisieren (z. B. wenn der Konzepte-Tab nicht offen ist). */
export function syncKonzeptZaehler(detail) {
  return syncEinreichungsZaehler('konzept', konzeptEinreichungFilter(detail));
}
