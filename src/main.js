// CSS Imports - müssen für Vite-Build hier sein
import '../assets/styles/variables.css';
import '../assets/styles/base.css';
import '../assets/styles/layout.css';
import '../assets/styles/components.css';
import '../assets/styles/dashboard.css';
import '../assets/styles/addresses.css';
import '../assets/styles/tabellen.css';
import '../assets/styles/toast.css';

import { CONFIG } from './core/ConfigSystem.js';
import { modularFilterSystem as filterSystem } from './core/filters/ModularFilterSystem.js';
import { toastSystem } from './core/ToastSystem.js';
import { creatorList } from './modules/creator/CreatorList.js';
import { creatorListPage } from './modules/creator/CreatorListPage.js';
import { creatorDetail } from './modules/creator/CreatorDetail.js';
import { creatorListDetail } from './modules/creator/CreatorListDetail.js';
import { CreatorAdressenManager } from './modules/creator/CreatorAdressenManager.js';
import { unternehmenList } from './modules/unternehmen/UnternehmenList.js';
import { unternehmenCreate } from './modules/unternehmen/UnternehmenCreate.js';
import { auftragList } from './modules/auftrag/AuftragList.js';
import { auftragsdetailsList } from './modules/auftrag/AuftragsdetailsList.js';
import { auftragsdetailsDetail } from './modules/auftrag/AuftragsdetailsDetail.js';
import { auftragsdetailsCreate } from './modules/auftrag/AuftragsdetailsCreate.js';
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
import { actionRegistry } from './core/ActionRegistry.js';
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
import { kundenList } from './modules/admin/KundenList.js';
import { kundenDetail } from './modules/admin/KundenDetail.js';
import { kundenLanding } from './modules/kunden/KundenLanding.js';
import { kundenKampagneDetail } from './modules/kunden/KundenKampagneDetail.js';
import { kundenKooperationDetail } from './modules/kunden/KundenKooperationDetail.js';
import { bulkActionSystem } from './core/BulkActionSystem.js';
import { notificationSystem } from './core/NotificationSystem.js';
import { AvatarBubbles } from './core/components/AvatarBubbles.js';
import { dashboardModule } from './modules/dashboard/DashboardModule.js';
import { breadcrumbSystem } from './core/BreadcrumbSystem.js';
import { TaskDetailDrawer } from './modules/tasks/TaskDetailDrawer.js';
import { taskListPage } from './modules/tasks/TaskListPage.js';
import { tabellenModule } from './modules/tabellen/TabellenModule.js';
import { strategieList } from './modules/strategie/StrategieList.js';
import { strategieDetail } from './modules/strategie/StrategieDetail.js';
import { creatorAuswahlList } from './modules/creator-auswahl/CreatorAuswahlList.js';
import { creatorAuswahlDetail } from './modules/creator-auswahl/CreatorAuswahlDetail.js';
import { feedbackPage } from './modules/feedback/FeedbackPage.js';
// Zentrales Bestätigungs-Modal (side-effect Import, hängt window.confirmationModal an)
import './core/ConfirmationModal.js';
// Duplicate Checker für Creator, Marke, Unternehmen
import { DuplicateChecker } from './core/validation/DuplicateChecker.js';
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
    // Blockiere Navigation für nicht freigeschaltete Benutzer (außer Dashboard)
    if (window.currentUser?.isBlocked === true) {
      const allowedRoutes = ['/', '/dashboard', ''];
      const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
      if (!allowedRoutes.includes(normalizedRoute)) {
        console.log('🚫 Navigation blockiert: Benutzer nicht freigeschaltet');
        window.toastSystem?.show('Ihr Account wartet auf Freischaltung', 'warning');
        return; // Blockiere Navigation
      }
    }

    // URL aktualisieren (inkl. Query-String), damit searchParams verfügbar sind
    try {
      if (window.history && window.history.pushState) {
        const url = route.startsWith('/') ? route : `/${route}`;
        window.history.pushState({ route: url }, '', url);
      }
    } catch (_) {}

    // Kompatibilitäts-Redirects
    try {
      if (route.startsWith('/admin/kunden')) {
        // Mappe auf das einsegmentige Routing der App
        route = route.replace('/admin/kunden', '/kunden-admin');
      }
    } catch (_) {}

    const path = route.replace(/^\//, '');
    const pathParts = path.split('/');
    // ID von Query-Parametern trennen (z.B. "new?kampagne_id=123" → "new")
    const [segment, idRaw, action] = pathParts;
    const id = idRaw ? idRaw.split('?')[0] : idRaw;

    if (import.meta.env.DEV) {
      console.log(`🧭 Navigation zu: ${segment}${id ? ` (ID: ${id})` : ''}${action ? ` (Action: ${action})` : ''}`);
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
    let isEditMode = action === 'edit';
    
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

    // Spezielle Behandlung für Kunden-Admin-Details
    if (id && (segment === 'kunden-admin') && id !== 'new') {
      moduleKey = 'kunden-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Kunden-Admin-Details erkannt, verwende Modul: ${moduleKey}`);
    }

    // Kunden-Portal Detailseiten
    if (id && segment === 'kunden-kampagne' && id !== 'new') {
      moduleKey = 'kunden-kampagne-detail';
      module = this.modules.get(moduleKey);
      console.log('🎯 Kunden Kampagne-Detail erkannt');
    }
    if (id && segment === 'kunden-kooperation' && id !== 'new') {
      moduleKey = 'kunden-kooperation-detail';
      module = this.modules.get(moduleKey);
      console.log('🎯 Kunden Kooperation-Detail erkannt');
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
    
    // Spezielle Behandlung für Auftragsdetails-Erstellung (MUSS VOR auftrag kommen!)
    if (id === 'new' && segment === 'auftragsdetails') {
      moduleKey = 'auftragsdetails-create';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Auftragsdetails-Erstellung erkannt, verwende Modul: ${moduleKey}`);
    }
    // Spezielle Behandlung für Auftragsdetails-Details (MUSS VOR auftrag kommen!)
    else if (id && segment === 'auftragsdetails' && id !== 'new') {
      moduleKey = 'auftragsdetails-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Auftragsdetails-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    // Spezielle Behandlung für Auftrags-Details (aber nicht für 'new')
    else if (id && segment === 'auftrag' && id !== 'new') {
      moduleKey = 'auftrag-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Auftrags-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    // Spezielle Behandlung für Kooperations-Erstellung
    if (id === 'new' && segment === 'kooperation') {
      moduleKey = 'kooperation';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Kooperations-Erstellung erkannt, verwende Modul: ${moduleKey}`);
    }
    // Spezielle Behandlung für Kooperations-Details (aber nicht für 'new')
    else if (id && segment === 'kooperation' && id !== 'new') {
      moduleKey = 'kooperation-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Kooperations-Details erkannt, verwende Modul: ${moduleKey}`);
    }

    // Route: /video/:id → Kooperation-Video-Detail
    const idCleanForVideo = id ? id.split('?')[0] : id;
    if (idCleanForVideo && segment === 'video' && idCleanForVideo !== 'new') {
      moduleKey = 'kooperation-video-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Video-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    // Route: /video/new?kooperation=:id → Neues Video anlegen
    if (segment === 'video' && (!idCleanForVideo || idCleanForVideo === 'new')) {
      moduleKey = 'kooperation-video-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Video-Neuanlage erkannt, verwende Modul: ${moduleKey}`);
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
    
    // Spezielle Behandlung für Strategie-Details (aber nicht für 'new')
    if (id && segment === 'strategie' && id !== 'new') {
      moduleKey = 'strategie-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Strategie-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    // Spezielle Behandlung für Creator-Auswahl-Details (aber nicht für 'new')
    if (id && segment === 'creator-auswahl' && id !== 'new') {
      moduleKey = 'creator-auswahl-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Creator-Auswahl-Details erkannt, verwende Modul: ${moduleKey}`);
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
      const effectiveId = id ? id.split('?')[0] : id;
      if (effectiveId === 'new') {
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
      } else if (effectiveId) {
        if (isEditMode) {
          console.log(`✏️ Zeige Edit-Formular für: ${segment}/${id}`);
          // Für Edit-Modus: Lade Detail-Modul und zeige Edit-Formular
          if (module && module.init) {
            module.init(effectiveId).then(() => {
              // Nach dem Laden der Detail-Daten, zeige Edit-Formular
              if (module.showEditForm) {
                module.showEditForm();
              }
            });
            return;
          }
        } else {
          console.log(`👁️ Zeige Details für: ${segment}/${id}`);
          return module.init?.(effectiveId);
        }
      } else {
        console.log(`🚀 Initialisiere Modul: ${segment}`);
        return module.init();
      }
    } else {
      console.warn(`❌ Modul nicht gefunden: ${moduleKey} - bleibe auf aktueller Seite`);
      // NICHT zum Dashboard weiterleiten - User bleibt auf aktueller Seite
      // Das verhindert Datenverlust bei Multi-User-Updates
      return;
    }
  }

  // Dashboard laden
  loadDashboard() {
    const dashboardModule = this.modules.get('dashboard');
    if (dashboardModule) {
      this.currentModule = dashboardModule;
      dashboardModule.init();
    } else {
      window.setHeadline('Dashboard');
      window.content.innerHTML = `
        <div class="dashboard">
          <h1>Willkommen im CRM</h1>
          <p>Dashboard wird geladen...</p>
        </div>
      `;
    }
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
  moduleRegistry.register('auftragsdetails', auftragsdetailsList);
  moduleRegistry.register('auftragsdetails-detail', auftragsdetailsDetail);
  moduleRegistry.register('auftragsdetails-create', auftragsdetailsCreate);
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
  moduleRegistry.register('admin/kunden', kundenList);
  moduleRegistry.register('kunden-admin', kundenList);
  moduleRegistry.register('kunden-detail', kundenDetail);
  moduleRegistry.register('kunden', kundenLanding);
  moduleRegistry.register('kunden-kampagne-detail', kundenKampagneDetail);
  moduleRegistry.register('kunden-kooperation-detail', kundenKooperationDetail);
  moduleRegistry.register('dashboard', dashboardModule);
  moduleRegistry.register('tasks', taskListPage);
  moduleRegistry.register('tabellen', tabellenModule);
  moduleRegistry.register('strategie', strategieList);
  moduleRegistry.register('strategie-detail', strategieDetail);
  moduleRegistry.register('creator-auswahl', creatorAuswahlList);
  moduleRegistry.register('creator-auswahl-detail', creatorAuswahlDetail);
  moduleRegistry.register('feedback', feedbackPage);
  
  // Profile-Modul initialisieren und registrieren (V2 - neue Version mit zweispaltigem Layout)
  const profileDetailV2 = new ProfileDetailV2();
  window.profileDetailV2 = profileDetailV2;
  moduleRegistry.register('profile', profileDetailV2);
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
window.AvatarBubbles = AvatarBubbles;
window.formSystem = formSystem;
window.notizenSystem = notizenSystem;
window.bewertungsSystem = bewertungsSystem;
window.ActionsDropdown = actionsDropdown;
window.bulkActionSystem = bulkActionSystem;

// Duplicate Checker Service
window.duplicateChecker = new DuplicateChecker();
console.log('✅ DuplicateChecker initialisiert');
window.notificationSystem = notificationSystem;
window.ansprechpartnerList = ansprechpartnerList;
window.ansprechpartnerDetail = ansprechpartnerDetail;
window.ansprechpartnerCreate = ansprechpartnerCreate;
window.dashboardModule = dashboardModule;
window.breadcrumbSystem = breadcrumbSystem;

// Profile-System importieren
import { ProfileDetailV2 } from './modules/admin/ProfileDetailV2.js';

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
  console.log('ProfileDetailV2:', profileDetailV2);
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
      const { createClient } = window.supabase;
      window.supabase = createClient(
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

  // Password Recovery Flow abfangen - BEVOR Auth-Check
  // Wenn ein Recovery-Token in der URL ist, zur Reset-Seite weiterleiten
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const urlParams = new URLSearchParams(window.location.search);
  const isRecoveryFlow = hashParams.get('type') === 'recovery' || 
                         urlParams.get('type') === 'recovery' ||
                         window.location.hash.includes('type=recovery');
  
  if (isRecoveryFlow) {
    console.log('🔑 Password Recovery Flow erkannt - leite zur Reset-Seite weiter');
    // Token im Hash beibehalten für die Reset-Seite
    window.location.href = '/src/auth/reset-password.html' + window.location.hash;
    return; // Stoppe weitere Ausführung
  }

  // Auth-Check durchführen
  const isAuthenticated = await authService.checkAuth();
  
  if (isAuthenticated) {
    console.log('✅ Benutzer ist authentifiziert');
    
    // ActionRegistry mit ModuleRegistry verbinden
    actionRegistry.setModuleRegistry(moduleRegistry);
    
    // Navigation initialisieren
    navigationSystem.init();
    
    // ActionsDropdown initialisieren
    actionsDropdown.init();
    
    // BulkActionSystem initialisieren
    bulkActionSystem.init();
    // NotificationSystem initialisieren
    notificationSystem.init();
    
    // TaskDetailDrawer initialisieren (global)
    const taskDetailDrawer = new TaskDetailDrawer();
    taskDetailDrawer.bindEvents();
    window.taskDetailDrawer = taskDetailDrawer;
    
    // BreadcrumbSystem initialisieren
    breadcrumbSystem.init();
    
    // App anzeigen
    window.appRoot.style.display = '';
    window.loginRoot.style.display = 'none';
    
    // Starte mit Dashboard oder aktuelle Route
    let initialRoute = location.pathname;
    
    // Hash-Support für Deep-Links (z.B. aus Duplicate-Check oder Bookmarks)
    // Wenn Pfad "/" ist, aber ein Hash existiert, nutze den Hash als Route
    if ((initialRoute === '/' || initialRoute === '/index.html') && location.hash) {
      // Entferne das führende '#' aus dem Hash (z.B. "#/unternehmen/123" -> "/unternehmen/123")
      initialRoute = location.hash.substring(1);
      console.log('Hash-Route erkannt:', initialRoute);
    }

    if (!initialRoute || initialRoute === '/' || initialRoute === '/dashboard' || initialRoute === '/index.html') {
      moduleRegistry.loadDashboard();
    } else {
      moduleRegistry.navigateTo(initialRoute);
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
    // URL auf Root zurücksetzen
    window.history.pushState({}, '', '/');
    
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
    
    // Initialen berechnen und setzen
    if (userName && profileInitials) {
      const parts = userName.split(/\s+/).filter(Boolean);
      const initials = (parts[0]?.[0] || '').toUpperCase() + (parts[1]?.[0] || '').toUpperCase();
      profileInitials.textContent = initials || (userName[0] || '?').toUpperCase();
    }
    
    // Profilbild anzeigen falls vorhanden (profile_image_url hat Priorität über avatar_url)
    const imageUrl = window.currentUser?.profile_image_url || window.currentUser?.avatar_url;
    if (imageUrl && profileImg) {
      profileImg.src = imageUrl;
      profileImg.style.display = '';
      if (profileInitials) profileInitials.style.display = 'none';
    } else {
      // Kein Bild vorhanden - zeige Initialen
      if (profileImg) profileImg.style.display = 'none';
      if (profileInitials) profileInitials.style.display = 'flex';
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
          moduleRegistry.navigateTo('/profile');
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
    const quickMenuContainer = document.querySelector('.quick-menu-container');
    
    // Quick-Menu temporär komplett ausgeblendet (kann später wieder aktiviert werden)
    // Um wieder zu aktivieren: diese Zeile entfernen und den else-Block unten einkommentieren
    if (quickMenuContainer) {
      quickMenuContainer.style.display = 'none';
    }
    // Ursprüngliche Logik (auskommentiert):
    // if (quickMenuContainer && window.currentUser?.rolle === 'kunde') {
    //   quickMenuContainer.style.display = 'none';
    // } else if (quickMenuContainer) {
    //   quickMenuContainer.style.display = '';
    // }
    
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