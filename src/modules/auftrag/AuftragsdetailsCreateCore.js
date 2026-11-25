// AuftragsdetailsCreateCore.js
// Core-Klasse der Auftragsdetails-Erstellung: Init, Edit-Mode, Formular-Aufbau, Lifecycle
// Weitere Methoden hängen als Prototype-Mixins in AuftragsdetailsCreateData/Selects/Events.js

import { auftragsdetailsRepository } from './repository/AuftragsdetailsRepository.js';
import { auftragsdetailsCreateView } from './views/AuftragsdetailsCreateView.js';
import { kampagnenartenService } from './services/KampagnenartenService.js';

export class AuftragsdetailsCreateController {
  constructor() {
    this.formData = {};
    this.unternehmen = []; // Gefilterte Unternehmen für Mitarbeiter
    this.auftraege = []; // Aufträge-Liste für Event-Listener
    this.currentKampagnenarten = []; // Aktuelle Kampagnenarten des ausgewählten Auftrags
    this.allKampagnenartTypen = []; // Alle verfügbaren Kampagnenart-Typen
    this.currentUnternehmenId = null; // Aktuell ausgewähltes Unternehmen
    this.currentAuftragId = null; // Aktuell ausgewählter Auftrag
    this.auftragIdsWithDetails = []; // Aufträge die bereits Details haben
    
    // Edit-Mode Variablen
    this.isEditMode = false;
    this.editDetailsId = null;
    this.existingDetails = null;
    this.repository = auftragsdetailsRepository;
    this.view = auftragsdetailsCreateView;
    this.kampagnenartenService = kampagnenartenService;

    // Lifecycle/Cleanup
    this._eventDisposers = [];
    this._observers = [];
    this._eventsBound = false;
    this._navigateTimer = null;
  }

  // Initialisiere Auftragsdetails-Erstellung
  async init() {
    console.log('🎯 AUFTRAGSDETAILSCREATE: Initialisiere Auftragsdetails-Erstellung');
    
    // Security: Nur Mitarbeiter haben Zugriff
    const isKunde = window.isKunde();
    if (isKunde) {
      window.setHeadline('Zugriff verweigert');
      window.content.innerHTML = `
        <div class="error-state">
          <h2>Zugriff verweigert</h2>
          <p>Sie haben keine Berechtigung, diese Seite zu sehen.</p>
        </div>
      `;
      return;
    }

    // Edit-Mode prüfen:
    // 1. Via Route /auftragsdetails/:id/edit (window._auftragsdetailsEditId)
    // 2. Via Query-Parameter ?edit=detailsId (Legacy/Fallback)
    let editId = window._auftragsdetailsEditId || null;
    
    // Fallback: Query-Parameter prüfen
    if (!editId) {
      const urlParams = new URLSearchParams(window.location.search);
      editId = urlParams.get('edit');
    }
    
    // window._auftragsdetailsEditId nach Verwendung löschen
    if (window._auftragsdetailsEditId) {
      delete window._auftragsdetailsEditId;
    }
    
    if (editId) {
      console.log('📝 AUFTRAGSDETAILSCREATE: Edit-Mode erkannt für Details-ID:', editId);
      this.isEditMode = true;
      this.editDetailsId = editId;
      
      // Bestehende Details laden
      await this.loadExistingDetails(editId);
    } else {
      this.isEditMode = false;
      this.editDetailsId = null;
      this.existingDetails = null;
    }

    await this.showCreateForm();
  }

  /**
   * Lädt bestehende Auftragsdetails für den Edit-Mode
   * @param {string} detailsId - ID der Auftragsdetails
   */
  async loadExistingDetails(detailsId) {
    console.log('🔄 AUFTRAGSDETAILSCREATE: Lade bestehende Details für ID:', detailsId);
    
    try {
      this.existingDetails = await this.repository.loadExistingDetails(detailsId);
      console.log('✅ AUFTRAGSDETAILSCREATE: Bestehende Details geladen');
      
      // IDs für Vorausfüllung setzen
      if (this.existingDetails.auftrag) {
        this.currentUnternehmenId = this.existingDetails.auftrag.unternehmen_id;
        this.currentAuftragId = this.existingDetails.auftrag_id;
      }
      
    } catch (error) {
      console.error('❌ AUFTRAGSDETAILSCREATE: Fehler beim Laden der Details:', error);
    }
  }

  // Show Create Form
  async showCreateForm() {
    console.log('🎯 AUFTRAGSDETAILSCREATE: Zeige Auftragsdetails-Formular (Edit-Mode:', this.isEditMode, ')');
    
    // Headline und Breadcrumb basierend auf Mode
    if (this.isEditMode) {
      window.setHeadline('Auftragsdetails bearbeiten');
      
      if (window.breadcrumbSystem) {
        window.breadcrumbSystem.updateDetailLabel('Bearbeiten');
      }
    } else {
      window.setHeadline('Neue Auftragsdetails anlegen');
      
      if (window.breadcrumbSystem) {
        window.breadcrumbSystem.updateDetailLabel('Neu anlegen');
      }
    }
    
    // Schritt 1: Lade alle Aufträge, die bereits Details haben
    let auftragIdsWithDetails = [];
    try {
      auftragIdsWithDetails = await this.repository.loadAuftragIdsWithDetails();
    } catch (detailsError) {
      console.error('Fehler beim Laden der existierenden Details:', detailsError);
      return;
    }

    // IDs der Aufträge, die bereits Details haben
    this.auftragIdsWithDetails = auftragIdsWithDetails;
    console.log('📋 Aufträge mit Details:', this.auftragIdsWithDetails);

    // Schritt 2: Lade Unternehmen (gefiltert nach Mitarbeiter-Zuordnung)
    this.unternehmen = await this.loadUnternehmen();
    console.log('🏢 Verfügbare Unternehmen:', this.unternehmen.length);
    
    // Aufträge werden erst nach Unternehmen-Auswahl geladen (Kaskade)
    this.auftraege = [];

    // Lade alle verfügbaren Kampagnenart-Typen für das Multiselect
    this.allKampagnenartTypen = await this.loadAllKampagnenartTypen();

    // Formular HTML - Basis-Struktur mit dynamischem Container
    const formHtml = this.view.renderForm({
      isEditMode: this.isEditMode,
      unternehmen: this.unternehmen,
      allKampagnenartTypen: this.allKampagnenartTypen
    });

    window.content.innerHTML = formHtml;

    // Dynamische Optionen sicher per DOM-API befüllen
    this.populateUnternehmenOptions();
    this.populateKampagnenartOptions();
    
    // Events binden
    this.bindFormEvents();
    
    // Autosuggestion für Unternehmen und Auftrag initialisieren
    this.initSearchableSelects();
    
    // Im Edit-Mode: Selects vorausfüllen
    if (this.isEditMode && this.existingDetails) {
      await this.prefillFormForEditMode();
    }
  }

  // Destroy
  destroy() {
    console.log('🎯 AUFTRAGSDETAILSCREATE: Destroy');
    this.cleanupBindings();
    if (this._navigateTimer) {
      clearTimeout(this._navigateTimer);
      this._navigateTimer = null;
    }
  }

  addManagedListener(target, type, handler, options) {
    if (!target || !type || !handler) return;
    target.addEventListener(type, handler, options);
    this._eventDisposers.push(() => target.removeEventListener(type, handler, options));
  }

  trackObserver(observer) {
    if (!observer) return;
    this._observers.push(observer);
  }

  cleanupBindings() {
    this._eventDisposers.forEach(dispose => {
      try {
        dispose();
      } catch (e) {
        console.warn('⚠️ Fehler beim Entfernen eines Event-Listeners:', e);
      }
    });
    this._eventDisposers = [];

    this._observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (e) {
        console.warn('⚠️ Fehler beim Disconnect eines Observers:', e);
      }
    });
    this._observers = [];
    this._eventsBound = false;
  }
}
