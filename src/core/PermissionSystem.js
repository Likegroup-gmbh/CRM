// PermissionSystem.js (ES6-Modul)
// Zentrale Berechtigungsverwaltung — deep module.
//
// Call-Sites fragen Capabilities, nicht Rollen:
//   permissionSystem.can('kampagne', 'create')  /  window.canCreate('kampagne')
//   permissionSystem.canEdit('kampagne')
// Rollen, Mitarbeiter-Klassen, zugriffsrechte-Overrides, user_permissions-Overlay
// und Guest-Share bleiben Implementation. Neue Rolle/Klasse = eine Matrix-Zeile
// mit True/False.

// --- Entitäten und Verben ---

const ENTITIES = [
  'creator', 'creator-lists', 'unternehmen', 'marke', 'produkt',
  'persona', 'auftrag', 'auftragsdetails', 'kampagne', 'kooperation', 'briefing',
  'videos', 'rechnung', 'ansprechpartner', 'dashboard', 'tasks',
  'strategie', 'sourcing', 'feedback', 'mitarbeiter',
  'vertraege', 'kunden-admin', 'contracts', 'skripte', 'management'
];

// Vier Verben: view / create / edit / delete. create ist absichtlich kein
// Subset von edit: Investor sieht Zeilen, legt aber keine an.
const T = { can_view: true,  can_create: true,  can_edit: true,  can_delete: true  };
const F = { can_view: false, can_create: false, can_edit: false, can_delete: false };
const V = { can_view: true,  can_create: false, can_edit: false, can_delete: false };

function allOf(template) {
  return Object.fromEntries(ENTITIES.map(e => [e, { ...template }]));
}

// Edit-Recht ohne Create (Kunde darf Anmerkungen pflegen, aber nichts anlegen).
function viewEdit() {
  return { can_view: true, can_create: false, can_edit: true, can_delete: false };
}

// --- Entity-Aliase ---
// UI-/Tabellen-Keys, die auf einen Matrix-Key zeigen: die Casting-Liste heisst
// in DB und ActionConfig 'creator_auswahl', in der Matrix 'sourcing'.
// Call-Sites duerfen beide Keys nutzen — der Lookup normalisiert.
const ENTITY_ALIASES = {
  creator_auswahl: 'sourcing',
  // Feld-Locks sprechen die DB-/UI-Keys an (video, versand), die Matrix
  // kennt nur die Entity-Keys (videos, kooperation).
  video: 'videos',
  versand: 'kooperation',
};

function resolveEntityKey(entity) {
  return ENTITY_ALIASES[entity] || entity;
}

// --- Rollen-Matrix (benutzer.rolle) ---

const BASE_PERMISSIONS = {
  admin: allOf(T),

  mitarbeiter: {
    ...allOf(T),
    unternehmen:    { can_view: true, can_create: false, can_edit: false, can_delete: true },
    marke:          { can_view: true, can_create: false, can_edit: false, can_delete: true },
    auftrag:        { ...F },
    auftragsdetails:{ can_view: true, can_create: false, can_edit: false, can_delete: true },
    rechnung:       { can_view: true, can_create: true,  can_edit: true,  can_delete: false },
    dashboard:      { ...V },
    tasks:          { can_view: true, can_create: false, can_edit: false, can_delete: true },
    mitarbeiter:    { ...F },
    'kunden-admin': { ...F },
    contracts:      { ...F },
  },

  kunde: {
    ...allOf(F),
    produkt:     { ...V },
    auftrag:     { ...V },
    kampagne:    { ...V },
    kooperation: { ...V },
    briefing:    { ...V },
    skripte:     { ...V },
    videos:      { ...V },
    dashboard:   { ...V },
    tasks:       viewEdit(),
    strategie:   viewEdit(),
    sourcing:    { ...V },
    contracts:   { ...V },
  },

  // Investor: volle Plattform lesen, ohne Schreiben und ohne Verwaltung.
  investor: {
    ...allOf(V),
    mitarbeiter:    { ...F },
    'kunden-admin': { ...F },
    feedback:       { ...F },
  },
};

// kunde_editor ist aktuell identisch mit kunde; spaeter koennen hier Abweichungen definiert werden
BASE_PERMISSIONS.kunde_editor = { ...BASE_PERMISSIONS.kunde };

// gast: Zugang nur ueber geteilte Listen (list_shares). Sieht ausschliesslich
// die per Share-Link freigegebene Entitaet; Schreibrechte steuert der Share
// selbst (rechte: 'ansehen' | 'feedback'), nicht diese Matrix.
BASE_PERMISSIONS.gast = {
  ...allOf(F),
  kampagne:    { ...V },
  kooperation: { ...V },
  videos:      { ...V },
  sourcing:    { ...V },
  strategie:   { ...V },
  skripte:     { ...V },
};

const DEFAULT_PERMISSIONS = {
  ...allOf(F),
  dashboard: { ...V },
  feedback:  { ...V },
};

const PENDING_PERMISSIONS = {
  ...allOf(F),
  dashboard: { ...V },
};

// --- Klassen-Matrix (mitarbeiter_klasse.name → Zeile) ---
// Klasse ist die Startzeile, kein hartes Preset mehr: zugriffsrechte-Overrides
// des Users gelten auch hier (sie schlagen die Klassen-Zeile, Q2 = B).
//
// Finanzen = die Investor-Klasse: wie rolle='investor' volle Plattform lesen,
// view-only, ohne Verwaltung, sieht Preise (canSeePricing via isInvestor).
const KLASSE_PERMISSIONS = {
  finanzen: {
    ...allOf(V),
    mitarbeiter:    { ...F },
    'kunden-admin': { ...F },
    feedback:       { ...F },
  },
};

// Feature-Matrix
// Dinge, die kein Entity-Write sind (Sichtbarkeit von Kontaktdaten, Tabellen-
// Werkzeuge, Uploads, Kommentar-Funktion). Eine Zeile pro Rolle/Klasse —
// eine neue Rolle bekommt die Eigenschaften hier zugeschrieben, nicht in
// den Renderern. Klasse schlaegt Rolle (wie bei den Entity-Permissions).
// Features: contactMail, kampagneTableFilter, kampagneTableLayout,
// mediaUpload, skriptKommentieren.
const FEATURE_MATRIX = {
  admin:         { contactMail: true,  kampagneTableFilter: true,  kampagneTableLayout: true,  mediaUpload: true,  skriptKommentieren: true  },
  mitarbeiter:   { contactMail: true,  kampagneTableFilter: true,  kampagneTableLayout: true,  mediaUpload: true,  skriptKommentieren: true  },
  // Kunde: sieht Mails, filtert die Kampagnen-Tabelle und kommentiert Skripte;
  // Layout-Werkzeuge und Uploads bleiben intern.
  kunde:         { contactMail: true,  kampagneTableFilter: true,  kampagneTableLayout: false, mediaUpload: false, skriptKommentieren: true  },
  kunde_editor:  { contactMail: true,  kampagneTableFilter: true,  kampagneTableLayout: false, mediaUpload: false, skriptKommentieren: true  },
  gast:          { contactMail: true,  kampagneTableFilter: true,  kampagneTableLayout: false, mediaUpload: false, skriptKommentieren: true  },
  investor:      { contactMail: false, kampagneTableFilter: false, kampagneTableLayout: false, mediaUpload: false, skriptKommentieren: false },
  pending:       { contactMail: false, kampagneTableFilter: false, kampagneTableLayout: false, mediaUpload: false, skriptKommentieren: false },
};

// Finanzen-Klasse = Investor-Zeile (gleiche Einschraenkungen).
const KLASSE_FEATURES = {
  finanzen: FEATURE_MATRIX.investor,
};

// --- Feld-Editierbarkeit ---
// Kunden-Denylist: Kunden duerfen diese Felder nie pflegen (bisher in
// KampagneKooperationenVideoTable.isFieldEditableForUser).
const KUNDE_READONLY_FIELDS = {
  kooperation: ['vertrag_unterschrieben', 'typ', 'nutzungsrechte', 'status_id'],
  versand: ['versendet', 'tracking_nummer', 'produkt_name', 'produkt_link'],
  video: [
    'thema', 'link_produkte', 'link_skript',
    'caption', 'posting_datum', 'drehort', 'content_art', 'video_name',
    // Live-Performance ist Reporting: Kunden sehen die Zahlen, pflegen sie aber nicht
    'link_live', 'stats_views', 'stats_likes', 'stats_comments'
  ],
};

// FIELD_LOCKS[rolle][entity]: Felder, die eine Rolle trotz Entity-Edit-Recht
// nicht aendern darf. Investor hat ohnehin kein Entity-Edit — die Locks sind
// fuer kuenftige Rollen, die schreiben duerfen, aber einzelne Spalten nicht.
const FIELD_LOCKS = {};

function resolveKlasseName(user) {
  const raw = user?.mitarbeiter_klasse?.name ?? user?.mitarbeiter_klasse_name ?? '';
  return String(raw).trim();
}

function klasseKey(user) {
  const name = resolveKlasseName(user).toLowerCase();
  return KLASSE_PERMISSIONS[name] ? name : null;
}

// --- Permission System Klasse ---

export class PermissionSystem {
  constructor() {
    this.userPermissions = {};
    this.userRole = null;
    this._normalizedRole = '';
    this._klasseKey = null;
    this.calculatedPermissions = {};
    this.pagePermissions = {};
    this.tablePermissions = {};
  }

  // ============================================
  // Rollen-Helper (gecacht ueber _normalizedRole)
  // ============================================

  get isAdmin()       { return this._normalizedRole === 'admin'; }
  // Gast zaehlt bewusst als "Kunde" fuer Rendering-Pfade (Preise verstecken,
  // Kunden-Feedback-Felder, ausgeblendete Admin-Aktionen). Feinsteuerung
  // (readonly vs. feedback) laeuft ueber isGastReadonly / window.guestShare.
  get isKunde()       { return this._normalizedRole === 'kunde' || this._normalizedRole === 'kunde_editor' || this.isGast; }
  get isGast()        { return this._normalizedRole === 'gast'; }
  get isGastReadonly() { return this.isGast && window.guestShare?.rechte !== 'feedback'; }
  get isKundeEditor() { return this._normalizedRole === 'kunde_editor'; }
  get isMitarbeiter() { return this._normalizedRole === 'mitarbeiter'; }
  get isPending()     { return this._normalizedRole === 'pending'; }
  get isInternal()    { return this.isAdmin || this.isMitarbeiter; }
  // Investor = eigene Rolle (rolle='investor', RLS-Wahrheit) ODER die
  // Finanzen-Klasse auf rolle=mitarbeiter. Beide Wege fuehren view-only.
  get isInvestor()    { return this._normalizedRole === 'investor' || this._klasseKey === 'finanzen'; }
  get isUnscoped()    { return this.isAdmin || this.isKunde || this.isInvestor || !!this._klasseKey; }

  // Feature-basierte Checks (Capabilities)
  get canSeePricing()      { return this.isInternal || this.isInvestor; }
  get canManageStaff()     { return this.isAdmin; }
  get canBulkDelete()      { return this.isInternal && !this._klasseKey; }
  get canCreateProject()   { return this.isInternal && !this._klasseKey; }
  get canUseGlobalSearch() { return !this.isPending; }
  get canViewAccounting()  { return this.isAdmin || this.isInvestor; }
  get canViewContracts() {
    if (this.isAdmin || this.isInvestor) return true;
    if (this.isKunde) return !!window.currentUser?.contracting_sicht;
    return false;
  }

  // Feature-Matrix: Klasse schlaegt Rolle, sonst Rolle, sonst alles false.
  canFeature(name) {
    if (this.isAdmin && !this._klasseKey) return true;
    if (!this._normalizedRole) return false;
    const row = (this._klasseKey && KLASSE_FEATURES[this._klasseKey])
      || FEATURE_MATRIX[this._normalizedRole];
    return !!row?.[name];
  }

  // Feld-Editierbarkeit: erst Rollen-Locks, dann Entity-Edit, dann die
  // Kunden-Denylist. Investor faellt ueber canEdit(entity) raus.
  canEditField(entity, field) {
    if (this.isAdmin && !this._klasseKey) return true;
    if (!this._normalizedRole) return false;
    if (this.isGastReadonly) return false;
    if (FIELD_LOCKS[this._normalizedRole]?.[entity]?.includes(field)) return false;
    if (this.isKunde) {
      return !KUNDE_READONLY_FIELDS[entity]?.includes(field);
    }
    return this.canEdit(entity);
  }

  // ============================================
  // Benutzer-Berechtigungen setzen
  // ============================================

  setUserPermissions(user) {
    this.userRole = user.rolle;
    this._normalizedRole = String(user.rolle || '').trim().toLowerCase();
    this.userPermissions = user.zugriffsrechte || {};
    this._klasseKey = klasseKey(user);

    // Klasse (falls vorhanden) ist die Startzeile, sonst die Rolle.
    let calculatedPermissions = this._klasseKey
      ? structuredClone(KLASSE_PERMISSIONS[this._klasseKey])
      : this.getPermissionsByRole(this._normalizedRole);

    // Overrides gelten immer — auch ueber einer Klasse (Admin-Toggle schlaegt Klasse).
    if (user?.zugriffsrechte && typeof user.zugriffsrechte === 'object') {
      calculatedPermissions = this.applyOverrides(calculatedPermissions, user.zugriffsrechte);
    }

    this.calculatedPermissions = calculatedPermissions;
    user.permissions = calculatedPermissions;

    if (window.currentUser) {
      window.currentUser.permissions = calculatedPermissions;
    }

    console.debug('🔐 Berechtigungen gesetzt:', { role: this.userRole, klasse: this._klasseKey, permissions: calculatedPermissions });
  }

  // ============================================
  // Rollen-Matrix auflösen
  // ============================================

  getPermissionsByRole(normalizedRole) {
    if (normalizedRole === 'pending') return structuredClone(PENDING_PERMISSIONS);
    const matrix = BASE_PERMISSIONS[normalizedRole];
    if (matrix) return structuredClone(matrix);
    return structuredClone(DEFAULT_PERMISSIONS);
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
      if (!cloned[key]) cloned[key] = { can_view: false, can_create: false, can_edit: false, can_delete: false };
      const ov = overrides[key];
      if (typeof ov === 'boolean') { cloned[key].can_view = ov; continue; }
      if (ov && typeof ov === 'object') {
        if (typeof ov.can_view === 'boolean') cloned[key].can_view = ov.can_view;
        if (typeof ov.can_create === 'boolean') cloned[key].can_create = ov.can_create;
        if (typeof ov.can_edit === 'boolean') cloned[key].can_edit = ov.can_edit;
        if (typeof ov.can_delete === 'boolean') cloned[key].can_delete = ov.can_delete;
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
  // Capability-Interface (das einzige, was Call-Sites brauchen)
  // ============================================

  // can('kampagne', 'create') — versteckt den Button, blockt die Route.
  // Akzeptiert 'view' | 'can_view' | 'create' | 'edit' | 'delete'.
  can(entity, verb) {
    if (this.isAdmin) return true;
    if (!this._normalizedRole) return false;
    const v = String(verb || '').replace(/^can_/, '');
    return !!this.calculatedPermissions?.[resolveEntityKey(entity)]?.[`can_${v}`];
  }

  canView(entity)   { return this.can(entity, 'view'); }
  canCreate(entity) { return this.can(entity, 'create'); }
  canEdit(entity) {
    if (this.isAdmin) return true;
    if (!this._normalizedRole) return false;
    const key = resolveEntityKey(entity);
    // Page-Scoped Override aus DB schlaegt die Matrix.
    const pageOverride = this.pagePermissions?.[key]?.can_edit;
    if (typeof pageOverride === 'boolean') return pageOverride;
    return !!this.calculatedPermissions?.[key]?.can_edit;
  }
  canDelete(entity) { return this.can(entity, 'delete'); }

  // Anlegen = create, wobei aeltere Matrizen create noch nicht kennen:
  // dann zaehlt edit als Create (Abwaertskompatibilitaet waehrend Migration).
  canCreateOrEdit(entity) {
    const perms = this.calculatedPermissions?.[entity];
    if (perms && typeof perms.can_create === 'boolean') return this.canCreate(entity);
    return this.canEdit(entity);
  }

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

    const key = resolveEntityKey(entity);

    // Normalisierung: sowohl 'view' als auch 'can_view' akzeptieren
    const normalized = action.startsWith('can_') ? action.slice(4) : action;

    // Page-Scoped Override aus DB
    if (normalized === 'view') {
      const pageOverride = this.pagePermissions?.[key]?.can_view;
      if (typeof pageOverride === 'boolean') return pageOverride;
    }

    const entityPermissions = this.calculatedPermissions?.[key];
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
    return this.calculatedPermissions?.[resolveEntityKey(entity)] || null;
  }

  // ============================================
  // Lifecycle
  // ============================================

  clearPermissions() {
    this.userPermissions = {};
    this.userRole = null;
    this._normalizedRole = '';
    this._klasseKey = null;
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

  // Capability-Interface
  window.can       = (entity, verb) => permissionSystem.can(entity, verb);
  window.canView   = (entity) => permissionSystem.canView(entity);
  window.canCreate = (entity) => permissionSystem.canCreateOrEdit(entity);
  window.canEdit   = (entity) => permissionSystem.canEdit(entity);
  window.canDelete = (entity) => permissionSystem.canDelete(entity);

  // Rollen-Helper (fuer Pricing-/Scoping-Fragen, nicht fuer Write-Gates)
  window.isAdmin        = () => permissionSystem.isAdmin;
  window.isKunde        = () => permissionSystem.isKunde;
  window.isGast         = () => permissionSystem.isGast;
  window.isGastReadonly = () => permissionSystem.isGastReadonly;
  window.isKundeEditor  = () => permissionSystem.isKundeEditor;
  window.isMitarbeiter  = () => permissionSystem.isMitarbeiter;
  window.isInvestor     = () => permissionSystem.isInvestor;
  window.isPending      = () => permissionSystem.isPending;
  window.isInternal     = () => permissionSystem.isInternal;
  window.isUnscoped     = () => permissionSystem.isUnscoped;

  // Feature-basierte Capabilities
  window.canSeePricing      = () => permissionSystem.canSeePricing;
  window.canManageStaff     = () => permissionSystem.canManageStaff;
  window.canBulkDelete      = () => permissionSystem.canBulkDelete;
  window.canCreateProject   = () => permissionSystem.canCreateProject;
  window.canUseGlobalSearch = () => permissionSystem.canUseGlobalSearch;
  window.canViewAccounting  = () => permissionSystem.canViewAccounting;
  window.canViewContracts   = () => permissionSystem.canViewContracts;
  window.canFeature         = (name) => permissionSystem.canFeature(name);
  window.canEditField       = (entity, field) => permissionSystem.canEditField(entity, field);

  window.permissionSystem = permissionSystem;
}
