// VertraegeCreateCore.js
// Kern der Vertragserstellung: Klassen-Shell, Konstruktor, Locale-/Geld-Helfer,
// Permissions, Initialisierung, Draft-Load, Stammdaten, Lifecycle (destroy).
// Weitere Methoden werden per Prototype-Extension in separaten Dateien angehangen:
//   - RenderShell.js  (render, renderStep1, Multistep-Shell, ProgressBar, Dispatcher)
//   - KooperationLogic.js  (Kampagnen-/Creator-/Kooperationen-Filter + Vertragsname)
//   - FormEvents.js  (bindMultistepEvents, dynamische Felder, Drehtage, Veroeffentlichungsplan)
//   - SearchableSelects.js  (Init + Rebuild der durchsuchbaren Dropdowns, Creator-Profile)
//   - DataPersistence.js  (saveDraftToDB, prepareDataForDB, validate/save/submit)
//   - ContractTranslations.js  (localizeContractText, localizeDocText)
//   - types/*.js, pdf/*.js

import { KampagneUtils } from '../../kampagne/KampagneUtils.js';
import CONFIG from '../../../core/ConfigSystem.js';

export class VertraegeCreate {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 5;
    this.selectedTyp = null;
    this.formData = {};
    this.unternehmen = [];
    this.kampagnen = [];          // Alle Kampagnen
    this.filteredKampagnen = [];  // Gefiltert nach Kunde
    this.creators = [];
    this.filteredCreators = [];   // Gefiltert nach Kampagne (via Kooperationen)
    this.filteredKooperationen = []; // Kooperationen der gewählten Kampagne
    this.kundeAuftraegePo = [];   // PO-Nummern aus Aufträgen des Kunden
    this.isGenerated = false;
    this.editId = null; // ID wenn Draft bearbeitet wird
    this._filtersInitialized = false; // Flag um doppelte Filter-Initialisierung zu verhindern
    this._isRendering = false; // Lock um Flackern während des Renderns zu verhindern
    this._isInitializing = false; // Flag um Change-Events während Initialisierung zu ignorieren
    this.creatorAddressMissing = false; // Flag: Creator hat keine gültige Adresse
  }
}

VertraegeCreate.prototype.getContractLanguage = function(vertrag = {}) {
    const source = vertrag.vertragssprache
      || this.formData.vertragssprache
      || CONFIG?.CONTRACTS?.DEFAULT_LANGUAGE
      || CONFIG?.UI?.LANGUAGE
      || 'de';
    return source === 'en' ? 'en' : 'de';
};

VertraegeCreate.prototype.getContractLocale = function(lang) {
    return lang === 'en' ? 'en-GB' : 'de-DE';
};

// Wrapper damit KampagneUtils in Prototype-Extension-Dateien (types/*.js)
// nicht vom Tree-Shaking entfernt wird. Kern-Datei importiert KampagneUtils bereits.
VertraegeCreate.prototype.getKampagneDisplayName = function(kampagne) {
    return KampagneUtils.getDisplayName(kampagne);
};

VertraegeCreate.prototype.formatContractDate = function(dateValue, lang, options) {
    if (!dateValue) return '-';
    return new Date(dateValue).toLocaleDateString(this.getContractLocale(lang), options);
};

VertraegeCreate.prototype.parseCurrencyInput = function(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    let str = String(value).trim();
    if (!str) return null;

    str = str.replace(/\s+/g, '').replace(/[€$]/g, '');

    const hasComma = str.includes(',');
    const hasDot = str.includes('.');

    if (hasComma && hasDot) {
      const lastComma = str.lastIndexOf(',');
      const lastDot = str.lastIndexOf('.');
      const decimalSep = lastComma > lastDot ? ',' : '.';
      const thousandSep = decimalSep === ',' ? '.' : ',';
      str = str.split(thousandSep).join('');
      str = decimalSep === ',' ? str.replace(',', '.') : str;
    } else if (hasComma) {
      const parts = str.split(',');
      if (parts.length > 2) {
        str = parts.join('');
      } else {
        const decimalPart = parts[1] || '';
        const likelyThousands = decimalPart.length === 3 && parts[0].length > 0;
        str = likelyThousands ? parts.join('') : `${parts[0]}.${decimalPart}`;
      }
    } else if (hasDot) {
      const parts = str.split('.');
      if (parts.length > 2) {
        str = parts.join('');
      } else {
        const decimalPart = parts[1] || '';
        const likelyThousands = decimalPart.length === 3 && parts[0].length > 0;
        str = likelyThousands ? parts.join('') : `${parts[0]}.${decimalPart}`;
      }
    }

    str = str.replace(/[^0-9.-]/g, '');
    if (!str || str === '-' || str === '.') return null;

    const parsed = Number(str);
    return Number.isFinite(parsed) ? parsed : null;
};

VertraegeCreate.prototype.formatContractMoney = function(value, lang, options = {}) {
    const { emptyValue = '-' } = options;
    const numeric = this.parseCurrencyInput(value);
    if (numeric === null) return emptyValue;
    return new Intl.NumberFormat(this.getContractLocale(lang), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numeric);
};

VertraegeCreate.prototype.getVertragPermissions = function() {
    const isAdmin = window.isAdmin();
    const perms = window.currentUser?.permissions?.vertraege || {};
    return {
      isAdmin,
      canEdit: isAdmin || perms.can_edit === true,
      canView: isAdmin || perms.can_view === true
    };
};

VertraegeCreate.prototype.init = async function(draftId = null) {
    this.editId = draftId;
    
    window.setHeadline(draftId ? 'Vertrag bearbeiten' : 'Neuer Vertrag');
    
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateDetailLabel(draftId ? 'Bearbeiten' : 'Neuer Vertrag');
    }
    
    // Berechtigungsprüfung (einheitlich über PermissionSystem + Overrides)
    const { canEdit } = this.getVertragPermissions();

    if (!canEdit) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Verträge zu ${draftId ? 'bearbeiten' : 'erstellen'}.</p>
        </div>
      `;
      return;
    }

    // Lade Stammdaten
    await this.loadStammdaten();
    
    // Wenn Draft-ID übergeben, lade den Draft aus der DB
    if (draftId) {
      await this.loadDraftFromDB(draftId);
    }
    
    // Rendere Formular
    this.render();
};

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
          korrekturschleifen: draft.korrekturschleifen,
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
          kunde_po_nummer: draft.kunde_po_nummer
        };
        this.selectedTyp = draft.typ;
        this.isGenerated = true;
        this.currentStep = 2; // Start bei Schritt 2 da Typ schon gewählt
        
        // Kaskade initialisieren: Kampagnen für Kunde und Creator für Kampagne laden
        this.updateFilteredKampagnen();
        await this.updateFilteredCreators();
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

VertraegeCreate.prototype.resetForm = function() {
    this.currentStep = 1;
    this.selectedTyp = null;
    this.formData = {};
    this.filteredKampagnen = [];
    this.filteredCreators = [];
    this.filteredKooperationen = [];
    this.kundeAuftraegePo = [];
    this.isGenerated = false;
    this.editId = null;
    this._filtersInitialized = false;
    this._isRendering = false;
    this._isInitializing = false;
};

VertraegeCreate.prototype.loadStammdaten = async function() {
    if (!window.supabase) return;

    try {
      // Lade Unternehmen
      const { data: unternehmen } = await window.supabase
        .from('unternehmen')
        .select('id, firmenname, rechnungsadresse_strasse, rechnungsadresse_hausnummer, rechnungsadresse_plz, rechnungsadresse_stadt')
        .order('firmenname');
      
      this.unternehmen = unternehmen || [];
      console.log('📊 VERTRAG: Unternehmen geladen:', this.unternehmen.length);

      // Lade Kampagnen mit Unternehmen-ID
      const { data: kampagnen } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname, eigener_name, unternehmen_id, auftrag_id')
        .order('kampagnenname');
      
      this.kampagnen = kampagnen || [];
      console.log('📊 VERTRAG: Kampagnen geladen:', this.kampagnen.length);
      if (this.kampagnen.length > 0) {
        console.log('📊 VERTRAG: Beispiel-Kampagne:', this.kampagnen[0]);
      }

      // Lade Creator mit Adressen
      const { data: creators } = await window.supabase
        .from('creator')
        .select('id, vorname, nachname, lieferadresse_strasse, lieferadresse_hausnummer, lieferadresse_plz, lieferadresse_stadt, lieferadresse_land, instagram, tiktok')
        .order('nachname');
      
      this.creators = creators || [];
      console.log('📊 VERTRAG: Creator geladen:', this.creators.length);

    } catch (error) {
      console.error('❌ Fehler beim Laden der Stammdaten:', error);
    }
};

VertraegeCreate.prototype.destroy = function() {
    this.currentStep = 1;
    this.selectedTyp = null;
    this.formData = {};
    this.filteredKampagnen = [];
    this.filteredCreators = [];
    this.isGenerated = false;
    this.editId = null;
    this._filtersInitialized = false;
    this._isRendering = false;
    this._isInitializing = false;
    
    // Progress Container aus main-wrapper entfernen
    const progressContainer = document.getElementById('vertrag-progress-container');
    if (progressContainer) {
      progressContainer.remove();
    }
};
