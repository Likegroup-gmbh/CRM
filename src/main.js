import { CONFIG } from './core/ConfigSystem.js';
import { modularFilterSystem as filterSystem } from './core/filters/ModularFilterSystem.js';
import { creatorList } from './modules/creator/CreatorList.js';
import { creatorListPage } from './modules/creator/CreatorListPage.js';
import { creatorDetail } from './modules/creator/CreatorDetail.js';
import { creatorListDetail } from './modules/creator/CreatorListDetail.js';
import { unternehmenList } from './modules/unternehmen/UnternehmenList.js';
import { unternehmenCreate } from './modules/unternehmen/UnternehmenCreate.js';
import { auftragList } from './modules/auftrag/AuftragList.js';
import { markeList } from './modules/marke/MarkeList.js';
import { markeDetail } from './modules/marke/MarkeDetail.js';
import { markeCreate } from './modules/marke/MarkeCreate.js';
import { authService } from './modules/auth/AuthService.js';
import { authUtils } from './modules/auth/AuthUtils.js';
import { navigationSystem } from './modules/navigation/NavigationSystem.js';
import { permissionSystem } from './core/PermissionSystem.js';
import { dataService } from './core/DataService.js';
import { validatorSystem } from './core/ValidatorSystem.js';
import { creatorUtils } from './modules/creator/CreatorUtils.js';
import { formSystem } from './core/FormSystem.js';
import { notizenSystem } from './core/NotizenSystem.js';
import { bewertungsSystem } from './core/BewertungsSystem.js';
import { unternehmenDetail } from './modules/unternehmen/UnternehmenDetail.js';
import { auftragDetail } from './modules/auftrag/AuftragDetail.js';
import { kooperationList } from './modules/kooperation/KooperationList.js';
import { kooperationDetail } from './modules/kooperation/KooperationDetail.js';
import { kooperationVideoDetail } from './modules/kooperation/KooperationVideoDetail.js';
import { kampagneList } from './modules/kampagne/KampagneList.js';
import { kampagneDetail } from './modules/kampagne/KampagneDetail.js';
import { kampagneUtils } from './modules/kampagne/KampagneUtils.js';
import { briefingList } from './modules/briefing/BriefingList.js';
import { briefingDetail } from './modules/briefing/BriefingDetail.js';
import { ansprechpartnerList } from './modules/ansprechpartner/AnsprechpartnerList.js';
import { ansprechpartnerDetail } from './modules/ansprechpartner/AnsprechpartnerDetail.js';
import { ansprechpartnerCreate } from './modules/ansprechpartner/AnsprechpartnerCreate.js';
import { rechnungList } from './modules/rechnung/RechnungList.js';
import { rechnungDetail } from './modules/rechnung/RechnungDetail.js';
import { actionsDropdown } from './core/ActionsDropdown.js';
import { mitarbeiterList } from './modules/admin/MitarbeiterList.js';
import { mitarbeiterDetail } from './modules/admin/MitarbeiterDetail.js';
import { bulkActionSystem } from './core/BulkActionSystem.js';
import { notificationSystem } from './core/NotificationSystem.js';
// main.js - Haupt-Einstiegspunkt für ES6-Module

// Zentrale Modul-Registry (Event-basiert)
class ModuleRegistry {
  constructor() {
    this.modules = new Map();
    this.currentModule = null;
  }

  // Modul registrieren
  register(name, module) {
    this.modules.set(name, module);
    if (import.meta.env.DEV) {
      console.log(`📦 Modul registriert: ${name}`);
    }
  }

  // Navigation zu Modul
  navigateTo(route) {
    const path = route.replace(/^\//, '');
    const [segment, id] = path.split('/');

    if (import.meta.env.DEV) {
      console.log(`🧭 Navigation zu: ${segment}${id ? ` (ID: ${id})` : ''}`);
      console.log(`🔍 Verfügbare Module:`, Array.from(this.modules.keys()));
      console.log(`🎯 Gesuchtes Modul: ${segment}`);
    }

    // Cleanup aktuelles Modul
    if (this.currentModule && this.currentModule.destroy) {
      console.log(`🗑️ Zerstöre aktuelles Modul:`, this.currentModule.constructor.name);
      this.currentModule.destroy();
      this.currentModule = null;
    }

    // Neues Modul laden
    let moduleKey = segment;
    let module = this.modules.get(moduleKey);
    
    // Spezielle Behandlung für Creator-Details (aber nicht für 'new')
    if (id && segment === 'creator' && id !== 'new') {
      moduleKey = 'creator-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Creator-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    // Detailseite für Creator-Listen: /creator-lists/:id
    if (segment === 'creator-lists' && id) {
      moduleKey = 'creator-list-detail';
      module = this.modules.get(moduleKey);
      console.log('🎯 Creator-Listen-Detail erkannt');
    }

    // Spezielle Behandlung für Mitarbeiter-Details
    if (id && segment === 'mitarbeiter' && id !== 'new') {
      moduleKey = 'mitarbeiter-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Mitarbeiter-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    // Spezielle Behandlung für Marken-Details (aber nicht für 'new')
    if (id && segment === 'marke' && id !== 'new') {
      moduleKey = 'marke-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Marken-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    // Spezielle Behandlung für Unternehmen-Erstellung
    if (id === 'neu' && segment === 'unternehmen') {
      moduleKey = 'unternehmen-create';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Unternehmen-Erstellung erkannt, verwende Modul: ${moduleKey}`);
    }
    // Spezielle Behandlung für Unternehmen-Details (aber nicht für 'new')
    else if (id && segment === 'unternehmen' && id !== 'new' && id !== 'neu') {
      moduleKey = 'unternehmen-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Unternehmen-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    // Spezielle Behandlung für Auftrags-Details (aber nicht für 'new')
    if (id && segment === 'auftrag' && id !== 'new') {
      moduleKey = 'auftrag-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Auftrags-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    // Spezielle Behandlung für Kooperations-Details (aber nicht für 'new')
    if (id && segment === 'kooperation' && id !== 'new') {
      moduleKey = 'kooperation-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Kooperations-Details erkannt, verwende Modul: ${moduleKey}`);
    }

    // Route: /video/:id → Kooperation-Video-Detail
    if (id && segment === 'video' && id !== 'new') {
      moduleKey = 'kooperation-video-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Video-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    // Spezielle Behandlung für Kampagnen-Details (aber nicht für 'new')
    if (id && segment === 'kampagne' && id !== 'new') {
      moduleKey = 'kampagne-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Kampagnen-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    // Spezielle Behandlung für Briefing-Details (aber nicht für 'new')
    if (id && segment === 'briefing' && id !== 'new') {
      moduleKey = 'briefing-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Briefing-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    // Spezielle Behandlung für Rechnung-Details (aber nicht für 'new')
    if (id && segment === 'rechnung' && id !== 'new') {
      moduleKey = 'rechnung-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Rechnung-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    // Spezielle Behandlung für Ansprechpartner-Details und -Erstellung
    if (id && segment === 'ansprechpartner') {
      moduleKey = 'ansprechpartner-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Ansprechpartner-Details/Erstellung erkannt, verwende Modul: ${moduleKey}`);
    }
    
    if (module) {
      console.log(`✅ Modul gefunden: ${moduleKey}`, module);
      this.currentModule = module;

      // Spezielle Routen behandeln
      if (id === 'new') {
        // Für Rechnungen Erstellungs-Route direkt auf Detail-Modul routen
        if (segment === 'rechnung') {
          moduleKey = 'rechnung-detail';
          module = this.modules.get(moduleKey);
          return module.init?.('new');
        }
        console.log(`📝 Zeige Erstellungsformular für: ${segment}`);
        // Für Detail-Module verwende init('new'), für List-Module verwende showCreateForm()
        if (moduleKey.includes('-detail')) {
          return module.init?.('new');
        } else {
          return module.showCreateForm?.();
        }
      } else if (id) {
        console.log(`👁️ Zeige Details für: ${segment}/${id}`);
        return module.init?.(id);
      } else {
        console.log(`🚀 Initialisiere Modul: ${segment}`);
        return module.init();
      }
    } else {
      console.warn(`❌ Modul nicht gefunden: ${moduleKey}`);
      this.loadDashboard();
    }
  }

  // Dashboard laden
  loadDashboard() {
    window.setHeadline('Dashboard');
    window.content.innerHTML = `
      <div class="dashboard">
        <h1>Willkommen im CRM</h1>
        <p>Dashboard wird geladen...</p>
      </div>
    `;
  }
}

// Globale Modul-Registry erstellen
const moduleRegistry = new ModuleRegistry();
window.moduleRegistry = moduleRegistry;

  // Module registrieren
  moduleRegistry.register('creator', creatorList);
  moduleRegistry.register('creator-detail', creatorDetail);
  moduleRegistry.register('creator-lists', creatorListPage);
  moduleRegistry.register('creator-list-detail', creatorListDetail);
  moduleRegistry.register('unternehmen', unternehmenList);
  moduleRegistry.register('unternehmen-create', unternehmenCreate);
  moduleRegistry.register('auftrag', auftragList);
  moduleRegistry.register('marke', markeList);
  moduleRegistry.register('marke-detail', markeDetail);
  moduleRegistry.register('marke-create', markeCreate);
  moduleRegistry.register('unternehmen-detail', unternehmenDetail);
  moduleRegistry.register('auftrag-detail', auftragDetail);
  moduleRegistry.register('kooperation', kooperationList);
  moduleRegistry.register('kooperation-detail', kooperationDetail);
  moduleRegistry.register('kooperation-video-detail', kooperationVideoDetail);
  moduleRegistry.register('kampagne', kampagneList);
  moduleRegistry.register('kampagne-detail', kampagneDetail);
  moduleRegistry.register('ansprechpartner', ansprechpartnerList);
  moduleRegistry.register('ansprechpartner-detail', ansprechpartnerDetail);
  moduleRegistry.register('ansprechpartner-create', ansprechpartnerCreate);
  moduleRegistry.register('briefing', briefingList);
  moduleRegistry.register('briefing-detail', briefingDetail);
  moduleRegistry.register('rechnung', rechnungList);
  moduleRegistry.register('rechnung-detail', rechnungDetail);
  moduleRegistry.register('mitarbeiter', mitarbeiterList);
  moduleRegistry.register('mitarbeiter-detail', mitarbeiterDetail);
  moduleRegistry.register('profile', profileDetail);
// Weitere Module folgen...

// Globale Navigation-Funktion
window.navigateTo = (route) => {
  moduleRegistry.navigateTo(route);
};

// Vorab keine Client-Initialisierung – erfolgt sauber nach DOMContentLoaded mit echten Keys

// Globale Verfügbarkeit für bestehende Kompatibilität
window.filterSystem = filterSystem;
window.creatorList = creatorList;
window.creatorDetail = creatorDetail;
window.unternehmenList = unternehmenList;
window.unternehmenCreate = unternehmenCreate;
window.auftragList = auftragList;
window.markeList = markeList;
window.markeDetail = markeDetail;
window.markeCreate = markeCreate;
window.unternehmenDetail = unternehmenDetail;
window.auftragDetail = auftragDetail;
window.kooperationList = kooperationList;
window.kooperationDetail = kooperationDetail;
window.kooperationVideoDetail = kooperationVideoDetail;
window.kampagneList = kampagneList;
window.kampagneDetail = kampagneDetail;
  window.briefingDetail = briefingDetail;
  window.kampagneUtils = kampagneUtils;
  window.briefingList = briefingList;
window.AuthService = authService;
window.AuthUtils = authUtils;
window.authService = authService;
window.authUtils = authUtils;
window.navigationSystem = navigationSystem;
window.permissionSystem = permissionSystem;
window.dataService = dataService;
window.validatorSystem = validatorSystem;
window.creatorUtils = creatorUtils;
window.formSystem = formSystem;
window.notizenSystem = notizenSystem;
window.bewertungsSystem = bewertungsSystem;
window.ActionsDropdown = actionsDropdown;
window.bulkActionSystem = bulkActionSystem;
window.notificationSystem = notificationSystem;
window.ansprechpartnerList = ansprechpartnerList;
window.ansprechpartnerDetail = ansprechpartnerDetail;
window.ansprechpartnerCreate = ansprechpartnerCreate;

// Profile-System importieren
import { profileDetail } from './modules/admin/ProfileDetail.js';

// Initialisiere das System
if (import.meta.env.DEV) {
  console.log('🚀 ES6-Module System geladen');
  console.log('FilterSystem:', filterSystem);
  console.log('CreatorList:', creatorList);
  console.log('CreatorDetail:', creatorDetail);
  console.log('UnternehmenList:', unternehmenList);
  console.log('MarkeList:', markeList);
  console.log('AuthService:', authService);
  console.log('AuthUtils:', authUtils);
  console.log('NavigationSystem:', navigationSystem);
  console.log('PermissionSystem:', permissionSystem);
  console.log('DataService:', dataService);
  console.log('ValidatorSystem:', validatorSystem);
  console.log('CreatorUtils:', creatorUtils);
  console.log('FormSystem:', formSystem);
  console.log('NotizenSystem:', notizenSystem);
  console.log('BewertungsSystem:', bewertungsSystem);
  console.log('ActionsDropdown:', actionsDropdown);
  console.log('KampagneList:', kampagneList);
  console.log('KampagneDetail:', kampagneDetail);
  console.log('KampagneUtils:', kampagneUtils);
  console.log('ProfileDetail:', profileDetail);
}

// Initialisiere nach DOM-Load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎯 Initialisiere Event-basiertes Modul-System...');

  // Globale DOM-Variablen setzen
  window.appRoot = document.getElementById('app-root');
  window.loginRoot = document.getElementById('login-root');
  window.content = document.getElementById('dashboard-content');
  window.nav = document.getElementById('main-nav');

  // Supabase initialisieren
  if (window.supabase && window.CONFIG?.SUPABASE?.URL && window.CONFIG?.SUPABASE?.KEY) {
    try {
      window.supabase = window.supabase.createClient(
        window.CONFIG.SUPABASE.URL,
        window.CONFIG.SUPABASE.KEY
      );
      console.log('✅ Supabase initialisiert');
    } catch (error) {
      console.error('❌ Supabase-Initialisierung fehlgeschlagen:', error);
    }
  } else {
    console.warn('⚠️ Supabase nicht verfügbar - verwende Offline-Modus');
  }

  // Auth-Check durchführen
  const isAuthenticated = await authService.checkAuth();
  
  if (isAuthenticated) {
    console.log('✅ Benutzer ist authentifiziert');
    
    // Navigation initialisieren
    navigationSystem.init();
    
    // ActionsDropdown initialisieren
    actionsDropdown.init();
    
    // BulkActionSystem initialisieren
    bulkActionSystem.init();
    // NotificationSystem initialisieren
    notificationSystem.init();
    
    // App anzeigen
    window.appRoot.style.display = '';
    window.loginRoot.style.display = 'none';
    
    // Starte mit Dashboard oder aktuelle Route
    const currentRoute = location.pathname;
    if (currentRoute === '/' || currentRoute === '/dashboard') {
      moduleRegistry.loadDashboard();
    } else {
      moduleRegistry.navigateTo(currentRoute);
    }

    // Header/UI-Setup (Initialen, Quick-Menu etc.)
    window.setupHeaderUI?.();
  } else {
    console.log('🔐 Benutzer nicht authentifiziert - zeige Login');
    authUtils.showLogin();
  }
}); 

// Einheitlicher Logout-Handler für die Topbar
window.handleLogout = async () => {
  try {
    await authService.signOut();
  } catch (e) {
    console.warn('Logout warn:', e);
  } finally {
    // UI zurück auf Login
    if (window.appRoot) window.appRoot.style.display = 'none';
    if (window.loginRoot) window.loginRoot.style.display = '';
    // Verhindere, dass Panels vom vorherigen State sichtbar bleiben
    const mitarbeiterOverlay = document.getElementById('mitarbeiterPanelOverlay');
    const mitarbeiterPanel = document.getElementById('mitarbeiterPanel');
    if (mitarbeiterOverlay) mitarbeiterOverlay.style.display = 'none';
    if (mitarbeiterPanel) mitarbeiterPanel.style.display = 'none';
    authUtils.showLogin?.();
  }
};

// Kapselt das Header/Quick-Menu Setup, damit es nach Login sofort läuft
window.setupHeaderUI = () => {
  try {
    const profileImg = document.querySelector('.profile-img');
    const profileInitials = document.querySelector('.profile-initials');
    const userName = (window.currentUser?.name || '').trim();
    if (userName && profileInitials) {
      const parts = userName.split(/\s+/).filter(Boolean);
      const initials = (parts[0]?.[0] || '').toUpperCase() + (parts[1]?.[0] || '').toUpperCase();
      profileInitials.textContent = initials || (userName[0] || '?').toUpperCase();
    }
    if (window.currentUser?.avatar_url && profileImg) {
      profileImg.src = window.currentUser.avatar_url;
      profileImg.style.display = '';
      if (profileInitials) profileInitials.style.display = 'none';
    }

    // Profile dropdown setup
    const profileBtn = document.querySelector('.profile-btn');
    const profileDropdown = document.querySelector('.profile-dropdown');
    if (profileBtn && profileDropdown && !profileBtn.dataset.bound) {
      profileBtn.dataset.bound = 'true';
      
      // Toggle dropdown
      profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = profileDropdown.getAttribute('aria-hidden') === 'false';
        profileDropdown.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
        profileBtn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      });

      // Profile actions
      profileDropdown.addEventListener('click', (e) => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (!action) return;
        
        e.preventDefault();
        profileDropdown.setAttribute('aria-hidden', 'true');
        profileBtn.setAttribute('aria-expanded', 'false');
        
        if (action === 'view-profile') {
          window.navigateTo('/profile');
        } else if (action === 'logout') {
          window.authService?.logout();
        }
      });

      // Close on outside click
      document.addEventListener('click', () => {
        profileDropdown.setAttribute('aria-hidden', 'true');
        profileBtn.setAttribute('aria-expanded', 'false');
      });
    }

    const quickBtn = document.querySelector('.quick-menu-btn');
    const quickDropdown = document.querySelector('.quick-menu-dropdown');
    if (quickBtn && quickDropdown && !quickBtn.dataset.bound) {
      const closeAll = () => {
        quickDropdown.classList.remove('show');
        quickBtn.setAttribute('aria-expanded', 'false');
      };
      quickBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const open = quickDropdown.classList.toggle('show');
        quickBtn.setAttribute('aria-expanded', String(open));
      });
      document.addEventListener('click', (e) => {
        if (!quickDropdown.contains(e.target) && !quickBtn.contains(e.target)) {
          closeAll();
        }
      });
      // Sichtbarkeit der Einträge gemäß can_edit prüfen
      const map = {
        unternehmen: 'unternehmen',
        marke: 'marke',
        auftrag: 'auftrag',
        ansprechpartner: 'ansprechpartner',
        kampagne: 'kampagne',
        briefing: 'briefing',
        kooperation: 'kooperation',
        creator: 'creator'
      };
      quickDropdown.querySelectorAll('.quick-menu-item').forEach(btn => {
        const entity = btn.getAttribute('data-entity');
        const permKey = map[entity];
        const canEdit = permKey ? !!window.permissionSystem?.getEntityPermissions(permKey)?.can_edit : false;
        btn.style.display = canEdit || window.currentUser?.rolle === 'admin' ? '' : 'none';
      });

      quickDropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.quick-menu-item');
        if (!item) return;
        const entity = item.getAttribute('data-entity');
        if (!entity) return;
        switch (entity) {
          case 'unternehmen':
            window.navigateTo('/unternehmen/neu');
            break;
          case 'marke':
            window.navigateTo('/marke/new');
            break;
          case 'auftrag':
            window.navigateTo('/auftrag/new');
            break;
          case 'ansprechpartner':
            window.navigateTo('/ansprechpartner/new');
            break;
          case 'kampagne':
            window.navigateTo('/kampagne/new');
            break;
          case 'briefing':
            window.navigateTo('/briefing/new');
            break;
          case 'kooperation':
            window.navigateTo('/kooperation/new');
            break;
          case 'creator':
            window.navigateTo('/creator/new');
            break;
        }
        closeAll();
      });
      quickBtn.dataset.bound = 'true';
    }
  } catch (err) {
    console.warn('Header/Quick-Menu setup warn:', err);
  }
};