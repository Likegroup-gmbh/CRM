// AgenturEditModal.js
// Modal zum Bearbeiten der Agentur-Daten eines Creators direkt aus dem
// Vertragsformular. Schreibt in die Tabelle creator_agentur und aktualisiert
// anschliessend die Felder im Vertrag ueber _loadCreatorAgentur().

import { VertraegeCreate } from './VertraegeCreateCore.js';

VertraegeCreate.prototype.openAgenturEditModal = async function(creatorId) {
    if (!creatorId) return;

    // Bestehende Agentur-Daten laden
    let current = {
      ist_aktiv: false,
      agentur_name: '',
      agentur_strasse: '',
      agentur_hausnummer: '',
      agentur_plz: '',
      agentur_stadt: '',
      agentur_land: 'Deutschland',
      agentur_vertretung: ''
    };

    try {
      const { data, error } = await window.supabase
        .from('creator_agentur')
        .select('ist_aktiv, agentur_name, agentur_strasse, agentur_hausnummer, agentur_plz, agentur_stadt, agentur_land, agentur_vertretung')
        .eq('creator_id', creatorId)
        .maybeSingle();
      if (!error && data) {
        current = { ...current, ...data };
      }
    } catch (err) {
      console.error('❌ VERTRAG: Agentur-Daten fuer Modal nicht ladbar:', err);
    }

    // Modal-DOM bauen
    const existing = document.getElementById('agentur-edit-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'agentur-edit-modal';
    modal.className = 'modal show';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 560px;">
        <div class="modal-header">
          <h3 style="margin: 0;">Agentur-Daten bearbeiten</h3>
          <button type="button" class="btn-close" id="agentur-modal-close" style="background: none; border: none; font-size: 22px; cursor: pointer; padding: 0 4px;">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-field">
            <label style="display: flex; align-items: center; gap: 10px; font-weight: 500;">
              <input type="checkbox" id="modal_agentur_vertreten" ${current.ist_aktiv ? 'checked' : ''}>
              <span>Wird der Creator durch eine Agentur vertreten?</span>
            </label>
          </div>

          <div id="modal-agentur-fields" class="${current.ist_aktiv ? '' : 'hidden'}" style="margin-top: 12px;">
            <div class="form-field">
              <label for="modal_agentur_name">Agenturname</label>
              <input type="text" id="modal_agentur_name" value="${escapeHtml(current.agentur_name || '')}" placeholder="Name der Agentur">
            </div>
            <div class="form-field-row" style="display: flex; gap: 10px;">
              <div class="form-field" style="flex: 1;">
                <label for="modal_agentur_strasse">Straße</label>
                <input type="text" id="modal_agentur_strasse" value="${escapeHtml(current.agentur_strasse || '')}">
              </div>
              <div class="form-field" style="flex: 0 0 100px;">
                <label for="modal_agentur_hausnummer">Nr.</label>
                <input type="text" id="modal_agentur_hausnummer" value="${escapeHtml(current.agentur_hausnummer || '')}">
              </div>
            </div>
            <div class="form-field-row" style="display: flex; gap: 10px;">
              <div class="form-field" style="flex: 0 0 120px;">
                <label for="modal_agentur_plz">PLZ</label>
                <input type="text" id="modal_agentur_plz" value="${escapeHtml(current.agentur_plz || '')}">
              </div>
              <div class="form-field" style="flex: 1;">
                <label for="modal_agentur_stadt">Stadt</label>
                <input type="text" id="modal_agentur_stadt" value="${escapeHtml(current.agentur_stadt || '')}">
              </div>
            </div>
            <div class="form-field">
              <label for="modal_agentur_land">Land</label>
              <input type="text" id="modal_agentur_land" value="${escapeHtml(current.agentur_land || 'Deutschland')}">
            </div>
            <div class="form-field">
              <label for="modal_agentur_vertretung">Vertreten durch</label>
              <input type="text" id="modal_agentur_vertretung" value="${escapeHtml(current.agentur_vertretung || '')}" placeholder="Name des Vertreters">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="agentur-modal-cancel">Abbrechen</button>
          <button type="button" class="btn btn-primary" id="agentur-modal-save">Speichern</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Toggle: Felder ein/ausblenden
    const toggle = document.getElementById('modal_agentur_vertreten');
    const fields = document.getElementById('modal-agentur-fields');
    toggle.addEventListener('change', () => {
      if (toggle.checked) fields.classList.remove('hidden');
      else fields.classList.add('hidden');
    });

    // Schliessen
    const close = () => modal.remove();
    document.getElementById('agentur-modal-close').addEventListener('click', close);
    document.getElementById('agentur-modal-cancel').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    // Speichern
    document.getElementById('agentur-modal-save').addEventListener('click', async () => {
      const vertreten = toggle.checked;
      const payload = {
        creator_id: creatorId,
        ist_aktiv: vertreten,
        agentur_name: vertreten ? (document.getElementById('modal_agentur_name').value.trim() || null) : null,
        agentur_strasse: vertreten ? (document.getElementById('modal_agentur_strasse').value.trim() || null) : null,
        agentur_hausnummer: vertreten ? (document.getElementById('modal_agentur_hausnummer').value.trim() || null) : null,
        agentur_plz: vertreten ? (document.getElementById('modal_agentur_plz').value.trim() || null) : null,
        agentur_stadt: vertreten ? (document.getElementById('modal_agentur_stadt').value.trim() || null) : null,
        agentur_land: vertreten ? (document.getElementById('modal_agentur_land').value.trim() || 'Deutschland') : null,
        agentur_vertretung: vertreten ? (document.getElementById('modal_agentur_vertretung').value.trim() || null) : null,
        updated_at: new Date().toISOString()
      };

      try {
        // Existierende Zeile finden
        const { data: existingRow, error: selectErr } = await window.supabase
          .from('creator_agentur')
          .select('id')
          .eq('creator_id', creatorId)
          .maybeSingle();

        if (selectErr) throw selectErr;

        if (existingRow) {
          const { error: updErr } = await window.supabase
            .from('creator_agentur')
            .update(payload)
            .eq('id', existingRow.id);
          if (updErr) throw updErr;
        } else {
          payload.created_at = new Date().toISOString();
          const { error: insErr } = await window.supabase
            .from('creator_agentur')
            .insert([payload]);
          if (insErr) throw insErr;
        }

        window.toastSystem?.show('Agentur-Daten gespeichert', 'success');

        // Vertragsformular-Felder aus DB neu laden (synchronisiert formData + DOM)
        await this._loadCreatorAgentur(creatorId);

        close();
      } catch (err) {
        console.error('❌ VERTRAG: Agentur-Speichern fehlgeschlagen:', err);
        window.toastSystem?.show('Agentur-Daten konnten nicht gespeichert werden', 'error');
      }
    });
};


function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
}
