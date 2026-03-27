export class ModuleRegistry {
  constructor() {
    this.modules = new Map();
    this.currentModule = null;
    this._isNavigating = false;
  }

  register(name, module) {
    this.modules.set(name, module);
    if (import.meta.env.DEV) {
      console.log(`📦 Modul registriert: ${name}`);
    }
  }

  async navigateTo(route, skipPushState = false) {
    if (this._isNavigating) return;
    this._isNavigating = true;

    try {
    return await this._doNavigate(route, skipPushState);
    } finally {
      this._isNavigating = false;
    }
  }

  _doNavigate(route, skipPushState = false) {
    if (window.currentUser?.isBlocked === true) {
      const allowedRoutes = ['/', '/dashboard', ''];
      const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
      if (!allowedRoutes.includes(normalizedRoute)) {
        console.log('🚫 Navigation blockiert: Benutzer nicht freigeschaltet');
        window.toastSystem?.show('Ihr Account wartet auf Freischaltung', 'warning');
        return;
      }
    }

    if (!skipPushState) {
      try {
        if (window.history && window.history.pushState) {
          const url = route.startsWith('/') ? route : `/${route}`;
          window.history.pushState({ route: url }, '', url);
        }
      } catch (err) {
        console.warn('⚠️ History pushState fehlgeschlagen:', err?.message);
      }
    }

    try {
      if (route.startsWith('/admin/kunden')) {
        route = route.replace('/admin/kunden', '/kunden-admin');
      }
    } catch (err) {
      console.warn('⚠️ Route-Mapping fehlgeschlagen:', err?.message);
    }

    const pathOnly = String(route || '').split(/[?#]/)[0];
    const path = pathOnly.replace(/^\//, '');
    const pathParts = path.split('/');
    const [segment, idRaw, actionRaw] = pathParts;
    const id = idRaw ? idRaw.split('?')[0] : idRaw;
    const action = actionRaw ? actionRaw.split('?')[0] : actionRaw;

    if (segment === 'creator' && id && id !== 'new') {
      const canViewViaPage = window.canViewPage?.('creator');
      const canViewViaPerm = window.currentUser?.permissions?.creator?.can_view;
      const canViewCreator = canViewViaPage !== false && canViewViaPerm !== false;

      if (!canViewCreator) {
        console.log('🚫 Navigation blockiert: Keine Berechtigung für Creator-Profile');
        window.toastSystem?.show('Sie haben keine Berechtigung, Creator-Profile anzuzeigen.', 'warning');
        return;
      }
    }

    if (import.meta.env.DEV) {
      console.log(`🧭 Navigation zu: ${segment}${id ? ` (ID: ${id})` : ''}${action ? ` (Action: ${action})` : ''}`);
      console.log(`🔍 Verfügbare Module:`, Array.from(this.modules.keys()));
      console.log(`🎯 Gesuchtes Modul: ${segment}`);
    }

    if (this.currentModule && this.currentModule.destroy) {
      console.log(`🗑️ Zerstöre aktuelles Modul:`, this.currentModule.constructor.name);
      this.currentModule.destroy();
      this.currentModule = null;
    }

    if (window.breadcrumbSystem?.setFromRoute) {
      window.breadcrumbSystem.setFromRoute(segment, id || null);
    }

    let moduleKey = segment;
    let module = this.modules.get(moduleKey);
    let isEditMode = action === 'edit';
    
    if (id && segment === 'creator' && id !== 'new') {
      moduleKey = 'creator-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Creator-Details erkannt, verwende Modul: ${moduleKey}`);
    }

    if (segment === 'creator-lists' && id) {
      moduleKey = 'creator-list-detail';
      module = this.modules.get(moduleKey);
      console.log('🎯 Creator-Listen-Detail erkannt');
    }

    if (id && segment === 'mitarbeiter' && id !== 'new') {
      moduleKey = 'mitarbeiter-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Mitarbeiter-Details erkannt, verwende Modul: ${moduleKey}`);
    }

    if (id && (segment === 'kunden-admin') && id !== 'new') {
      moduleKey = 'kunden-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Kunden-Admin-Details erkannt, verwende Modul: ${moduleKey}`);
    }

    if (id && segment === 'kunden-kooperation' && id !== 'new') {
      moduleKey = 'kunden-kooperation-detail';
      module = this.modules.get(moduleKey);
      console.log('🎯 Kunden Kooperation-Detail erkannt');
    }
    
    if (id && segment === 'marke' && id !== 'new') {
      moduleKey = 'marke-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Marken-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    if (id && segment === 'produkt' && id !== 'new') {
      moduleKey = 'produkt-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Produkt-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    if (id === 'neu' && segment === 'unternehmen') {
      moduleKey = 'unternehmen-create';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Unternehmen-Erstellung erkannt, verwende Modul: ${moduleKey}`);
    }
    else if (id && segment === 'unternehmen' && id !== 'new' && id !== 'neu') {
      moduleKey = 'unternehmen-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Unternehmen-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    if (id === 'new' && segment === 'auftragsdetails') {
      moduleKey = 'auftragsdetails-create';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Auftragsdetails-Erstellung erkannt, verwende Modul: ${moduleKey}`);
    }
    else if (id && segment === 'auftragsdetails' && id !== 'new' && action === 'edit') {
      moduleKey = 'auftragsdetails-create';
      module = this.modules.get(moduleKey);
      window._auftragsdetailsEditId = id;
      console.log(`🎯 Auftragsdetails-Edit erkannt, verwende Modul: ${moduleKey}, ID: ${id}`);
    }
    else if (id && segment === 'auftragsdetails' && id !== 'new') {
      moduleKey = 'auftragsdetails-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Auftragsdetails-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    else if (id && segment === 'auftrag' && id !== 'new') {
      moduleKey = 'auftrag-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Auftrags-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    if (id === 'new' && segment === 'kooperation') {
      moduleKey = 'kooperation';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Kooperations-Erstellung erkannt, verwende Modul: ${moduleKey}`);
    }
    else if (id && segment === 'kooperation' && id !== 'new') {
      moduleKey = 'kooperation-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Kooperations-Details erkannt, verwende Modul: ${moduleKey}`);
    }

    const idCleanForVideo = id ? id.split('?')[0] : id;
    if (idCleanForVideo && segment === 'video' && idCleanForVideo !== 'new') {
      moduleKey = 'kooperation-video-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Video-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    if (id && segment === 'kampagne' && id !== 'new') {
      moduleKey = 'kampagne-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Kampagnen-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    if (id && segment === 'briefing' && id !== 'new') {
      moduleKey = 'briefing-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Briefing-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    if (id && segment === 'rechnung' && id !== 'new') {
      moduleKey = 'rechnung-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Rechnung-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    if (id && segment === 'strategie' && id !== 'new') {
      moduleKey = 'strategie-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Strategie-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    if (id && segment === 'kickoff' && id !== 'new') {
      moduleKey = 'kickoff-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Kick-Off-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    if (id && segment === 'sourcing' && id !== 'new') {
      moduleKey = 'sourcing-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Creator-Auswahl-Details erkannt, verwende Modul: ${moduleKey}`);
    }
    
    if (id && segment === 'education') {
      moduleKey = 'education-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Education-Artikel erkannt, verwende Modul: ${moduleKey}, slug: ${id}`);
    }
    
    if (id && segment === 'ansprechpartner') {
      moduleKey = 'ansprechpartner-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Ansprechpartner-Details/Erstellung erkannt, verwende Modul: ${moduleKey}`);
    }
    
    if (segment === 'vertraege' && id === 'new') {
      moduleKey = 'vertraege-create';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Vertraege-Erstellung erkannt, verwende Modul: ${moduleKey}`);
    }

    if (segment === 'vertraege' && id && action === 'edit') {
      moduleKey = 'vertraege-create';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Vertraege-Bearbeitung erkannt, verwende Modul: ${moduleKey} mit ID: ${id}`);
    }

    if (module) {
      console.log(`✅ Modul gefunden: ${moduleKey}`, module);
      this.currentModule = module;

      const effectiveId = id ? id.split('?')[0] : id;
      if (effectiveId === 'new') {
        if (segment === 'vertraege') {
          return module.init?.();
        }
        if (segment === 'rechnung') {
          moduleKey = 'rechnung-detail';
          module = this.modules.get(moduleKey);
          return module.init?.('new');
        }
        console.log(`📝 Zeige Erstellungsformular für: ${segment}`);
        if (moduleKey.includes('-detail')) {
          return module.init?.('new');
        } else {
          return module.showCreateForm?.();
        }
      } else if (effectiveId) {
        if (isEditMode) {
          console.log(`✏️ Zeige Edit-Formular für: ${segment}/${id}`);
          if (segment === 'vertraege' && module && module.init) {
            return module.init(effectiveId);
          }
          if (module && module.init) {
            module.init(effectiveId).then(() => {
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
      return;
    }
  }

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
