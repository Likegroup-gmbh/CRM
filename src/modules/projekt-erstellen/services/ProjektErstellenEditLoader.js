// ProjektErstellenEditLoader.js
// Laedt einen bestehenden Auftrag inklusive auftrag_details, kampagne und
// auftrag_kampagnenart_blocks aus Supabase und konvertiert die Daten in
// das wizard.formData-Format, sodass der ProjektErstellen-Wizard im Edit-Mode
// dieselben Strukturen verwendet wie beim Anlegen.
//
// Fallback: Wurden Kampagnenarten ueber den Auftragsdetails-Flow gepflegt
// (Junction `auftrag_kampagne_art` + flache Spalten auf `auftrag_details`),
// existieren keine Eintraege in `auftrag_kampagnenart_blocks` und auch nicht
// zwingend in `auftrag_details.campaign_type`. In dem Fall werden die Slugs
// aus der Junction abgeleitet und Budget-Werte aus den flachen Spalten
// rekonstruiert.

import {
  getChipFromKampagnenartName,
  mapDbColumnsToBudgets,
  normalizeCampaignBlock
} from '../logic/CampaignBudgetFields.js';

const SUPABASE = () => window.supabase;

export class ProjektErstellenEditLoader {
  async load(auftragId) {
    const supabase = SUPABASE();
    if (!supabase) {
      throw new Error('Supabase nicht verfügbar');
    }
    if (!auftragId) {
      throw new Error('Auftrag-ID fehlt');
    }

    const [auftragResult, detailsResult, kampagneResult, blocksResult, junctionResult, teilrechnungenResult] = await Promise.all([
      supabase
        .from('auftrag')
        .select('*')
        .eq('id', auftragId)
        .single(),
      supabase
        .from('auftrag_details')
        .select('*')
        .eq('auftrag_id', auftragId)
        .maybeSingle(),
      supabase
        .from('kampagne')
        .select('*')
        .eq('auftrag_id', auftragId)
        .order('created_at', { ascending: true }),
      supabase
        .from('auftrag_kampagnenart_blocks')
        .select('*')
        .eq('auftrag_id', auftragId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('auftrag_kampagne_art')
        .select('kampagne_art_typen:kampagne_art_id(id, name)')
        .eq('auftrag_id', auftragId),
      supabase
        .from('auftrag_teilrechnung')
        .select('*')
        .eq('auftrag_id', auftragId)
        .order('position', { ascending: true })
    ]);

    if (auftragResult.error) {
      throw auftragResult.error;
    }
    if (!auftragResult.data) {
      throw new Error(`Auftrag ${auftragId} nicht gefunden`);
    }

    const auftrag = auftragResult.data;
    const details = detailsResult.error ? null : detailsResult.data;
    const kampagnen = kampagneResult.error ? [] : (kampagneResult.data || []);
    const blocks = blocksResult.error ? [] : (blocksResult.data || []);
    const junctionRows = junctionResult.error ? [] : (junctionResult.data || []);
    const junctionArtNames = junctionRows
      .map(row => row?.kampagne_art_typen?.name)
      .filter(Boolean);

    const teilrechnungen = teilrechnungenResult.error ? [] : (teilrechnungenResult.data || []);

    const kampagne = kampagnen[0] || null;
    const formData = this.toFormData({ auftrag, details, kampagne, blocks, junctionArtNames, teilrechnungen });

    return {
      formData,
      raw: { auftrag, details, kampagne, kampagnen, blocks, junctionArtNames, teilrechnungen }
    };
  }

  toFormData({ auftrag, details, kampagne, blocks, junctionArtNames = [], teilrechnungen = [] }) {
    return {
      auftrag: this.mapAuftrag(auftrag, teilrechnungen),
      details: this.mapDetails(details, blocks, junctionArtNames, kampagne),
      kampagne: this.mapKampagne(kampagne, auftrag)
    };
  }

  mapAuftrag(auftrag, teilrechnungen = []) {
    const titel = auftrag.titel || auftrag.auftragsname || '';
    const mapped = {
      unternehmen_id: auftrag.unternehmen_id || null,
      marke_id: auftrag.marke_id || null,
      ansprechpartner_id: auftrag.ansprechpartner_id || null,
      auftragtype: auftrag.auftragtype || null,
      start: auftrag.start || null,
      ende: auftrag.ende || null,
      titel,
      // Bei Edit immer als "manuell" behandeln, damit der Generator den geladenen
      // Titel nicht beim ersten Recompute ueberschreibt.
      titel_manuell_geaendert: !!titel,

      angebotsnummer: auftrag.angebotsnummer || '',
      re_nr: auftrag.re_nr || '',
      po: auftrag.po || '',
      externe_po: auftrag.externe_po || '',
      zahlungsziel_tage: auftrag.zahlungsziel_tage ?? null,
      rechnung_gestellt: !!auftrag.rechnung_gestellt,
      rechnung_gestellt_am: auftrag.rechnung_gestellt_am || null,
      re_faelligkeit: auftrag.re_faelligkeit || null,
      erwarteter_monat_zahlungseingang: auftrag.erwarteter_monat_zahlungseingang || null,
      nettobetrag: auftrag.nettobetrag ?? null,
      ust_prozent: auftrag.ust_prozent ?? null,
      ust_betrag: auftrag.ust_betrag ?? null,
      bruttobetrag: auftrag.bruttobetrag ?? null,
      anzahl_teilrechnungen: auftrag.anzahl_teilrechnungen ?? 1,
      teilrechnungen: this.mapTeilrechnungen(teilrechnungen, auftrag),

      auftragsbestaetigungen_files: [],
      rechnungen_files: []
    };

    return mapped;
  }

  mapTeilrechnungen(teilrechnungen, auftrag) {
    if (Array.isArray(teilrechnungen) && teilrechnungen.length > 0) {
      return teilrechnungen.map(tr => ({
        position: tr.position,
        nettobetrag: tr.nettobetrag ?? 0,
        ust_prozent: tr.ust_prozent ?? 19,
        ust_betrag: tr.ust_betrag ?? 0,
        bruttobetrag: tr.bruttobetrag ?? 0,
        re_nr: tr.re_nr || '',
        externe_po: tr.externe_po || '',
        rechnung_gestellt: !!tr.rechnung_gestellt,
        rechnung_gestellt_am: tr.rechnung_gestellt_am || null,
        re_faelligkeit: tr.re_faelligkeit || null,
        erwarteter_monat_zahlungseingang: tr.erwarteter_monat_zahlungseingang || null,
        notiz: tr.notiz || '',
        ueberwiesen: !!tr.ueberwiesen,
        ueberwiesen_am: tr.ueberwiesen_am || null
      }));
    }

    // Fallback: Alten Auftrag ohne Teilrechnungen → synthetischen Block aus Auftragsfeldern
    const netto = parseFloat(auftrag.nettobetrag) || 0;
    const ustProzent = parseFloat(auftrag.ust_prozent) || 19;
    const ustBetrag = +(netto * ustProzent / 100).toFixed(2);
    return [{
      position: 1,
      nettobetrag: netto,
      ust_prozent: ustProzent,
      ust_betrag: ustBetrag,
      bruttobetrag: +(netto + ustBetrag).toFixed(2),
      re_nr: auftrag.re_nr || '',
      externe_po: auftrag.externe_po || '',
      rechnung_gestellt: !!auftrag.rechnung_gestellt,
      rechnung_gestellt_am: auftrag.rechnung_gestellt_am || null,
      re_faelligkeit: auftrag.re_faelligkeit || null,
      erwarteter_monat_zahlungseingang: auftrag.erwarteter_monat_zahlungseingang || null,
      notiz: '',
      ueberwiesen: !!auftrag.ueberwiesen,
      ueberwiesen_am: auftrag.ueberwiesen_am || null
    }];
  }

  mapDetails(details, blocks, junctionArtNames = [], kampagne = null) {
    // 1) Primaerquelle: vorhandene Blocks aus auftrag_kampagnenart_blocks
    let campaignBlocks = this.mapBlocks(blocks);
    let campaign_type = campaignBlocks.map(b => b.campaign_type).filter(Boolean);

    // 2) Fallback: campaign_type Array auf auftrag_details (Wizard-Legacy)
    if (campaignBlocks.length === 0 && details && Array.isArray(details.campaign_type) && details.campaign_type.length > 0) {
      const slugsFromDetails = details.campaign_type.filter(Boolean);
      campaign_type = slugsFromDetails;
      campaignBlocks = this.buildBlocksFromSlugs(slugsFromDetails, details);
    }

    // 3) Fallback: Junction auftrag_kampagne_art -> Slugs ableiten und
    //    Budgets aus flachen Spalten (auftrag_details.<prefix>_*) rekonstruieren.
    if (campaignBlocks.length === 0 && junctionArtNames.length > 0) {
      const slugsFromJunction = Array.from(new Set(
        junctionArtNames.map(getChipFromKampagnenartName).filter(Boolean)
      ));
      if (slugsFromJunction.length > 0) {
        campaign_type = slugsFromJunction;
        campaignBlocks = this.buildBlocksFromSlugs(slugsFromJunction, details);
      }
    }

    // 4) Fallback: kampagne.art_der_kampagne Labels -> Wizard-Slugs.
    //    Aeltere Auftraege haben oft nur hier ihre Kampagnenarten gespeichert.
    if (campaignBlocks.length === 0 && Array.isArray(kampagne?.art_der_kampagne) && kampagne.art_der_kampagne.length > 0) {
      const slugsFromKampagne = kampagne.art_der_kampagne
        .map(getChipFromKampagnenartName)
        .filter(Boolean);
      const uniqueSlugs = [...new Set(slugsFromKampagne)];
      if (uniqueSlugs.length > 0) {
        campaign_type = uniqueSlugs;
        campaignBlocks = this.buildBlocksFromSlugs(uniqueSlugs, details);
      }
    }

    if (!details) {
      return {
        campaign_type,
        campaign_blocks: campaignBlocks,
        campaign_budgets: {},
        agency_services_enabled: false,
        retainer_type: 'none',
        retainer_amount: 0,
        extra_services_enabled: false,
        extra_services: [],
        percentage_fee_enabled: false,
        percentage_fee_value: 0,
        percentage_fee_base: 'total_budget',
        ksk_enabled: false,
        ksk_type: 'fixed',
        ksk_value: 0
      };
    }

    const extraServices = Array.isArray(details.extra_services) ? details.extra_services : [];

    return {
      campaign_type,
      campaign_blocks: campaignBlocks,
      campaign_budgets: {},
      agency_services_enabled: !!details.agency_services_enabled,
      retainer_type: details.retainer_type || 'none',
      retainer_amount: details.retainer_amount ?? 0,
      extra_services_enabled: extraServices.length > 0 || !!details.extra_services_enabled,
      extra_services: extraServices,
      percentage_fee_enabled: !!details.percentage_fee_enabled,
      percentage_fee_value: details.percentage_fee_value ?? 0,
      percentage_fee_base: details.percentage_fee_base || 'total_budget',
      ksk_enabled: !!details.ksk_enabled,
      ksk_type: details.ksk_type || 'fixed',
      ksk_value: details.ksk_value ?? 0
    };
  }

  /**
   * Baut campaign_blocks aus einer Slug-Liste und fuellt sie mit Werten aus
   * den flachen Budget-Spalten von auftrag_details (z.B. ugc_paid_video_anzahl,
   * vor_ort_einkaufspreis_netto_von, ...). Wird genutzt, wenn keine Eintraege
   * in auftrag_kampagnenart_blocks vorhanden sind, die Daten aber bereits
   * via Auftragsdetails-Flow gepflegt wurden.
   */
  buildBlocksFromSlugs(slugs = [], details = null) {
    if (!Array.isArray(slugs) || slugs.length === 0) return [];
    const budgets = details ? mapDbColumnsToBudgets(details, slugs) : {};
    return slugs.map(slug => normalizeCampaignBlock({
      campaign_type: slug,
      ...(budgets[slug] || {})
    }, slug));
  }

  mapBlocks(blocks) {
    return (blocks || []).map(b => ({
      // ID aus DB uebernehmen, damit DOM-Elemente und Diffs konsistent bleiben
      id: b.id,
      campaign_type: b.campaign_type,
      video_anzahl: b.video_anzahl ?? null,
      creator_anzahl: b.creator_anzahl ?? null,
      einkaufspreis_netto_von: b.einkaufspreis_netto_von ?? null,
      einkaufspreis_netto_bis: b.einkaufspreis_netto_bis ?? null,
      verkaufspreis_netto_von: b.verkaufspreis_netto_von ?? null,
      verkaufspreis_netto_bis: b.verkaufspreis_netto_bis ?? null,
      budget_info: b.budget_info || '',
      status: b.status || 'offen'
    }));
  }

  mapKampagne(kampagne, auftrag) {
    const fallbackName = auftrag?.titel || auftrag?.auftragsname || '';
    if (!kampagne) {
      return { kampagnenname: fallbackName };
    }
    return {
      id: kampagne.id,
      kampagnenname: kampagne.eigener_name || kampagne.kampagnenname || fallbackName
    };
  }
}

export const projektErstellenEditLoader = new ProjektErstellenEditLoader();
