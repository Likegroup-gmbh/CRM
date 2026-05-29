// UnternehmenDetailLoader.js
// Daten-Laden für Unternehmen-Detailseite (Batch 1–3)

export async function loadUnternehmenData(detail) {
  try {
    // ========== BATCH 1: Alle unabhängigen Abfragen parallel ==========
    const [
      unternehmenResult,
      branchenResult,
      markenResult,
      auftraegeResult,
      briefingsResult,
      kampagnenResult,
      rechnungenResult,
      vertraegeResult,
      strategienResult,
      creatorAuswahlenResult,
      kickoffResult,
      ansprechpartnerResult
    ] = await Promise.all([
      window.supabase.from('unternehmen').select('*').eq('id', detail.unternehmenId).single(),
      window.supabase.from('unternehmen_branchen').select('branche_id, branchen:branche_id (id, name)').eq('unternehmen_id', detail.unternehmenId),
      window.supabase.from('marke').select('*').eq('unternehmen_id', detail.unternehmenId),
      window.supabase.from('auftrag').select('*, marke:marke_id(id, markenname, logo_url), ansprechpartner:ansprechpartner_id(id, vorname, nachname, profile_image_url), created_by:created_by_id(id, name, profile_image_url)').eq('unternehmen_id', detail.unternehmenId).order('created_at', { ascending: false }),
      window.supabase.from('briefings').select('id, product_service_offer, status, deadline, unternehmen_id, marke_id, kampagne_id, created_at, marke:marke_id(id, markenname, logo_url), kampagne:kampagne_id(id, kampagnenname, eigener_name), assignee:assignee_id(id, name, profile_image_url)').eq('unternehmen_id', detail.unternehmenId).order('created_at', { ascending: false }),
      window.supabase.from('kampagne').select('id, kampagnenname, eigener_name, status, start, deadline, art_der_kampagne, creatoranzahl, videoanzahl, unternehmen_id, auftrag_id, marke:marke_id(id, markenname, logo_url)').eq('unternehmen_id', detail.unternehmenId).order('created_at', { ascending: false }),
      window.supabase.from('rechnung').select('id, rechnung_nr, rechnungstyp, status, nettobetrag, bruttobetrag, gestellt_am, zahlungsziel, bezahlt_am, po_nummer, land, videoanzahl, created_at, pdf_url, auftrag:auftrag_id(id, auftragsname), kampagne:kampagne_id(id, kampagnenname, eigener_name), creator:creator_id(id, vorname, nachname), created_by:created_by_id(id, name, profile_image_url), rechnung_pdfs(id, file_name, file_path, file_url)').eq('unternehmen_id', detail.unternehmenId).order('gestellt_am', { ascending: false }),
      window.supabase.from('vertraege').select('id, name, typ, is_draft, datei_url, datei_path, created_at, kampagne:kampagne_id(id, kampagnenname, eigener_name), creator:creator_id(id, vorname, nachname)').eq('kunde_unternehmen_id', detail.unternehmenId).order('created_at', { ascending: false }),
      window.supabase.from('strategie').select('id, name, teilbereich, created_at, created_by_user:created_by(id, name)').eq('unternehmen_id', detail.unternehmenId).order('created_at', { ascending: false }),
      window.supabase.from('creator_auswahl').select('id, name, created_at').eq('unternehmen_id', detail.unternehmenId).order('created_at', { ascending: false }),
      window.supabase.from('marke_kickoff').select('*').eq('unternehmen_id', detail.unternehmenId).is('marke_id', null),
      window.supabase.from('ansprechpartner_unternehmen').select(`
        ansprechpartner_id,
        ansprechpartner:ansprechpartner_id (
          *,
          position:position_id(name),
          unternehmen:unternehmen_id(firmenname, logo_url),
          telefonnummer_land:eu_laender!telefonnummer_land_id (id, name, name_de, iso_code, vorwahl),
          telefonnummer_office_land:eu_laender!telefonnummer_office_land_id (id, name, name_de, iso_code, vorwahl),
          kunde_ansprechpartner(kunde_id)
        )
      `).eq('unternehmen_id', detail.unternehmenId)
    ]);

    if (unternehmenResult.error) throw unternehmenResult.error;
    detail.unternehmen = unternehmenResult.data;

    if (!branchenResult.error && branchenResult.data) {
      detail.unternehmen.branche_id = branchenResult.data.map(b => b.branche_id);
      detail.unternehmen.branchen_names = branchenResult.data.map(b => b.branchen?.name).filter(Boolean);
    }

    detail.marken = markenResult.data || [];
    detail.auftraege = auftraegeResult.data || [];
    detail.briefings = briefingsResult.data || [];
    detail.kampagnen = kampagnenResult.data || [];
    detail.rechnungen = rechnungenResult.data || [];
    detail.vertraege = vertraegeResult.data || [];
    detail.strategien = strategienResult.data || [];
    detail.creatorAuswahlen = creatorAuswahlenResult.data || [];
    detail.kickoffsByType = { influencer: null, paid: null, organic: null };
    (kickoffResult.data || []).forEach(item => {
      const typeKey = item.kampagnenart || item.kickoff_type || 'organic';
      if (typeKey === 'paid' || typeKey === 'organic' || typeKey === 'influencer') {
        detail.kickoffsByType[typeKey] = item;
      }
    });
    if (!detail.kickoffsByType[detail.activeKickoffType]) {
      detail.activeKickoffType = detail.kickoffsByType.influencer
        ? 'influencer'
        : (detail.kickoffsByType.organic
          ? 'organic'
          : (detail.kickoffsByType.paid ? 'paid' : 'influencer'));
    }
    detail.kickoff = detail.kickoffsByType[detail.activeKickoffType] || null;

    detail.kickoffMarkenwerteByType = { influencer: [], paid: [], organic: [] };
    const kickoffEntries = Object.entries(detail.kickoffsByType).filter(([, value]) => value);
    if (kickoffEntries.length > 0) {
      try {
        const markenwerteResults = await Promise.all(
          kickoffEntries.map(async ([typeKey, kickoffItem]) => {
            const { data: markenwerte } = await window.supabase
              .from('marke_kickoff_markenwerte')
              .select('markenwert:markenwert_id(id, name)')
              .eq('kickoff_id', kickoffItem.id);
            return { typeKey, markenwerte: markenwerte?.map(m => m.markenwert) || [] };
          })
        );
        markenwerteResults.forEach(({ typeKey, markenwerte }) => {
          detail.kickoffMarkenwerteByType[typeKey] = markenwerte;
        });
        detail.kickoffMarkenwerte = detail.kickoffMarkenwerteByType[detail.activeKickoffType] || [];
      } catch {
        detail.kickoffMarkenwerteByType = { influencer: [], paid: [], organic: [] };
        detail.kickoffMarkenwerte = [];
      }
    } else {
      detail.kickoff = null;
      detail.kickoffMarkenwerteByType = { influencer: [], paid: [], organic: [] };
      detail.kickoffMarkenwerte = [];
    }

    // Ansprechpartner verarbeiten
    if (!ansprechpartnerResult.error) {
      detail.ansprechpartner = (ansprechpartnerResult.data || [])
        .filter(item => item.ansprechpartner)
        .map(item => {
          const ap = item.ansprechpartner;
          ap.ist_verknuepft = (ap.kunde_ansprechpartner?.length ?? 0) > 0;
          delete ap.kunde_ansprechpartner;
          return ap;
        });
    } else {
      detail.ansprechpartner = [];
    }

    // ========== BATCH 2: Abhängige Abfragen parallel ==========
    const auftragIds = detail.auftraege.map(a => a.id).filter(Boolean);
    const kampagneIds = detail.kampagnen.map(k => k.id).filter(Boolean);

    const [auftragsdetailsResult, kooperationenResult, teilrechnungenResult] = await Promise.all([
      auftragIds.length > 0
        ? window.supabase.from('auftrag_details')
            .select('*, auftrag:auftrag_id (id, auftragsname, status, po, start, ende, externe_po, marke:marke_id(id, markenname, logo_url)), created_by:created_by_id(id, name, profile_image_url)')
            .in('auftrag_id', auftragIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      kampagneIds.length > 0
        ? window.supabase.from('kooperationen')
            .select('id, name, status, videoanzahl, einkaufspreis_gesamt, verkaufspreis_gesamt, verkaufspreis_zusatzkosten, kampagne_id, creator_id, created_at, kampagne:kampagne_id(kampagnenname, eigener_name)')
            .in('kampagne_id', kampagneIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      auftragIds.length > 0
        ? window.supabase.from('auftrag_teilrechnung')
            .select('*')
            .in('auftrag_id', auftragIds)
            .order('position', { ascending: true })
        : Promise.resolve({ data: [] })
    ]);

    detail.auftragsdetails = auftragsdetailsResult.data || [];
    detail.kooperationen = kooperationenResult.data || [];

    // Kundenrechnungen: Aufträge nach Teilrechnungen explodieren
    const TR_FIELDS = [
      're_nr', 'externe_po', 'nettobetrag', 'ust_betrag', 'bruttobetrag',
      'rechnung_gestellt', 'rechnung_gestellt_am', 're_faelligkeit',
      'ueberwiesen', 'ueberwiesen_am'
    ];
    const teilrechnungen = teilrechnungenResult.data || [];
    const trByAuftrag = new Map();
    for (const tr of teilrechnungen) {
      if (!trByAuftrag.has(tr.auftrag_id)) trByAuftrag.set(tr.auftrag_id, []);
      trByAuftrag.get(tr.auftrag_id).push(tr);
    }

    const exploded = [];
    for (const auftrag of detail.auftraege) {
      const base = {
        id: auftrag.id,
        auftragsname: auftrag.auftragsname,
        angebotsnummer: auftrag.angebotsnummer,
        re_nr: auftrag.re_nr,
        externe_po: auftrag.externe_po,
        zahlungsziel_tage: auftrag.zahlungsziel_tage,
        re_faelligkeit: auftrag.re_faelligkeit,
        nettobetrag: auftrag.nettobetrag,
        ust_betrag: auftrag.ust_betrag,
        bruttobetrag: auftrag.bruttobetrag,
        rechnung_gestellt: auftrag.rechnung_gestellt,
        rechnung_gestellt_am: auftrag.rechnung_gestellt_am,
        ueberwiesen: auftrag.ueberwiesen,
        ueberwiesen_am: auftrag.ueberwiesen_am,
        marke: auftrag.marke,
        status: auftrag.status
      };

      const trs = trByAuftrag.get(auftrag.id);
      if (trs && trs.length > 0) {
        const total = trs.length;
        for (const tr of trs) {
          const row = { ...base };
          for (const field of TR_FIELDS) {
            if (tr[field] !== undefined) row[field] = tr[field];
          }
          row._teilrechnung = { position: tr.position, total, label: `${tr.position} von ${total}` };
          exploded.push(row);
        }
      } else {
        base._teilrechnung = { position: 1, total: 1, label: '1 von 1' };
        exploded.push(base);
      }
    }
    detail.kundenrechnungen = exploded;

    // ========== BATCH 3: Creator + Kampagnenart-Typen parallel laden ==========
    const creatorIds = Array.from(new Set(detail.kooperationen.map(k => k.creator_id).filter(Boolean)));
    const allArtIds = Array.from(new Set(
      detail.kampagnen.flatMap(k => Array.isArray(k.art_der_kampagne) ? k.art_der_kampagne : []).filter(Boolean)
    ));

    const [creatorsResult, artTypenResult] = await Promise.all([
      creatorIds.length > 0
        ? window.supabase.from('creator')
            .select('id, vorname, nachname, instagram, instagram_follower, tiktok_follower, lieferadresse_strasse, lieferadresse_hausnummer, lieferadresse_plz, lieferadresse_stadt, lieferadresse_land')
            .in('id', creatorIds)
        : Promise.resolve({ data: [] }),
      allArtIds.length > 0
        ? window.supabase.from('kampagne_art_typen').select('id, name').in('id', allArtIds)
        : Promise.resolve({ data: [] })
    ]);

    detail.creators = creatorsResult.data || [];
    detail._creatorMap = detail.creators.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});

    detail._kampagneArtMap = new Map();
    (artTypenResult.data || []).forEach(t => detail._kampagneArtMap.set(t.id, t.name));

    detail.kampagnen = detail.kampagnen.map(k => {
      const arr = Array.isArray(k.art_der_kampagne) ? k.art_der_kampagne : [];
      return {
        ...k,
        art_der_kampagne_display: arr.map(id => {
          const fullName = detail._kampagneArtMap.get(id) || id;
          return fullName.replace(/[-\s]Kampagne[n]?$/i, '');
        })
      };
    });

  } catch (error) {
    console.error('Fehler beim Laden der Unternehmen-Daten:', error);
    throw error;
  }
}
