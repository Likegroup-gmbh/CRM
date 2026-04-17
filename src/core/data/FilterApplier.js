export class FilterApplier {
  applyFilters(query, filters, fieldConfig, entityType) {
    for (const [field, value] of Object.entries(filters)) {
      // Ignoriere null/undefined/empty
      if (!value || value === '') continue;
      
      // Stelle sicher, dass der Wert als String behandelt wird
      const stringValue = typeof value === 'object' ? '' : String(value);
      
      // Spezielle Behandlung für Name-Filter (Entity-spezifisch)
      if (field === 'name' && value) {
        switch (entityType) {
          case 'unternehmen':
            query = query.ilike('firmenname', `%${value}%`);
            break;
          case 'marke':
            query = query.ilike('markenname', `%${value}%`);
            break;
          case 'auftrag':
            query = query.ilike('auftragsname', `%${value}%`);
            break;
          case 'ansprechpartner':
          case 'creator':
          default:
            // Suche in vorname UND nachname
            query = query.or(`vorname.ilike.%${value}%,nachname.ilike.%${value}%`);
            break;
        }
        continue;
      }
      
      // Prüfe ob Feld im Config definiert ist
      const fieldType = fieldConfig[field];
      
      if (fieldType) {
        // Feld ist im Config definiert - nutze Typ-spezifische Logik
        switch (fieldType) {
          case 'number':
            if (filters[`${field}_min`]) {
              query = query.gte(field, parseFloat(filters[`${field}_min`]));
            }
            if (filters[`${field}_max`]) {
              query = query.lte(field, parseFloat(filters[`${field}_max`]));
            }
            // Unterstütze Objekt-Form {min,max}
            if (typeof value === 'object') {
              if (value.min != null && value.min !== '') {
                query = query.gte(field, parseFloat(value.min));
              }
              if (value.max != null && value.max !== '') {
                query = query.lte(field, parseFloat(value.max));
              }
            }
            break;
          case 'string':
            // Für Text-Felder verwende ilike für bessere Suche
            if (field === 'firmenname' || field === 'markenname' || field === 'name' || field === 'stadt') {
              query = query.ilike(field, `%${stringValue}%`);
            } else {
              query = query.eq(field, stringValue);
            }
            break;
          case 'array':
            // Array-Felder: Prüfe ob das Array den Wert enthält
            if (Array.isArray(value)) {
              // Mehrere Werte: Prüfe ob mindestens einer enthalten ist
              query = query.overlaps(field, value);
            } else {
              // Einzelner Wert: Prüfe ob enthalten
              query = query.contains(field, [stringValue]);
            }
            break;
          case 'date':
            if (filters[`${field}_from`]) {
              query = query.gte(field, filters[`${field}_from`]);
            }
            if (filters[`${field}_to`]) {
              query = query.lte(field, filters[`${field}_to`]);
            }
            // Unterstütze Objekt-Form {from,to} oder {min,max}
            if (typeof value === 'object') {
              const from = value.from ?? value.min;
              const to = value.to ?? value.max;
              if (from) {
                query = query.gte(field, from);
              }
              if (to) {
                query = query.lte(field, to);
              }
            }
            break;
          case 'uuid':
            // UUID-Felder für Beziehungen - stelle sicher, dass es ein gültiger UUID ist
            if (stringValue && stringValue !== '[object Object]') {
              query = query.eq(field, stringValue);
            }
            break;
        }
      } else {
        // Feld ist NICHT im Config - nutze intelligente Fallback-Logik
        console.log(`📋 Fallback-Filter für ${field} (nicht im fieldConfig)`);
        
        // UUID-Pattern erkennen (für Foreign Keys)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stringValue);
        
        if (isUuid || field.endsWith('_id')) {
          // Foreign Key / UUID
          query = query.eq(field, stringValue);
        } else if (field === 'firmenname' || field === 'markenname' || field === 'kampagnenname' || 
                   field === 'stadt' || field === 'land' || field === 'auftragsname') {
          // Text-Felder: Partial-Match mit ilike
          query = query.ilike(field, `%${stringValue}%`);
        } else if (typeof value === 'boolean') {
          // Boolean-Felder
          query = query.eq(field, value);
        } else if (typeof value === 'number') {
          // Numerische Felder
          query = query.eq(field, value);
        } else {
          // Default: Exakte Übereinstimmung
          query = query.eq(field, stringValue);
        }
      }
    }
    
    return query;
  }

  async extractFilterOptions(data, entityType) {
    const filterOptions = {};

    if (entityType === 'creator') {
      // Neue Methode: Lade alle verfügbaren Optionen aus den Referenz-Tabellen
      try {
        // Creator Types laden
        const { data: creatorTypes, error: ctError } = await window.supabase
          .from('creator_type')
          .select('id, name')
          .order('name');
        
        if (!ctError && creatorTypes) {
          // Sowohl alte als auch neue Keys setzen für Kompatibilität
          const options = creatorTypes.map(ct => ({ id: ct.id, name: ct.name }));
          filterOptions.creator_type = options;
          filterOptions.creator_type_id = options;
        }

        // Sprachen laden
        const { data: sprachen, error: spError } = await window.supabase
          .from('sprachen')
          .select('id, name')
          .order('name');
        
        if (!spError && sprachen) {
          // Sowohl alte als auch neue Keys setzen für Kompatibilität
          const options = sprachen.map(s => ({ id: s.id, name: s.name }));
          filterOptions.sprache = options;
          filterOptions.sprache_id = options;
        }

        // Branchen laden
        const { data: branchen, error: brError } = await window.supabase
          .from('branchen_creator')
          .select('id, name')
          .order('name');
        
        if (!brError && branchen) {
          // Sowohl alte als auch neue Keys setzen für Kompatibilität
          const options = branchen.map(b => ({ id: b.id, name: b.name }));
          filterOptions.branche = options;
          filterOptions.branche_id = options;
        }
      } catch (error) {
        console.error('❌ Fehler beim Laden der Filter-Optionen:', error);
      }

      // Instagram Follower Range
      const followerValues = data
        .map(item => item.instagram_follower)
        .filter(follower => follower && follower > 0)
        .sort((a, b) => a - b);
      
      if (followerValues.length > 0) {
        filterOptions.instagram_follower_min = Math.min(...followerValues);
        filterOptions.instagram_follower_max = Math.max(...followerValues);
      }

      // Stadt (String-Feld)
      const allStaedte = new Set();
      data.forEach(item => {
        if (item.lieferadresse_stadt) {
          allStaedte.add(item.lieferadresse_stadt);
        }
      });
      filterOptions.lieferadresse_stadt = Array.from(allStaedte).sort();

      // Land (String-Feld)
      const allLaender = new Set();
      data.forEach(item => {
        if (item.lieferadresse_land) {
          allLaender.add(item.lieferadresse_land);
        }
      });
      filterOptions.lieferadresse_land = Array.from(allLaender).sort();

    } else if (entityType === 'unternehmen') {
      // Branche (String-Feld)
      const allBranchen = new Set();
      data.forEach(item => {
        if (item.branche) {
          allBranchen.add(item.branche);
        }
      });
      filterOptions.branche = Array.from(allBranchen).sort();

      // Status (String-Feld)
      const allStatus = new Set();
      data.forEach(item => {
        if (item.status) {
          allStatus.add(item.status);
        }
      });
      filterOptions.status = Array.from(allStatus).sort();

      // Stadt (String-Feld)
      const allStaedte = new Set();
      data.forEach(item => {
        if (item.rechnungsadresse_stadt) {
          allStaedte.add(item.rechnungsadresse_stadt);
        }
      });
      filterOptions.rechnungsadresse_stadt = Array.from(allStaedte).sort();

      // Land (String-Feld)
      const allLaender = new Set();
      data.forEach(item => {
        if (item.rechnungsadresse_land) {
          allLaender.add(item.rechnungsadresse_land);
        }
      });
      filterOptions.rechnungsadresse_land = Array.from(allLaender).sort();

    } else if (entityType === 'kampagne') {
      // Status (String-Feld)
      const allStatus = new Set();
      data.forEach(item => {
        if (item.status) {
          allStatus.add(item.status);
        }
      });
      filterOptions.status = Array.from(allStatus).sort();

      // Budget Range
      const budgetValues = data
        .map(item => item.budget)
        .filter(budget => budget && budget > 0)
        .sort((a, b) => a - b);
      
      if (budgetValues.length > 0) {
        filterOptions.budget_min = Math.min(...budgetValues);
        filterOptions.budget_max = Math.max(...budgetValues);
      }

    } else if (entityType === 'kooperation') {
      // Status (String-Feld)
      const allStatus = new Set();
      data.forEach(item => {
        if (item.status) {
          allStatus.add(item.status);
        }
      });
      filterOptions.status = Array.from(allStatus).sort();

      // Budget Range
      const budgetValues = data
        .map(item => item.budget)
        .filter(budget => budget && budget > 0)
        .sort((a, b) => a - b);
      
      if (budgetValues.length > 0) {
        filterOptions.budget_min = Math.min(...budgetValues);
        filterOptions.budget_max = Math.max(...budgetValues);
      }
    } else if (entityType === 'ansprechpartner') {
      // Positionen (UUID-Feld) - Lade alle verfügbaren Positionen
      try {
        const { data: positionen, error } = await window.supabase
          .from('positionen')
          .select('id, name')
          .order('sort_order, name');

        if (!error && positionen) {
          filterOptions.position_id = positionen.map(p => ({
            value: p.id,
            label: p.name
          }));
        }
      } catch (error) {
        console.error('❌ Fehler beim Laden der Positionen für Ansprechpartner-Filter:', error);
      }

      // Sprachen (UUID-Feld) - Lade alle verfügbaren Sprachen
      try {
        const { data: sprachen, error } = await window.supabase
          .from('sprachen')
          .select('id, name')
          .order('name');

        if (!error && sprachen) {
          filterOptions.sprache_id = sprachen.map(s => ({
            value: s.id,
            label: s.name
          }));
        }
      } catch (error) {
        console.error('❌ Fehler beim Laden der Sprachen für Ansprechpartner-Filter:', error);
      }

      // Stadt (String-Feld) - Distinct values aus der Datenbank
      const allStaedte = new Set();
      data.forEach(item => {
        if (item.stadt) {
          allStaedte.add(item.stadt);
        }
      });
      filterOptions.stadt = Array.from(allStaedte).sort();

      // Unternehmen (UUID-Feld) - Lade alle verfügbaren Unternehmen
      try {
        const { data: unternehmen, error } = await window.supabase
          .from('unternehmen')
          .select('id, firmenname')
          .order('firmenname');

        if (!error && unternehmen) {
          filterOptions.unternehmen_id = unternehmen.map(u => ({
            value: u.id,
            label: u.firmenname
          }));
        }
      } catch (error) {
        console.error('❌ Fehler beim Laden der Unternehmen für Ansprechpartner-Filter:', error);
      }

    } else if (entityType === 'marke') {
      // Branche (String-Feld)
      const allBranchen = new Set();
      data.forEach(item => {
        if (item.branche) {
          allBranchen.add(item.branche);
        }
      });
      filterOptions.branche = Array.from(allBranchen).sort();

      // Unternehmen (UUID-Feld) - Lade Unternehmen-Namen
      const unternehmenIds = [...new Set(data.map(item => item.unternehmen_id).filter(Boolean))];
      if (unternehmenIds.length > 0) {
        try {
          const { data: unternehmen, error } = await window.supabase
            .from('unternehmen')
            .select('id, firmenname')
            .in('id', unternehmenIds);

          if (!error && unternehmen) {
            filterOptions.unternehmen_id = unternehmen.map(u => ({
              value: u.id,
              label: u.firmenname
            }));
          }
        } catch (error) {
          console.error('❌ Fehler beim Laden der Unternehmen für Marken-Filter:', error);
        }
      }
    }

    return filterOptions;
  }
}
