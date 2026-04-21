// KampagneDetailDataLoader.js
// Datenlade-Logik für die Kampagnen-Detail-Ansicht

import { VideoTableDataLoader } from './VideoTableDataLoader.js';

/**
 * Lädt Kampagne-Metadaten (ohne Kooperationen/Videos — die kommen via loadFullTableData).
 */
export async function loadCriticalData(kampagneId) {
  console.log('🔄 KAMPAGNEDETAIL: Lade kritische Daten parallel...');
  const startTime = performance.now();

  const [
    kampagneResult,
    ansprechpartnerResult,
    mitarbeiterResult
  ] = await Promise.all([
    window.supabase
      .from('kampagne')
      .select(`
        *,
        unternehmen:unternehmen_id(firmenname, webseite, branche_id),
        marke:marke_id(markenname, webseite),
        auftrag:auftrag_id(auftragsname, status, gesamt_budget, creator_budget, bruttobetrag, nettobetrag)
      `)
      .eq('id', kampagneId)
      .single(),

    window.supabase
      .from('ansprechpartner_kampagne')
      .select(`
        ansprechpartner:ansprechpartner_id(
          id, vorname, nachname, email,
          unternehmen:unternehmen_id(firmenname),
          position:position_id(name)
        )
      `)
      .eq('kampagne_id', kampagneId),

    window.supabase
      .from('v_kampagne_mitarbeiter_aggregated')
      .select('mitarbeiter_id, name, rolle, profile_image_url, zuordnungsart')
      .eq('kampagne_id', kampagneId)
  ]);

  if (kampagneResult.error) throw kampagneResult.error;

  const kampagneData = kampagneResult.data;

  kampagneData.ansprechpartner = ansprechpartnerResult.data
    ?.map(item => item.ansprechpartner)
    .filter(Boolean) || [];

  const mitarbeiterData = mitarbeiterResult.data || [];
  kampagneData.mitarbeiter = mitarbeiterData.map(m => ({
    id: m.mitarbeiter_id,
    name: m.name,
    rolle: m.rolle,
    profile_image_url: m.profile_image_url,
    zuordnungsart: m.zuordnungsart
  }));
  kampagneData.projektmanager = [];
  kampagneData.scripter = [];
  kampagneData.cutter = [];
  kampagneData.copywriter = [];
  kampagneData.strategie = [];
  kampagneData.creator_sourcing = [];

  // Plattformen & Formate parallel laden
  const [plattformResult, formatResult] = await Promise.all([
    window.supabase
      .from('kampagne_plattformen')
      .select('plattform:plattform_id(id, name)')
      .eq('kampagne_id', kampagneId),
    window.supabase
      .from('kampagne_formate')
      .select('format:format_id(id, name)')
      .eq('kampagne_id', kampagneId)
  ]);

  if (plattformResult.data) {
    kampagneData.plattformen = plattformResult.data.map(item => item.plattform).filter(Boolean);
    kampagneData.plattform_ids = kampagneData.plattformen.map(p => p.id);
  }
  if (formatResult.data) {
    kampagneData.formate = formatResult.data.map(item => item.format).filter(Boolean);
    kampagneData.format_ids = kampagneData.formate.map(f => f.id);
  }

  // Mitarbeiter nach Rollen + Ziele parallel laden
  const [rollenResult, paidZieleResult, organicZieleResult] = await Promise.all([
    window.supabase
      .from('kampagne_mitarbeiter')
      .select('role, mitarbeiter:mitarbeiter_id(id, name)')
      .eq('kampagne_id', kampagneId)
      .in('role', ['cutter', 'copywriter', 'strategie', 'creator_sourcing']),
    window.supabase
      .from('kampagne_paid_ziele')
      .select('ziel:ziel_id(id, name)')
      .eq('kampagne_id', kampagneId),
    window.supabase
      .from('kampagne_organic_ziele')
      .select('ziel:ziel_id(id, name)')
      .eq('kampagne_id', kampagneId)
  ]);

  if (rollenResult.data) {
    const byRole = { cutter: [], copywriter: [], strategie: [], creator_sourcing: [] };
    for (const row of rollenResult.data) {
      if (row.mitarbeiter && byRole[row.role]) {
        byRole[row.role].push(row.mitarbeiter);
      }
    }
    kampagneData.cutter = byRole.cutter;
    kampagneData.cutter_ids = byRole.cutter.map(c => c.id);
    kampagneData.copywriter = byRole.copywriter;
    kampagneData.copywriter_ids = byRole.copywriter.map(c => c.id);
    kampagneData.strategie = byRole.strategie;
    kampagneData.strategie_ids = byRole.strategie.map(s => s.id);
    kampagneData.creator_sourcing = byRole.creator_sourcing;
    kampagneData.creator_sourcing_ids = byRole.creator_sourcing.map(c => c.id);
  }

  if (paidZieleResult.data) {
    kampagneData.paid_ziele = paidZieleResult.data.map(item => item.ziel).filter(Boolean);
    kampagneData.paid_ziele_ids = kampagneData.paid_ziele.map(z => z.id);
  }
  if (organicZieleResult.data) {
    kampagneData.organic_ziele = organicZieleResult.data.map(item => item.ziel).filter(Boolean);
    kampagneData.organic_ziele_ids = kampagneData.organic_ziele.map(z => z.id);
  }

  // Kampagnen-Arten laden
  if (kampagneData.art_der_kampagne?.length > 0) {
    const { data: kampagneArten } = await window.supabase
      .from('kampagne_art_typen')
      .select('id, name, beschreibung')
      .in('id', kampagneData.art_der_kampagne);
    kampagneData.kampagne_art_typen = kampagneArten || [];
  }

  // Notizen, Ratings, Strategien, Briefings & Tab-Counts parallel laden
  const [strategienResult, briefingsResult, sourcingCountResult, vertraegeCountResult, rechnungenCountResult] = await Promise.all([
    window.supabase
      .from('strategie')
      .select(`
        id, name, beschreibung, created_at,
        unternehmen:unternehmen_id(id, firmenname, logo_url, internes_kuerzel),
        marke:marke_id(id, markenname, logo_url),
        created_by_user:created_by(id, name, profile_image_url)
      `)
      .eq('kampagne_id', kampagneId)
      .order('created_at', { ascending: false }),
    window.supabase
      .from('briefings')
      .select('id, product_service_offer, deadline, status, created_at, kooperation_id, assignee_id')
      .eq('kampagne_id', kampagneId)
      .order('created_at', { ascending: false }),
    window.supabase
      .from('creator_auswahl')
      .select('id', { count: 'exact', head: true })
      .eq('kampagne_id', kampagneId),
    window.supabase
      .from('vertraege')
      .select('id', { count: 'exact', head: true })
      .eq('kampagne_id', kampagneId),
    window.supabase
      .from('rechnung')
      .select('id', { count: 'exact', head: true })
      .eq('kampagne_id', kampagneId)
  ]);

  const strategien = strategienResult.data || [];

  if (briefingsResult.error) {
    console.error('❌ KAMPAGNEDETAIL: Fehler beim Laden der Briefings:', briefingsResult.error);
  }
  const briefings = briefingsResult.data || [];

  const sourcingListenCount = sourcingCountResult.count || 0;
  const vertraegeCount = vertraegeCountResult.count || 0;
  const rechnungenCount = rechnungenCountResult.count || 0;

  const loadTime = (performance.now() - startTime).toFixed(0);
  console.log(`✅ KAMPAGNEDETAIL: Kritische Daten geladen in ${loadTime}ms`);

  return {
    kampagneData,
    strategien,
    briefings,
    sourcingListenCount,
    vertraegeCount,
    rechnungenCount
  };
}

/**
 * Lädt Tab-spezifische Daten on-demand.
 * Gibt die geladenen Daten zurück.
 */
export async function loadTabData(tabName, kampagneId) {
  console.log(`🔄 KAMPAGNEDETAIL: Lade Daten für Tab: ${tabName}`);
  const startTime = performance.now();

  let result = null;

  switch (tabName) {
    case 'creators': {
      const { data } = await window.supabase
        .from('kampagne_creator')
        .select(`
          *,
          creator:creator_id(
            id, vorname, nachname, instagram, instagram_follower,
            tiktok, tiktok_follower, mail, telefonnummer
          )
        `)
        .eq('kampagne_id', kampagneId);
      result = { creator: data || [] };
      break;
    }
    case 'sourcing': {
      const { data } = await window.supabase
        .from('kampagne_creator_sourcing')
        .select(`
          id,
          creator:creator_id (
            id, vorname, nachname,
            creator_types:creator_creator_type(creator_type:creator_type_id(name)),
            sprachen:creator_sprachen(sprachen:sprache_id(name)),
            branchen:creator_branchen(branchen_creator:branche_id(name)),
            instagram_follower, tiktok_follower,
            lieferadresse_stadt, lieferadresse_land
          )
        `)
        .eq('kampagne_id', kampagneId);

      result = {
        sourcingCreators: (data || []).map(row => {
          const c = row.creator || {};
          return {
            id: c.id, vorname: c.vorname, nachname: c.nachname,
            creator_types: (c.creator_types || []).map(x => x.creator_type).filter(Boolean),
            sprachen: (c.sprachen || []).map(x => x.sprachen).filter(Boolean),
            branchen: (c.branchen || []).map(x => x.branchen_creator).filter(Boolean),
            instagram_follower: c.instagram_follower, tiktok_follower: c.tiktok_follower,
            lieferadresse_stadt: c.lieferadresse_stadt, lieferadresse_land: c.lieferadresse_land,
          };
        })
      };
      break;
    }
    case 'favs': {
      const { data } = await window.supabase
        .from('kampagne_creator_favoriten')
        .select(`
          id,
          creator:creator_id (
            id, vorname, nachname,
            creator_types:creator_creator_type(creator_type:creator_type_id(name)),
            sprachen:creator_sprachen(sprachen:sprache_id(name)),
            branchen:creator_branchen(branchen_creator:branche_id(name)),
            instagram_follower, tiktok_follower,
            lieferadresse_stadt, lieferadresse_land
          )
        `)
        .eq('kampagne_id', kampagneId);

      result = {
        favoriten: (data || []).map(row => {
          const c = row.creator || {};
          return {
            id: c.id, vorname: c.vorname, nachname: c.nachname,
            creator_types: (c.creator_types || []).map(x => x.creator_type).filter(Boolean),
            sprachen: (c.sprachen || []).map(x => x.sprachen).filter(Boolean),
            branchen: (c.branchen || []).map(x => x.branchen_creator).filter(Boolean),
            instagram_follower: c.instagram_follower, tiktok_follower: c.tiktok_follower,
            lieferadresse_stadt: c.lieferadresse_stadt, lieferadresse_land: c.lieferadresse_land,
          };
        })
      };
      break;
    }
    case 'rechnungen': {
      const { data } = await window.supabase
        .from('rechnung')
        .select(`
          id, rechnung_nr, status, nettobetrag, bruttobetrag,
          gestellt_am, bezahlt_am, pdf_url,
          kooperation:kooperation_id(id, name),
          creator:creator_id(id, vorname, nachname)
        `)
        .eq('kampagne_id', kampagneId)
        .order('gestellt_am', { ascending: false });
      result = { rechnungen: data || [] };
      break;
    }
    case 'vertraege': {
      const { data } = await window.supabase
        .from('vertraege')
        .select(`
          id, name, typ, is_draft, datei_url, datei_path,
          dropbox_file_url, dropbox_file_path, kooperation_id,
          unterschriebener_vertrag_url, created_at,
          creator:creator_id(id, vorname, nachname),
          kooperation:kooperation_id(id, name)
        `)
        .eq('kampagne_id', kampagneId)
        .order('created_at', { ascending: false });
      result = { vertraege: data || [] };
      break;
    }
    case 'sourcing-listen': {
      const { data } = await window.supabase
        .from('creator_auswahl')
        .select(`
          id, name, created_at,
          kampagne:kampagne_id(id, kampagnenname),
          unternehmen:unternehmen_id(id, firmenname, logo_url, internes_kuerzel),
          marke:marke_id(id, markenname, logo_url),
          created_by_user:created_by(id, name, profile_image_url)
        `)
        .eq('kampagne_id', kampagneId)
        .order('created_at', { ascending: false });
      result = { sourcingListen: data || [] };
      break;
    }
  }

  const loadTime = (performance.now() - startTime).toFixed(0);
  console.log(`✅ KAMPAGNEDETAIL: Tab ${tabName} Daten geladen in ${loadTime}ms`);

  return result;
}

/**
 * Lädt Kooperationen + Videos + Satelliten-Daten in einem Durchgang direkt in den Store.
 * Ersetzt das doppelte Laden aus loadCriticalData (Summary) + VideoTableDataLoader.
 */
export async function loadFullTableData(kampagneId, store, isKunde) {
  console.log('🔄 KAMPAGNEDETAIL: Lade vollständige Tabellendaten...');
  const startTime = performance.now();

  const kampagneJoin = 'kampagne:kampagne_id (id, kampagnenname, eigener_name, unternehmen:unternehmen_id(id, firmenname), marke:marke_id(id, markenname))';
  const koopSelect = isKunde
    ? `id, name, posting_datum, vertrag_unterschrieben, nutzungsrechte, tracking_link, typ, videoanzahl, skript_deadline, content_deadline, created_at, creator_id, bilder_folder_url, status_id, status, status_ref:status_id(id, name), ${kampagneJoin}`
    : `id, name, einkaufspreis_netto, einkaufspreis_gesamt, verkaufspreis_zusatzkosten, posting_datum, vertrag_unterschrieben, nutzungsrechte, tracking_link, typ, videoanzahl, skript_deadline, content_deadline, created_at, creator_id, bilder_folder_url, status_id, status, status_ref:status_id(id, name), ${kampagneJoin}`;

  const kooperationenResult = await window.supabase
    .from('kooperationen')
    .select(koopSelect)
    .eq('kampagne_id', kampagneId)
    .order('created_at', { ascending: false });

  if (kooperationenResult.error) throw kooperationenResult.error;

  const kooperationen = kooperationenResult.data || [];

  const firstKamp = kooperationen.find(k => k.kampagne)?.kampagne;
  if (firstKamp) {
    store.setKampagneInfo({
      id: firstKamp.id,
      name: firstKamp.kampagnenname || firstKamp.eigener_name || '',
      unternehmen: firstKamp.unternehmen?.firmenname || '',
      marke: firstKamp.marke?.markenname || ''
    });
  }

  if (kooperationen.length === 0) {
    store.setKooperationen([]);
    store.setVideos({});
    store.setVideoComments({});
    store.setVersandInfos({});
    const { data: statusOpts } = await window.supabase
      .from('kampagne_status').select('id, name, sort_order').order('sort_order', { ascending: true });
    console.log(`✅ KAMPAGNEDETAIL: Tabellendaten geladen (leer) in ${(performance.now() - startTime).toFixed(0)}ms`);
    return { videoIds: [], statusOptions: statusOpts || [] };
  }

  const koopIds = kooperationen.map(k => k.id);
  const creatorIds = [...new Set(kooperationen.map(k => k.creator_id).filter(Boolean))];

  const batchIn = VideoTableDataLoader.batchInQuery;
  const sb = window.supabase;

  const [videosResult, creatorsResult, vertraegeResult, versandResult, statusResult, tagsResult] = await Promise.allSettled([
    batchIn(
      sb.from('kooperation_videos'),
      'id, kooperation_id, position, asset_url, content_art, caption, feedback_creatorjobs, feedback_ritzenhoff, freigabe, link_content, folder_url, story_folder_url, link_produkte, thema, link_skript, skript_freigegeben, drehort, video_name, posting_datum, einkaufspreis_netto, verkaufspreis_netto, kampagnenart, strategie_item_id, strategie_item:strategie_item_id(id, screenshot_url, beschreibung, strategie_id, video_link)',
      'kooperation_id', koopIds,
      q => q.order('position', { ascending: true })
    ),
    batchIn(
      sb.from('creator'),
      'id, vorname, nachname, instagram, instagram_follower, tiktok, tiktok_follower, lieferadresse_strasse, lieferadresse_hausnummer, lieferadresse_plz, lieferadresse_stadt',
      'id', creatorIds
    ),
    batchIn(
      sb.from('vertraege'),
      'id, name, typ, kooperation_id, datei_url, dropbox_file_url, unterschriebener_vertrag_url, is_draft',
      'kooperation_id', koopIds
    ),
    batchIn(
      sb.from('kooperation_versand'),
      'id, kooperation_id, video_id, versendet, tracking_nummer, produkt_name, produkt_link, strasse, hausnummer, plz, stadt, creator_adresse_id',
      'kooperation_id', koopIds
    ),
    sb.from('kampagne_status')
      .select('id, name, sort_order')
      .order('sort_order', { ascending: true }),
    batchIn(
      sb.from('kooperation_tags'),
      'kooperation_id, tag_id, kooperation_tag_typen(id, name)',
      'kooperation_id', koopIds
    )
  ]);

  const allVideos = videosResult.status === 'fulfilled' ? (videosResult.value.data || []) : [];
  const creators = creatorsResult.status === 'fulfilled' ? (creatorsResult.value.data || []) : [];
  const vertraege = vertraegeResult.status === 'fulfilled' ? (vertraegeResult.value.data || []) : [];
  const versandInfos = versandResult.status === 'fulfilled' ? (versandResult.value.data || []) : [];
  const statusOptions = statusResult.status === 'fulfilled' ? (statusResult.value.data || []) : [];
  const allTags = tagsResult.status === 'fulfilled' ? (tagsResult.value.data || []) : [];

  const creatorsMap = new Map();
  creators.forEach(c => creatorsMap.set(c.id, c));
  store.setCreators(creatorsMap);

  kooperationen.forEach(koop => {
    if (koop.creator_id) {
      koop.creator = creatorsMap.get(koop.creator_id) || null;
    }
    koop._vertraege = vertraege.filter(v => v.kooperation_id === koop.id);
    koop.status_name = koop.status_ref?.name || koop.status || '';
    koop._tags = allTags
      .filter(tag => tag.kooperation_id === koop.id)
      .map(tag => tag.kooperation_tag_typen?.name || '')
      .filter(Boolean);
  });

  const videosByKoopId = {};
  allVideos.forEach(video => {
    if (!videosByKoopId[video.kooperation_id]) {
      videosByKoopId[video.kooperation_id] = [];
    }
    videosByKoopId[video.kooperation_id].push({
      ...video,
      currentAsset: null,
      file_url: video.asset_url || null
    });
  });

  const versandMap = {};
  versandInfos.forEach(info => {
    if (info.video_id) versandMap[info.video_id] = info;
  });

  const adresseIds = [...new Set(versandInfos.map(v => v.creator_adresse_id).filter(Boolean))];
  const creatorAdressenMap = {};
  if (adresseIds.length > 0) {
    try {
      const adressenResult = await batchIn(
        sb.from('creator_adressen'),
        'id, strasse, hausnummer, plz, stadt, adressname',
        'id', adresseIds
      );
      (adressenResult.data || []).forEach(a => { creatorAdressenMap[a.id] = a; });
    } catch (e) {
      console.warn('⚠️ KAMPAGNEDETAIL: Creator-Adressen konnten nicht geladen werden:', e);
    }
  }

  store.setKooperationen(kooperationen);
  store.setVideos(videosByKoopId);
  store.setVideoComments({});
  store.setVersandInfos(versandMap);
  store.setCreatorAdressen(creatorAdressenMap);
  store.setStatusOptions(statusOptions);

  console.log(`✅ KAMPAGNEDETAIL: Tabellendaten geladen in ${(performance.now() - startTime).toFixed(0)}ms (${kooperationen.length} Koops, ${allVideos.length} Videos)`);
  return { videoIds: allVideos.map(v => v.id), statusOptions };
}
