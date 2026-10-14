// VertragDraftLoad.js
// Lädt einen Vertragsentwurf und faltet die JSON-Felder wieder ins Formular.

import { VertraegeCreate } from './VertraegeCreateCore.js';
import { expandParagraphZusaetze, expandAwarenessFelder, expandEhgFelder } from './paragraphZusatz.js';
import { normalizeKorrekturschleifen } from './pflichtAuswahlen.js';
import { applyVertretenDurch } from './managementVertretung.js';

VertraegeCreate.prototype.loadDraftFromDB = async function(draftId) {
    try {
      const { data: draft, error } = await window.supabase
        .from('vertraege')
        .select('*')
        .eq('id', draftId)
        .single();

      if (error) throw error;

      if (draft) {
        this.formData = {
          typ: draft.typ,
          vertragssprache: draft.vertragssprache || this.getContractLanguage(draft),
          name: draft.name,
          kunde_unternehmen_id: draft.kunde_unternehmen_id,
          kampagne_id: draft.kampagne_id,
          creator_id: draft.creator_id,
          kooperation_id: draft.kooperation_id,
          // UGC-spezifische Felder
          anzahl_videos: draft.anzahl_videos || 0,
          anzahl_fotos: draft.anzahl_fotos || 0,
          anzahl_storys: draft.anzahl_storys || 0,
          content_erstellung_art: draft.content_erstellung_art,
          lieferung_art: draft.lieferung_art,
          rohmaterial_enthalten: draft.rohmaterial_enthalten,
          untertitel: draft.untertitel,
          nutzungsart: draft.nutzungsart,
          medien: draft.medien || [],
          nutzungsdauer: draft.nutzungsdauer,
          nutzungsdauer_custom_wert: draft.nutzungsdauer_custom_wert,
          nutzungsdauer_custom_einheit: draft.nutzungsdauer_custom_einheit,
          exklusivitaet: draft.exklusivitaet,
          exklusivitaet_monate: draft.exklusivitaet_monate,
          exklusivitaet_einheit: draft.exklusivitaet_einheit || 'monate',
          verguetung_netto: draft.verguetung_netto,
          zusatzkosten: draft.zusatzkosten,
          zusatzkosten_betrag: draft.zusatzkosten_betrag,
          zahlungsziel: draft.zahlungsziel,
          skonto: draft.skonto,
          content_deadline: draft.content_deadline,
          korrekturschleifen: normalizeKorrekturschleifen(draft.korrekturschleifen),
          abnahmedatum: draft.abnahmedatum,
          weitere_bestimmungen: draft.weitere_bestimmungen,
          // Influencer-spezifische Felder (Agentur-Adresse strukturiert)
          influencer_agentur_vertreten: draft.influencer_agentur_vertreten || false,
          influencer_agentur_name: draft.influencer_agentur_name,
          influencer_agentur_strasse: draft.influencer_agentur_strasse,
          influencer_agentur_hausnummer: draft.influencer_agentur_hausnummer,
          influencer_agentur_plz: draft.influencer_agentur_plz,
          influencer_agentur_stadt: draft.influencer_agentur_stadt,
          influencer_agentur_land: draft.influencer_agentur_land || 'Deutschland',
          influencer_agentur_vertretung: draft.influencer_agentur_vertretung,
          // Gewaehltes Management + Schalter "nur Management-Adresse"
          _management_id: draft.management_id || null,
          nur_management_adresse: draft.nur_management_adresse || false,
          influencer_land: draft.influencer_land,
          influencer_profile: draft.influencer_profile || [],
          // Handle-Felder aus gespeicherten Profil-Strings parsen (Format: "Plattform @handle")
          ...this._parseProfileHandles(draft.influencer_profile || []),
          plattformen: draft.plattformen || [],
          plattformen_sonstige: draft.plattformen_sonstige,
          anzahl_reels: draft.anzahl_reels || 0,
          anzahl_feed_posts: draft.anzahl_feed_posts || 0,
          veroeffentlichungsplan: draft.veroeffentlichungsplan || {},
          organische_veroeffentlichung: draft.organische_veroeffentlichung,
          media_buyout: draft.media_buyout,
          reichweiten_garantie: draft.reichweiten_garantie || false,
          reichweiten_garantie_wert: draft.reichweiten_garantie_wert,
          mindest_online_dauer: draft.mindest_online_dauer,
          anpassungen: draft.anpassungen || [],
          // Videograf-spezifische Felder
          kunde_rechtsform: draft.kunde_rechtsform,
          influencer_steuer_id: draft.influencer_steuer_id,
          videograf_produktionsart: draft.videograf_produktionsart,
          videograf_produktionsplan: draft.videograf_produktionsplan || [],
          videograf_lieferumfang: draft.videograf_lieferumfang || [],
          videograf_v1_deadline: draft.videograf_v1_deadline,
          videograf_finale_werktage: draft.videograf_finale_werktage,
          videograf_nutzungsart: draft.videograf_nutzungsart || [],
          // PO-Nummer
          kunde_po_nummer: draft.kunde_po_nummer,
          // Contracting-spezifische Felder
          contracting_auftrag_id: draft.contracting_auftrag_id,
          contracting_plattformen_handles: draft.contracting_plattformen_handles || {},
          contracting_content_formate: draft.contracting_content_formate || [],
          contracting_anzahl_inhalte: draft.contracting_anzahl_inhalte,
          contracting_veroeffentlichung_zeitraum: draft.contracting_veroeffentlichung_zeitraum,
          contracting_buyout_aktiv: draft.contracting_buyout_aktiv || false,
          contracting_buyout_plattformen: draft.contracting_buyout_plattformen || [],
          contracting_buyout_art: draft.contracting_buyout_art || [],
          contracting_buyout_art_sonstige: draft.contracting_buyout_art_sonstige,
          contracting_buyout_nutzungsdauer: draft.contracting_buyout_nutzungsdauer,
          contracting_buyout_geografisch: draft.contracting_buyout_geografisch,
          contracting_buyout_besonderheiten: draft.contracting_buyout_besonderheiten,
          contracting_veroeffentlichungsdatum: draft.contracting_veroeffentlichungsdatum,
          contracting_exklusivitaet_bereich: draft.contracting_exklusivitaet_bereich,
          contracting_exklusivitaet_von: draft.contracting_exklusivitaet_von,
          contracting_exklusivitaet_bis: draft.contracting_exklusivitaet_bis,
          // Zusätzliche Bestimmungen pro Paragraph: JSONB -> flache paragraph_zusatz_*-Felder
          ...expandParagraphZusaetze(draft.paragraph_zusaetze),
          // Awareness-Template-Felder: JSONB -> flache Formularfelder
          ...expandAwarenessFelder(draft.awareness_felder),
          ...expandEhgFelder(draft.ehg_felder),
          ...applyVertretenDurch({}, draft.vertreten_durch)
        };
        this.selectedTyp = draft.typ;
        if (typeof this.loadEhgKundenStammdaten === 'function' && this.formData.typ === 'UGC') {
          await this.loadEhgKundenStammdaten();
        }
        this.isGenerated = true;
        this.currentStep = 2; // Start bei Schritt 2 da Typ schon gewählt
        
        // Kaskade initialisieren: Kampagnen für Kunde und Creator für Kampagne laden
        this.updateFilteredKampagnen();
        await this.updateFilteredCreators();
        // Contracting-Aufträge nach Kunde filtern
        if (typeof this.updateFilteredContractingAuftraege === 'function') {
          this.updateFilteredContractingAuftraege();
        }
        this._filtersInitialized = true; // Verhindert doppelte Initialisierung in renderStep2
        
        // Creator-Profile aus Creator-Profil übernehmen (falls Creator gewählt)
        if (this.formData.creator_id) {
          const creator = this.creators.find(c => c.id === this.formData.creator_id);
          if (creator) this._applyCreatorProfiles(creator);
        }
        
        console.log('📋 Draft aus DB geladen:', draft);
        console.log('📋 Gefilterte Kampagnen:', this.filteredKampagnen.length);
        console.log('📋 Gefilterte Creator:', this.filteredCreators.length);
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden des Drafts:', error);
      window.toastSystem?.show('Draft konnte nicht geladen werden', 'error');
    }
};
