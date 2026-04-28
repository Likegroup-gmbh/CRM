// PermissionSystem.js (ES6-Modul)
// Zentrale Berechtigungsverwaltung

// --- Komprimierte Rollen-Matrix (Modul-Konstante, wird nur 1x erzeugt) ---

const ENTITIES = [
  'creator', 'creator-lists', 'unternehmen', 'marke', 'produkt',
  'auftrag', 'auftragsdetails', 'kampagne', 'kooperation', 'briefing',
  'videos', 'rechnung', 'ansprechpartner', 'dashboard', 'tasks',
  'strategie', 'kickoff', 'sourcing', 'feedback', 'mitarbeiter',
  'vertraege', 'kunden-admin'
];

const T = { can_view: true, can_edit: true, can_delete: true };
const F = { can_view: false, can_edit: false, can_delete: false };
const V = { can_view: true, can_edit: false, can_delete: false };

function allOf(template) {
  return Object.fromEntries(ENTITIES.map(e => [e, { ...template }]));
}

const BASE_PERMISSIONS = {
  admin: allOf(T),

  mitarbeiter: {
    ...allOf(T),
    unternehmen:    { can_view: true, can_edit: false, can_delete: true },
    marke:          { can_view: true, can_edit: false, can_delete: true },
    auftrag:        { ...F },
    auftragsdetails:{ can_view: true, can_edit: false, can_delete: true },
    rechnung:       { can_view: true, can_edit: true, can_delete: false },
    dashboard:      { ...V },
    tasks:          { can_view: true, can_edit: false, can_delete: true },
    mitarbeiter:    { ...F },
    'kunden-admin': { ...F },
  },

  kunde: {
    ...allOf(F),
    produkt:     { ...V },
    auftrag:     { ...V },
    kampagne:    { ...V },
    kooperation: { ...V },
    briefing:    { ...V },
    videos:      { ...V },
    dashboard:   { ...V },
    tasks:       { can_view: true, can_edit: true, can_delete: false },
    strategie:   { can_view: true, can_edit: true, can_delete: false },
    kickoff:     { ...V },
    sourcing:    { ...V },
  },
};

// kunde_editor ist aktuell identisch mit kunde; spaeter koennen hier Abweichungen definiert werden
BASE_PERMISSIONS.kunde_editor = { ...BASE_PERMISSIONS.kunde };

const DEFAULT_PERMISSIONS = {
  ...allOf(F),
  dashboard: { ...V },
  feedback:  { ...V },
};

const PENDING_PERMISSIONS = {
  ...allOf(F),
  dashboard: { ...V },
};

// --- Permission System Klasse ---

export class PermissionSystem {
  constructor() {
    this.userPermissions = {};
    this.userRole = null;
    this._normalizedRole = '';
    this.calculatedPermissions = {};
    this.pagePermissions = {};
    this.tablePermissions = {};
  }

  // ============================================
  // Rollen-Helper (gecacht ueber _normalizedRole)
  // ============================================

  get isAdmin()       { return this._normalizedRole === 'admin'; }
  get isKunde()       { return this._normalizedRole === 'kunde' || this._normalizedRole === 'kunde_editor'; }
  get isKundeEditor() { return this._normalizedRole === 'kunde_editor'; }
  get isMitarbeiter() { return this._normalizedRole === 'mitarbeiter'; }
  get isPending()     { return this._normalizedRole === 'pending'; }
  get isInternal()    { return this.isAdmin || this.isMitarbeiter; }

  // Feature-basierte Checks (Capabilities)
  get canSeePricing()      { return this.isInternal; }
  get canManageStaff()     { return this.isAdmin; }
  get canBulkDelete()      { return this.isInternal; }
  get canCreateProject()   { return this.isInternal; }
  get canUseGlobalSearch() { return this.isInternal; }

  // ============================================
  // Benutzer-Berechtigungen setzen
  // ============================================

  setUserPermissions(user) {
    this.userRole = user.rolle;
    this._normalizedRole = String(user.rolle || '').trim().toLowerCase();
    this.userPermissions = user.zugriffsrechte || {};

    let calculatedPermissions = this.getPermissionsByRole(this._normalizedRole);

    if (user?.zugriffsrechte && typeof user.zugriffsrechte === 'object') {
      calculatedPermissions = this.applyOverrides(calculatedPermissions, user.zugriffsrechte);
    }

    this.calculatedPermissions = calculatedPermissions;
    user.permissions = calculatedPermissions;

    if (window.currentUser) {
      window.currentUser.permissions = calculatedPermissions;
    }

    console.debug('🔐 Berechtigungen gesetzt:', { role: this.userRole, permissions: calculatedPermissions });
  }

  // ============================================
  // Rollen-Matrix auflösen
  // ============================================

  getPermissionsByRole(normalizedRole) {
    if (normalizedRole === 'pending') return { ...PENDING_PERMISSIONS };
    const matrix = BASE_PERMISSIONS[normalizedRole];
    if (matrix) return structuredClone(matrix);
    return { ...DEFAULT_PERMISSIONS };
  }

  // Abwaertskompatibilitaet: alte Signatur getPermissionsByUser(user)
  getPermissionsByUser(user) {
    const role = String(user?.rolle || '').trim().toLowerCase();
    return this.getPermissionsByRole(role);
  }

  // ============================================
  // Overrides
  // ============================================

  applyOverrides(perms, overrides) {
    const cloned = structuredClone(perms || {});
    for (const key of Object.keys(overrides || {})) {
      if (!cloned[key]) cloned[key] = { can_view: false, can_edit: false, can_delete: false };
      const ov = overrides[key];
      if (typeof ov === 'boolean') { cloned[key].can_view = ov; continue; }
      if (ov && typeof ov === 'object') {
        if (typeof ov.can_view === 'boolean') cloned[key].can_view = ov.can_view;
        if (typeof ov.can_edit === 'boolean') cloned[key].can_edit = ov.can_edit;
      }
    }
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

  // ============================================
  // Permission-Checks
  // ============================================

  canViewPage(pageId) {
    if (this.isAdmin) return true;
    if (!this._normalizedRole) return false;

    const pageOverride = this.pagePermissions?.[pageId]?.can_view;
    if (typeof pageOverride === 'boolean') return pageOverride;

    const perms = this.calculatedPermissions?.[pageId];
    if (perms === undefined) return undefined;
    return !!perms?.can_view;
  }

  canViewTable(pageId, tableId) {
    if (this.isAdmin) return true;
    const tableOverride = this.tablePermissions?.[`${pageId}.${tableId}`]?.can_view;
    if (typeof tableOverride === 'boolean') return tableOverride;
    return this.canViewPage(pageId);
  }

  getDataFilters(pageId, tableId) {
    const key = tableId ? `${pageId}.${tableId}` : pageId;
    const scoped = tableId ? this.tablePermissions[key] : this.pagePermissions[key];
    return scoped?.data_filters || null;
  }

  checkPermission(entity, action) {
    if (!this._normalizedRole) {
      console.warn('⚠️ Keine Benutzer-Rolle gesetzt');
      return false;
    }

    if (this.isAdmin) return true;

    // Normalisierung: sowohl 'view' als auch 'can_view' akzeptieren
    const normalized = action.startsWith('can_') ? action.slice(4) : action;

    // Page-Scoped Override aus DB
    if (normalized === 'view') {
      const pageOverride = this.pagePermissions?.[entity]?.can_view;
      if (typeof pageOverride === 'boolean') return pageOverride;
    }

    const entityPermissions = this.calculatedPermissions?.[entity];
    if (!entityPermissions) {
      console.warn(`⚠️ Keine Berechtigungen für Entity: ${entity}`);
      return false;
    }

    return entityPermissions[`can_${normalized}`] || false;
  }

  checkPermissions(entity, actions) {
    if (Array.isArray(actions)) {
      return actions.every(action => this.checkPermission(entity, action));
    }
    return this.checkPermission(entity, actions);
  }

  // ============================================
  // Getter
  // ============================================

  getUserPermissions() {
    return { role: this.userRole, permissions: this.calculatedPermissions };
  }

  getEntityPermissions(entity) {
    if (!this._normalizedRole) return null;
    return this.calculatedPermissions?.[entity] || null;
  }

  // ============================================
  // Lifecycle
  // ============================================

  clearPermissions() {
    this.userPermissions = {};
    this.userRole = null;
    this._normalizedRole = '';
    this.calculatedPermissions = {};
    this.pagePermissions = {};
    this.tablePermissions = {};
  }

  updateUserPermissions(user) {
    this.setUserPermissions(user);
    if (window.currentUser) {
      window.currentUser.permissions = this.calculatedPermissions;
    }
  }
}

// --- Singleton + Window-Exports ---

export const permissionSystem = new PermissionSystem();

if (typeof window !== 'undefined') {
  // Bestehende APIs (Abwaertskompatibilitaet)
  window.checkUserPermission = (entity, action) => permissionSystem.checkPermission(entity, action);
  window.checkUserPermissions = (entity, actions) => permissionSystem.checkPermissions(entity, actions);
  window.getUserPermissions = () => permissionSystem.getUserPermissions();
  window.getEntityPermissions = (entity) => permissionSystem.getEntityPermissions(entity);
  window.canViewPage = (pageId) => permissionSystem.canViewPage(pageId);
  window.canViewTable = (pageId, tableId) => permissionSystem.canViewTable(pageId, tableId);
  window.getDataFilters = (pageId, tableId) => permissionSystem.getDataFilters(pageId, tableId);

  // Neue Rollen-Helper
  window.isAdmin        = () => permissionSystem.isAdmin;
  window.isKunde        = () => permissionSystem.isKunde;
  window.isKundeEditor  = () => permissionSystem.isKundeEditor;
  window.isMitarbeiter  = () => permissionSystem.isMitarbeiter;
  window.isPending      = () => permissionSystem.isPending;
  window.isInternal     = () => permissionSystem.isInternal;

  // Feature-basierte Capabilities
  window.canSeePricing      = () => permissionSystem.canSeePricing;
  window.canManageStaff     = () => permissionSystem.canManageStaff;
  window.canBulkDelete      = () => permissionSystem.canBulkDelete;
  window.canCreateProject   = () => permissionSystem.canCreateProject;
  window.canUseGlobalSearch = () => permissionSystem.canUseGlobalSearch;

  window.permissionSystem = permissionSystem;
}
