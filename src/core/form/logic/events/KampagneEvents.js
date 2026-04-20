import { bindStepperEvents } from './StepperUI.js';

export async function setup(form, ctx) {
  console.log('🎯 FORMEVENTS: setupKampagneEvents gestartet');
  
  let fieldsContainer = form.querySelector('#kampagnenart-felder-container');
  
  if (!fieldsContainer) {
    const customField = form.querySelector('.kampagnenart-felder-container');
    if (customField) {
      fieldsContainer = customField;
    }
  }
  
  if (!fieldsContainer) {
    const actionsDiv = form.querySelector('.form-actions, .drawer-actions');
    fieldsContainer = document.createElement('div');
    fieldsContainer.id = 'kampagnenart-felder-container';
    fieldsContainer.className = 'kampagnenart-felder-container';
    if (actionsDiv) {
      actionsDiv.parentNode.insertBefore(fieldsContainer, actionsDiv);
    } else {
      form.appendChild(fieldsContainer);
    }
  }
  
  const auftragSelect = form.querySelector('select[name="auftrag_id"]');
  if (!auftragSelect) {
    console.log('⚠️ FORMEVENTS: auftrag_id Select nicht gefunden');
    return;
  }
  
  const initDynamicFields = async () => {
    try {
        const { KAMPAGNENARTEN_MAPPING, generateFieldsHtml } = await import('../../../../modules/auftrag/logic/KampagnenartenMapping.js');
      
      const loadKampagnenartenForAuftrag = async (auftragId) => {
        if (!auftragId || !window.supabase) return [];
        
        try {
          const { data: auftragArten, error } = await window.supabase
            .from('auftrag_kampagne_art')
            .select(`kampagne_art_typen:kampagne_art_id(id, name)`)
            .eq('auftrag_id', auftragId);
          
          if (error) {
            console.error('❌ FORMEVENTS: Fehler beim Laden der Auftrag-Kampagnenarten:', error);
            return [];
          }
          
          const artenNamen = (auftragArten || [])
            .map(item => item.kampagne_art_typen?.name)
            .filter(Boolean);
          
          return artenNamen;
        } catch (error) {
          console.error('❌ FORMEVENTS: Fehler:', error);
          return [];
        }
      };
      
      const renderDynamicFields = async () => {
        const selectedAuftragId = auftragSelect.value;
        
        let editModeValues = {};
        if (form.dataset.editModeData) {
          try {
            const editData = JSON.parse(form.dataset.editModeData);
            const kampagnenartSuffixes = ['_video_anzahl', '_creator_anzahl', '_bilder_anzahl', '_videographen_anzahl'];
            for (const [key, value] of Object.entries(editData)) {
              if (kampagnenartSuffixes.some(suffix => key.endsWith(suffix)) && value !== undefined && value !== null) {
                editModeValues[key] = value;
              }
            }
          } catch (e) {
            console.warn('⚠️ FORMEVENTS: Fehler beim Parsen von editModeData:', e);
          }
        }
        
        const domValues = {};
        fieldsContainer.querySelectorAll('input, textarea').forEach(input => {
          if (input.name && input.value) {
            domValues[input.name] = input.value;
          }
        });
        
        const existingValues = { ...editModeValues, ...domValues };
        fieldsContainer.innerHTML = '';
        
        if (!selectedAuftragId) {
          fieldsContainer.innerHTML = '<p class="form-hint" style="padding: 1rem; color: var(--text-secondary); font-style: italic;">Bitte wählen Sie einen Auftrag aus, um die Produktionsdetails anzuzeigen.</p>';
          return;
        }
        
        fieldsContainer.innerHTML = '<p class="form-hint" style="padding: 1rem; color: var(--text-secondary);"><span class="loading-spinner" style="display: inline-block; width: 16px; height: 16px; border: 2px solid #ddd; border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 8px;"></span>Lade Produktionsdetails...</p>';
        
        const artenNamen = await loadKampagnenartenForAuftrag(selectedAuftragId);
        
        if (artenNamen.length === 0) {
          fieldsContainer.innerHTML = '<p class="form-hint" style="padding: 1rem; color: var(--color-warning); background: rgba(255,193,7,0.1); border-radius: 8px;">Für diesen Auftrag wurden noch keine Kampagnenarten hinterlegt. Bitte zuerst im Auftrag die "Art der Kampagne" auswählen.</p>';
          return;
        }
        
        let fieldsHtml = '<div class="kampagnenart-fields-wrapper" style="margin-top: 1rem;">';
        fieldsHtml += '<h4 style="margin-bottom: 1rem; color: var(--text-primary); font-weight: 600;">Produktionsdetails</h4>';
        
        artenNamen.forEach(artName => {
          if (KAMPAGNENARTEN_MAPPING[artName]) {
            fieldsHtml += generateFieldsHtml(artName, existingValues, false);
          }
        });
        
        fieldsHtml += '</div>';
        fieldsContainer.innerHTML = fieldsHtml;
        
        bindStepperEvents(fieldsContainer);
        
        if (!document.getElementById('kampagnenart-spinner-style')) {
          const style = document.createElement('style');
          style.id = 'kampagnenart-spinner-style';
          style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
          document.head.appendChild(style);
        }
      };
      
      auftragSelect.addEventListener('change', renderDynamicFields);
      
      if (auftragSelect.value) {
        setTimeout(renderDynamicFields, 200);
      } else {
        fieldsContainer.innerHTML = '<p class="form-hint" style="padding: 1rem; color: var(--text-secondary); font-style: italic;">Bitte wählen Sie einen Auftrag aus, um die Produktionsdetails anzuzeigen.</p>';
      }
      
    } catch (error) {
      console.error('❌ FORMEVENTS: Fehler beim Initialisieren der dynamischen Felder:', error);
    }
  };
  
  initDynamicFields();
}
