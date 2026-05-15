// MitarbeiterDetailRendererRechte.js
// Rechte-Tab: Freischaltung, Rolle, Firmenhandy, Permissions-Tabelle

export function renderRechteTab(detail) {
  return `
    <div class="detail-section">
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th style="width:120px; text-align:right;">Aktiv</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div>
                  <strong>Benutzer freigeschaltet</strong>
                  <div class="form-help" style="margin-top: 4px;">
                    ${detail.user?.freigeschaltet ? 
                      'Dieser Benutzer ist freigeschaltet und kann sich anmelden. Sie können Rechte vergeben.' : 
                      'Dieser Benutzer wartet auf Freischaltung. Schalten Sie ihn frei, bevor Sie Rechte vergeben.'}
                  </div>
                </div>
              </td>
              <td style="text-align:right;">
                <label class="toggle-label" style="justify-content:flex-end;">
                  <span class="toggle-switch">
                    <input type="checkbox" id="freigeschaltet-toggle" ${detail.user?.freigeschaltet ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                  </span>
                </label>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="detail-section">
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rolle / Klasse</th>
              <th style="width: 200px; text-align: right;">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div>
                  <strong>${detail.user?.mitarbeiter_klasse_name || 'Keine Rolle zugewiesen'}</strong>
                  <div class="form-help" style="margin-top: 4px;">
                    Definiert die Hauptaufgaben und Zuständigkeiten des Mitarbeiters
                  </div>
                </div>
              </td>
              <td style="text-align: right;">
                <button class="secondary-btn" id="btn-change-rolle">Rolle ändern</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="detail-section">
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Kontaktdaten</th>
              <th style="width: 320px; text-align: right;">Wert</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div>
                  <strong>Firmenhandy</strong>
                  <div class="form-help" style="margin-top: 4px;">
                    Wird auf der Mitarbeiter-Detailseite angezeigt.
                  </div>
                </div>
              </td>
              <td>
                <div style="display:flex; gap:8px; justify-content:flex-end; align-items:center;">
                  <select id="firmenhandy-land" class="form-select" style="max-width: 170px;">
                    <option value="">Land wählen...</option>
                    ${(detail.euLaender || []).map(land => `
                      <option value="${land.id}" ${land.id === detail.user?.telefonnummer_firmenhandy_land_id ? 'selected' : ''}>
                        ${detail.sanitize(`${land.vorwahl || ''} ${land.name_de || ''}`.trim())}
                      </option>
                    `).join('')}
                  </select>
                  <input
                    id="firmenhandy-nummer"
                    type="tel"
                    class="form-input"
                    placeholder="z. B. 15123456789"
                    value="${detail.sanitize(detail.user?.telefonnummer_firmenhandy || '')}"
                    style="max-width: 180px;"
                  />
                  <button id="btn-save-firmenhandy" class="secondary-btn">Speichern</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="detail-section">
      ${detail.user?.freigeschaltet ? 
        `<div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th style="text-align:left;">Recht</th>
                <th style="width:120px; text-align:right;">Lesen</th>
                <th style="width:120px; text-align:right;">Bearbeiten</th>
              </tr>
            </thead>
            <tbody>
              ${generatePermissionsTable(detail)}
            </tbody>
          </table>
        </div>` 
        : '<p class="text-muted"><em>Rechte können erst nach der Freischaltung des Benutzers vergeben werden.</em></p>'
      }
    </div>
  `;
}

export function generatePermissionsTable(detail) {
  const perms = detail.user?.zugriffsrechte || {};
  return [
    ['unternehmen','Unternehmen'],
    ['marke','Marken'],
    ['ansprechpartner','Ansprechpartner'],
    ['auftrag','Aufträge'],
    ['auftragsdetails','Auftragsdetails'],
    ['kampagne','Kampagnen'],
    ['briefing','Briefings'],
    ['strategie','Strategie'],
    ['kooperation','Kooperationen'],
    ['rechnung','Rechnungen'],
    ['tasks','Aufgaben'],
    ['creator','Creator'],
    ['creator-lists','Creator Listen'],
    ['feedback','Feedback']
  ].map(([key,label]) => `
    <tr>
      <td style="text-align:left;">${label}</td>
      <td style="text-align:right;">
        <label class="toggle-label" style="justify-content:flex-end;">
          <span class="toggle-switch">
            <input type="checkbox" class="perm-toggle" data-key="${key}" ${perms?.[key]?.can_view === false ? '' : (perms?.[key] === true || perms?.[key]?.can_view === true ? 'checked' : '')}>
            <span class="toggle-slider"></span>
          </span>
        </label>
      </td>
      <td style="text-align:right;">
        <label class="toggle-label" style="justify-content:flex-end;">
          <span class="toggle-switch">
            <input type="checkbox" class="perm-edit-toggle" data-key="${key}" ${perms?.[key]?.can_edit ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </span>
        </label>
      </td>
    </tr>
  `).join('');
}
