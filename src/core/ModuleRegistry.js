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
import { navMark } from './dev/navTrace.js';
import { prepareRoute } from './navigation/prepareRoute.js';
import { activateModule } from './navigation/activateModule.js';
export { OptionsManager };

export class ModuleRegistry {
  constructor() {
    this.modules = new Map();
    this.currentModule = null;
    this._isNavigating = false;
    this._activeRoute = null;
    this._pendingNav = null;
    this._navSeq = 0;
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

  async navigateTo(route, skipPushState = false, options = {}) {
    if (this._isNavigating) {
      this._queueNavigation(route, skipPushState, options);
      return;
    }
    this._isNavigating = true;
    this._activeRoute = route;
    this._navSeq = (this._navSeq || 0) + 1;
    const seq = this._navSeq;
    this._didInitModule = false;
    navMark('nav:start');

    try {
      const allowed = await this._confirmLeave(skipPushState);
      if (!allowed) return;

      // Vor pushState merken: nach popstate ist die URL schon das Ziel.
      if (!skipPushState) {
        rememberScrollForRoute();
        if (!options.replace) saveScrollToCurrentHistory();
      }
      const result = await this._doNavigate(route, skipPushState, options);
      if (this._didInitModule) {
        const ready = this.currentModule?.ready;
        if (ready && typeof ready.then === 'function') {
          // Das Modul kehrt vor dem Laden zurueck (Skeleton): der Scroll passt
          // erst, wenn der Inhalt steht. Ausserhalb der Sperre warten, sonst
          // blockiert der Load wieder jeden Klick.
          this._restoreScrollWhenReady(ready, seq);
        } else {
          await this._restoreScrollAfterNav();
        }
      }
      return result;
    } catch (error) {
      // Das Quell-Modul ist zu diesem Zeitpunkt schon zerstört — ohne
      // sichtbare Meldung bliebe eine Zombie-Seite ohne Feedback stehen.
      console.error('❌ Navigation fehlgeschlagen:', route, error);
      window.toastSystem?.show('Die Seite konnte nicht geladen werden. Bitte neu laden.', 'error');
      return null;
    } finally {
      this._isNavigating = false;
      this._activeRoute = null;
      const next = this._pendingNav;
      this._pendingNav = null;
      if (next) this.navigateTo(next.route, next.skipPushState, next.options);
    }
  }

  // Latest-wins: ein Klick waehrend einer laufenden Navigation geht nicht
  // verloren, sondern laeuft danach. Mehrere Klicks: nur der letzte zaehlt.
  // Gleiches Ziel wie die laufende Navigation ist ein Doppelklick und bleibt
  // wirkungslos (Mehrfach-Klick-Schutz). Ein laufendes init() wird nie
  // abgebrochen: nicht jedes Modul hat ein Abbruch-Token.
  _queueNavigation(route, skipPushState, options = {}) {
    if (route === this._activeRoute) {
      this._pendingNav = null;
      return;
    }
    this._pendingNav = { route, skipPushState, options };
  }

  _restoreScrollWhenReady(ready, seq) {
    Promise.resolve(ready)
      .then(() => {
        // Seitdem navigiert (oder neu initialisiert): Scroll gehoert nicht mehr uns.
        if (seq !== this._navSeq) return undefined;
        return this._restoreScrollAfterNav();
      })
      .catch((e) => console.warn('⚠️ Scroll-Restore nach ready fehlgeschlagen:', e?.message));
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

  async _doNavigate(route, skipPushState = false, { replace = false } = {}) {
    const prepared = await prepareRoute(this, route, skipPushState, { replace });
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
