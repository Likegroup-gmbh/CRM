// MarkeDetailLoader.js
// Daten-Laden: loadCriticalData (parallelLoad) + loadMarkeTabData (tabDataCache mit Race-Guard)

import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { updateKampagnenTab, updateAuftraegeTab, updateBriefingsTab, updateKooperationenTab, updateRechnungenTab, updateStrategienTab, updatePersonasTab, updateProdukteTab } from './MarkeDetailTabUpdates.js';
import { PersonaService } from '../persona/PersonaService.js';
import { ProduktService } from '../produkt/ProduktService.js';

export async function loadCriticalData(detail) {
  try {
    const [
      markeResult,
      branchenResult,
      ansprechpartnerResult,
      dokumentResult
    ] = await parallelLoad([
      () => window.supabase
        .from('marke')
        .select(`
          *,
          unternehmen:unternehmen_id(id, firmenname),
          branche:branche_id(name)
        `)
        .eq('id', detail.markeId)
        .single(),

      () => window.supabase
        .from('marke_branchen')
        .select(`
          branche_id,
          branche:branche_id(name)
        `)
        .eq('marke_id', detail.markeId),

      () => window.supabase
        .from('ansprechpartner_marke')
        .select(`
          ansprechpartner_id,
          ansprechpartner:ansprechpartner_id (
            *,
            position:position_id(name),
            unternehmen:unternehmen_id(firmenname),
            telefonnummer_land:eu_laender!telefonnummer_land_id (
              id, name, name_de, iso_code, vorwahl
            ),
            telefonnummer_office_land:eu_laender!telefonnummer_office_land_id (
              id, name, name_de, iso_code, vorwahl
            ),
            kunde_ansprechpartner(kunde_id)
          )
        `)
        .eq('marke_id', detail.markeId),

      () => window.supabase
        .from('entity_dokumente')
        .select('*')
        .eq('entity_type', 'marke')
        .eq('entity_id', detail.markeId)
        .maybeSingle()
    ]);

    if (markeResult.error) throw markeResult.error;
    detail.marke = markeResult.data;
    detail.strategieDokument = (!dokumentResult?.error && dokumentResult?.data) ? dokumentResult.data : null;

    if (!branchenResult.error && branchenResult.data && branchenResult.data.length > 0) {
      detail.marke.branchen = branchenResult.data.map(item => item.branche);
    } else {
      detail.marke.branchen = [];
    }

    if (!ansprechpartnerResult.error) {
      detail.ansprechpartner = (ansprechpartnerResult.data || []).map(item => {
        const ap = item.ansprechpartner;
        if (!ap) return null;
        ap.ist_verknuepft = (ap.kunde_ansprechpartner?.length ?? 0) > 0;
        delete ap.kunde_ansprechpartner;
        return ap;
      }).filter(Boolean);
    } else {
      detail.ansprechpartner = [];
    }

  } catch (error) {
    console.error('Fehler beim Laden der kritischen Daten:', error);
    throw error;
  }
}

export async function loadMarkeTabData(detail, tabName) {
  const requestId = `${tabName}-${Date.now()}`;
  detail._tabAbortControllers.set(tabName, requestId);
  detail._currentLoadingTab = tabName;

  const isStillActive = () => detail._tabAbortControllers.get(tabName) === requestId;

  return await tabDataCache.load('marke', detail.markeId, tabName, async () => {
    try {
      switch(tabName) {
        case 'kampagnen': {
          const { data: kampagnen } = await window.supabase
            .from('kampagne')
            .select('*')
            .eq('marke_id', detail.markeId);
          if (!isStillActive()) return kampagnen;
          detail.kampagnen = kampagnen || [];
          updateKampagnenTab(detail);
          return kampagnen;
        }

        case 'auftraege': {
          const { data: auftraege } = await window.supabase
            .from('auftrag')
            .select('*')
            .eq('marke_id', detail.markeId);
          if (!isStillActive()) return auftraege;
          detail.auftraege = auftraege || [];
          updateAuftraegeTab(detail);
          return auftraege;
        }

        case 'briefings': {
          const { data: briefings } = await window.supabase
            .from('campaign_briefings')
            .select('id, aktivierung_name, bereich, is_draft, content_deadline, marke_id, created_at')
            .eq('marke_id', detail.markeId)
            .order('created_at', { ascending: false });
          if (!isStillActive()) return briefings;
          detail.briefings = briefings || [];
          updateBriefingsTab(detail);
          return briefings;
        }

        case 'kooperationen': {
          if (!detail.kampagnen || detail.kampagnen.length === 0) {
            await loadMarkeTabData(detail, 'kampagnen');
          }
          if (!isStillActive()) return detail.kooperationen;
          const kampagneIds = (detail.kampagnen || []).map(k => k.id).filter(Boolean);
          if (kampagneIds.length > 0) {
            const { data: kooperationen } = await window.supabase
              .from('kooperationen')
              .select(`
                id, name, status, videoanzahl, einkaufspreis_gesamt, kampagne_id, creator_id, created_at,
                creator:creator_id (vorname, nachname),
                kampagne:kampagne_id (kampagnenname, eigener_name)
              `)
              .in('kampagne_id', kampagneIds)
              .order('created_at', { ascending: false });
            if (!isStillActive()) return kooperationen;
            detail.kooperationen = kooperationen || [];
          } else {
            detail.kooperationen = [];
          }
          updateKooperationenTab(detail);
          return detail.kooperationen;
        }

        case 'rechnungen': {
          if (!detail.auftraege || detail.auftraege.length === 0) {
            await loadMarkeTabData(detail, 'auftraege');
          }
          if (!isStillActive()) return detail.rechnungen;
          const auftragIds = (detail.auftraege || []).map(a => a.id).filter(Boolean);
          if (auftragIds.length > 0) {
            const { data: rechnungen } = await window.supabase
              .from('rechnung')
              .select('id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, zahlungsziel, bezahlt_am, pdf_url, auftrag_id, rechnung_pdfs(id, file_name, file_path, file_url)')
              .in('auftrag_id', auftragIds);
            if (!isStillActive()) return rechnungen;
            detail.rechnungen = rechnungen || [];
          } else {
            detail.rechnungen = [];
          }
          updateRechnungenTab(detail);
          return detail.rechnungen;
        }

        case 'strategien': {
          const { data: strategien } = await window.supabase
            .from('strategie')
            .select('id, name, beschreibung, teilbereich, created_at, updated_at, created_by_user:created_by(id, name)')
            .eq('marke_id', detail.markeId)
            .order('created_at', { ascending: false });
          if (!isStillActive()) return strategien;
          detail.strategien = strategien || [];
          updateStrategienTab(detail);
          return strategien;
        }

        case 'personas': {
          const personas = await PersonaService.loadForContext({ markeId: detail.markeId });
          if (!isStillActive()) return personas;
          detail.personas = personas;
          updatePersonasTab(detail);
          return personas;
        }

        case 'produkte': {
          const produkte = await ProduktService.loadForContext({ markeId: detail.markeId });
          if (!isStillActive()) return produkte;
          detail.produkte = produkte;
          updateProdukteTab(detail);
          return produkte;
        }
      }
    } catch (error) {
      console.error(`Fehler beim Laden von Tab ${tabName}:`, error);
      return null;
    }
  });
}
