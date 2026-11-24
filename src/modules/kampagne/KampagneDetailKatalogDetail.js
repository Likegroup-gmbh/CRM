// KampagneDetailKatalogDetail.js
// Produkt oder Persona im eigenen Tab der Produktion (ADR 0079): das Formular wie auf
// /produkt/:id bzw. /persona/:id, nur im Pane. Rechts in der Tab-Zeile die Wahl der
// Linie ("Alle …" führt zur Liste), die Breadcrumb hängt den Namen an.
// Speichern, Abbrechen und Löschen schließen zurück zur Liste.

import { ProduktForm } from '../produkt/ProduktForm.js';
import { PersonaForm } from '../persona/PersonaForm.js';
import { loadBriefingProdukte } from '../briefing/BriefingProdukte.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { bindListenSwitch, clearListenSwitch, effectiveLinie, placeListenSwitch } from './linienScope.js';
import { renderDetailWahl } from './detailWahlSwitch.js';
import { isPaneGenCurrent } from './KampagneDetailWorkflow.js';
import { markiereAnsicht, offeneId, tabUrl } from './produktionTabDetail.js';
import { zeigeImTab, zeigeTabListe } from './produktionFlowRoute.js';

const nachName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'de');

async function ladeLiniePersonas(linieId) {
  const db = window.supabase;
  if (!linieId || !db) return [];
  const { data: briefing, error } = await db.from('campaign_briefings')
    .select('persona_ids').eq('id', linieId).maybeSingle();
  if (error) throw error;
  const ids = (briefing?.persona_ids || []).filter(Boolean);
  if (!ids.length) return [];
  const { data, error: personaError } = await db.from('personas').select('id, name').in('id', ids);
  if (personaError) throw personaError;
  return (data || []).sort(nachName);
}

const ARTEN = {
  produkte: {
    Form: ProduktForm,
    attr: 'data-produkt-wahl',
    alleLabel: 'Alle Produkte',
    leerLabel: 'Produkt wählen',
    title: 'Produkt wechseln',
    blatt: 'Produkt',
    eintraege: loadBriefingProdukte
  },
  personas: {
    Form: PersonaForm,
    attr: 'data-persona-wahl',
    alleLabel: 'Alle Personas',
    leerLabel: 'Persona wählen',
    title: 'Persona wechseln',
    blatt: 'Persona',
    eintraege: ladeLiniePersonas
  }
};

async function zeigeWahl(detail, tab, { linieId, aktivId, aktuell }) {
  const art = ARTEN[tab];
  let eintraege = [];
  try {
    eintraege = await art.eintraege(linieId);
  } catch (error) {
    console.warn(`⚠️ KAMPAGNEDETAIL: Wahl im Tab ${tab} nicht geladen:`, error?.message || error);
  }
  if (!aktuell()) return;
  const html = renderDetailWahl({
    attr: art.attr,
    items: eintraege.map(e => ({ id: e.id, label: e.name || 'Unbenannt' })),
    aktivId,
    alleLabel: art.alleLabel,
    leerLabel: art.leerLabel,
    title: art.title
  });
  const { slot } = placeListenSwitch(html, 'kampagne-katalog-wahl');
  if (!slot) return;
  bindListenSwitch(slot, art.attr, (id) => {
    if (id) zeigeImTab(detail, tab, id);
    else zeigeTabListe(detail, tab);
  });
}

/** Offenes Produkt bzw. offene Persona in den Pane. gen: Pane-Generation beim Start. */
export async function mountKatalogDetail(detail, tab, pane, gen) {
  const art = ARTEN[tab];
  const id = offeneId(detail, tab);
  const linieId = effectiveLinie(detail, tab);
  const form = new art.Form();
  detail.katalogForm = { tab, form };
  const aktuell = () => isPaneGenCurrent(detail, tab, gen) && pane.isConnected && detail.katalogForm?.form === form;

  markiereAnsicht(tab, true);
  pane.innerHTML = '<div class="katalog-im-flow"></div>';
  void zeigeWahl(detail, tab, { linieId, aktivId: id, aktuell });

  try {
    await form.mountEmbedded(pane.firstElementChild, id, {
      briefingId: linieId,
      onTitel: (label) => {
        detail._updateBreadcrumb?.({ produktionUrl: tabUrl(detail, tab) });
        window.breadcrumbSystem?.showEditLeaf(label || art.blatt);
      },
      onSchliessen: () => {
        if (aktuell()) zeigeImTab(detail, tab, null);
      }
    });
  } catch (error) {
    // Abgebaut, während das Formular lud: der nächste Mount hat den Pane schon
    if (!aktuell()) return;
    console.error(`❌ KAMPAGNEDETAIL: ${art.blatt} im Tab fehlgeschlagen:`, error);
    pane.innerHTML = renderEmptyState({
      icon: 'info',
      title: 'Fehler beim Laden',
      text: `${art.blatt} konnte nicht geladen werden.`
    });
  }
}

/** Formular abbauen (Tab verlassen, anderes Ziel, Neurendern). Das Offene bleibt gemerkt. */
export function unmountKatalogDetail(detail) {
  const offen = detail.katalogForm;
  if (!offen) return;
  detail.katalogForm = null;
  offen.form.destroy();
  markiereAnsicht(offen.tab, false);
  clearListenSwitch();
  if (detail._isMounted) detail._updateBreadcrumb?.();
}
