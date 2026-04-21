// KooperationLogic.js
// Kaskaden-Logik fuer Kunde -> Kampagne -> Creator -> Kooperation sowie PO-Nummer-Lookups
// und automatische Vertragsnamen-Generierung.

import { VertraegeCreate } from './VertraegeCreateCore.js';
import { KampagneUtils } from '../../kampagne/KampagneUtils.js';

function koopLabel(k) {
  const name = k.name || k.id;
  if (k.created_at) {
    return `${name} (${new Date(k.created_at).toLocaleDateString('de-DE')})`;
  }
  return name;
}

VertraegeCreate.prototype.updateFilteredKampagnen = function() {
    console.log('🔍 VERTRAG: updateFilteredKampagnen aufgerufen');
    console.log('🔍 VERTRAG: kunde_unternehmen_id:', this.formData.kunde_unternehmen_id, '(Typ:', typeof this.formData.kunde_unternehmen_id, ')');
    console.log('🔍 VERTRAG: Anzahl geladener Kampagnen:', this.kampagnen.length);
    
    // Debug: Alle einzigartigen Unternehmen-IDs in Kampagnen anzeigen
    if (this.kampagnen.length > 0) {
      const uniqueUnternehmenIds = [...new Set(this.kampagnen.map(k => k.unternehmen_id))];
      console.log('🔍 VERTRAG: Unternehmen-IDs in Kampagnen:', uniqueUnternehmenIds);
    }
    
    if (this.formData.kunde_unternehmen_id) {
      // String-Vergleich für robuste UUID-Behandlung
      const kundeId = String(this.formData.kunde_unternehmen_id);
      this.filteredKampagnen = this.kampagnen.filter(
        k => String(k.unternehmen_id) === kundeId
      );
      console.log('🔍 VERTRAG: Gefilterte Kampagnen:', this.filteredKampagnen.length);
      if (this.filteredKampagnen.length === 0 && this.kampagnen.length > 0) {
        console.log('⚠️ VERTRAG: Keine Kampagnen für Kunde gefunden!');
        console.log('⚠️ VERTRAG: Gesuchte Kunde-ID:', kundeId);
        console.log('⚠️ VERTRAG: Erste 3 Kampagnen:', this.kampagnen.slice(0, 3).map(k => ({name: KampagneUtils.getDisplayName(k), unternehmen_id: k.unternehmen_id})));
      }
    } else {
      this.filteredKampagnen = [];
      console.log('🔍 VERTRAG: Keine kunde_unternehmen_id gesetzt, filteredKampagnen geleert');
    }
};

VertraegeCreate.prototype.loadKundeAuftraegePo = async function() {
    if (!this.formData.kunde_unternehmen_id) {
      this.kundeAuftraegePo = [];
      return;
    }

    try {
      const kundeId = String(this.formData.kunde_unternehmen_id);
      const { data: auftraege, error } = await window.supabase
        .from('auftrag')
        .select('id, po, auftragsname')
        .eq('unternehmen_id', kundeId)
        .not('po', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.kundeAuftraegePo = auftraege || [];
      console.log('📋 VERTRAG: PO-Nummern geladen:', this.kundeAuftraegePo.length);
    } catch (error) {
      console.error('❌ Fehler beim Laden der PO-Nummern:', error);
      this.kundeAuftraegePo = [];
    }
};

VertraegeCreate.prototype.loadPoFromKampagne = async function(kampagneId) {
    if (!kampagneId) {
      this.formData.kunde_po_nummer = null;
      return;
    }

    try {
      const kampagne = this.kampagnen.find(k => k.id === kampagneId);
      const auftragId = kampagne?.auftrag_id;

      if (!auftragId) {
        console.warn('⚠️ VERTRAG: Kampagne hat keine auftrag_id, PO kann nicht geladen werden');
        this.formData.kunde_po_nummer = null;
        return;
      }

      const { data: auftrag, error } = await window.supabase
        .from('auftrag')
        .select('po')
        .eq('id', auftragId)
        .single();

      if (error) throw error;

      this.formData.kunde_po_nummer = auftrag?.po || null;
      console.log('📋 VERTRAG: PO aus Kampagne-Auftrag gesetzt:', this.formData.kunde_po_nummer);
    } catch (error) {
      console.error('❌ Fehler beim Laden der PO aus Kampagne:', error);
      this.formData.kunde_po_nummer = null;
    }
};

VertraegeCreate.prototype.updateKooperationField = function() {
    const field = document.getElementById('kooperation-field');
    const select = document.getElementById('kooperation_id');
    if (!field || !select) return;

    this.formData.kooperation_id = null;

    const koopForCreator = this.filteredKooperationen.filter(
      k => k.creator_id === this.formData.creator_id
    );

    if (!this.formData.creator_id || koopForCreator.length === 0) {
      field.style.display = 'none';
      select.innerHTML = '<option value="">Kooperation auswählen...</option>';
      return;
    }

    field.style.display = '';
    select.innerHTML = `
      <option value="">Kooperation auswählen...</option>
      ${koopForCreator.map(k => `<option value="${k.id}">${koopLabel(k)}</option>`).join('')}
    `;

    if (koopForCreator.length === 1) {
      select.value = koopForCreator[0].id;
      this.formData.kooperation_id = koopForCreator[0].id;
      this.applyKooperationVerguetung(koopForCreator[0].id);
    }
};

VertraegeCreate.prototype.renderKooperationSelect = function() {
    const koopForCreator = this.filteredKooperationen.filter(
      k => k.creator_id === this.formData.creator_id
    );
    const showField = this.formData.creator_id && koopForCreator.length > 0;

    return `
      <div class="form-field" id="kooperation-field" style="${showField ? '' : 'display:none'}">
        <label for="kooperation_id">Kooperation <span class="required">*</span></label>
        <select id="kooperation_id" name="kooperation_id" required>
          <option value="">Kooperation auswählen...</option>
          ${koopForCreator.map(k => `
            <option value="${k.id}" ${this.formData.kooperation_id === k.id ? 'selected' : ''}>
              ${koopLabel(k)}
            </option>
          `).join('')}
        </select>
      </div>
    `;
};

VertraegeCreate.prototype.applyKooperationVerguetung = function(kooperationId) {
    if (!kooperationId) return;

    const koop = this.filteredKooperationen.find(k => k.id === kooperationId);
    if (!koop) return;

    const ekNetto = parseFloat(koop.einkaufspreis_netto) || 0;
    const ekZusatz = parseFloat(koop.einkaufspreis_zusatzkosten) || 0;

    this.formData.verguetung_netto = ekNetto || '';
    this.formData.zusatzkosten = ekZusatz > 0;
    this.formData.zusatzkosten_betrag = ekZusatz > 0 ? ekZusatz : '';

    const verguetungInput = document.getElementById('verguetung_netto');
    if (verguetungInput) verguetungInput.value = this.formData.verguetung_netto;

    const zusatzkostenCheckbox = document.getElementById('zusatzkosten');
    if (zusatzkostenCheckbox) zusatzkostenCheckbox.checked = this.formData.zusatzkosten;

    const zusatzkostenWrapper = document.getElementById('zusatzkosten-wrapper');
    if (zusatzkostenWrapper) zusatzkostenWrapper.classList.toggle('hidden', !this.formData.zusatzkosten);

    const zusatzkostenInput = document.getElementById('zusatzkosten_betrag');
    if (zusatzkostenInput) zusatzkostenInput.value = this.formData.zusatzkosten_betrag;
};

VertraegeCreate.prototype.generateVertragName = function() {
    const typ = this.formData.typ || this.selectedTyp || '';
    
    // Kampagne-Name finden
    let kampagneName = '';
    if (this.formData.kampagne_id) {
      const kampagne = this.kampagnen.find(k => k.id === this.formData.kampagne_id);
      kampagneName = KampagneUtils.getDisplayName(kampagne);
    }
    
    // Creator-Name finden
    let creatorName = '';
    if (this.formData.creator_id) {
      const creator = this.filteredCreators.find(c => c.id === this.formData.creator_id) 
                   || this.creators.find(c => c.id === this.formData.creator_id);
      if (creator) {
        creatorName = `${creator.vorname} ${creator.nachname}`.trim();
      }
    }
    
    // Name zusammenbauen
    const parts = [typ, kampagneName, creatorName].filter(p => p);
    this.formData.name = parts.join(' - ');
    
    // Input-Feld aktualisieren wenn vorhanden
    const nameInput = document.getElementById('name');
    if (nameInput) {
      nameInput.value = this.formData.name;
    }
    
    return this.formData.name;
};

VertraegeCreate.prototype.updateFilteredCreators = async function() {
    if (!this.formData.kampagne_id) {
      this.filteredCreators = [];
      this.filteredKooperationen = [];
      return;
    }

    try {
      const { data: kooperationen } = await window.supabase
        .from('kooperationen')
        .select('id, creator_id, name, einkaufspreis_netto, einkaufspreis_zusatzkosten, created_at')
        .eq('kampagne_id', this.formData.kampagne_id);

      this.filteredKooperationen = kooperationen || [];

      if (kooperationen && kooperationen.length > 0) {
        const creatorIds = [...new Set(kooperationen.map(k => k.creator_id))];
        this.filteredCreators = this.creators.filter(c => creatorIds.includes(c.id));
      } else {
        this.filteredCreators = [];
      }
    } catch (error) {
      console.error('❌ Fehler beim Filtern der Creator:', error);
      this.filteredCreators = [];
      this.filteredKooperationen = [];
    }
};
