// AuftragsdetailsCreateData.js
// Daten-Methoden: Unternehmen/Aufträge/Kampagnenarten laden, Kampagnenarten aktivieren
// (Prototype-Mixin von AuftragsdetailsCreateController)

import { AuftragsdetailsCreateController } from './AuftragsdetailsCreateCore.js';

Object.assign(AuftragsdetailsCreateController.prototype, {
  /**
   * Lädt alle verfügbaren Kampagnenart-Typen aus der Datenbank
   * @returns {Promise<Array<{id: string, name: string}>>}
   */
  async loadAllKampagnenartTypen() {
    try {
      return await this.repository.loadAllKampagnenartTypen();
    } catch (error) {
      console.error('❌ Fehler beim Laden der Kampagnenart-Typen:', error);
      return [];
    }
  },

  /**
   * Lädt Unternehmen gefiltert nach Mitarbeiter-Zuordnung
   * NUR Unternehmen mit mindestens einem offenen Auftrag (ohne Details)
   * Im Edit-Mode: Aktuelles Unternehmen immer einschließen
   * @returns {Promise<Array<{id: string, firmenname: string}>>}
   */
  async loadUnternehmen() {
    try {
      // Hole erlaubte Unternehmen-IDs vom PermissionSystem
      const allowedIds = await window.getAllowedUnternehmenIds?.();
      console.log('🔐 Erlaubte Unternehmen-IDs:', allowedIds);
      
      // Im Edit-Mode: Aktuelles Unternehmen merken
      const editUnternehmenId = this.isEditMode && this.existingDetails?.auftrag?.unternehmen_id 
        ? this.existingDetails.auftrag.unternehmen_id 
        : null;
      
      // Schritt 1: Alle Auftrags-IDs mit Details laden
      let auftragIdsWithDetails = await this.repository.loadAuftragIdsWithDetails();
      
      // Im Edit-Mode: Den aktuellen Auftrag aus der "mit Details"-Liste entfernen
      // damit das Unternehmen als "offen" gilt
      if (this.isEditMode && this.currentAuftragId) {
        auftragIdsWithDetails = auftragIdsWithDetails.filter(id => id !== this.currentAuftragId);
      }
      
      console.log('📋 Aufträge mit Details:', auftragIdsWithDetails.length);
      
      // Schritt 2: Aufträge OHNE Details laden und deren Unternehmen-IDs extrahieren
      const alleAuftraegeData = await this.repository.loadAllAuftraegeBasic();

      // Filter robust client-seitig statt fragiler NOT IN Stringbildung
      const detailsIdSet = new Set(auftragIdsWithDetails);
      const auftraegeData = (alleAuftraegeData || []).filter(a => !detailsIdSet.has(a.id));
      
      // Unique Unternehmen-IDs mit offenen Aufträgen
      let unternehmenMitOffenenAuftraegen = [...new Set(
        (auftraegeData || []).map(a => a.unternehmen_id).filter(Boolean)
      )];
      
      // Im Edit-Mode: Aktuelles Unternehmen immer einschließen
      if (editUnternehmenId && !unternehmenMitOffenenAuftraegen.includes(editUnternehmenId)) {
        unternehmenMitOffenenAuftraegen.push(editUnternehmenId);
        console.log('📝 Edit-Mode: Aktuelles Unternehmen hinzugefügt:', editUnternehmenId);
      }
      
      console.log('🏢 Unternehmen mit offenen Aufträgen:', unternehmenMitOffenenAuftraegen.length);
      
      if (unternehmenMitOffenenAuftraegen.length === 0) {
        console.log('ℹ️ Keine Unternehmen mit offenen Aufträgen gefunden');
        return [];
      }
      
      // Schritt 3: Unternehmen laden (nur mit offenen Aufträgen)
      let finalIds = unternehmenMitOffenenAuftraegen;
      
      // Für Nicht-Admins: Zusätzlich nach erlaubten IDs filtern (Schnittmenge)
      if (allowedIds !== null) {
        if (allowedIds.length === 0) {
          console.log('🔐 Keine Unternehmen zugeordnet');
          return [];
        }
        // Schnittmenge: Unternehmen mit offenen Aufträgen UND erlaubte Unternehmen
        finalIds = unternehmenMitOffenenAuftraegen.filter(id => allowedIds.includes(id));
        if (finalIds.length === 0) {
          console.log('🔐 Keine erlaubten Unternehmen mit offenen Aufträgen');
          return [];
        }
      }
      
      const data = await this.repository.loadUnternehmenByIds(finalIds);
      console.log('✅ Geladene Unternehmen (mit offenen Aufträgen):', data.length);
      return data;
    } catch (error) {
      console.error('❌ Fehler beim Laden der Unternehmen:', error);
      return [];
    }
  },

  /**
   * Lädt Aufträge für ein bestimmtes Unternehmen (ohne bereits vorhandene Details)
   * Im Edit-Mode wird der aktuelle Auftrag NICHT herausgefiltert
   * @param {string} unternehmenId - ID des Unternehmens
   * @returns {Promise<Array>}
   */
  async loadAuftraegeForUnternehmen(unternehmenId) {
    if (!unternehmenId) return [];
    
    try {
      const data = await this.repository.loadAuftraegeForUnternehmen(unternehmenId);
      
      // Filtere Aufträge die bereits Details haben
      // Im Edit-Mode: Den aktuellen Auftrag NICHT herausfiltern!
      const filtered = (data || []).filter(a => {
        // Im Edit-Mode: aktuellen Auftrag behalten
        if (this.isEditMode && a.id === this.currentAuftragId) {
          return true;
        }
        // Sonst: Aufträge mit Details herausfiltern
        return !this.auftragIdsWithDetails.includes(a.id);
      });
      
      console.log(`📋 Aufträge für Unternehmen ${unternehmenId}: ${filtered.length} verfügbar (Edit-Mode: ${this.isEditMode})`);
      
      return filtered;
    } catch (error) {
      console.error('❌ Fehler beim Laden der Aufträge:', error);
      return [];
    }
  },

  /**
   * Lädt die Kampagnenarten für einen Auftrag
   * PRIMÄR: Aus der auftrag_kampagne_art Junction-Tabelle (direkt am Auftrag hinterlegt)
   * FALLBACK: Aus den zugehörigen Kampagnen
   * @param {string} auftragId - ID des Auftrags
   * @returns {Promise<string[]>} - Array der eindeutigen Kampagnenarten-Namen
   */
  async loadKampagnenartenForAuftrag(auftragId) {
    if (!auftragId) return [];
    
    try {
      const arten = await this.repository.loadKampagnenartenForAuftrag(auftragId);
      console.log('📋 Kampagnenarten geladen:', arten);
      return arten;
    } catch (error) {
      console.error('❌ Fehler beim Laden der Kampagnenarten:', error);
      return [];
    }
  },

  /**
   * Speichert die Kampagnenarten in die auftrag_kampagne_art Junction-Tabelle
   * @param {string} auftragId - ID des Auftrags
   * @param {string[]} kampagneArtIds - Array der Kampagnenart-IDs
   */
  async saveKampagnenartenToJunction(auftragId, kampagneArtIds) {
    console.log('💾 Speichere Kampagnenarten in Junction:', { auftragId, kampagneArtIds });
    await this.repository.replaceKampagnenartenForAuftrag(auftragId, kampagneArtIds);
    console.log('✅ Kampagnenarten in Junction gespeichert');
  },

  /**
   * Holt die ausgewählten Kampagnenart-IDs aus dem Multiselect
   * @returns {string[]} - Array der ausgewählten IDs
   */
  getSelectedKampagnenartIds() {
    const selectedIds = this.kampagnenartenService.getSelectedKampagnenartIds();
    console.log('📋 Ausgewählte Kampagnenart-IDs:', selectedIds);
    return selectedIds;
  },

  /**
   * Aktiviert die ausgewählten Kampagnenarten:
   * - Speichert in auftrag_kampagne_art Junction-Tabelle
   * - Rendert die dynamischen Budget-Sections
   */
  async activateKampagnenarten() {
    if (!this.currentAuftragId) {
      return;
    }

    console.log('🎯 Aktiviere Kampagnenarten für Auftrag:', this.currentAuftragId);
    
    try {
      // Sammle die ausgewählten Werte
      const selectedIds = this.getSelectedKampagnenartIds();
      
      if (selectedIds.length === 0) {
        return;
      }

      // Speichere in der Junction-Tabelle
      await this.saveKampagnenartenToJunction(this.currentAuftragId, selectedIds);

      // Lade die Kampagnenarten-Namen neu
      const kampagnenarten = await this.loadKampagnenartenForAuftrag(this.currentAuftragId);
      this.currentKampagnenarten = kampagnenarten;

      // Lade bestehende auftrag_details Werte (falls vorhanden)
      let existingValues = {};
      try {
        existingValues = await this.repository.loadExistingValuesForAuftrag(this.currentAuftragId);
      } catch (e) {
        console.warn('⚠️ Keine bestehenden auftrag_details gefunden');
      }

      // Rendere die dynamischen Sections
      this.renderDynamicSections(kampagnenarten, existingValues);

      // Aktiviere den Erstellen-Button
      const submitBtn = document.getElementById('submit-btn');
      if (submitBtn) {
        submitBtn.disabled = false;
      }

      console.log('✅ Kampagnenarten aktiviert:', kampagnenarten);

    } catch (error) {
      console.error('❌ Fehler beim Aktivieren der Kampagnenarten:', error);
    }
  },

  /**
   * Rendert die dynamischen Sections basierend auf Kampagnenarten
   * NUR Budget-Felder - Anzahl wird über Kampagnen gepflegt
   * @param {string[]} kampagnenarten - Array von Kampagnenarten-Namen
   * @param {object} existingValues - Bestehende Werte (optional)
   */
  renderDynamicSections(kampagnenarten, existingValues = {}) {
    this.kampagnenartenService.renderDynamicSections(kampagnenarten, existingValues);
  },
});
