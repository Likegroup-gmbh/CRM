// VertraegeCreateCore.js
// Kern der Vertragserstellung: Klassen-Shell, Konstruktor, Locale-/Geld-Helfer,
// Permissions, Initialisierung, Draft-Load, Stammdaten, Lifecycle (destroy).
// Weitere Methoden werden per Prototype-Extension in separaten Dateien angehangen:
//   - RenderShell.js  (render, renderStep1, Multistep-Shell, ProgressBar, Dispatcher)
//   - KooperationLogic.js  (Kampagnen-/Creator-/Kooperationen-Filter + Vertragsname)
//   - FormEvents.js  (bindMultistepEvents, dynamische Felder, Drehtage, Veroeffentlichungsplan)
//   - SearchableSelects.js  (Init + Rebuild der durchsuchbaren Dropdowns, Creator-Profile)
//   - prepareVertragPayload.js  (prepareDataForDB)
//   - DataPersistence.js  (saveDraftToDB, validate/save/submit)
//   - VertragDraftLoad.js  (loadDraftFromDB)
//   - CreatorAddressPreview.js  (Hauptadresse-Vorschau und PDF-Zeilen)
//   - ContractTranslations.js  (localizeContractText, localizeDocText)
//   - types/*.js, pdf/*.js

import { KampagneUtils } from '../../kampagne/KampagneUtils.js';
import CONFIG from '../../../core/ConfigSystem.js';
import { applyFinalisiertFilter } from '../../../core/finalisiert.js';

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
    this.filteredCreators = [];   // Casting Zusage/Gebucht + Kooperation-Union
    this.filteredKooperationen = []; // Kooperationen der gewählten Kampagne
    this.kundeAuftraegePo = [];   // PO-Nummern aus Aufträgen des Kunden
    this.contractingAuftraege = []; // Alle Contracting-Aufträge
    this.filteredContractingAuftraege = []; // Gefiltert nach Kunde
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
    
    const crumbLabel = draftId ? 'Bearbeiten' : 'Neuer Vertrag';
    window.breadcrumbSystem?.updateDetailLabel(crumbLabel);
    
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
    } else {
      await this.applyQueryPrefill();
    }
    
    // Rendere Formular
    this.render();
};

VertraegeCreate.prototype.applyQueryPrefill = async function() {
    const params = new URLSearchParams(window.location.search);
    const typ = params.get('typ');
    const unternehmen = params.get('unternehmen');
    const kampagne = params.get('kampagne');
    const auftrag = params.get('auftrag');

    if (unternehmen) {
      this.formData.kunde_unternehmen_id = unternehmen;
    }

    if (kampagne && typ !== 'Contracting') {
      this.formData.kampagne_id = kampagne;
    }
    const produktion = params.get('produktion');
    if (produktion && typ !== 'Contracting') this.formData.produktion_id = produktion;

    if (typ === 'Contracting') {
      this.selectedTyp = 'Contracting';
      this.formData.typ = 'Contracting';
      if (auftrag) {
        this.formData.contracting_auftrag_id = auftrag;
        if (typeof this.applyContractingAuftragData === 'function') {
          this.applyContractingAuftragData(auftrag);
        }
      }
      if (typeof this.updateFilteredContractingAuftraege === 'function') {
        this.updateFilteredContractingAuftraege();
      }
      this.isGenerated = true;
      this.currentStep = 2;
    }

    if (this.formData.kunde_unternehmen_id && typeof this.updateFilteredKampagnen === 'function') {
      this.updateFilteredKampagnen();
    }
    if (this.formData.kampagne_id) {
      if (typeof this.loadPoFromKampagne === 'function') {
        await this.loadPoFromKampagne(this.formData.kampagne_id);
      }
      if (typeof this.updateFilteredCreators === 'function') {
        await this.updateFilteredCreators();
      }
    }
    if (this.formData.kunde_unternehmen_id || this.formData.kampagne_id) {
      this._filtersInitialized = true;
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
    this.filteredContractingAuftraege = [];
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
        .select('id, firmenname, rechnungsadresse_strasse, rechnungsadresse_hausnummer, rechnungsadresse_plz, rechnungsadresse_stadt, rechnungsadresse_land, reg_code, ust_id, vertreten_durch')
        .order('firmenname');
      
      this.unternehmen = unternehmen || [];
      console.log('📊 VERTRAG: Unternehmen geladen:', this.unternehmen.length);

      // Lade Kampagnen mit Unternehmen-ID + Marke (für Dropbox-Pfad bei PDF-Upload)
      const { data: kampagnen } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname, eigener_name, unternehmen_id, auftrag_id, marke_id, marke:marke_id(id, markenname)')
        .order('kampagnenname');
      
      this.kampagnen = kampagnen || [];
      console.log('📊 VERTRAG: Kampagnen geladen:', this.kampagnen.length);
      if (this.kampagnen.length > 0) {
        console.log('📊 VERTRAG: Beispiel-Kampagne:', this.kampagnen[0]);
      }

      // Lade Creator mit Adressen
      const { data: creators } = await window.supabase
        .from('creator')
        .select('id, vorname, nachname, mail, lieferadresse_strasse, lieferadresse_hausnummer, lieferadresse_plz, lieferadresse_stadt, lieferadresse_land, hauptadresse_quelle, instagram, tiktok')
        .order('nachname');
      
      this.creators = creators || [];
      console.log('📊 VERTRAG: Creator geladen:', this.creators.length);

      if (typeof this.loadAlleManagements === 'function') {
        await this.loadAlleManagements();
      }

      // Lade Contracting-Aufträge (für Contracting-Vertragstyp)
      const { data: contractingAuftraege } = await applyFinalisiertFilter(
        window.supabase
          .from('auftrag')
          .select('id, auftragsname, titel, unternehmen_id, po, angebotsnummer, marke_id')
          .eq('auftragtype', 'Contracting'),
        'auftrag'
      ).order('created_at', { ascending: false });

      this.contractingAuftraege = contractingAuftraege || [];
      console.log('📊 VERTRAG: Contracting-Aufträge geladen:', this.contractingAuftraege.length);

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
    this.filteredContractingAuftraege = [];
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
