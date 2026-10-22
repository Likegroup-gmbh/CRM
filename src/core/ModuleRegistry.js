import { OptionsManager } from './form/data/OptionsManager.js';
import { resetElementCount } from './dev/ListenerMonitor.js';
import {
  rememberScrollForRoute,
  saveScrollToCurrentHistory,
  applyScrollAfterNavigation,
  savedScrollFor,
  historyScrollFor,
  mergeScrolls,
  currentHistoryRoute
} from './NavigationScroll.js';
import { unregisterHeaderChatToggle } from './chat/HeaderChatSlot.js';
import { prepareRoute } from './navigation/prepareRoute.js';
import { activateModule } from './navigation/activateModule.js';
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
    this._didInitModule = false;

    try {
      const allowed = await this._confirmLeave(skipPushState);
      if (!allowed) return;

      // Vor pushState merken: nach popstate ist die URL schon das Ziel.
      if (!skipPushState) {
        rememberScrollForRoute();
        saveScrollToCurrentHistory();
      }
      const result = await this._doNavigate(route, skipPushState);
      if (this._didInitModule) {
        await this._restoreScrollAfterNav();
      }
      return result;
    } finally {
      this._isNavigating = false;
    }
  }

  async _restoreScrollAfterNav() {
    const dest = currentHistoryRoute();
    const scroll = mergeScrolls(historyScrollFor(dest), savedScrollFor(dest));
    const loadMore = this.currentModule?.loadMoreForScroll?.bind(this.currentModule);
    await applyScrollAfterNavigation({ ...scroll, loadMore });
  }

  // Umleitungen aus _doNavigate heraus muessen an navigateTo vorbei: dessen
  // Reentrancy-Flag steht zu dem Zeitpunkt noch und wuerde den Aufruf wortlos
  // verwerfen. Die URL bleibt auf der urspruenglichen Route, ein Reload leitet
  // erneut um.
  _redirect(route) {
    return this._doNavigate(route, true);
  }

  async _doNavigate(route, skipPushState = false) {
    const prepared = await prepareRoute(this, route, skipPushState);
    if (!prepared.proceed) return prepared.value;
    return activateModule(this, prepared);
  }

  // Modul kann das Verlassen ablehnen (ungesicherte Notiz, fremder Stand).
  // skipPushState: die URL ist schon das Ziel, dann zurück auf stayRoute.
  async _confirmLeave(skipPushState = false) {
    const page = this.currentModule;
    const guard = page?.beforeLeave;
    if (typeof guard !== 'function') return true;
    let allowed = true;
    try {
      allowed = await guard.call(page);
    } catch (error) {
      console.warn('⚠️ Verlassen der Seite abgebrochen:', error?.message || error);
      allowed = false;
    }
    if (allowed === false) {
      this._restoreStayRoute(skipPushState);
      return false;
    }
    return true;
  }

  _restoreStayRoute(skipPushState) {
    if (!skipPushState) return;
    const stay = this.currentModule?.stayRoute;
    if (!stay || !window.history?.pushState) return;
    try {
      window.history.pushState({ route: stay }, '', stay);
    } catch (error) {
      console.warn('⚠️ Rückkehr zur Seite fehlgeschlagen:', error?.message || error);
    }
  }

  async loadDashboard() {
    if (this._isNavigating) return;
    const needsGuard = typeof this.currentModule?.beforeLeave === 'function';
    if (needsGuard) this._isNavigating = true;
    try {
      if (needsGuard) {
        const allowed = await this._confirmLeave(false);
        if (!allowed) return;
      }
      this._showDashboard();
    } finally {
      if (needsGuard) this._isNavigating = false;
    }
  }

  _showDashboard() {
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
    unregisterHeaderChatToggle();

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
