// SearchableSelects.js
// Initialisierung und Rebuild der durchsuchbaren Dropdowns (Kunde, Kampagne, Creator, PO),
// Uebernahme von Creator-Profilen und Adress-Validierung.

import { VertraegeCreate } from './VertraegeCreateCore.js';
import { KampagneUtils } from '../../kampagne/KampagneUtils.js';

function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
}

VertraegeCreate.prototype.rebuildKampagneSelect = function(kundeId) {
    console.log('🔧 VERTRAG: rebuildKampagneSelect aufgerufen mit kundeId:', kundeId);
    console.log('🔧 VERTRAG: filteredKampagnen:', this.filteredKampagnen.length, 'Stück');
    
    const container = document.querySelector('.form-field:has(#kampagne_id), .form-field label[for="kampagne_id"]')?.closest('.form-field');
    if (!container) {
      console.warn('⚠️ VERTRAG: Kampagne-Container nicht gefunden!');
      return;
    }

    // Altes Searchable Select entfernen
    const oldSearchable = container.querySelector('.searchable-select-container');
    if (oldSearchable) oldSearchable.remove();
    
    // Altes Select wieder sichtbar machen oder neues erstellen
    let kampagneSelect = container.querySelector('#kampagne_id');
    if (!kampagneSelect) {
      kampagneSelect = document.createElement('select');
      kampagneSelect.id = 'kampagne_id';
      kampagneSelect.name = 'kampagne_id';
      kampagneSelect.required = true;
      container.appendChild(kampagneSelect);
    }
    kampagneSelect.style.display = '';
    kampagneSelect.disabled = false; // Wichtig: disabled entfernen!
    kampagneSelect.removeAttribute('disabled'); // Sicherheitshalber auch das Attribut

    const options = this.filteredKampagnen.map(k => ({ value: k.id, label: KampagneUtils.getDisplayName(k) }));
    console.log('🔧 VERTRAG: Kampagne-Optionen erstellt:', options.length, 'Stück');
    
    if (kundeId && window.formSystem?.createSearchableSelect) {
      window.formSystem.createSearchableSelect(kampagneSelect, options, {
        name: 'kampagne_id',
        placeholder: 'Kampagne suchen...',
        value: null
      });
      console.log('✅ VERTRAG: Searchable Select für Kampagne erstellt');
      
      // Event-Handler für Kampagne-Änderung
      kampagneSelect.addEventListener('change', async (e) => {
        const id = e.target.value;
        this.formData.kampagne_id = id;
        this.formData.creator_id = null;
        
        await this.loadPoFromKampagne(id);
        await this.updateFilteredCreators();
        this.rebuildCreatorSelect(!!id);
        
        // Vertragsname automatisch generieren
        this.generateVertragName();
      });
    } else {
      // Fallback ohne Searchable Select
      kampagneSelect.disabled = !kundeId;
      kampagneSelect.innerHTML = `
        <option value="">${kundeId ? 'Kampagne auswählen...' : 'Bitte zuerst Kunde wählen...'}</option>
        ${this.filteredKampagnen.map(k => `<option value="${k.id}">${KampagneUtils.getDisplayName(k)}</option>`).join('')}
      `;
    }
};


VertraegeCreate.prototype.rebuildCreatorSelect = function(enabled) {
    const container = document.querySelector('.form-field:has(#creator_id), .form-field label[for="creator_id"]')?.closest('.form-field');
    if (!container) return;

    // Altes Searchable Select entfernen
    const oldSearchable = container.querySelector('.searchable-select-container');
    if (oldSearchable) oldSearchable.remove();
    
    // Altes Select wieder sichtbar machen oder neues erstellen
    let creatorSelect = container.querySelector('#creator_id');
    if (!creatorSelect) {
      creatorSelect = document.createElement('select');
      creatorSelect.id = 'creator_id';
      creatorSelect.name = 'creator_id';
      // Creator ist optional, daher kein required
      container.appendChild(creatorSelect);
    }
    creatorSelect.style.display = '';

    // Adress-Vorschau zurücksetzen
    const creatorPreview = document.getElementById('creator-adresse');
    if (creatorPreview) creatorPreview.innerHTML = '';

    const options = this.filteredCreators.map(c => ({ value: c.id, label: `${c.vorname} ${c.nachname}` }));
    
    if (enabled && window.formSystem?.createSearchableSelect) {
      if (this.filteredCreators.length === 0) {
        creatorSelect.disabled = true;
        creatorSelect.innerHTML = '<option value="">Keine Creator für diese Kampagne</option>';
        return;
      }
      
      // Wichtig: disabled entfernen bevor Searchable Select erstellt wird!
      creatorSelect.disabled = false;
      creatorSelect.removeAttribute('disabled');
      
      window.formSystem.createSearchableSelect(creatorSelect, options, {
        name: 'creator_id',
        placeholder: 'Creator suchen...',
        value: null
      });
      
      // Event-Handler für Creator-Änderung
      creatorSelect.addEventListener('change', async (e) => {
        const id = e.target.value;
        this.formData.creator_id = id;

        this.updateKooperationField();
        this.generateVertragName();

        const creator = this.creators.find(c => c.id === id);
        if (creator) {
          this._applyCreatorProfiles(creator);
          await this._loadCreatorManagement(id);
        } else {
          const preview = document.getElementById('creator-adresse');
          this.creatorAddressMissing = false;
          if (preview) preview.innerHTML = '';
          this.formData.influencer_profile = [];
          this._resetManagementFields();
          this._syncAgenturDomFromFormData();
        }
      });
    } else {
      // Fallback ohne Searchable Select
      creatorSelect.disabled = true;
      creatorSelect.innerHTML = '<option value="">Bitte zuerst Kampagne wählen...</option>';
    }
};


VertraegeCreate.prototype.initSearchableSelects = function() {
    // Flag setzen um Change-Events während der Initialisierung zu ignorieren
    this._isInitializing = true;
    
    const kundeSelect = document.getElementById('kunde_unternehmen_id');

    // Kunde als Searchable Select
    if (kundeSelect && window.formSystem?.createSearchableSelect) {
      const options = this.unternehmen.map(u => ({ value: u.id, label: u.firmenname }));
      const selectedKunde = this.formData.kunde_unternehmen_id;
      
      window.formSystem.createSearchableSelect(kundeSelect, options, {
        name: 'kunde_unternehmen_id',
        placeholder: 'Unternehmen suchen...',
        value: selectedKunde
      });
      
      // Nach Erstellung des Searchable Selects: Wert manuell setzen und Adresse anzeigen
      if (selectedKunde) {
        this.setSearchableSelectValue('kunde_unternehmen_id', selectedKunde, options);
        
        // Adress-Vorschau für geladenen Kunden
        const kunde = this.unternehmen.find(u => u.id === selectedKunde);
        const preview = document.getElementById('kunde-adresse');
        if (preview && kunde) {
          preview.innerHTML = `
            <small class="address-text">
              ${kunde.rechnungsadresse_strasse || ''} ${kunde.rechnungsadresse_hausnummer || ''}<br>
              ${kunde.rechnungsadresse_plz || ''} ${kunde.rechnungsadresse_stadt || ''}
            </small>
          `;
        }
      }
    }

    // Wenn Draft geladen: Kampagne und Creator Searchable Selects initialisieren
    if (this.formData.kunde_unternehmen_id) {
      this.initKampagneSearchableSelect();
    }
    if (this.formData.kampagne_id) {
      this.initCreatorSearchableSelect();
    }
    
    // Flag zurücksetzen nach kurzer Verzögerung
    setTimeout(() => {
      this._isInitializing = false;
      // Vertragsname automatisch generieren (nach Initialisierung)
      this.generateVertragName();
    }, 100);
};


VertraegeCreate.prototype.initKampagneSearchableSelect = function() {
    const kampagneSelect = document.getElementById('kampagne_id');
    if (!kampagneSelect || !window.formSystem?.createSearchableSelect) return;

    const options = this.filteredKampagnen.map(k => ({ value: k.id, label: KampagneUtils.getDisplayName(k) }));
    const selectedKampagne = this.formData.kampagne_id;
    
    window.formSystem.createSearchableSelect(kampagneSelect, options, {
      name: 'kampagne_id',
      placeholder: 'Kampagne suchen...',
      value: selectedKampagne
    });
    
    if (selectedKampagne) {
      this.setSearchableSelectValue('kampagne_id', selectedKampagne, options);
    }
    
    // Event-Handler für Kampagne-Änderung
    kampagneSelect.addEventListener('change', async (e) => {
      // Ignoriere Events während der Initialisierung
      if (this._isInitializing) return;
      
      const id = e.target.value;
      this.formData.kampagne_id = id;
      this.formData.creator_id = null;
      
      await this.loadPoFromKampagne(id);
      await this.updateFilteredCreators();
      this.rebuildCreatorSelect(!!id);
      
      // Vertragsname automatisch generieren
      this.generateVertragName();
    });
};


VertraegeCreate.prototype.initCreatorSearchableSelect = function() {
    const creatorSelect = document.getElementById('creator_id');
    if (!creatorSelect || !window.formSystem?.createSearchableSelect) return;

    const options = this.filteredCreators.map(c => ({ value: c.id, label: `${c.vorname} ${c.nachname}` }));
    const selectedCreator = this.formData.creator_id;
    
    if (this.filteredCreators.length === 0) {
      creatorSelect.disabled = true;
      creatorSelect.innerHTML = '<option value="">Keine Creator für diese Kampagne</option>';
      return;
    }
    
    window.formSystem.createSearchableSelect(creatorSelect, options, {
      name: 'creator_id',
      placeholder: 'Creator suchen...',
      value: selectedCreator
    });
    
    if (selectedCreator) {
      this.setSearchableSelectValue('creator_id', selectedCreator, options);
      
      const creator = this.creators.find(c => c.id === selectedCreator);
      if (creator) {
        this._loadCreatorManagement(selectedCreator);
      }
    }
    
    // Event-Handler für Creator-Änderung
    creatorSelect.addEventListener('change', async (e) => {
      if (this._isInitializing) return;

      const id = e.target.value;
      this.formData.creator_id = id;

      this.updateKooperationField();
      this.generateVertragName();

      const creator = this.creators.find(c => c.id === id);
      if (creator) {
        this._applyCreatorProfiles(creator);
        await this._loadCreatorManagement(id);
      } else {
        const preview = document.getElementById('creator-adresse');
        this.creatorAddressMissing = false;
        if (preview) preview.innerHTML = '';
        this.formData.influencer_profile = [];
        this._resetManagementFields();
        this._syncAgenturDomFromFormData();
      }
    });
};


VertraegeCreate.prototype._applyCreatorProfiles = function(creator) {
    if (!creator) return;
    const profiles = [];
    if (creator.instagram) {
      const handle = this._extractHandle(creator.instagram);
      profiles.push(`Instagram: @${handle}`);
    }
    if (creator.tiktok) {
      const handle = this._extractHandle(creator.tiktok);
      profiles.push(`TikTok: @${handle}`);
    }
    this.formData.influencer_profile = profiles;
};


// Adress-Logik wurde nach CreatorAddressResolver.js verschoben

  // Handle aus URL oder String extrahieren
  // "https://www.instagram.com/majercars/" → "majercars"
  // "https://www.tiktok.com/@majer.cars" → "majer.cars"
  // "@majercars" → "majercars"

VertraegeCreate.prototype._extractHandle = function(value) {
    if (!value) return '';
    let handle = value.trim();
    // URL → letzten Pfad-Teil nehmen
    if (handle.includes('.com/')) {
      handle = handle.split('.com/').pop();
    }
    // Trailing Slash entfernen
    handle = handle.replace(/\/+$/, '');
    // Führendes @ entfernen (wird beim Zusammenbauen wieder hinzugefügt)
    handle = handle.replace(/^@/, '');
    return handle;
};


VertraegeCreate.prototype.setSearchableSelectValue = function(selectId, value, options) {
    const select = document.getElementById(selectId);
    if (!select) {
      console.warn(`⚠️ Select ${selectId} nicht gefunden`);
      return;
    }
    
    select.value = value;

    // Hidden Input synchronisieren (von createSimpleSearchableSelect erstellt)
    const formField = select.closest('.form-field');
    const hiddenInput = formField?.querySelector(`input[type="hidden"][name="${selectId}"]`);
    if (hiddenInput) hiddenInput.value = value;
    
    // Label finden und sichtbaren Input setzen
    const option = options.find(o => o.value === value);
    const label = option?.label || '';
    const container = formField?.querySelector('.searchable-select-container');
    const input = container?.querySelector('.searchable-select-input');
    if (input) input.value = label;
};


VertraegeCreate.prototype._parseProfileHandles = function(profiles) {
    const handles = {};
    const platformMap = {
      'instagram': 'handle_instagram',
      'tiktok': 'handle_tiktok',
      'youtube': 'handle_youtube',
      'sonstige': 'handle_sonstige'
    };
    (profiles || []).forEach(p => {
      const lower = (p || '').toLowerCase();
      for (const [key, field] of Object.entries(platformMap)) {
        if (lower.startsWith(key)) {
          handles[field] = p.substring(key.length).trim();
          break;
        }
      }
    });
    return handles;
};


// Adress-Validation und Preview wurden nach CreatorAddressResolver.js verschoben

