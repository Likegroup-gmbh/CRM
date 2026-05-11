// ProjektErstellenEditLoader.js
// Laedt einen bestehenden Auftrag inklusive auftrag_details, kampagne und
// auftrag_kampagnenart_blocks aus Supabase und konvertiert die Daten in
// das wizard.formData-Format, sodass der ProjektErstellen-Wizard im Edit-Mode
// dieselben Strukturen verwendet wie beim Anlegen.

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

    const [auftragResult, detailsResult, kampagneResult, blocksResult] = await Promise.all([
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
        .order('sort_order', { ascending: true })
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

    const kampagne = kampagnen[0] || null;
    const formData = this.toFormData({ auftrag, details, kampagne, blocks });

    return {
      formData,
      raw: { auftrag, details, kampagne, kampagnen, blocks }
    };
  }

  toFormData({ auftrag, details, kampagne, blocks }) {
    return {
      auftrag: this.mapAuftrag(auftrag),
      details: this.mapDetails(details, blocks),
      kampagne: this.mapKampagne(kampagne, auftrag)
    };
  }

  mapAuftrag(auftrag) {
    const titel = auftrag.titel || auftrag.auftragsname || '';
    return {
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
      erwarteter_monat_zahlungseingang: auftrag.erwarteter_monat_zahlungseingang || null,
      re_faelligkeit: auftrag.re_faelligkeit || null,
      nettobetrag: auftrag.nettobetrag ?? null,
      ust_prozent: auftrag.ust_prozent ?? null,
      ust_betrag: auftrag.ust_betrag ?? null,
      bruttobetrag: auftrag.bruttobetrag ?? null,

      auftragsbestaetigungen_files: []
    };
  }

  mapDetails(details, blocks) {
    const campaignBlocks = this.mapBlocks(blocks);
    const campaign_type = campaignBlocks.map(b => b.campaign_type).filter(Boolean);

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
      campaign_type: campaign_type.length ? campaign_type : (Array.isArray(details.campaign_type) ? details.campaign_type : []),
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
    if (!kampagne) {
      return {
        kampagnenname: auftrag?.titel || auftrag?.auftragsname || ''
      };
    }
    return {
      id: kampagne.id,
      kampagnenname: kampagne.kampagnenname || auftrag?.titel || auftrag?.auftragsname || ''
    };
  }
}

export const projektErstellenEditLoader = new ProjektErstellenEditLoader();
