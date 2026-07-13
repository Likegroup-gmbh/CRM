import { OptionsManager } from './form/data/OptionsManager.js';
import { resetElementCount } from './dev/ListenerMonitor.js';
export { OptionsManager };

export class ModuleRegistry {
  constructor() {
    this.modules = new Map();
    this.currentModule = null;
    this._isNavigating = false;
    this._cleanupCallbacks = [];
  }

  registerCleanup(fn) {
    if (typeof fn === 'function') this._cleanupCallbacks.push(fn);
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

  async _doNavigate(route, skipPushState = false) {
    // Gast-Modus (Share-Link): strikt nur die geteilte Entität, keine anderen Routen
    if (window.guestShare) {
      const normalizedRoute = String(route || '').split(/[?#]/)[0];
      const allowed = window.guestShare.allowedRoute;
      if (normalizedRoute !== allowed && !normalizedRoute.startsWith(`${allowed}/`)) {
        console.log('🚫 Navigation blockiert: Gast-Zugang ist auf die geteilte Liste beschränkt');
        window.toastSystem?.show('Ihr Zugang ist auf die geteilte Liste beschränkt.', 'warning');
        return;
      }
      // URL bleibt beim Share-Link (Reload-fähig)
      skipPushState = true;
    }

    if (window.currentUser?.isBlocked === true) {
      const allowedRoutes = ['/', '/dashboard', ''];
      const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
      if (!allowedRoutes.includes(normalizedRoute)) {
        console.log('🚫 Navigation blockiert: Benutzer nicht freigeschaltet');
        window.toastSystem?.show('Ihr Account wartet auf Freischaltung', 'warning');
        return;
      }
    }

    // Alias: /kampagnen(/...) → /kampagne(/...) (Safety-Net für alte Links/Tippfehler)
    route = String(route || '').replace(/^(\/?)kampagnen(?=[/?#]|$)/, '$1kampagne');

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

    if (segment === 'marke' && id && id !== 'new') {
      const canViewViaPage = window.canViewPage?.('marke');
      const canViewViaPerm = window.currentUser?.permissions?.marke?.can_view;
      if (canViewViaPage === false || canViewViaPerm === false) {
        console.log('🚫 Navigation blockiert: Keine Berechtigung für Marken-Seiten');
        window.toastSystem?.show('Sie haben keine Berechtigung, Marken-Seiten anzuzeigen.', 'warning');
        return;
      }
    }

    if (segment === 'auftrag' && id && id !== 'new') {
      const isKunde = window.isKunde();
      if (isKunde) {
        console.log('🚫 Navigation blockiert: Kunden dürfen nicht auf Auftrags-Detailseite');
        window.toastSystem?.show('Sie können Aufträge nur in der Übersicht einsehen.', 'warning');
        return;
      }
    }

    if (segment === 'auftragsdetails' && id && id !== 'new') {
      const canViewViaPage = window.canViewPage?.('auftragsdetails');
      const canViewViaPerm = window.currentUser?.permissions?.auftragsdetails?.can_view;
      if (canViewViaPage === false || canViewViaPerm === false) {
        console.log('🚫 Navigation blockiert: Keine Berechtigung für Auftragsdetails');
        window.toastSystem?.show('Sie haben keine Berechtigung, Auftragsdetails anzuzeigen.', 'warning');
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

    this._globalCleanup();

    if (window.breadcrumbSystem?.setFromRoute) {
      window.breadcrumbSystem.setFromRoute(segment, id || null);
    }

    let moduleKey = segment;
    let module = this.modules.get(moduleKey);
    let isEditMode = action === 'edit';

    // Leeres Segment (Root-Pfad "/"): kein Navigate. main.js ruft separat loadDashboard() auf.
    if (!moduleKey) {
      return;
    }

    // Legacy-Redirects: /auftrag/new, /auftragsdetails/new, /kampagne/new → Wizard
    if (id === 'new' && (segment === 'auftrag' || segment === 'auftragsdetails' || segment === 'kampagne')) {
      return this.navigateTo('/projekt-erstellen', true);
    }
    
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
      return this.navigateTo('/projekt-erstellen', true);
    }
    else if (id && segment === 'auftragsdetails' && id !== 'new' && action === 'edit') {
      // Wizard-Redirect: auftrag_id aus den Details laden, dann Wizard-Edit öffnen
      moduleKey = 'auftragsdetails-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Auftragsdetails-Edit → Wizard-Redirect für ID: ${id}`);
      if (module) {
        this.currentModule = module;
        try {
          const { data } = await window.supabase
            .from('auftrag_details')
            .select('auftrag_id')
            .eq('id', id)
            .single();
          if (data?.auftrag_id) {
            return this.navigateTo(`/projekt-erstellen/edit/${data.auftrag_id}`, true);
          }
        } catch (e) {
          console.warn('⚠️ Auftragsdetails-Edit Wizard-Redirect fehlgeschlagen:', e);
        }
        return module.init?.(id);
      }
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
    
    if (id && segment === 'kampagne' && id !== 'new' && action === 'edit') {
      // Kampagne bearbeiten → Wizard via auftrag_id
      console.log(`🎯 Kampagne-Edit → Wizard-Redirect für Kampagne-ID: ${id}`);
      try {
        const { data } = await window.supabase
          .from('kampagne')
          .select('auftrag_id')
          .eq('id', id)
          .single();
        if (data?.auftrag_id) {
          return this.navigateTo(`/projekt-erstellen/edit/${data.auftrag_id}?step=kampagnen`, true);
        }
      } catch (e) {
        console.warn('⚠️ Kampagne-Edit Wizard-Redirect fehlgeschlagen:', e);
      }
      moduleKey = 'kampagne-detail';
      module = this.modules.get(moduleKey);
    }
    else if (id && segment === 'kampagne' && id !== 'new') {
      moduleKey = 'kampagne-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Kampagnen-Details erkannt, verwende Modul: ${moduleKey}`);
    }

    if (id && segment === 'contracts' && id !== 'new') {
      moduleKey = 'contracts-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Contract-Details erkannt, verwende Modul: ${moduleKey}`);
    }

    if (segment === 'contracts' && !id) {
      console.log(`🔄 /contracts → /auftrag (Contracts-Tab)`);
      moduleKey = 'auftrag';
      module = this.modules.get(moduleKey);
      if (module) module._pendingTab = 'contracts';
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

    // /management-ansprechpartner: gefilterte Ansprechpartner-Liste (mode='management')
    if (segment === 'management-ansprechpartner' && id === 'new') {
      moduleKey = 'management-ansprechpartner-create';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Management-Ansprechpartner-Erstellung erkannt, verwende Modul: ${moduleKey}`);
    } else if (segment === 'management-ansprechpartner' && id) {
      // Detail-Ansicht nutzt das gleiche AnsprechpartnerDetail
      moduleKey = 'ansprechpartner-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Management-Ansprechpartner-Details, verwende Modul: ${moduleKey}`);
    }

    // /management-creator: gefilterte Creator-Liste (mode='management')
    if (segment === 'management-creator' && id) {
      // Detail-Ansicht nutzt das gleiche CreatorDetail
      moduleKey = 'creator-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Management-Creator-Details, verwende Modul: ${moduleKey}`);
    }

    if (segment === 'management' && id === 'new') {
      moduleKey = 'management-create';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Management-Erstellung erkannt, verwende Modul: ${moduleKey}`);
    }

    if (id && segment === 'management' && id !== 'new') {
      moduleKey = 'management-detail';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Management-Details erkannt, verwende Modul: ${moduleKey}`);
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

    if (segment === 'projekt-erstellen') {
      moduleKey = 'projekt-erstellen';
      module = this.modules.get(moduleKey);
      console.log(`🎯 Projekt-Erstellen, verwende Modul: ${moduleKey}`);
      if (module) {
        this.currentModule = module;
        // Edit-Routen: /projekt-erstellen/edit/:id ODER /projekt-erstellen/:id/edit
        const editId = (id === 'edit' && action)
          ? action
          : (id && id !== 'new' && action === 'edit' ? id : null);
        if (editId && module.initForEdit) {
          return module.initForEdit(editId);
        }
        if (module.init) {
          return module.init();
        }
      }
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
          // Fast-Path: Wenn das Modul initForEdit implementiert, diesen direkt nutzen
          // (kein Detail-Render-Flash vor der Edit-Form).
          if (module && typeof module.initForEdit === 'function') {
            return module.initForEdit(effectiveId);
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
    if (this.currentModule && this.currentModule.destroy) {
      this.currentModule.destroy();
      this.currentModule = null;
    }

    this._globalCleanup();

    if (window.breadcrumbSystem?.setFromRoute) {
      window.breadcrumbSystem.setFromRoute('dashboard');
    }

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

  _globalCleanup() {
    try { OptionsManager.cleanup(); } catch {}

    for (const cb of this._cleanupCallbacks) {
      try { cb(); } catch (e) { console.warn('⚠️ Cleanup-Callback Fehler:', e); }
    }
    this._cleanupCallbacks = [];

    document.querySelectorAll(
      '.drawer-overlay, .modal-overlay'
    ).forEach(el => el.remove());

    // Element-Listener-Counter im DevTools-Monitor zuruecksetzen.
    // Element-Listener auf Knoten innerhalb von window.content werden durch
    // innerHTML-Replacement im Zielmodul ohnehin GC'd, der Counter wird aber
    // nicht automatisch dekrementiert (keine removeEventListener-Calls).
    try { resetElementCount?.(); } catch {}
  }
}
