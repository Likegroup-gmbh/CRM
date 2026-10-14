// prepareVertragPayload.js
// Baut das Zeilenobjekt für vertraege aus den Formulardaten.

import { VertraegeCreate } from './VertraegeCreateCore.js';
import { collectParagraphZusaetze } from './paragraphZusatz.js';
import { collectEhgFelder } from './EhgVertragGating.js';
import { vertretenDurchPayload, vertretungGiltFuer } from './managementVertretung.js';

VertraegeCreate.prototype.prepareDataForDB = function() {
    const typ = this.formData.typ || this.selectedTyp;
    
    // Basis-Daten (für alle Vertragstypen)
    const data = {
      typ: typ,
      name: this.formData.name || null,
      kunde_unternehmen_id: this.formData.kunde_unternehmen_id || null,
      kampagne_id: typ === 'Contracting' ? null : (this.formData.kampagne_id || null),
      creator_id: this.formData.creator_id || null,
      kooperation_id: typ === 'Contracting' ? null : (this.formData.kooperation_id || null),
      contracting_auftrag_id: typ === 'Contracting' ? (this.formData.contracting_auftrag_id || null) : null,
      anzahl_storys: parseInt(this.formData.anzahl_storys) || 0,
      medien: this.formData.medien || [],
      nutzungsdauer: this.formData.nutzungsdauer || null,
      nutzungsdauer_custom_wert: this.formData.nutzungsdauer === 'individuell' ? (parseInt(this.formData.nutzungsdauer_custom_wert, 10) || null) : null,
      nutzungsdauer_custom_einheit: this.formData.nutzungsdauer === 'individuell' ? (this.formData.nutzungsdauer_custom_einheit || null) : null,
      exklusivitaet: this.formData.exklusivitaet || false,
      exklusivitaet_monate: this.formData.exklusivitaet ? parseInt(this.formData.exklusivitaet_monate) || null : null,
      exklusivitaet_einheit: this.formData.exklusivitaet ? (this.formData.exklusivitaet_einheit || 'monate') : null,
      verguetung_netto: this.parseCurrencyInput(this.formData.verguetung_netto),
      zusatzkosten: this.formData.zusatzkosten || false,
      zusatzkosten_betrag: this.formData.zusatzkosten ? this.parseCurrencyInput(this.formData.zusatzkosten_betrag) : null,
      zahlungsziel: this.formData.zahlungsziel || null,
      skonto: this.formData.skonto === true || this.formData.skonto === 'true',
      korrekturschleifen: parseInt(this.formData.korrekturschleifen) || null,
      weitere_bestimmungen: this.formData.weitere_bestimmungen || null,
      // Zusätzliche Bestimmungen pro Paragraph (JSONB, null wenn leer)
      paragraph_zusaetze: collectParagraphZusaetze(this.formData),
      kunde_po_nummer: this.formData.kunde_po_nummer || null,
      // mehrere_rechnungen_erlaubt entfaellt (ADR 0004/0015): die Freigabe
      // weiterer Rechnungen ergibt sich aus dem Restbetrag, nicht aus dem Vertrag.
      vertragssprache: this.getContractLanguage(this.formData),
      // Gewaehltes Management (FK) + Schalter "nur Management-Adresse"
      management_id: this.formData._management_id || null,
      nur_management_adresse: !!this.formData.nur_management_adresse,
      vertreten_durch: vertretungGiltFuer(typ) ? vertretenDurchPayload(this.formData) : null
    };

    if (typ === 'Influencer Kooperation') {
      // Influencer-spezifische Felder
      Object.assign(data, {
        // Management-Vertretung (Snapshot aus creator_management -> management)
        influencer_agentur_vertreten: this.formData.influencer_agentur_vertreten || false,
        influencer_agentur_name: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_name || null : null,
        influencer_agentur_strasse: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_strasse || null : null,
        influencer_agentur_hausnummer: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_hausnummer || null : null,
        influencer_agentur_plz: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_plz || null : null,
        influencer_agentur_stadt: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_stadt || null : null,
        influencer_agentur_land: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_land || 'Deutschland' : null,
        influencer_agentur_vertretung: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_vertretung || null : null,
        
        // Influencer-Daten
        influencer_land: this.formData.influencer_land || 'Deutschland',
        influencer_profile: this.formData.influencer_profile || [],
        
        // Plattformen & Inhalte
        plattformen: this.formData.plattformen || [],
        plattformen_sonstige: this.formData.plattformen_sonstige || null,
        anzahl_reels: parseInt(this.formData.anzahl_reels) || 0,
        anzahl_feed_posts: parseInt(this.formData.anzahl_feed_posts) || 0,
        
        // Veröffentlichungsplan
        veroeffentlichungsplan: this.formData.veroeffentlichungsplan || {},
        
        // Nutzungsrechte
        organische_veroeffentlichung: this.formData.organische_veroeffentlichung || null,
        media_buyout: this.formData.media_buyout || null,
        
        // Reichweite & Online-Dauer
        reichweiten_garantie: this.formData.reichweiten_garantie || false,
        reichweiten_garantie_wert: this.formData.reichweiten_garantie ? parseInt(this.formData.reichweiten_garantie_wert) || null : null,
        mindest_online_dauer: this.formData.mindest_online_dauer || null,
        
        // Anpassungen
        anpassungen: this.formData.anpassungen || []
      });

      // Awareness-Felder NUR beim Direktvertrag-Template (awareness) mitschicken
      // und nur wenn der Kunde ein Direktvertrag-Kunde (BURGA / UAB Hautica) ist.
      // Bei Standard-Vertraegen wuerde das Insert sonst fehlschlagen, wenn die
      // Spalte awareness_felder in der DB (noch) nicht existiert.
      if (this.formData.vertrag_template === 'awareness' && this.isDirektvertragKunde()) {
        data.awareness_felder = {
          vertrag_datum: this.formData.vertrag_datum || null,
          ansprechpartner_email: this.formData.ansprechpartner_email || null,
          video_mindestlaenge_sekunden: parseInt(this.formData.video_mindestlaenge_sekunden) || null,
          veroeffentlichungsfrist: this.formData.veroeffentlichungsfrist || null,
          verguetung_brutto: this.parseCurrencyInput(this.formData.verguetung_brutto),
          zahlungsmethode: this.formData.zahlungsmethode || null,
          statistik_frist_tage: parseInt(this.formData.statistik_frist_tage) || null,
          content_vorlauf_tage: parseInt(this.formData.content_vorlauf_tage) || 3,
          content_aufbewahrung_dauer: this.formData.content_aufbewahrung_dauer || '12_monate',
          brand_tag: this.formData.brand_tag || null,
          kuendigungsfrist_tage: parseInt(this.formData.kuendigungsfrist_tage) || 30,
          influencer_reg_code: this.formData.influencer_reg_code || null,
          influencer_ust_id: this.formData.influencer_ust_id || null,
          produkt_beschreibung: this.formData.produkt_beschreibung || null
        };
      }
    } else if (typ === 'Videograph') {
      // Videograf-spezifische Felder
      Object.assign(data, {
        // Kunde
        kunde_rechtsform: this.formData.kunde_rechtsform || null,
        
        // Auftragnehmer-Daten (nutzt influencer_-Felder für Kompatibilität)
        influencer_steuer_id: this.formData.influencer_steuer_id || null,
        influencer_land: this.formData.influencer_land || 'Deutschland',
        
        // Leistungsumfang
        anzahl_videos: parseInt(this.formData.anzahl_videos) || 0,
        anzahl_fotos: parseInt(this.formData.anzahl_fotos) || 0,
        content_erstellung_art: this.formData.content_erstellung_art || null,
        
        // Videograf-spezifisch
        videograf_produktionsart: this.formData.videograf_produktionsart || null,
        videograf_produktionsplan: this.formData.videograf_produktionsplan || [],
        videograf_lieferumfang: this.formData.videograf_lieferumfang || [],
        videograf_v1_deadline: this.formData.videograf_v1_deadline || null,
        videograf_finale_werktage: parseInt(this.formData.videograf_finale_werktage) || 5,
        videograf_nutzungsart: this.formData.videograf_nutzungsart || []
      });
    } else if (typ === 'Model') {
      // Model-spezifische Felder
      Object.assign(data, {
        influencer_steuer_id: this.formData.influencer_steuer_id || null,
        influencer_land: this.formData.influencer_land || 'Deutschland',

        model_produktionsart: this.formData.model_produktionsart || null,
        model_shooting_von: this.formData.model_shooting_von || null,
        model_shooting_bis: this.formData.model_shooting_bis || null,
        model_call_time: this.formData.model_call_time || null,
        model_drehbeginn: this.formData.model_drehbeginn || null,
        model_produktionsende: this.formData.model_produktionsende || null,
        model_max_tagesstunden: this.formData.model_max_tagesstunden ? parseFloat(this.formData.model_max_tagesstunden) : null,
        model_einsatzort_art: this.formData.model_einsatzort_art || [],
        model_einsatzort_adresse: this.formData.model_einsatzort_adresse || null,
        model_optionstage: this.formData.model_optionstage || null,

        model_anzahl_foto_motive: parseInt(this.formData.model_anzahl_foto_motive) || 0,
        model_anzahl_video_sequenzen: parseInt(this.formData.model_anzahl_video_sequenzen) || 0,
        model_rolle: this.formData.model_rolle || [],
        model_rolle_sonstiges: (this.formData.model_rolle || []).includes('sonstiges') ? this.formData.model_rolle_sonstiges || null : null,
        model_styling: this.formData.model_styling || null,
        model_fitting_datum: this.formData.model_styling === 'fitting' ? this.formData.model_fitting_datum || null : null,

        model_nutzungsarten: this.formData.model_nutzungsarten || [],
        model_territorium: this.formData.model_territorium || null,
        model_territorium_beschraenkt: this.formData.model_territorium === 'beschraenkt' ? this.formData.model_territorium_beschraenkt || null : null,
        model_nutzungsdauer: this.formData.model_nutzungsdauer || null,
        model_nutzungsbeginn: this.formData.model_nutzungsbeginn || null,
        model_exklusivitaet_art: this.formData.model_exklusivitaet_art || 'keine',
        model_exklusivitaet_dauer: this.formData.model_exklusivitaet_art && this.formData.model_exklusivitaet_art !== 'keine' ? parseInt(this.formData.model_exklusivitaet_dauer) || null : null,
        model_ki_nutzung: this.formData.model_ki_nutzung || [],

        model_honorar_art: this.formData.model_honorar_art || null,
        model_buyout_inklusiv: this.formData.model_buyout_inklusiv === true || this.formData.model_buyout_inklusiv === 'true',
        model_buyout_betrag: !(this.formData.model_buyout_inklusiv === true || this.formData.model_buyout_inklusiv === 'true') ? this.parseCurrencyInput(this.formData.model_buyout_betrag) : null,
        model_reisekosten: this.formData.model_reisekosten || null,
        model_reisepauschale: this.formData.model_reisekosten === 'pauschale' ? this.parseCurrencyInput(this.formData.model_reisepauschale) : null,

        model_wetterabhaengig: this.formData.model_wetterabhaengig === true || this.formData.model_wetterabhaengig === 'true',
        model_absage_regelung: this.formData.model_absage_regelung || [],
        model_absage_individuell: (this.formData.model_absage_regelung || []).includes('individuell') ? this.formData.model_absage_individuell || null : null
      });
    } else if (typ === 'Contracting') {
      // Contracting-Vertrag: direkt zu Contracting-Auftrag, ohne Kampagne/Kooperation
      const handles = {};
      if (this.formData.contracting_handle_instagram) handles.instagram = this.formData.contracting_handle_instagram;
      if (this.formData.contracting_handle_tiktok) handles.tiktok = this.formData.contracting_handle_tiktok;
      if (this.formData.contracting_handle_youtube) handles.youtube = this.formData.contracting_handle_youtube;
      if (this.formData.contracting_handle_weitere) handles.weitere = this.formData.contracting_handle_weitere;

      // Falls noch das alte Object aus Draft-Load kommt, dazu mischen
      const existing = this.formData.contracting_plattformen_handles || {};
      const mergedHandles = { ...existing, ...handles };

      const buyoutAktiv = this.formData.contracting_buyout_aktiv === true || this.formData.contracting_buyout_aktiv === 'true';

      Object.assign(data, {
        // Management-Vertretung (analog Influencer-Vertrag, falls Creator durch Agentur vertreten)
        influencer_agentur_vertreten: this.formData.influencer_agentur_vertreten || false,
        influencer_agentur_name: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_name || null : null,
        influencer_agentur_strasse: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_strasse || null : null,
        influencer_agentur_hausnummer: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_hausnummer || null : null,
        influencer_agentur_plz: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_plz || null : null,
        influencer_agentur_stadt: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_stadt || null : null,
        influencer_agentur_land: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_land || 'Deutschland' : null,
        influencer_agentur_vertretung: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_vertretung || null : null,

        // Influencer-Daten
        influencer_land: this.formData.influencer_land || 'Deutschland',

        // Plattformen (allgemein, wiederverwendet aus bestehender Spalte)
        plattformen: this.formData.plattformen || [],
        plattformen_sonstige: this.formData.plattformen_sonstige || null,

        // Contracting-spezifische Felder
        contracting_plattformen_handles: Object.keys(mergedHandles).length > 0 ? mergedHandles : null,
        contracting_content_formate: this.formData.contracting_content_formate || [],
        contracting_anzahl_inhalte: this.formData.contracting_anzahl_inhalte || null,
        contracting_veroeffentlichung_zeitraum: this.formData.contracting_veroeffentlichung_zeitraum || null,
        contracting_buyout_aktiv: buyoutAktiv,
        contracting_buyout_plattformen: buyoutAktiv ? (this.formData.contracting_buyout_plattformen || []) : [],
        contracting_buyout_art: buyoutAktiv ? (this.formData.contracting_buyout_art || []) : [],
        contracting_buyout_art_sonstige: buyoutAktiv && (this.formData.contracting_buyout_art || []).includes('sonstige')
          ? (this.formData.contracting_buyout_art_sonstige || null)
          : null,
        contracting_buyout_nutzungsdauer: buyoutAktiv ? (this.formData.contracting_buyout_nutzungsdauer || null) : null,
        contracting_buyout_geografisch: this.formData.contracting_buyout_geografisch || null,
        contracting_buyout_besonderheiten: this.formData.contracting_buyout_besonderheiten || null,
        contracting_veroeffentlichungsdatum: this.formData.contracting_veroeffentlichungsdatum || null,
        contracting_exklusivitaet_bereich: this.formData.contracting_exklusivitaet_bereich || null,
        contracting_exklusivitaet_von: this.formData.contracting_exklusivitaet_von || null,
        contracting_exklusivitaet_bis: this.formData.contracting_exklusivitaet_bis || null
      });
    } else {
      // UGC-spezifische Felder
      Object.assign(data, {
        // Management-Vertretung (Snapshot aus creator_management -> management)
        influencer_agentur_vertreten: this.formData.influencer_agentur_vertreten || false,
        influencer_agentur_name: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_name || null : null,
        influencer_agentur_strasse: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_strasse || null : null,
        influencer_agentur_hausnummer: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_hausnummer || null : null,
        influencer_agentur_plz: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_plz || null : null,
        influencer_agentur_stadt: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_stadt || null : null,
        influencer_agentur_land: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_land || 'Deutschland' : null,
        influencer_agentur_vertretung: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_vertretung || null : null,
        
        anzahl_videos: parseInt(this.formData.anzahl_videos) || 0,
        anzahl_fotos: parseInt(this.formData.anzahl_fotos) || 0,
        content_erstellung_art: this.formData.content_erstellung_art || null,
        lieferung_art: this.formData.lieferung_art || null,
        rohmaterial_enthalten: this.formData.rohmaterial_enthalten || false,
        untertitel: this.formData.untertitel || false,
        nutzungsart: this.formData.nutzungsart || null,
        content_deadline: this.formData.content_deadline || null,
        abnahmedatum: this.formData.abnahmedatum || null
      });

      if (typeof this.isEhgKunde === 'function' && this.isEhgKunde()) {
        data.ehg_felder = collectEhgFelder(this.formData, (v) => this.parseCurrencyInput(v));
      }
    }

    return data;
};
