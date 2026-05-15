// MitarbeiterDetailLoader.js
// Daten-Laden für Mitarbeiter-Detailseite (Phase 1 + 2)

import staticDataCache from '../../core/cache/StaticDataCache.js';

export async function loadMitarbeiterData(detail) {
  try {
    // Phase 1: Paralleler Batch – User + direkte Relationen
    const userPromise = (async () => {
      const { data, error } = await window.supabase
        .from('benutzer')
        .select('*, mitarbeiter_klasse:mitarbeiter_klasse_id(id, name), telefonnummer_firmenhandy_land:telefonnummer_firmenhandy_land_id(id, name_de, vorwahl, iso_code)')
        .eq('id', detail.userId)
        .single();
      if (error) {
        console.warn('Mitarbeiter-Ladung mit Firmenhandy-Feldern fehlgeschlagen, nutze Fallback:', error.message);
        const fb = await window.supabase
          .from('benutzer')
          .select('*, mitarbeiter_klasse:mitarbeiter_klasse_id(id, name)')
          .eq('id', detail.userId)
          .single();
        return fb.data;
      }
      return data;
    })();

    const [
      user,
      { data: kampRel },
      { data: koops },
      { data: briefs },
      statusRows,
      { data: unternehmenRel },
      { data: markenRel },
      euLaenderRows
    ] = await Promise.all([
      userPromise,
      window.supabase
        .from('kampagne_mitarbeiter')
        .select('kampagne:kampagne_id(id, kampagnenname, eigener_name)')
        .eq('mitarbeiter_id', detail.userId),
      window.supabase
        .from('kooperationen')
        .select('id, name, kampagne:kampagne_id(kampagnenname, eigener_name), einkaufspreis_netto, einkaufspreis_zusatzkosten, einkaufspreis_gesamt')
        .eq('assignee_id', detail.userId),
      window.supabase
        .from('briefings')
        .select('id, product_service_offer, status')
        .eq('assignee_id', detail.userId),
      staticDataCache.get('kampagne_status', 'id, name, sort_order', 'sort_order'),
      window.supabase
        .from('mitarbeiter_unternehmen')
        .select('unternehmen:unternehmen_id(id, firmenname), role')
        .eq('mitarbeiter_id', detail.userId),
      window.supabase
        .from('marke_mitarbeiter')
        .select('marke:marke_id(id, markenname)')
        .eq('mitarbeiter_id', detail.userId),
      staticDataCache.get('eu_laender', 'id, name_de, vorwahl, iso_code', 'name_de')
    ]);

    detail.user = user || {};
    if (detail.user.mitarbeiter_klasse) {
      detail.user.mitarbeiter_klasse_name = detail.user.mitarbeiter_klasse.name;
    }

    const directKampagnen = (kampRel || []).map(r => r.kampagne).filter(Boolean);
    const directKoops = koops || [];
    const unternehmenIds = (unternehmenRel || []).map(r => r.unternehmen?.id).filter(Boolean);

    // Phase 2: Zwei unabhängige Branches parallel
    const branchA = (async () => {
      let unternehmenKampagnen = [];
      if (unternehmenIds.length > 0) {
        try {
          const { data: marken } = await window.supabase
            .from('marke')
            .select('id')
            .in('unternehmen_id', unternehmenIds);
          const markenIds = (marken || []).map(m => m.id).filter(Boolean);
          if (markenIds.length > 0) {
            const { data: kampagnen } = await window.supabase
              .from('kampagne')
              .select('id, kampagnenname, eigener_name')
              .in('marke_id', markenIds);
            unternehmenKampagnen = (kampagnen || []).filter(Boolean);
          }
        } catch (e) {
          console.error('Fehler beim Laden von Unternehmen-Kampagnen:', e);
        }
      }

      const allKampagnenMap = new Map();
      [...directKampagnen, ...unternehmenKampagnen].forEach(k => {
        if (k && k.id) allKampagnenMap.set(k.id, k);
      });
      const allKampagnenIds = Array.from(allKampagnenMap.keys());

      let unternehmenKoops = [];
      if (allKampagnenIds.length > 0) {
        try {
          const { data } = await window.supabase
            .from('kooperationen')
            .select('id, name, status, kampagne:kampagne_id(kampagnenname, eigener_name), einkaufspreis_netto, einkaufspreis_zusatzkosten, einkaufspreis_gesamt')
            .in('kampagne_id', allKampagnenIds);
          unternehmenKoops = data || [];
        } catch (e) {
          console.error('Fehler beim Laden von Unternehmen-Kooperationen:', e);
        }
      }

      const allKoopsMap = new Map();
      [...directKoops, ...unternehmenKoops].forEach(k => {
        if (k && k.id) allKoopsMap.set(k.id, k);
      });
      const allKoops = Array.from(allKoopsMap.values());
      const koopIds = allKoops.map(k => k.id).filter(Boolean);

      let invoicesByKoop = {};
      const totals = { netto: 0, zusatz: 0, gesamt: 0, invoice_netto: 0, invoice_brutto: 0 };
      if (koopIds.length > 0) {
        try {
          const { data: rechnungen } = await window.supabase
            .from('rechnung')
            .select('id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, bezahlt_am, pdf_url, kooperation_id')
            .in('kooperation_id', koopIds);
          (rechnungen || []).forEach(r => {
            if (!invoicesByKoop[r.kooperation_id]) invoicesByKoop[r.kooperation_id] = [];
            invoicesByKoop[r.kooperation_id].push(r);
            totals.invoice_netto += Number(r.nettobetrag || 0);
            totals.invoice_brutto += Number(r.bruttobetrag || 0);
          });
        } catch (_) {
          invoicesByKoop = {};
        }
      }
      allKoops.forEach(k => {
        totals.netto += Number(k.einkaufspreis_netto || 0);
        totals.zusatz += Number(k.einkaufspreis_zusatzkosten || 0);
        totals.gesamt += Number(k.einkaufspreis_gesamt != null ? k.einkaufspreis_gesamt : (Number(k.einkaufspreis_netto || 0) + Number(k.einkaufspreis_zusatzkosten || 0)));
      });

      return {
        kampagnen: Array.from(allKampagnenMap.values()),
        kooperationen: allKoops,
        invoicesByKoop,
        totals
      };
    })();

    const branchB = (async () => {
      if (unternehmenIds.length === 0) return [];
      try {
        const { data: auftraege } = await window.supabase
          .from('auftrag')
          .select('id')
          .in('unternehmen_id', unternehmenIds);
        const auftragIds = (auftraege || []).map(a => a.id).filter(Boolean);
        if (auftragIds.length === 0) return [];
        const { data: auftragsdetails } = await window.supabase
          .from('auftrag_details')
          .select(`
            *,
            auftrag:auftrag_id (
              id,
              auftragsname,
              status
            )
          `)
          .in('auftrag_id', auftragIds)
          .order('created_at', { ascending: false });
        return auftragsdetails || [];
      } catch (e) {
        console.error('Fehler beim Laden von Auftragsdetails:', e);
        return [];
      }
    })();

    const [branchAResult, auftragsdetails] = await Promise.all([branchA, branchB]);

    detail.assignments.kampagnen = branchAResult.kampagnen;
    detail.assignments.kooperationen = branchAResult.kooperationen;
    detail.assignments.briefings = briefs || [];
    detail.assignments.auftragsdetails = auftragsdetails;
    detail.budget = { invoicesByKoop: branchAResult.invoicesByKoop, totals: branchAResult.totals };

    detail.statusOptions = statusRows || [];
    detail.euLaender = euLaenderRows || [];
    detail.zugeordnet = {
      unternehmen: (unternehmenRel || []).map(r => ({
        ...r.unternehmen,
        role: r.role || 'mitarbeiter'
      })).filter(u => u && u.id),
      marken: (markenRel || []).map(r => r.marke).filter(Boolean)
    };
  } catch (e) {
    console.error('Fehler beim Laden Mitarbeiter-Details:', e);
  }
}
