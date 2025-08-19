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
        kampagne: { can_view: true, can_edit: true, can_delete: true },
        kooperation: { can_view: true, can_edit: true, can_delete: true },
        briefing: { can_view: true, can_edit: true, can_delete: true },
        rechnung: { can_view: true, can_edit: true, can_delete: true },
        ansprechpartner: { can_view: true, can_edit: true, can_delete: true },
        dashboard: { can_view: true, can_edit: true, can_delete: true }
      },
      mitarbeiter: {
        creator: { can_view: true, can_edit: false, can_delete: false },
        'creator-lists': { can_view: true, can_edit: false, can_delete: false },
        unternehmen: { can_view: true, can_edit: false, can_delete: false },
        marke: { can_view: true, can_edit: false, can_delete: false },
        auftrag: { can_view: true, can_edit: false, can_delete: false },
        kampagne: { can_view: true, can_edit: false, can_delete: false },
        kooperation: { can_view: true, can_edit: false, can_delete: false },
        briefing: { can_view: true, can_edit: false, can_delete: false },
        rechnung: { can_view: false, can_edit: false, can_delete: false },
        ansprechpartner: { can_view: true, can_edit: false, can_delete: false },
        dashboard: { can_view: false, can_edit: false, can_delete: false }
      }
    };

    // Standard-Berechtigungen
    const defaultPermissions = {
      creator: { can_view: false, can_edit: false, can_delete: false },
      'creator-lists': { can_view: false, can_edit: false, can_delete: false },
      unternehmen: { can_view: false, can_edit: false, can_delete: false },
      marke: { can_view: false, can_edit: false, can_delete: false },
      auftrag: { can_view: false, can_edit: false, can_delete: false },
      kampagne: { can_view: false, can_edit: false, can_delete: false },
      kooperation: { can_view: false, can_edit: false, can_delete: false },
      dashboard: { can_view: false, can_edit: false, can_delete: false }
    };

    // Admin hat alle Rechte (case-insensitive)
    if (normalizedRole === 'admin') {
      return basePermissions.admin;
    }

    // Mitarbeiter mit can_edit Unterrolle hat erweiterte Rechte (case-insensitive)
    if (normalizedRole === 'mitarbeiter' && subRole === 'can_edit') {
      return {
        creator: { can_view: true, can_edit: true, can_delete: false },
        unternehmen: { can_view: true, can_edit: true, can_delete: false },
        marke: { can_view: true, can_edit: true, can_delete: false },
        auftrag: { can_view: true, can_edit: true, can_delete: false },
        kampagne: { can_view: true, can_edit: true, can_delete: false },
        kooperation: { can_view: true, can_edit: true, can_delete: false },
        dashboard: { can_view: true, can_edit: false, can_delete: false }
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

    // Fallback zu Standard-Berechtigungen
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
}
