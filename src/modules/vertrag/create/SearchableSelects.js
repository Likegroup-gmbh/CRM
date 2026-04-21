// SearchableSelects.js
// Initialisierung und Rebuild der durchsuchbaren Dropdowns (Kunde, Kampagne, Creator, PO),
// Uebernahme von Creator-Profilen und Adress-Validierung.

import { VertraegeCreate } from './VertraegeCreateCore.js';
import { KampagneUtils } from '../../kampagne/KampagneUtils.js';

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
        
        const creator = this.creators.find(c => c.id === id);
        const preview = document.getElementById('creator-adresse');
        if (preview && creator) {
          // Prüfen ob Creator eine gültige Adresse hat
          if (this.hasValidCreatorAddress(creator)) {
            this.creatorAddressMissing = false;
            preview.innerHTML = `
              <small class="address-text">
                ${creator.lieferadresse_strasse || ''} ${creator.lieferadresse_hausnummer || ''}<br>
                ${creator.lieferadresse_plz || ''} ${creator.lieferadresse_stadt || ''}<br>
                ${creator.lieferadresse_land || 'Deutschland'}
              </small>
            `;
          } else {
            // Keine gültige Adresse - Warnung mit Link zum Creator-Profil
            this.creatorAddressMissing = true;
            preview.innerHTML = `
              <div class="address-warning" style="color: #dc3545; background: #fff3f3; padding: 8px 12px; border-radius: 4px; border: 1px solid #dc3545; margin-top: 8px;">
                <span style="margin-right: 6px;">⚠️</span>
                <span>Keine Adresse hinterlegt! Vertragserstellung nicht möglich.</span><br>
                <a href="/creator/${creator.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${creator.id}')" style="color: #0066cc; text-decoration: underline; margin-top: 4px; display: inline-block;">
                  Zum Creator-Profil →
                </a>
              </div>
            `;
          }
          // Social-Media-Profile aus Creator-Profil übernehmen
          this._applyCreatorProfiles(creator);
          // Agentur-Daten aus creator_agentur laden (async, aber nicht blockierend)
          this._loadCreatorAgentur(id);
        } else if (preview) {
          this.creatorAddressMissing = false;
          preview.innerHTML = '';
          // Profile zurücksetzen wenn kein Creator
          this.formData.influencer_profile = [];
          this._resetAgenturFields();
          this._syncAgenturDomFromFormData();
        }

        this.updateKooperationField();
        
        // Vertragsname automatisch generieren
        this.generateVertragName();
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
      
      // Agentur-Daten fuer geladenen Creator aus creator_agentur nachladen
      // (ueberschreibt ggf. alte Draft-Werte, das ist gewollt)
      this._loadCreatorAgentur(selectedCreator);
      
      // Adress-Vorschau für geladenen Creator
      const creator = this.creators.find(c => c.id === selectedCreator);
      const preview = document.getElementById('creator-adresse');
      if (preview && creator) {
        // Prüfen ob Creator eine gültige Adresse hat
        if (this.hasValidCreatorAddress(creator)) {
          this.creatorAddressMissing = false;
          preview.innerHTML = `
            <small class="address-text">
              ${creator.lieferadresse_strasse || ''} ${creator.lieferadresse_hausnummer || ''}<br>
              ${creator.lieferadresse_plz || ''} ${creator.lieferadresse_stadt || ''}<br>
              ${creator.lieferadresse_land || 'Deutschland'}
            </small>
          `;
        } else {
          // Keine gültige Adresse - Warnung mit Link zum Creator-Profil
          this.creatorAddressMissing = true;
          preview.innerHTML = `
            <div class="address-warning" style="color: #dc3545; background: #fff3f3; padding: 8px 12px; border-radius: 4px; border: 1px solid #dc3545; margin-top: 8px;">
              <span style="margin-right: 6px;">⚠️</span>
              <span>Keine Adresse hinterlegt! Vertragserstellung nicht möglich.</span><br>
              <a href="/creator/${creator.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${creator.id}')" style="color: #0066cc; text-decoration: underline; margin-top: 4px; display: inline-block;">
                Zum Creator-Profil →
              </a>
            </div>
          `;
        }
      }
    }
    
    // Event-Handler für Creator-Änderung
    creatorSelect.addEventListener('change', async (e) => {
      const id = e.target.value;
      this.formData.creator_id = id;
      
      const creator = this.creators.find(c => c.id === id);
      const preview = document.getElementById('creator-adresse');
      if (preview && creator) {
        // Prüfen ob Creator eine gültige Adresse hat
        if (this.hasValidCreatorAddress(creator)) {
          this.creatorAddressMissing = false;
          preview.innerHTML = `
            <small class="address-text">
              ${creator.lieferadresse_strasse || ''} ${creator.lieferadresse_hausnummer || ''}<br>
              ${creator.lieferadresse_plz || ''} ${creator.lieferadresse_stadt || ''}<br>
              ${creator.lieferadresse_land || 'Deutschland'}
            </small>
          `;
        } else {
          // Keine gültige Adresse - Warnung mit Link zum Creator-Profil
          this.creatorAddressMissing = true;
          preview.innerHTML = `
            <div class="address-warning" style="color: #dc3545; background: #fff3f3; padding: 8px 12px; border-radius: 4px; border: 1px solid #dc3545; margin-top: 8px;">
              <span style="margin-right: 6px;">⚠️</span>
              <span>Keine Adresse hinterlegt! Vertragserstellung nicht möglich.</span><br>
              <a href="/creator/${creator.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${creator.id}')" style="color: #0066cc; text-decoration: underline; margin-top: 4px; display: inline-block;">
                Zum Creator-Profil →
              </a>
            </div>
          `;
        }
        // Social-Media-Profile aus Creator-Profil übernehmen
        this._applyCreatorProfiles(creator);
        // Agentur-Daten aus creator_agentur laden
        this._loadCreatorAgentur(id);
      } else if (preview) {
        this.creatorAddressMissing = false;
        preview.innerHTML = '';
        // Profile zurücksetzen wenn kein Creator
        this.formData.influencer_profile = [];
        this._resetAgenturFields();
        this._syncAgenturDomFromFormData();
      }

      this.updateKooperationField();
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


// Laedt die Agentur-Daten fuer den gewaehlten Creator aus creator_agentur
// und schreibt sie in formData.influencer_agentur_*. Setzt das Flag
// _agentur_from_creator, damit die UI die Felder read-only darstellt.
VertraegeCreate.prototype._loadCreatorAgentur = async function(creatorId) {
    // Reset bei fehlendem Creator
    if (!creatorId) {
      this._resetAgenturFields();
      this._syncAgenturDomFromFormData();
      return;
    }

    if (!window.supabase) {
      console.warn('⚠️ VERTRAG: Supabase nicht verfuegbar fuer creator_agentur-Load');
      return;
    }

    try {
      const { data, error } = await window.supabase
        .from('creator_agentur')
        .select('ist_aktiv, agentur_name, agentur_strasse, agentur_hausnummer, agentur_plz, agentur_stadt, agentur_land, agentur_vertretung')
        .eq('creator_id', creatorId)
        .maybeSingle();

      if (error) {
        console.error('❌ VERTRAG: Fehler beim Laden creator_agentur:', error);
        this._resetAgenturFields();
      } else if (data && data.ist_aktiv) {
        this.formData.influencer_agentur_vertreten = true;
        this.formData.influencer_agentur_name = data.agentur_name || '';
        this.formData.influencer_agentur_strasse = data.agentur_strasse || '';
        this.formData.influencer_agentur_hausnummer = data.agentur_hausnummer || '';
        this.formData.influencer_agentur_plz = data.agentur_plz || '';
        this.formData.influencer_agentur_stadt = data.agentur_stadt || '';
        this.formData.influencer_agentur_land = data.agentur_land || 'Deutschland';
        this.formData.influencer_agentur_vertretung = data.agentur_vertretung || '';
        this.formData._agentur_from_creator = true;
      } else {
        // Creator hat keine aktive Agentur → Felder leeren, manuell editierbar
        this._resetAgenturFields();
      }
    } catch (err) {
      console.error('❌ VERTRAG: Exception bei _loadCreatorAgentur:', err);
      this._resetAgenturFields();
    }

    this._syncAgenturDomFromFormData();
};


VertraegeCreate.prototype._resetAgenturFields = function() {
    this.formData.influencer_agentur_vertreten = false;
    this.formData.influencer_agentur_name = '';
    this.formData.influencer_agentur_strasse = '';
    this.formData.influencer_agentur_hausnummer = '';
    this.formData.influencer_agentur_plz = '';
    this.formData.influencer_agentur_stadt = '';
    this.formData.influencer_agentur_land = 'Deutschland';
    this.formData.influencer_agentur_vertretung = '';
    this.formData._agentur_from_creator = false;
};


// Aktualisiert die Agentur-Felder im DOM aus formData (falls Step 2 gerade sichtbar).
// Ruft optional einen globalen Hook, der in FormEvents definiert wird, um den
// gesamten Agentur-Block (inkl. Read-Only-State und Modal-Button) neu zu rendern.
VertraegeCreate.prototype._syncAgenturDomFromFormData = function() {
    if (typeof this.refreshAgenturSection === 'function') {
      this.refreshAgenturSection();
    }
};

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
    
    // Original-Select Wert setzen
    select.value = value;
    
    // Label finden
    const option = options.find(o => o.value === value);
    const label = option?.label || '';
    
    // Searchable Select Input finden
    const formField = select.closest('.form-field');
    const container = formField?.querySelector('.searchable-select-container');
    const input = container?.querySelector('.searchable-select-input');
    
    if (input) {
      input.value = label;
    }
    
    // KEIN dispatchEvent - Adress-Vorschauen werden separat gesetzt
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


VertraegeCreate.prototype.hasValidCreatorAddress = function(creator) {
    if (!creator) return false;
    // Mindestens Straße, PLZ und Stadt müssen vorhanden sein
    const hasStrasse = creator.lieferadresse_strasse && creator.lieferadresse_strasse.trim() !== '';
    const hasPlz = creator.lieferadresse_plz && creator.lieferadresse_plz.trim() !== '';
    const hasStadt = creator.lieferadresse_stadt && creator.lieferadresse_stadt.trim() !== '';
    return hasStrasse && hasPlz && hasStadt;
};

