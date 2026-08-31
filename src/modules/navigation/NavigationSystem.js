// NavigationSystem.js (ES6-Modul)
// Zentrale Navigation für das CRM

import { bindCollapsible } from '../../core/collapsiblePanel.js';
import { entityIcon } from '../../core/icons/entityIcons.js';
import { icon } from '../../core/icons/IconSystem.js';

export class NavigationSystem {
  constructor() {
    this.currentRoute = '/';
    this.navSections = [
      {
        title: 'Dashboard',
        items: [
          { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', url: '/dashboard' }
          // Ausgeblendet, kommt später wieder:
          // { id: 'tasks', label: 'Aufgaben', icon: 'tasks', url: '/tasks' }
        ]
      },
      {
        title: null,
        items: [
          { id: 'projekt-erstellen', label: 'Projekt anlegen', icon: 'projekt-erstellen', url: '/projekt-erstellen' }
        ]
      },
      {
        title: 'Stammdaten',
        items: [
          { id: 'unternehmen', label: 'Unternehmen', icon: 'unternehmen', url: '/unternehmen' },
          { id: 'marke', label: 'Marken', icon: 'marke', url: '/marke' },
          { id: 'produkt', label: 'Produkte', icon: 'produkt', url: '/produkt' },
          { id: 'ansprechpartner', label: 'Ansprechpartner', icon: 'ansprechpartner', url: '/ansprechpartner' },
          {
            id: 'management',
            label: 'Management',
            icon: 'management',
            url: '/management'
          },
          { id: 'creator', label: 'Creator', icon: 'creator', url: '/creator' }
        ]
      },
      {
        title: 'Projektmanagement',
        items: [
          { id: 'stakeholder', label: 'Stakeholder', icon: 'stakeholder', url: '/stakeholder' },
          { id: 'auftrag', label: 'Aufträge', icon: 'auftrag', url: '/auftrag' },
          { id: 'ausgangsrechnungen', label: 'Kundenrechnungen', icon: 'ausgangsrechnungen', url: '/ausgangsrechnungen' },
          { id: 'auftragsdetails', label: 'Auftragsdetails', icon: 'auftragsdetails', url: '/auftragsdetails' },
          { id: 'kampagne', label: 'Kampagnen', icon: 'kampagne', url: '/kampagne' }
        ]
      },
      {
        title: 'Content & Strategie',
        items: [
          { id: 'briefing', label: 'Briefings', icon: 'briefing', url: '/briefing' },
          { id: 'strategie', label: 'Strategie', icon: 'strategie', url: '/strategie' },
          { id: 'sourcing', label: 'Sourcing', icon: 'sourcing', url: '/sourcing' },
          { id: 'skripte', label: 'Skripte', icon: 'skripte', url: '/skripte' },
          { id: 'vertraege', label: 'Verträge', icon: 'vertraege', url: '/vertraege' },
          { id: 'videos', label: 'Videos', icon: 'videos', url: '/videos' },
          { id: 'rechnung', label: 'Rechnung', icon: 'rechnung', url: '/rechnung' }
        ]
      },
      // Ausgeblendet, aber nicht entfernt:
      // {
      //   title: 'Listen',
      //   items: [
      //     { id: 'creator-lists', label: 'Listen', icon: 'listen', url: '/creator-lists' }
      //   ]
      // },
      {
        title: 'Admin',
        items: [
          { id: 'mitarbeiter', label: 'Mitarbeiter', icon: 'mitarbeiter', url: '/mitarbeiter' },
          { id: 'kunden-admin', label: 'Kunden', icon: 'kunden-admin', url: '/admin/kunden' },
          { id: 'shares', label: 'Geteilte Listen', icon: 'shares', url: '/shares' },
          { id: 'ki-usage', label: 'KI-Nutzung', icon: 'ki-usage', url: '/ki-usage' }
        ]
      },
      {
        title: 'Feedback',
        items: [
          { id: 'feedback', label: 'Feedback', icon: 'feedback', url: '/feedback' }
        ]
      }
    ];
  }

  // Navigation rendern
  renderNavigation() {
    const navElement = document.getElementById('main-nav');
    if (!navElement) {
      console.error('Navigation-Element nicht gefunden');
      return;
    }

    // Sichtbarkeit anhand Berechtigungen filtern (Page-Scoped, dann Entity)
    const perms = window.currentUser?.permissions || {};
    const canView = (id) => {
      // Dashboard ist immer für alle eingeloggten User sichtbar
      if (id === 'dashboard') {
        return true;
      }
      
      // Nicht freigeschaltete Benutzer dürfen nur das Dashboard sehen
      if (window.currentUser?.isBlocked === true) {
        return false;
      }

      // "Projekt anlegen" nur für interne Mitarbeiter, nicht für Kunden
      if (id === 'projekt-erstellen') {
        if (typeof window.canCreateProject === 'function' && !window.canCreateProject()) return false;
        if (typeof window.canCreateProject !== 'function') return false;
      }

      // Geteilte Listen: nur intern (Admin + Mitarbeiter)
      if (id === 'shares') {
        return typeof window.isInternal === 'function' && window.isInternal();
      }

      // KI-Nutzung: nur Admins (RLS laesst ohnehin nur Admins lesen)
      if (id === 'ki-usage') {
        return typeof window.isAdmin === 'function' && window.isAdmin();
      }

      if (id === 'stakeholder') {
        return typeof window.isAdmin === 'function' && window.isAdmin();
      }

      // 1) Page-Scoped Check (DB-Overrides)
      if (window.canViewPage && typeof window.canViewPage === 'function') {
        const allowed = window.canViewPage(id);
        if (allowed === false) return false;
        if (allowed === true) return true;
      }
      // 2) Fallback: Entity-Mapping
      const map = {
        dashboard: 'dashboard',
        unternehmen: 'unternehmen',
        marke: 'marke',
        produkt: 'produkt',
        auftrag: 'auftrag',
        'projekt-erstellen': 'auftrag',
        auftragsdetails: 'auftragsdetails',
        ansprechpartner: 'ansprechpartner',
        'management-ansprechpartner': 'ansprechpartner',
        kampagne: 'kampagne',
        strategie: 'strategie',
        briefing: 'briefing',
        skripte: 'skripte',
        kooperation: 'kooperation',
        rechnung: 'rechnung',
        videos: 'videos', // Eigene Videos-Berechtigung
        vertraege: 'vertraege',
        creator: 'creator',
        'creator-lists': 'creator',
        'management-creator': 'creator',
        management: 'management',
        'sourcing': 'sourcing',
        mitarbeiter: 'mitarbeiter',
        'kunden-admin': 'kunden-admin',
        tasks: 'tasks',
        tabellen: 'dashboard',
        feedback: 'feedback',
        contracts: 'contracts',
        ausgangsrechnungen: 'auftrag'
      };
      
      const entity = map[id] || id;
      const canViewResult = perms?.[entity]?.can_view || window.isAdmin();
      
      // Debug-Log für Tasks
      if (id === 'tasks') {
        console.debug('🔍 Navigation Debug - Tasks:', {
          id, entity, perms, canView: canViewResult
        });
      }
      
      return canViewResult;
    };

    // Feedback separat rendern (für Footer)
    const feedbackSection = this.navSections.find(s => s.title === 'Feedback');
    const feedbackItems = feedbackSection ? feedbackSection.items.filter(it => canView(it.id)) : [];

    const renderNavItem = (item) => `
      <li class="nav-item">
        <a href="${item.url}" class="nav-link" data-route="${item.url}">
          <span class="nav-icon">${this.getIcon(item.icon)}</span>
          <span class="nav-label">${item.label}</span>
        </a>
      </li>
    `;

    const chevronSvg = `
      ${icon('chevron-down')}
    `;

    const renderNavSubgroup = (item, visibleChildren) => `
      <li class="nav-subgroup" data-subgroup="${item.id}">
        <div class="nav-subgroup-header">
          <a href="${item.url}" class="nav-link nav-subgroup-link" data-route="${item.url}">
            <span class="nav-icon">${this.getIcon(item.icon)}</span>
            <span class="nav-label">${item.label}</span>
          </a>
          <button type="button" class="nav-subgroup-toggle" aria-label="Untergruppe ${item.label} ein-/ausklappen">
            <span class="nav-subgroup-chevron">${chevronSvg}</span>
          </button>
        </div>
        <ul class="nav-subgroup-list">
          ${visibleChildren.map(renderNavItem).join('')}
        </ul>
      </li>
    `;

    const renderItemsHtml = (items) => items.map(item => {
      if (Array.isArray(item.children) && item.children.length > 0) {
        const visibleChildren = item.children.filter(ch => canView(ch.id));
        const headerVisible = item.url ? canView(item.id) : false;
        if (visibleChildren.length === 0 && !headerVisible) return '';
        return renderNavSubgroup(item, visibleChildren);
      }
      return renderNavItem(item);
    }).join('');

    // Alle anderen Sections (ohne Feedback)
    const sectionsHtml = this.navSections
      .filter(section => section.title !== 'Feedback')
      .map(section => {
        const visibleItems = section.items.filter(it => {
          if (Array.isArray(it.children) && it.children.length > 0) {
            const visibleChildren = it.children.filter(ch => canView(ch.id));
            const headerVisible = it.url ? canView(it.id) : false;
            return visibleChildren.length > 0 || headerVisible;
          }
          return canView(it.id);
        });
        if (visibleItems.length === 0) return '';
        
        // Dashboard und title-less Sections ohne Section-Title
        if (section.title === 'Dashboard' || section.title === null) {
          return `
            <ul class="nav-list nav-list-standalone">
              ${renderItemsHtml(visibleItems)}
            </ul>`;
        }
        
        return `
          <div class="nav-section" data-section="${section.title}">
            <div class="nav-section-title">
              <span class="nav-section-chevron">${chevronSvg}</span>
              ${section.title}
            </div>
            <ul class="nav-list">
              ${renderItemsHtml(visibleItems)}
            </ul>
          </div>`;
      }).join('');

    // Feedback Footer HTML
    const feedbackHtml = feedbackItems.length > 0 ? `
      <div class="nav-footer">
        <ul class="nav-list nav-list-standalone">
          ${feedbackItems.map(item => `
            <li class="nav-item">
              <a href="${item.url}" class="nav-link" data-route="${item.url}">
                <span class="nav-icon">${this.getIcon(item.icon)}</span>
                <span class="nav-label">${item.label}</span>
              </a>
            </li>
          `).join('')}
        </ul>
      </div>
    ` : '';

    const navHtml = `
      <div class="nav-sections">
        ${sectionsHtml}
      </div>
      ${feedbackHtml}
    `;

    navElement.innerHTML = navHtml;
    this.bindNavigationEvents();
  }

  // Navigation-Events binden
  bindNavigationEvents() {
    const navLinks = document.querySelectorAll('.nav-link[data-route]');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const route = link.getAttribute('data-route');
        this.navigateTo(route);
      });
    });

    // Section-Toggle Events
    const sectionTitles = document.querySelectorAll('.nav-section-title');
    sectionTitles.forEach(title => {
      title.addEventListener('click', () => {
        const section = title.closest('.nav-section');
        section.classList.toggle('collapsed');
      });
    });

    // Subgroup-Toggle Events (Chevron neben dem Sub-Gruppen-Link)
    const subgroupToggles = document.querySelectorAll('.nav-subgroup-toggle');
    subgroupToggles.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const subgroup = btn.closest('.nav-subgroup');
        if (subgroup) subgroup.classList.toggle('collapsed');
      });
    });
  }

  // Navigation zu Route
  navigateTo(route) {
    console.log(`🧭 Navigation zu: ${route}`);
    this.currentRoute = route;
    
    // Aktive Route markieren
    this.updateActiveRoute(route);
    
    // Route über ModuleRegistry verarbeiten
    if (window.navigateTo) {
      window.navigateTo(route);
    } else {
      // Fallback: Hash-basierte Navigation
      window.location.hash = route;
    }
  }

  // Aktive Route markieren
  updateActiveRoute(route) {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
      const linkRoute = link.getAttribute('data-route');
      if (linkRoute === route) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // Icon basierend auf Icon-Name zurückgeben (über zentrales IconSystem)
  getIcon(iconName) {
    return entityIcon(iconName, { stroke: 1.5 });
  }


  // Initialisiere Navigation

  init() {
    console.log('🧭 NavigationSystem: Initialisiere Navigation');
    this._bindSidebarToggle();
    try {
      this.renderNavigation();
    } catch (err) {
      console.error('NavigationSystem: Fehler beim Rendern der Navigation', err);
    }
  }

  _bindSidebarToggle() {
    const appRoot = document.getElementById('app-root');
    const btn = document.getElementById('sidebar-toggle');
    if (!appRoot || !btn || btn._sidebarBound) return;
    btn._sidebarBound = true;
    this._sidebarCollapse = bindCollapsible({
      root: appRoot,
      toggleBtn: btn,
      collapsedClass: 'sidebar-collapsed',
      storageKey: 'sidebar-collapsed'
    });
  }

  // Cleanup
  destroy() {
    this._sidebarCollapse?.destroy();
    this._sidebarCollapse = null;
    console.log('🗑️ NavigationSystem: Destroy aufgerufen');
  }
}

// Exportiere Instanz für globale Nutzung
export const navigationSystem = new NavigationSystem();
