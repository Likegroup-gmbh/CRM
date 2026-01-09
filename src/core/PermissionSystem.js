// PermissionSystem.js (ES6-Modul)
// Zentrale Berechtigungsverwaltung

export class PermissionSystem {
  constructor() {
    this.userPermissions = {};
    this.userRole = null;
    this.userSubRole = null;
    this.calculatedPermissions = {};
    // Page-/Tabellen-Scoped-Overrides aus DB `user_permissions`
    this.pagePermissions = {}; // key: page_id → { can_view, can_edit, can_delete, data_filters }
    this.tablePermissions = {}; // key: `${page_id}.${table_id}` → { ... }
  }

  // Benutzer-Berechtigungen setzen
  setUserPermissions(user) {
    console.log('🔐 Setze Benutzer-Berechtigungen:', user);
    
    this.userRole = user.rolle;
    this.userSubRole = user.unterrolle;
    this.userPermissions = user.zugriffsrechte || {};
    
    // Berechtigungen basierend auf Rolle berechnen
    let calculatedPermissions = this.getPermissionsByUser(user);
    // Benutzer-spezifische Overrides aus zugriffsrechte anwenden (can_view + can_edit)
    if (user?.zugriffsrechte && typeof user.zugriffsrechte === 'object') {
      calculatedPermissions = this.applyOverrides(calculatedPermissions, user.zugriffsrechte);
    }
    // final berechnete Permissions persistieren
    this.calculatedPermissions = calculatedPermissions;
    // Speichere auch roh am user-Objekt
    user.permissions = calculatedPermissions;
    
    // Berechtigungen in window.currentUser setzen
    if (window.currentUser) {
      window.currentUser.permissions = calculatedPermissions;
      console.log('✅ Berechtigungen in window.currentUser gesetzt:', calculatedPermissions);
    }
    
    console.log('✅ Berechtigungen gesetzt:', {
      role: this.userRole,
      subRole: this.userSubRole,
      permissions: this.userPermissions,
      calculatedPermissions: calculatedPermissions
    });
  }

  // Berechtigungen basierend auf Benutzer-Rolle (aus Datenbank)
  getPermissionsByUser(user) {
    const role = user.rolle;
    const subRole = user.unterrolle;
    
    // Basis-Berechtigungen basierend auf Rolle (case-insensitive)
    const normalizedRole = role?.toLowerCase();
    const basePermissions = {
      admin: {
        creator: { can_view: true, can_edit: true, can_delete: true },
        'creator-lists': { can_view: true, can_edit: true, can_delete: true },
        unternehmen: { can_view: true, can_edit: true, can_delete: true },
        marke: { can_view: true, can_edit: true, can_delete: true },
        auftrag: { can_view: true, can_edit: true, can_delete: true },
        auftragsdetails: { can_view: true, can_edit: true, can_delete: true },
        kampagne: { can_view: true, can_edit: true, can_delete: true },
        kooperation: { can_view: true, can_edit: true, can_delete: true },
        briefing: { can_view: true, can_edit: true, can_delete: true },
        rechnung: { can_view: true, can_edit: true, can_delete: true },
        ansprechpartner: { can_view: true, can_edit: true, can_delete: true },
        dashboard: { can_view: true, can_edit: true, can_delete: true },
        tasks: { can_view: true, can_edit: true, can_delete: true },
        strategie: { can_view: true, can_edit: true, can_delete: true },
        feedback: { can_view: true, can_edit: true, can_delete: true },
        mitarbeiter: { can_view: true, can_edit: true, can_delete: true },
        'kunden-admin': { can_view: true, can_edit: true, can_delete: true }
      },
      mitarbeiter: {
        creator: { can_view: true, can_edit: false, can_delete: false },
        'creator-lists': { can_view: true, can_edit: false, can_delete: false },
        unternehmen: { can_view: true, can_edit: false, can_delete: false },
        marke: { can_view: true, can_edit: false, can_delete: false },
        auftrag: { can_view: false, can_edit: false, can_delete: false }, // Aufträge für Mitarbeiter ausgeblendet
        auftragsdetails: { can_view: true, can_edit: false, can_delete: false }, // Auftragsdetails für Mitarbeiter sichtbar
        kampagne: { can_view: true, can_edit: false, can_delete: false },
        kooperation: { can_view: true, can_edit: false, can_delete: false },
        briefing: { can_view: true, can_edit: false, can_delete: false },
        rechnung: { can_view: true, can_edit: false, can_delete: false },
        ansprechpartner: { can_view: true, can_edit: false, can_delete: false },
        dashboard: { can_view: true, can_edit: false, can_delete: false },
        tasks: { can_view: true, can_edit: false, can_delete: false },
        strategie: { can_view: true, can_edit: true, can_delete: false },
        feedback: { can_view: true, can_edit: true, can_delete: false },
        mitarbeiter: { can_view: false, can_edit: false, can_delete: false },
        'kunden-admin': { can_view: false, can_edit: false, can_delete: false }
      },
      // Kunden: read-only Einsicht in relevante Module (RLS filtert auf eigene Daten)
      kunde: {
        creator: { can_view: false, can_edit: false, can_delete: false },
        'creator-lists': { can_view: false, can_edit: false, can_delete: false },
        unternehmen: { can_view: false, can_edit: false, can_delete: false },
        marke: { can_view: false, can_edit: false, can_delete: false },
        auftrag: { can_view: true, can_edit: false, can_delete: false }, // Kunden können IHRE Aufträge sehen (RLS-gefiltert)
        auftragsdetails: { can_view: true, can_edit: false, can_delete: false }, // Kunden können IHRE Auftragsdetails sehen
        kampagne: { can_view: true, can_edit: false, can_delete: false },
        kooperation: { can_view: true, can_edit: false, can_delete: false },
        briefing: { can_view: true, can_edit: false, can_delete: false },
        rechnung: { can_view: false, can_edit: false, can_delete: false },
        ansprechpartner: { can_view: false, can_edit: false, can_delete: false },
        dashboard: { can_view: true, can_edit: false, can_delete: false },
        tasks: { can_view: true, can_edit: true, can_delete: false },
        strategie: { can_view: true, can_edit: true, can_delete: false },
        feedback: { can_view: true, can_edit: true, can_delete: false },
        mitarbeiter: { can_view: false, can_edit: false, can_delete: false },
        'kunden-admin': { can_view: false, can_edit: false, can_delete: false }
      },
      // Kunde-Editor: perspektivisch eingeschränkt bearbeitbar; v1 wie kunde
      'kunde_editor': {
        creator: { can_view: false, can_edit: false, can_delete: false },
        'creator-lists': { can_view: false, can_edit: false, can_delete: false },
        unternehmen: { can_view: false, can_edit: false, can_delete: false },
        marke: { can_view: false, can_edit: false, can_delete: false },
        auftrag: { can_view: true, can_edit: false, can_delete: false }, // Kunden können IHRE Aufträge sehen (RLS-gefiltert)
        auftragsdetails: { can_view: true, can_edit: false, can_delete: false }, // Kunden können IHRE Auftragsdetails sehen
        kampagne: { can_view: true, can_edit: false, can_delete: false },
        kooperation: { can_view: true, can_edit: false, can_delete: false },
        briefing: { can_view: true, can_edit: false, can_delete: false },
        rechnung: { can_view: false, can_edit: false, can_delete: false },
        ansprechpartner: { can_view: false, can_edit: false, can_delete: false },
        dashboard: { can_view: true, can_edit: false, can_delete: false },
        tasks: { can_view: true, can_edit: true, can_delete: false },
        strategie: { can_view: true, can_edit: true, can_delete: false },
        feedback: { can_view: true, can_edit: true, can_delete: false },
        mitarbeiter: { can_view: false, can_edit: false, can_delete: false },
        'kunden-admin': { can_view: false, can_edit: false, can_delete: false }
      }
    };

    // Standard-Berechtigungen
    const defaultPermissions = {
      creator: { can_view: false, can_edit: false, can_delete: false },
      'creator-lists': { can_view: false, can_edit: false, can_delete: false },
      unternehmen: { can_view: false, can_edit: false, can_delete: false },
      marke: { can_view: false, can_edit: false, can_delete: false },
      auftrag: { can_view: false, can_edit: false, can_delete: false },
      auftragsdetails: { can_view: false, can_edit: false, can_delete: false },
      kampagne: { can_view: false, can_edit: false, can_delete: false },
      kooperation: { can_view: false, can_edit: false, can_delete: false },
      briefing: { can_view: false, can_edit: false, can_delete: false },
      tasks: { can_view: false, can_edit: false, can_delete: false },
      rechnung: { can_view: false, can_edit: false, can_delete: false },
      ansprechpartner: { can_view: false, can_edit: false, can_delete: false },
      dashboard: { can_view: true, can_edit: false, can_delete: false },
      strategie: { can_view: false, can_edit: false, can_delete: false },
      feedback: { can_view: true, can_edit: false, can_delete: false },
      mitarbeiter: { can_view: false, can_edit: false, can_delete: false },
      'kunden-admin': { can_view: false, can_edit: false, can_delete: false }
    };

    // Kunden-Berechtigungen (NUR LESEN - RLS filtert die Daten)
    const kundenPermissions = {
      creator: { can_view: false, can_edit: false, can_delete: false },
      'creator-lists': { can_view: false, can_edit: false, can_delete: false },
      unternehmen: { can_view: false, can_edit: false, can_delete: false },
      marke: { can_view: false, can_edit: false, can_delete: false },
      auftrag: { can_view: true, can_edit: false, can_delete: false }, // Kunden können IHRE Aufträge sehen (RLS-gefiltert)
      auftragsdetails: { can_view: true, can_edit: false, can_delete: false }, // Kunden können IHRE Auftragsdetails sehen
      kampagne: { can_view: true, can_edit: false, can_delete: false }, // Kunden können Kampagnen NUR sehen
      kooperation: { can_view: true, can_edit: false, can_delete: false }, // Kunden können Kooperationen NUR sehen
      briefing: { can_view: true, can_edit: false, can_delete: false }, // Kunden können Briefings NUR sehen
      rechnung: { can_view: false, can_edit: false, can_delete: false }, // Kunden können Rechnungen NICHT sehen
      ansprechpartner: { can_view: false, can_edit: false, can_delete: false },
      dashboard: { can_view: true, can_edit: false, can_delete: false },
      tasks: { can_view: true, can_edit: true, can_delete: false }, // Kunden können Tasks sehen und bearbeiten
      strategie: { can_view: true, can_edit: true, can_delete: false }, // Kunden können Strategien sehen und Items bearbeiten
      feedback: { can_view: true, can_edit: true, can_delete: false },
      mitarbeiter: { can_view: false, can_edit: false, can_delete: false },
      'kunden-admin': { can_view: false, can_edit: false, can_delete: false }
    };

    // Pending-User: Nur Dashboard, keine anderen Rechte
    const pendingPermissions = {
      creator: { can_view: false, can_edit: false, can_delete: false },
      'creator-lists': { can_view: false, can_edit: false, can_delete: false },
      unternehmen: { can_view: false, can_edit: false, can_delete: false },
      marke: { can_view: false, can_edit: false, can_delete: false },
      auftrag: { can_view: false, can_edit: false, can_delete: false },
      auftragsdetails: { can_view: false, can_edit: false, can_delete: false },
      kampagne: { can_view: false, can_edit: false, can_delete: false },
      kooperation: { can_view: false, can_edit: false, can_delete: false },
      briefing: { can_view: false, can_edit: false, can_delete: false },
      rechnung: { can_view: false, can_edit: false, can_delete: false },
      ansprechpartner: { can_view: false, can_edit: false, can_delete: false },
      dashboard: { can_view: true, can_edit: false, can_delete: false },
      tasks: { can_view: false, can_edit: false, can_delete: false },
      strategie: { can_view: false, can_edit: false, can_delete: false },
      feedback: { can_view: false, can_edit: false, can_delete: false },
      mitarbeiter: { can_view: false, can_edit: false, can_delete: false },
      'kunden-admin': { can_view: false, can_edit: false, can_delete: false }
    };

    // Pending-User: Warten auf Admin-Freischaltung
    if (normalizedRole === 'pending') {
      console.log('👤 Pending-User: Nur Dashboard-Zugriff, alle anderen Module gesperrt');
      return pendingPermissions;
    }

    // Kunden: Spezielle Berechtigungen (RLS filtert die Daten)
    if (normalizedRole === 'kunde') {
      console.log('👤 Kunde: Zugriff auf Kampagnen, Kooperationen, Briefings, Rechnungen (RLS-gefiltert)');
      return kundenPermissions;
    }

    // Admin hat alle Rechte (case-insensitive)
    if (normalizedRole === 'admin') {
      return basePermissions.admin;
    }

    // Mitarbeiter mit can_edit Unterrolle hat erweiterte Rechte (case-insensitive)
    if (normalizedRole === 'mitarbeiter' && subRole === 'can_edit') {
      return {
        creator: { can_view: true, can_edit: true, can_delete: false },
        'creator-lists': { can_view: true, can_edit: true, can_delete: false },
        unternehmen: { can_view: true, can_edit: true, can_delete: false },
        marke: { can_view: true, can_edit: true, can_delete: false },
        auftrag: { can_view: true, can_edit: true, can_delete: false },
        auftragsdetails: { can_view: true, can_edit: true, can_delete: false },
        kampagne: { can_view: true, can_edit: true, can_delete: false },
        kooperation: { can_view: true, can_edit: true, can_delete: false },
        briefing: { can_view: true, can_edit: true, can_delete: false },
        rechnung: { can_view: true, can_edit: true, can_delete: false },
        ansprechpartner: { can_view: true, can_edit: true, can_delete: false },
        dashboard: { can_view: true, can_edit: false, can_delete: false },
        tasks: { can_view: true, can_edit: true, can_delete: false },
        strategie: { can_view: true, can_edit: true, can_delete: false },
        feedback: { can_view: true, can_edit: true, can_delete: false },
        mitarbeiter: { can_view: false, can_edit: false, can_delete: false },
        'kunden-admin': { can_view: false, can_edit: false, can_delete: false }
      };
    }

    // Mitarbeiter mit can_view Unterrolle hat nur Leserechte (case-insensitive)
    if (normalizedRole === 'mitarbeiter' && subRole === 'can_view') {
      return basePermissions.mitarbeiter;
    }

    // Standard Mitarbeiter-Rechte (case-insensitive)
    if (normalizedRole === 'mitarbeiter') {
      return basePermissions.mitarbeiter;
    }

    // Kunde (read-only)
    if (normalizedRole === 'kunde') {
      return basePermissions.kunde;
    }

    // Kunde-Editor (derzeit wie Kunde; spätere Edit-Rechte möglich)
    if (normalizedRole === 'kunde_editor') {
      return basePermissions['kunde_editor'];
    }

    // Fallback zu Standard-Berechtigungen (ohne Rechte)
    return defaultPermissions;
  }

  // Overrides anwenden (can_view + can_edit aus JSON-Objekt, delete bleibt rollenbasiert)
  applyOverrides(perms, overrides) {
    const cloned = JSON.parse(JSON.stringify(perms || {}));
    Object.keys(overrides || {}).forEach((key) => {
      if (!cloned[key]) cloned[key] = { can_view: false, can_edit: false, can_delete: false };
      const ov = overrides[key];
      if (typeof ov === 'boolean') cloned[key].can_view = ov;
      if (ov && typeof ov === 'object') {
        if (typeof ov.can_view === 'boolean') cloned[key].can_view = ov.can_view;
        if (typeof ov.can_edit === 'boolean') cloned[key].can_edit = ov.can_edit;
      }
    });
    return cloned;
  }

  // Page-/Tabellen-Scoped-Overrides setzen (Rows aus `user_permissions`)
  setScopedPermissions(rows) {
    this.pagePermissions = {};
    this.tablePermissions = {};
    (rows || []).forEach((row) => {
      const base = {
        can_view: !!row.can_view,
        can_edit: !!row.can_edit,
        can_delete: !!row.can_delete,
        data_filters: row.data_filters || null
      };
      if (row.page_id && !row.table_id) {
        this.pagePermissions[row.page_id] = base;
      }
      if (row.page_id && row.table_id) {
        this.tablePermissions[`${row.page_id}.${row.table_id}`] = base;
      }
    });

    if (window.currentUser) {
      window.currentUser.scopedPermissions = {
        pages: this.pagePermissions,
        tables: this.tablePermissions
      };
    }
  }

  // Seiten-/Tabellen-Sichtbarkeit ermitteln (Page-Override hat Vorrang)
  canViewPage(pageId) {
    // Admin immer true
    if (this.userRole === 'admin') return true;

    const pageOverride = this.pagePermissions?.[pageId]?.can_view;
    if (typeof pageOverride === 'boolean') return pageOverride;

    // Fallback: berechnete rollenbasierte Rechte
    const perms = this.calculatedPermissions?.[pageId];
    // Wenn pageId nicht in calculatedPermissions existiert, undefined zurückgeben
    // damit das Entity-Mapping in der Navigation greifen kann
    if (perms === undefined) return undefined;
    return !!perms?.can_view;
  }

  canViewTable(pageId, tableId) {
    if (this.userRole === 'admin') return true;
    const tableOverride = this.tablePermissions?.[`${pageId}.${tableId}`]?.can_view;
    if (typeof tableOverride === 'boolean') return tableOverride;
    // Wenn keine Table-Regel vorhanden ist, nutze Page-Regel
    return this.canViewPage(pageId);
  }

  getDataFilters(pageId, tableId) {
    const key = tableId ? `${pageId}.${tableId}` : pageId;
    const scoped = tableId ? this.tablePermissions[key] : this.pagePermissions[key];
    return scoped?.data_filters || null;
  }

  // Berechtigung für eine spezifische Aktion prüfen
  checkPermission(entity, action) {
    if (!this.userRole) {
      console.warn('⚠️ Keine Benutzer-Rolle gesetzt');
      return false;
    }

    // Admin hat alle Rechte
    if (this.userRole === 'admin') {
      return true;
    }

    // Zuerst: Page-Scoped Override aus DB (falls vorhanden)
    if (action === 'can_view') {
      const pageOverride = this.pagePermissions?.[entity]?.can_view;
      if (typeof pageOverride === 'boolean') return pageOverride;
    }

    // Prüfe berechnete, gecachte Rollenrechte inkl. (boolean) Overrides
    const entityPermissions = this.calculatedPermissions?.[entity];

    if (!entityPermissions) {
      console.warn(`⚠️ Keine Berechtigungen für Entity: ${entity}`);
      return false;
    }

    const hasPermission = entityPermissions[`can_${action}`] || false;
    
    console.log(`🔐 Berechtigung prüfen: ${entity}.${action} = ${hasPermission}`);
    return hasPermission;
  }

  // Mehrere Berechtigungen auf einmal prüfen
  checkPermissions(entity, actions) {
    if (Array.isArray(actions)) {
      return actions.every(action => this.checkPermission(entity, action));
    }
    return this.checkPermission(entity, actions);
  }

  // Aktuelle Benutzer-Berechtigungen abrufen
  getUserPermissions() {
    return {
      role: this.userRole,
      subRole: this.userSubRole,
      permissions: this.calculatedPermissions
    };
  }

  // Berechtigungen für eine spezifische Entität abrufen
  getEntityPermissions(entity) {
    if (!this.userRole) return null;

    const permissions = this.calculatedPermissions?.[entity];

    return permissions || null;
  }

  // Berechtigungen zurücksetzen
  clearPermissions() {
    this.userPermissions = {};
    this.userRole = null;
    this.userSubRole = null;
    console.log('🔐 Berechtigungen zurückgesetzt');
  }

  // Benutzer-Berechtigungen aktualisieren
  updateUserPermissions(user) {
    this.setUserPermissions(user);
    
    // Berechtigungen auch in window.currentUser aktualisieren
    if (window.currentUser) {
      window.currentUser.permissions = this.calculatedPermissions;
      console.log('✅ Berechtigungen in window.currentUser aktualisiert:', this.calculatedPermissions);
    }
  }

  /**
   * Holt alle Unternehmen-IDs, auf die der aktuelle User Zugriff hat
   * @returns {Promise<string[]|null>} Array von IDs oder null (= alle erlaubt für Admin)
   */
  async getAllowedUnternehmenIds() {
    const rolle = window.currentUser?.rolle?.toLowerCase();
    const userId = window.currentUser?.id;
    
    // Admin hat uneingeschränkten Zugriff
    if (rolle === 'admin') return null;
    
    // Kunde hat auch uneingeschränkten Zugriff (RLS filtert auf DB-Ebene)
    if (rolle === 'kunde' || rolle === 'kunde_editor') return null;
    
    if (!userId) {
      console.warn('⚠️ getAllowedUnternehmenIds: Kein User-ID gefunden');
      return [];
    }
    
    try {
      // 1. Direkt über mitarbeiter_unternehmen zugeordnete Unternehmen
      const { data: direkteZuordnung, error: err1 } = await window.supabase
        .from('mitarbeiter_unternehmen')
        .select('unternehmen_id')
        .eq('mitarbeiter_id', userId);
      
      if (err1) {
        console.error('❌ Fehler beim Laden direkter Unternehmen-Zuordnungen:', err1);
      }
      
      // 2. Indirekt über marke_mitarbeiter -> marke.unternehmen_id
      const { data: markenZuordnung, error: err2 } = await window.supabase
        .from('marke_mitarbeiter')
        .select('marke:marke_id(unternehmen_id)')
        .eq('mitarbeiter_id', userId);
      
      if (err2) {
        console.error('❌ Fehler beim Laden Marken-basierter Unternehmen-Zuordnungen:', err2);
      }
      
      // Zusammenführen und Duplikate entfernen
      const alleIds = [
        ...(direkteZuordnung || []).map(r => r.unternehmen_id),
        ...(markenZuordnung || []).map(r => r.marke?.unternehmen_id).filter(Boolean)
      ];
      const uniqueIds = [...new Set(alleIds)];
      
      console.log(`🔐 getAllowedUnternehmenIds: ${uniqueIds.length} Unternehmen für User ${userId}`);
      return uniqueIds;
      
    } catch (error) {
      console.error('❌ getAllowedUnternehmenIds Fehler:', error);
      return [];
    }
  }

  /**
   * Holt alle Marken-IDs, auf die der aktuelle User Zugriff hat
   * @returns {Promise<string[]|null>} Array von IDs oder null (= alle erlaubt für Admin)
   */
  async getAllowedMarkenIds() {
    const rolle = window.currentUser?.rolle?.toLowerCase();
    const userId = window.currentUser?.id;
    
    // Admin hat uneingeschränkten Zugriff
    if (rolle === 'admin') return null;
    
    // Kunde hat auch uneingeschränkten Zugriff (RLS filtert auf DB-Ebene)
    if (rolle === 'kunde' || rolle === 'kunde_editor') return null;
    
    if (!userId) {
      console.warn('⚠️ getAllowedMarkenIds: Kein User-ID gefunden');
      return [];
    }
    
    try {
      // 1. Direkt über marke_mitarbeiter zugeordnete Marken
      const { data: direkteMarken, error: err1 } = await window.supabase
        .from('marke_mitarbeiter')
        .select('marke_id')
        .eq('mitarbeiter_id', userId);
      
      if (err1) {
        console.error('❌ Fehler beim Laden direkter Marken-Zuordnungen:', err1);
      }
      
      // 2. Indirekt über mitarbeiter_unternehmen -> alle Marken des Unternehmens
      const { data: unternehmenZuordnung, error: err2 } = await window.supabase
        .from('mitarbeiter_unternehmen')
        .select('unternehmen_id')
        .eq('mitarbeiter_id', userId);
      
      if (err2) {
        console.error('❌ Fehler beim Laden Unternehmen-Zuordnungen:', err2);
      }
      
      // Marken der zugeordneten Unternehmen laden
      const unternehmenIds = (unternehmenZuordnung || []).map(r => r.unternehmen_id).filter(Boolean);
      let markenVonUnternehmen = [];
      
      if (unternehmenIds.length > 0) {
        const { data: markenData, error: err3 } = await window.supabase
          .from('marke')
          .select('id')
          .in('unternehmen_id', unternehmenIds);
        
        if (err3) {
          console.error('❌ Fehler beim Laden Marken der Unternehmen:', err3);
        }
        markenVonUnternehmen = (markenData || []).map(m => m.id);
      }
      
      // Zusammenführen und Duplikate entfernen
      const alleIds = [
        ...(direkteMarken || []).map(r => r.marke_id),
        ...markenVonUnternehmen
      ];
      const uniqueIds = [...new Set(alleIds)];
      
      console.log(`🔐 getAllowedMarkenIds: ${uniqueIds.length} Marken für User ${userId}`);
      return uniqueIds;
      
    } catch (error) {
      console.error('❌ getAllowedMarkenIds Fehler:', error);
      return [];
    }
  }
}

// Exportiere Instanz
export const permissionSystem = new PermissionSystem();

// Globale Funktionen für Kompatibilität
if (typeof window !== 'undefined') {
  window.checkUserPermission = (entity, action) => {
    return permissionSystem.checkPermission(entity, action);
  };
  
  window.checkUserPermissions = (entity, actions) => {
    return permissionSystem.checkPermissions(entity, actions);
  };
  
  window.getUserPermissions = () => {
    return permissionSystem.getUserPermissions();
  };
  
  window.getEntityPermissions = (entity) => {
    return permissionSystem.getEntityPermissions(entity);
  };

  // Scoped-APIs global machen für UI
  window.canViewPage = (pageId) => permissionSystem.canViewPage(pageId);
  window.canViewTable = (pageId, tableId) => permissionSystem.canViewTable(pageId, tableId);
  window.getDataFilters = (pageId, tableId) => permissionSystem.getDataFilters(pageId, tableId);
  
  // Globale Helper für erlaubte Unternehmen/Marken
  window.getAllowedUnternehmenIds = () => permissionSystem.getAllowedUnternehmenIds();
  window.getAllowedMarkenIds = () => permissionSystem.getAllowedMarkenIds();
}
