// FilterDropdownHelper.js
// Hilfsfunktionen für FilterDropdown

/**
 * Extrahiert Filter-Optionen aus den aktuell sichtbaren Daten (performant)
 */
export function extractOptionsFromCurrentData(entityType, filterConfig) {
  try {
    // Hole die aktuell sichtbaren Daten aus der Tabelle
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return [];

    const rows = tbody.querySelectorAll('tr:not(.empty-state):not(.no-data)');
    if (rows.length === 0) return [];

    const uniqueValues = new Map(); // Map für eindeutige Werte
    const fieldId = filterConfig.id;
    
    rows.forEach(row => {
      // Spezielle Behandlung für Firmenname (aus Link extrahieren)
      if (fieldId === 'firmenname' && entityType === 'unternehmen') {
        // Finde die Firmenname-Spalte (normalerweise "Name")
        const nameLink = row.querySelector('a.table-link[data-table="unternehmen"]');
        if (nameLink) {
          const firmenname = nameLink.textContent.trim();
          const unternehmenId = nameLink.dataset.id;
          
          if (firmenname && firmenname !== '-') {
            // Speichere sowohl den Namen als auch die ID
            uniqueValues.set(firmenname, firmenname);
          }
        }
      }
      // Spezielle Behandlung für Markenname (aus Link extrahieren)
      else if (fieldId === 'markenname' && entityType === 'marke') {
        // Finde die Markenname-Spalte (normalerweise "Name")
        const nameLink = row.querySelector('a.table-link[data-table="marke"]');
        if (nameLink) {
          const markenname = nameLink.textContent.trim();
          const markeId = nameLink.dataset.id;
          
          if (markenname && markenname !== '-') {
            // Speichere sowohl den Namen als auch die ID
            uniqueValues.set(markenname, markenname);
          }
        }
      }
      // Spezielle Behandlung für Auftragsname (aus Link extrahieren)
      else if (fieldId === 'auftragsname' && entityType === 'auftrag') {
        // Finde die Auftragsname-Spalte (normalerweise "Name")
        const nameLink = row.querySelector('a.table-link[data-table="auftrag"]');
        if (nameLink) {
          const auftragsname = nameLink.textContent.trim();
          const auftragId = nameLink.dataset.id;
          
          if (auftragsname && auftragsname !== '-') {
            // Speichere sowohl den Namen als auch die ID
            uniqueValues.set(auftragsname, auftragsname);
          }
        }
      }
      // Spezielle Behandlung für Auftragsname bei Auftragsdetails
      else if (fieldId === 'auftragsname' && entityType === 'auftragsdetails') {
        // Suche nach der Auftrag-Spalte in der Tabelle
        const headerCells = document.querySelectorAll('.data-table thead th');
        const cells = row.querySelectorAll('td');
        
        let columnIndex = -1;
        headerCells.forEach((th, index) => {
          const headerText = th.textContent.trim().toLowerCase();
          if (headerText.includes('auftrag')) {
            columnIndex = index;
          }
        });
        
        if (columnIndex >= 0 && cells[columnIndex]) {
          const cell = cells[columnIndex];
          const auftragsname = cell.textContent.trim();
          
          if (auftragsname && auftragsname !== '-') {
            uniqueValues.set(auftragsname, auftragsname);
          }
        }
      }
      // Spezielle Behandlung für Stadt/Land bei Unternehmen
      else if ((fieldId === 'rechnungsadresse_stadt' || fieldId === 'rechnungsadresse_land') && entityType === 'unternehmen') {
        // Extrahiere Text aus der entsprechenden Tabellenspalte
        const headerCells = document.querySelectorAll('.data-table thead th');
        const cells = row.querySelectorAll('td');
        
        // Finde Index der Spalte durch Vergleich mit Header-Text
        let columnIndex = -1;
        headerCells.forEach((th, index) => {
          const headerText = th.textContent.trim().toLowerCase();
          let matches = false;
          
          if (fieldId === 'rechnungsadresse_stadt') {
            matches = headerText.includes('stadt');
          } else if (fieldId === 'rechnungsadresse_land') {
            matches = headerText.includes('land');
          }
          
          if (matches && columnIndex === -1) {
            columnIndex = index;
          }
        });
        
        if (columnIndex >= 0 && cells[columnIndex]) {
          const cell = cells[columnIndex];
          const cellText = cell.textContent.trim();
          
          if (cellText && cellText !== '-' && cellText.length > 0) {
            uniqueValues.set(cellText, cellText);
          }
        }
      }
      // Spezielle Behandlung für andere Text-Felder
      else if (fieldId === 'vorname' || fieldId === 'nachname' || fieldId === 'stadt') {
        // Extrahiere Text aus der entsprechenden Tabellenspalte
        const headerCells = document.querySelectorAll('.data-table thead th');
        const cells = row.querySelectorAll('td');
        
        // Finde Index der Spalte durch Vergleich mit Header-Text
        let columnIndex = -1;
        headerCells.forEach((th, index) => {
          const headerText = th.textContent.trim().toLowerCase();
          let matches = false;
          
          if (fieldId === 'firmenname') {
            // "Name" ist die Spalte für Firmenname in der Unternehmen-Tabelle
            matches = headerText.includes('firmenname') || headerText.includes('unternehmen') || 
                     (entityType === 'unternehmen' && (headerText === 'name' || headerText.includes('name')));
          } else if (fieldId === 'rechnungsadresse_stadt' || fieldId === 'stadt') {
            matches = headerText.includes('stadt');
          } else if (fieldId === 'rechnungsadresse_land' || fieldId === 'land') {
            matches = headerText.includes('land');
          } else if (fieldId === 'vorname') {
            matches = headerText.includes('vorname');
          } else if (fieldId === 'nachname') {
            matches = headerText.includes('nachname');
          }
          
          if (matches && columnIndex === -1) {
            columnIndex = index;
          }
        });
        
        if (columnIndex >= 0 && cells[columnIndex]) {
          const cell = cells[columnIndex];
          const cellText = cell.textContent.trim();
          
          if (cellText && cellText !== '-' && cellText.length > 0) {
            // Für Text-Filter: Verwende den Text selbst als Value (nicht ID)
            // Dies ermöglicht .ilike() Suche in der Datenbank
            uniqueValues.set(cellText, cellText);
          }
        }
      } else {
        // Standard: Versuche den Wert aus dem data-Attribut zu lesen
        const cellValue = row.dataset[fieldId];
        const cellLabel = row.dataset[`${fieldId}Label`];
        
        if (cellValue && cellValue !== 'null' && cellValue !== 'undefined') {
          uniqueValues.set(cellValue, cellLabel || cellValue);
        }
        
        // Alternativ: Durchsuche Zellen nach dem Wert
        if (!cellValue) {
          const cells = row.querySelectorAll('td');
          cells.forEach(cell => {
            const dataValue = cell.dataset.value;
            const dataLabel = cell.textContent.trim();
            
            if (dataValue && dataValue !== 'null' && dataValue !== 'undefined') {
              uniqueValues.set(dataValue, dataLabel || dataValue);
            }
          });
        }
      }
    });

    // Konvertiere zu Options-Array
    const options = Array.from(uniqueValues.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return options;
    
  } catch (error) {
    console.error('Fehler beim Extrahieren der Optionen aus aktuellen Daten:', error);
    return [];
  }
}

