// Entity-Registry: Zentrale Konfiguration aller Entitäten
// Jede Entität definiert table, fields, relations, manyToMany, filters, sortBy, sortOrder

export const EntityRegistry = {
  creator: {
    table: 'creator',
    displayField: 'vorname',
    fields: {
      vorname: 'string',
      nachname: 'string',
      instagram: 'string',
      instagram_follower: 'number',
      tiktok: 'string',
      tiktok_follower: 'number',
      telefonnummer: 'string',
      mail: 'string',
      portfolio_link: 'string',
      budget_letzte_buchung: 'number',
      lieferadresse_strasse: 'string',
      lieferadresse_hausnummer: 'string',
      lieferadresse_plz: 'string',
      lieferadresse_stadt: 'string',
      lieferadresse_land: 'string',
      rechnungsadresse_abweichend: 'boolean',
      rechnungsadresse_strasse: 'string',
      rechnungsadresse_hausnummer: 'string',
      rechnungsadresse_plz: 'string',
      rechnungsadresse_stadt: 'string',
      rechnungsadresse_land: 'string',
      notiz: 'string',
      geschlecht: 'string',
      alter_jahre: 'number', // Legacy, wird durch alter_min/alter_max ersetzt
      alter_min: 'number',
      alter_max: 'number',
      hat_haustier: 'boolean',
      umsatzsteuerpflichtig: 'boolean',
      haustier_beschreibung: 'string'
    },
    relations: {},
    manyToMany: {
      sprachen: {
        table: 'sprachen',
        junctionTable: 'creator_sprachen',
        localKey: 'creator_id',
        foreignKey: 'sprache_id',
        displayField: 'name'
      },
      branchen: {
        table: 'branchen_creator',
        junctionTable: 'creator_branchen',
        localKey: 'creator_id',
        foreignKey: 'branche_id',
        displayField: 'name'
      },
      creator_types: {
        table: 'creator_type',
        junctionTable: 'creator_creator_type',
        localKey: 'creator_id',
        foreignKey: 'creator_type_id',
        displayField: 'name'
      }
    },
    filters: ['vorname', 'nachname'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },
  ansprechpartner: {
    table: 'ansprechpartner',
    displayField: 'vorname',
    fields: {
      vorname: 'string',
      nachname: 'string',
      unternehmen_id: 'uuid',
      position_id: 'uuid',
      email: 'string',
      telefonnummer: 'string',
      telefonnummer_land_id: 'uuid',
      telefonnummer_office: 'string',
      telefonnummer_office_land_id: 'uuid',
      linkedin: 'string',
      stadt: 'string',
      land_id: 'uuid',
      geburtsdatum: 'date',
      sprache_id: 'uuid',
      notiz: 'string',
      erlaubt_updates: 'toggle',
      erlaubt_newsletter: 'toggle',
      erlaubt_webinare: 'toggle'
    },
    relations: {
      unternehmen: { table: 'unternehmen', foreignKey: 'unternehmen_id', displayField: 'firmenname' },
      sprache: { table: 'sprachen', foreignKey: 'sprache_id', displayField: 'name' },
      position: { table: 'positionen', foreignKey: 'position_id', displayField: 'name' },
      telefonnummer_land: { table: 'eu_laender', foreignKey: 'telefonnummer_land_id', displayField: 'name_de' },
      telefonnummer_office_land: { table: 'eu_laender', foreignKey: 'telefonnummer_office_land_id', displayField: 'name_de' },
      land: { table: 'eu_laender', foreignKey: 'land_id', displayField: 'name_de' }
    },
    manyToMany: {
      unternehmen: {
        table: 'unternehmen',
        junctionTable: 'ansprechpartner_unternehmen',
        localKey: 'ansprechpartner_id',
        foreignKey: 'unternehmen_id',
        displayField: 'firmenname'
      },
      marken: {
        table: 'marke',
        junctionTable: 'ansprechpartner_marke',
        localKey: 'ansprechpartner_id',
        foreignKey: 'marke_id',
        displayField: 'markenname'
      },
      sprachen: {
        table: 'sprachen',
        junctionTable: 'ansprechpartner_sprache',
        localKey: 'ansprechpartner_id',
        foreignKey: 'sprache_id',
        displayField: 'name'
      }
    },
    filters: ['vorname', 'nachname', 'position_id', 'unternehmen_id', 'stadt', 'sprache_id'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },
  unternehmen: {
    table: 'unternehmen',
    displayField: 'firmenname',
    fields: [
      { name: 'firmenname', type: 'string' },
      { name: 'internes_kuerzel', type: 'string' },
      { name: 'branche', type: 'string' },
      { name: 'branche_id', type: 'uuid', relationTable: 'unternehmen_branchen', relationField: 'branche_id' },
      { name: 'ansprechpartner', type: 'string' },
      { name: 'telefonnummer', type: 'string' },
      { name: 'invoice_email', type: 'string' },
      { name: 'rechnungsadresse_strasse', type: 'string' },
      { name: 'rechnungsadresse_hausnummer', type: 'string' },
      { name: 'rechnungsadresse_plz', type: 'string' },
      { name: 'rechnungsadresse_stadt', type: 'string' },
      { name: 'rechnungsadresse_land', type: 'string' },
      { name: 'webseite', type: 'string' },
      { name: 'status', type: 'string' },
      { name: 'notiz', type: 'string' },
      { name: 'logo_url', type: 'string' },
      { name: 'logo_path', type: 'string' }
    ],
    relations: {
      branche: { table: 'branchen', foreignKey: 'branche_id', displayField: 'name' }
    },
    manyToMany: {
      branchen: {
        table: 'branchen',
        junctionTable: 'unternehmen_branchen',
        localKey: 'unternehmen_id',
        foreignKey: 'branche_id',
        displayField: 'name'
      },
      ansprechpartner: {
        table: 'ansprechpartner',
        junctionTable: 'ansprechpartner_unternehmen',
        localKey: 'unternehmen_id',
        foreignKey: 'ansprechpartner_id',
        displayField: 'vorname'
      }
    },
    filters: ['firmenname', 'branche_id', 'status', 'rechnungsadresse_stadt', 'rechnungsadresse_land'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },
  kampagne: {
    table: 'kampagne',
    displayField: 'kampagnenname',
    fields: {
      eigener_name: 'string',
      kampagnenname: 'string',
      unternehmen_id: 'uuid',
      marke_id: 'uuid',
      auftrag_id: 'uuid',
      art_der_kampagne: 'array',
      kampagne_typ: 'string',
      start: 'date',
      deadline_briefing: 'date',
      deadline_strategie: 'date',
      deadline_skripte: 'date',
      deadline_creator_sourcing: 'date',
      deadline_video_produktion: 'date',
      deadline_post_produktion: 'date',
      kampagnen_nummer: 'number',
      drehort_typ_id: 'uuid',
      drehort_beschreibung: 'string',
      creatoranzahl: 'number',
      videoanzahl: 'number',
      budget_info: 'string',
      ugc_pro_paid_video_anzahl: 'number',
      ugc_pro_paid_creator_anzahl: 'number',
      ugc_pro_paid_bilder_anzahl: 'number',
      ugc_pro_organic_video_anzahl: 'number',
      ugc_pro_organic_creator_anzahl: 'number',
      ugc_pro_organic_bilder_anzahl: 'number',
      ugc_video_paid_video_anzahl: 'number',
      ugc_video_paid_creator_anzahl: 'number',
      ugc_video_paid_bilder_anzahl: 'number',
      ugc_video_organic_video_anzahl: 'number',
      ugc_video_organic_creator_anzahl: 'number',
      ugc_video_organic_bilder_anzahl: 'number',
      influencer_video_anzahl: 'number',
      influencer_creator_anzahl: 'number',
      influencer_bilder_anzahl: 'number',
      vor_ort_video_anzahl: 'number',
      vor_ort_creator_anzahl: 'number',
      vor_ort_bilder_anzahl: 'number',
      vor_ort_videographen_anzahl: 'number'
    },
    relations: {
      unternehmen: { table: 'unternehmen', foreignKey: 'unternehmen_id', displayField: 'firmenname' },
      marke: { table: 'marke', foreignKey: 'marke_id', displayField: 'markenname' },
      auftrag: { table: 'auftrag', foreignKey: 'auftrag_id', displayField: 'auftragsname' },
      drehort_typ: { table: 'drehort_typen', foreignKey: 'drehort_typ_id', displayField: 'name' }
    },
    manyToMany: {
      ansprechpartner: {
        table: 'ansprechpartner',
        junctionTable: 'ansprechpartner_kampagne',
        localKey: 'kampagne_id',
        foreignKey: 'ansprechpartner_id',
        displayField: 'id,vorname,nachname,email,profile_image_url'
      },
      mitarbeiter: {
        table: 'benutzer',
        junctionTable: 'kampagne_mitarbeiter',
        localKey: 'kampagne_id',
        foreignKey: 'mitarbeiter_id',
        displayField: 'name,profile_image_url'
      }
    },
    filters: ['kampagnenname', 'unternehmen_id', 'marke_id', 'art_der_kampagne', 'start', 'deadline_post_produktion'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },
  kooperation: {
    table: 'kooperationen',
    displayField: 'id',
    fields: {
      name: 'string',
      creator_id: 'uuid',
      kampagne_id: 'uuid',
      briefing_id: 'uuid',
      unternehmen_id: 'uuid',
      einkaufspreis_netto: 'number',
      einkaufspreis_zusatzkosten: 'number',
      einkaufspreis_ust: 'number',
      einkaufspreis_gesamt: 'number',
      verkaufspreis_netto: 'number',
      verkaufspreis_zusatzkosten: 'number',
      verkaufspreis_ust: 'number',
      verkaufspreis_gesamt: 'number',
      vertrag_unterschrieben: 'boolean',
      videoanzahl: 'number',
      skript_deadline: 'date',
      content_deadline: 'date',
      content_link: 'string',
      bewertung: 'number',
      budget: 'number',
      start_datum: 'date',
      end_datum: 'date',
      notiz: 'string'
    },
    relations: {
      creator: { table: 'creator', foreignKey: 'creator_id', displayField: 'vorname' },
      kampagne: { table: 'kampagne', foreignKey: 'kampagne_id', displayField: 'name' },
      briefing: { table: 'briefings', foreignKey: 'briefing_id', displayField: 'product_service_offer' }
    },
    manyToMany: {
      tags: {
        table: 'kooperation_tag_typen',
        junctionTable: 'kooperation_tags',
        localKey: 'kooperation_id',
        foreignKey: 'tag_id',
        displayField: 'name'
      }
    },
    filters: ['creator_id', 'kampagne_id', 'budget', 'start_datum', 'end_datum'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },
  briefing: {
    table: 'briefings',
    displayField: 'product_service_offer',
    fields: {
      product_service_offer: 'string',
      produktseite_url: 'string',
      creator_aufgabe: 'string',
      usp: 'string',
      zielgruppe: 'string',
      zieldetails: 'string',
      deadline: 'date',
      must_haves: 'string',
      rechtlicher_hinweis: 'string',
      unternehmen_id: 'uuid',
      marke_id: 'uuid',
      kampagne_id: 'uuid',
      status: 'string',
      assignee_id: 'uuid',
      kooperation_id: 'uuid',
      created_at: 'date',
      updated_at: 'date'
    },
    relations: {
      unternehmen: { table: 'unternehmen', foreignKey: 'unternehmen_id', displayField: 'firmenname' },
      marke: { table: 'marke', foreignKey: 'marke_id', displayField: 'markenname' },
      kampagne: { table: 'kampagne', foreignKey: 'kampagne_id', displayField: 'kampagnenname' },
      assignee: { table: 'benutzer', foreignKey: 'assignee_id', displayField: 'name' }
    },
    filters: ['product_service_offer', 'unternehmen_id', 'marke_id', 'status', 'assignee_id', 'deadline', 'created_at'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },
  creator_type: {
    table: 'creator_type',
    displayField: 'name',
    fields: {
      name: 'string',
      beschreibung: 'string'
    },
    filters: ['name'],
    sortBy: 'name',
    sortOrder: 'asc'
  },
  sprachen: {
    table: 'sprachen',
    displayField: 'name',
    fields: {
      name: 'string',
      code: 'string'
    },
    filters: ['name'],
    sortBy: 'name',
    sortOrder: 'asc'
  },
  branchen_creator: {
    table: 'branchen_creator',
    displayField: 'name',
    fields: {
      name: 'string',
      beschreibung: 'string'
    },
    filters: ['name'],
    sortBy: 'name',
    sortOrder: 'asc'
  },
  benutzer: {
    table: 'benutzer',
    displayField: 'name',
    fields: {
      name: 'string',
      email: 'string',
      rolle: 'string',
      zugriffsrechte: 'json',
      auth_user_id: 'uuid',
      profile_image_url: 'string',
      mitarbeiter_klasse_id: 'uuid',
      telefonnummer_firmenhandy: 'string',
      telefonnummer_firmenhandy_land_id: 'uuid',
      freigeschaltet: 'boolean',
      updated_at: 'date'
    },
    relations: {
      mitarbeiter_klasse: { table: 'mitarbeiter_klasse', foreignKey: 'mitarbeiter_klasse_id', displayField: 'name' },
      telefonnummer_firmenhandy_land: { table: 'eu_laender', foreignKey: 'telefonnummer_firmenhandy_land_id', displayField: 'name_de' }
    }
  },
  kunden: {
    table: 'benutzer',
    displayField: 'name',
    fields: {
      name: 'string',
      email: 'string',
      rolle: 'string',
      freigeschaltet: 'boolean',
      created_at: 'date',
      updated_at: 'date'
    },
    relations: {},
    manyToMany: {
      unternehmen: {
        table: 'unternehmen',
        junctionTable: 'kunde_unternehmen',
        localKey: 'kunde_id',
        foreignKey: 'unternehmen_id',
        displayField: 'firmenname'
      },
      marken: {
        table: 'marke',
        junctionTable: 'kunde_marke',
        localKey: 'kunde_id',
        foreignKey: 'marke_id',
        displayField: 'markenname'
      }
    },
    filters: ['name', 'email', 'rolle'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },
  kampagne_status: {
    table: 'kampagne_status',
    displayField: 'name',
    fields: {
      name: 'string',
      beschreibung: 'string',
      sort_order: 'number',
      created_at: 'date',
      updated_at: 'date'
    }
  },
  plattform_typen: {
    table: 'plattform_typen',
    displayField: 'name',
    fields: {
      name: 'string',
      beschreibung: 'string',
      created_at: 'date',
      updated_at: 'date'
    }
  },
  format_typen: {
    table: 'format_typen',
    displayField: 'name',
    fields: {
      name: 'string',
      beschreibung: 'string',
      created_at: 'date',
      updated_at: 'date'
    }
  },
  marke: {
    table: 'marke',
    displayField: 'markenname',
    fields: {
      markenname: 'string',
      unternehmen_id: 'uuid',
      webseite: 'string',
      branche: 'string',
      branche_id: 'uuid',
      created_at: 'date',
      updated_at: 'date',
      logo_url: 'string',
      logo_path: 'string'
    },
    relations: {
      unternehmen: { table: 'unternehmen', foreignKey: 'unternehmen_id', displayField: 'firmenname' }
    },
    manyToMany: {
      branchen: {
        table: 'branchen',
        junctionTable: 'marke_branchen',
        localKey: 'marke_id',
        foreignKey: 'branche_id',
        displayField: 'name'
      },
      ansprechpartner: {
        table: 'ansprechpartner',
        junctionTable: 'ansprechpartner_marke',
        localKey: 'marke_id',
        foreignKey: 'ansprechpartner_id',
        displayField: 'id,vorname,nachname,email'
      }
      // mitarbeiter: Bewusst NICHT hier – marke_mitarbeiter hat eine role-Spalte
      // und wird ausschließlich über MarkeService.saveMitarbeiterToMarke() verwaltet.
    },
    filters: ['markenname', 'unternehmen_id', 'branche_id'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },
  produkt: {
    table: 'produkt',
    displayField: 'name',
    fields: {
      name: 'string',
      marke_id: 'uuid',
      unternehmen_id: 'uuid',
      url: 'string',
      kernbotschaft: 'string',
      hauptproblem: 'string',
      kernnutzen: 'string',
      usp_1: 'string',
      usp_2: 'string',
      usp_3: 'string',
      kauf_conversion_trigger: 'string',
      zielnutzer_anwendungskontext: 'string',
      created_at: 'date',
      updated_at: 'date'
    },
    relations: {
      marke: { table: 'marke', foreignKey: 'marke_id', displayField: 'markenname' },
      unternehmen: { table: 'unternehmen', foreignKey: 'unternehmen_id', displayField: 'firmenname' }
    },
    manyToMany: {
      pflicht_elemente: {
        table: 'pflicht_elemente_typen',
        junctionTable: 'produkt_pflicht_elemente',
        localKey: 'produkt_id',
        foreignKey: 'pflicht_element_id',
        displayField: 'name'
      },
      no_gos: {
        table: 'no_go_typen',
        junctionTable: 'produkt_no_gos',
        localKey: 'produkt_id',
        foreignKey: 'no_go_id',
        displayField: 'name'
      }
    },
    filters: ['name', 'marke_id', 'unternehmen_id'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },
  auftrag: {
    table: 'auftrag',
    displayField: 'auftragsname',
    fields: {
      auftragsname: 'string',
      unternehmen_id: 'uuid',
      marke_id: 'uuid',
      status: 'string',
      ansprechpartner_id: 'uuid',
      auftragtype: 'string',
      titel: 'string',
      notiz: 'string',
      angebotsnummer: 'string',
      po: 'string',
      externe_po: 'string',
      zahlungsziel_tage: 'number',
      re_nr: 'string',
      re_faelligkeit: 'date',
      erwarteter_monat_zahlungseingang: 'date',
      kampagnenanzahl: 'number',
      start: 'date',
      ende: 'date',
      nettobetrag: 'number',
      ust_prozent: 'number',
      ust_betrag: 'number',
      bruttobetrag: 'number',
      rechnung_gestellt: 'boolean',
      rechnung_gestellt_am: 'date',
      ueberwiesen: 'boolean',
      ueberwiesen_am: 'date',
      created_by_id: 'uuid'
    },
    relations: {
      unternehmen: { table: 'unternehmen', foreignKey: 'unternehmen_id', displayField: 'firmenname' },
      marke: { table: 'marke', foreignKey: 'marke_id', displayField: 'markenname' },
      ansprechpartner: { table: 'ansprechpartner', foreignKey: 'ansprechpartner_id', displayField: 'vorname' },
      created_by: { table: 'benutzer', foreignKey: 'created_by_id', displayField: 'name' }
    },
    manyToMany: {
      mitarbeiter: {
        table: 'benutzer',
        junctionTable: 'auftrag_mitarbeiter',
        localKey: 'auftrag_id',
        foreignKey: 'mitarbeiter_id',
        displayField: 'name'
      },
      cutter: {
        table: 'benutzer',
        junctionTable: 'auftrag_cutter',
        localKey: 'auftrag_id',
        foreignKey: 'mitarbeiter_id',
        displayField: 'name'
      },
      copywriter: {
        table: 'benutzer',
        junctionTable: 'auftrag_copywriter',
        localKey: 'auftrag_id',
        foreignKey: 'mitarbeiter_id',
        displayField: 'name'
      },
      kampagne_arten: {
        table: 'kampagne_art_typen',
        junctionTable: 'auftrag_kampagne_art',
        localKey: 'auftrag_id',
        foreignKey: 'kampagne_art_id',
        displayField: 'name'
      }
    },
    filters: ['auftragsname', 'status', 'unternehmen_id', 'marke_id', 'ansprechpartner_id'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },
  auftrag_details: {
    table: 'auftrag_details',
    displayField: 'id',
    fields: {
      auftrag_id: 'uuid',
      kampagnenanzahl: 'number',
      ugc_pro_paid_video_anzahl: 'number',
      ugc_pro_paid_creator_anzahl: 'number',
      ugc_pro_paid_bilder_anzahl: 'number',
      ugc_pro_paid_budget_info: 'text',
      ugc_pro_paid_einkaufspreis_netto_von: 'number',
      ugc_pro_paid_einkaufspreis_netto_bis: 'number',
      ugc_pro_paid_verkaufspreis_netto_von: 'number',
      ugc_pro_paid_verkaufspreis_netto_bis: 'number',
      ugc_pro_organic_video_anzahl: 'number',
      ugc_pro_organic_creator_anzahl: 'number',
      ugc_pro_organic_bilder_anzahl: 'number',
      ugc_pro_organic_budget_info: 'text',
      ugc_pro_organic_einkaufspreis_netto_von: 'number',
      ugc_pro_organic_einkaufspreis_netto_bis: 'number',
      ugc_pro_organic_verkaufspreis_netto_von: 'number',
      ugc_pro_organic_verkaufspreis_netto_bis: 'number',
      ugc_video_paid_video_anzahl: 'number',
      ugc_video_paid_creator_anzahl: 'number',
      ugc_video_paid_bilder_anzahl: 'number',
      ugc_video_paid_budget_info: 'text',
      ugc_video_paid_einkaufspreis_netto_von: 'number',
      ugc_video_paid_einkaufspreis_netto_bis: 'number',
      ugc_video_paid_verkaufspreis_netto_von: 'number',
      ugc_video_paid_verkaufspreis_netto_bis: 'number',
      ugc_video_organic_video_anzahl: 'number',
      ugc_video_organic_creator_anzahl: 'number',
      ugc_video_organic_bilder_anzahl: 'number',
      ugc_video_organic_budget_info: 'text',
      ugc_video_organic_einkaufspreis_netto_von: 'number',
      ugc_video_organic_einkaufspreis_netto_bis: 'number',
      ugc_video_organic_verkaufspreis_netto_von: 'number',
      ugc_video_organic_verkaufspreis_netto_bis: 'number',
      influencer_video_anzahl: 'number',
      influencer_creator_anzahl: 'number',
      influencer_bilder_anzahl: 'number',
      influencer_budget_info: 'text',
      influencer_einkaufspreis_netto_von: 'number',
      influencer_einkaufspreis_netto_bis: 'number',
      influencer_verkaufspreis_netto_von: 'number',
      influencer_verkaufspreis_netto_bis: 'number',
      vor_ort_video_anzahl: 'number',
      vor_ort_creator_anzahl: 'number',
      vor_ort_bilder_anzahl: 'number',
      vor_ort_videographen_anzahl: 'number',
      vor_ort_budget_info: 'text',
      vor_ort_einkaufspreis_netto_von: 'number',
      vor_ort_einkaufspreis_netto_bis: 'number',
      vor_ort_verkaufspreis_netto_von: 'number',
      vor_ort_verkaufspreis_netto_bis: 'number',
      vor_ort_mitarbeiter_video_anzahl: 'number',
      vor_ort_mitarbeiter_bilder_anzahl: 'number',
      vor_ort_mitarbeiter_videographen_anzahl: 'number',
      vor_ort_mitarbeiter_budget_info: 'text',
      vor_ort_mitarbeiter_einkaufspreis_netto_von: 'number',
      vor_ort_mitarbeiter_einkaufspreis_netto_bis: 'number',
      vor_ort_mitarbeiter_verkaufspreis_netto_von: 'number',
      vor_ort_mitarbeiter_verkaufspreis_netto_bis: 'number',
      gesamt_videos: 'number',
      gesamt_creator: 'number',
      created_by_id: 'uuid'
    },
    relations: {
      auftrag: { table: 'auftrag', foreignKey: 'auftrag_id', displayField: 'auftragsname' },
      created_by: { table: 'benutzer', foreignKey: 'created_by_id', displayField: 'name' }
    },
    filters: ['auftrag_id', 'kampagnenanzahl', 'gesamt_videos', 'gesamt_creator', 'created_at'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },
  auftragsdetails: {
    table: 'auftrag_details',
    displayField: 'id',
    fields: {
      auftrag_id: 'uuid',
      kampagnenanzahl: 'number',
      ugc_pro_paid_video_anzahl: 'number',
      ugc_pro_paid_creator_anzahl: 'number',
      ugc_pro_paid_bilder_anzahl: 'number',
      ugc_pro_paid_budget_info: 'text',
      ugc_pro_paid_einkaufspreis_netto_von: 'number',
      ugc_pro_paid_einkaufspreis_netto_bis: 'number',
      ugc_pro_paid_verkaufspreis_netto_von: 'number',
      ugc_pro_paid_verkaufspreis_netto_bis: 'number',
      ugc_pro_organic_video_anzahl: 'number',
      ugc_pro_organic_creator_anzahl: 'number',
      ugc_pro_organic_bilder_anzahl: 'number',
      ugc_pro_organic_budget_info: 'text',
      ugc_pro_organic_einkaufspreis_netto_von: 'number',
      ugc_pro_organic_einkaufspreis_netto_bis: 'number',
      ugc_pro_organic_verkaufspreis_netto_von: 'number',
      ugc_pro_organic_verkaufspreis_netto_bis: 'number',
      ugc_video_paid_video_anzahl: 'number',
      ugc_video_paid_creator_anzahl: 'number',
      ugc_video_paid_bilder_anzahl: 'number',
      ugc_video_paid_budget_info: 'text',
      ugc_video_paid_einkaufspreis_netto_von: 'number',
      ugc_video_paid_einkaufspreis_netto_bis: 'number',
      ugc_video_paid_verkaufspreis_netto_von: 'number',
      ugc_video_paid_verkaufspreis_netto_bis: 'number',
      ugc_video_organic_video_anzahl: 'number',
      ugc_video_organic_creator_anzahl: 'number',
      ugc_video_organic_bilder_anzahl: 'number',
      ugc_video_organic_budget_info: 'text',
      ugc_video_organic_einkaufspreis_netto_von: 'number',
      ugc_video_organic_einkaufspreis_netto_bis: 'number',
      ugc_video_organic_verkaufspreis_netto_von: 'number',
      ugc_video_organic_verkaufspreis_netto_bis: 'number',
      influencer_video_anzahl: 'number',
      influencer_creator_anzahl: 'number',
      influencer_bilder_anzahl: 'number',
      influencer_budget_info: 'text',
      influencer_einkaufspreis_netto_von: 'number',
      influencer_einkaufspreis_netto_bis: 'number',
      influencer_verkaufspreis_netto_von: 'number',
      influencer_verkaufspreis_netto_bis: 'number',
      vor_ort_video_anzahl: 'number',
      vor_ort_creator_anzahl: 'number',
      vor_ort_bilder_anzahl: 'number',
      vor_ort_videographen_anzahl: 'number',
      vor_ort_budget_info: 'text',
      vor_ort_einkaufspreis_netto_von: 'number',
      vor_ort_einkaufspreis_netto_bis: 'number',
      vor_ort_verkaufspreis_netto_von: 'number',
      vor_ort_verkaufspreis_netto_bis: 'number',
      vor_ort_mitarbeiter_video_anzahl: 'number',
      vor_ort_mitarbeiter_bilder_anzahl: 'number',
      vor_ort_mitarbeiter_videographen_anzahl: 'number',
      vor_ort_mitarbeiter_budget_info: 'text',
      vor_ort_mitarbeiter_einkaufspreis_netto_von: 'number',
      vor_ort_mitarbeiter_einkaufspreis_netto_bis: 'number',
      vor_ort_mitarbeiter_verkaufspreis_netto_von: 'number',
      vor_ort_mitarbeiter_verkaufspreis_netto_bis: 'number',
      gesamt_videos: 'number',
      gesamt_creator: 'number',
      created_by_id: 'uuid'
    },
    relations: {
      auftrag: { table: 'auftrag', foreignKey: 'auftrag_id', displayField: 'auftragsname' },
      created_by: { table: 'benutzer', foreignKey: 'created_by_id', displayField: 'name' }
    },
    filters: ['auftrag_id', 'kampagnenanzahl', 'gesamt_videos', 'gesamt_creator', 'created_at'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },
  rechnung: {
    table: 'rechnung',
    displayField: 'rechnung_nr',
    fields: {
      rechnung_nr: 'string',
      externe_angebotsnummer: 'string',
      kooperation_id: 'uuid',
      kampagne_id: 'uuid',
      creator_id: 'uuid',
      auftrag_id: 'uuid',
      unternehmen_id: 'uuid',
      videoanzahl: 'number',
      nettobetrag: 'number',
      zusatzkosten: 'number',
      ust_prozent: 'number',
      ust_betrag: 'number',
      bruttobetrag: 'number',
      gestellt_am: 'date',
      zahlungsziel: 'date',
      bezahlt_am: 'date',
      status: 'string',
      geprueft: 'boolean',
      skonto: 'boolean',
      land: 'string',
      pdf_url: 'string',
      pdf_path: 'string',
      vertrag_id: 'uuid',
      created_by_id: 'uuid',
      created_at: 'date',
      updated_at: 'date'
    },
    relations: {
      unternehmen: { table: 'unternehmen', foreignKey: 'unternehmen_id', displayField: 'firmenname' },
      auftrag: { table: 'auftrag', foreignKey: 'auftrag_id', displayField: 'auftragsname' },
      kooperation: { table: 'kooperationen', foreignKey: 'kooperation_id', displayField: 'name' },
      creator: { table: 'creator', foreignKey: 'creator_id', displayField: 'vorname' },
      kampagne: { table: 'kampagne', foreignKey: 'kampagne_id', displayField: 'kampagnenname' },
      created_by: { table: 'benutzer', foreignKey: 'created_by_id', displayField: 'name' },
      vertrag: { table: 'vertraege', foreignKey: 'vertrag_id', displayField: 'name' }
    },
    filters: ['rechnung_nr', 'kooperation_id', 'kampagne_id', 'unternehmen_id', 'auftrag_id', 'status', 'gestellt_am', 'zahlungsziel', 'bezahlt_am', 'nettobetrag', 'land'],
    sortBy: 'zahlungsziel',
    sortOrder: 'asc'
  },
  creator_list: {
    table: 'creator_list',
    displayField: 'name',
    fields: {
      name: 'string',
      beschreibung: 'string',
      created_by: 'uuid',
      created_at: 'date',
      updated_at: 'date'
    },
    relations: {},
    filters: ['name', 'created_at'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },
  markenwert_typen: {
    table: 'markenwert_typen',
    displayField: 'name',
    fields: {
      name: 'string',
      created_at: 'date'
    },
    relations: {},
    filters: ['name'],
    sortBy: 'name',
    sortOrder: 'asc'
  },
  kooperation_tag_typen: {
    table: 'kooperation_tag_typen',
    displayField: 'name',
    fields: {
      name: 'string',
      created_at: 'date'
    },
    relations: {},
    filters: ['name'],
    sortBy: 'name',
    sortOrder: 'asc'
  },
  marke_kickoff: {
    table: 'marke_kickoff',
    displayField: 'brand_essenz',
    fields: {
      kickoff_type: 'string',
      marke_id: 'uuid',
      unternehmen_id: 'uuid',
      brand_essenz: 'string',
      mission: 'string',
      zielgruppe: 'string',
      zielgruppen_mindset: 'string',
      marken_usp: 'string',
      tonalitaet_sprachstil: 'string',
      content_charakter: 'string',
      dos_donts: 'string',
      rechtliche_leitplanken: 'string',
      created_by: 'uuid',
      created_at: 'date',
      updated_at: 'date'
    },
    relations: {
      marke: { table: 'marke', foreignKey: 'marke_id', displayField: 'markenname' },
      unternehmen: { table: 'unternehmen', foreignKey: 'unternehmen_id', displayField: 'firmenname' },
      created_by_user: { table: 'benutzer', foreignKey: 'created_by', displayField: 'name' }
    },
    manyToMany: {
      markenwerte: {
        table: 'markenwert_typen',
        junctionTable: 'marke_kickoff_markenwerte',
        localKey: 'kickoff_id',
        foreignKey: 'markenwert_id',
        displayField: 'name'
      }
    },
    filters: ['marke_id', 'unternehmen_id'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  }
};
