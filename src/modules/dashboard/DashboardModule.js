// DashboardModule.js (ES6-Modul)
// Schlankes Dashboard: Begrüßung + Suche + Geburtstage

import { getGreeting } from './DashboardGreetings.js';
import { loadUpcomingBirthdays, renderBirthdaysList } from './DashboardBirthdays.js';
import { loadUpcomingKampagnen, loadUpcomingKooperationen, renderKampagnenBlock, renderKooperationenBlock } from './DashboardUpcoming.js';
import { renderKundeTutorialBlock } from './DashboardKundeTutorial.js';

export class DashboardModule {
  constructor() {
    this.birthdays = [];
    this.kampagnen = [];
    this.kooperationen = [];
  }

  async init() {
    window.setHeadline('Dashboard');

    const isPending = window.currentUser?.isBlocked === true;
    if (isPending) {
      this.renderPending();
      return;
    }

    const [birthdays, kampagnen, kooperationen] = await Promise.all([
      loadUpcomingBirthdays(),
      loadUpcomingKampagnen(),
      loadUpcomingKooperationen()
    ]);

    this.birthdays = birthdays;
    this.kampagnen = kampagnen;
    this.kooperationen = kooperationen;

    this.renderDashboard();
    this.setupEventListeners();
  }

  renderDashboard() {
    const vorname = this.extractVorname();
    const greeting = getGreeting(vorname);
    const searchAllowed = typeof window.globalSearch?.isAllowed === 'function' && window.globalSearch.isAllowed();
    const avatarHtml = this.renderAvatar();

    const html = `
      <div class="dashboard-container dashboard-container--centered">
        <div class="dashboard-greeting">
          ${avatarHtml}
          <h1 class="dashboard-greeting__text">${greeting}</h1>
        </div>

        ${searchAllowed ? this.renderSearchField() : ''}

        ${renderKundeTutorialBlock()}

        ${renderBirthdaysList(this.birthdays)}

        ${ /* renderKampagnenBlock(this.kampagnen) -- temporär ausgeblendet */ ''}

        ${ /* renderKooperationenBlock(this.kooperationen) -- temporär ausgeblendet */ ''}
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  renderSearchField() {
    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const shortcut = isMac ? '⌘K' : 'Strg+K';

    return `
      <div class="dashboard-search">
        <div class="dashboard-search__input-wrap">
          <span class="dashboard-search__icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="20" height="20">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </span>
          <input
            type="text"
            class="dashboard-search__input"
            placeholder="Suchen nach Namen, Stadt, E-Mail, …"
            readonly
            data-action="open-search"
          />
          <span class="dashboard-search__shortcut">${shortcut}</span>
        </div>
      </div>
    `;
  }

  renderPending() {
    const html = `
      <div class="dashboard-container dashboard-container--centered">
        <div class="pending-user-message">
          <div class="pending-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h3>Account wartet auf Freischaltung</h3>
          <p>Ihr Account wurde erfolgreich erstellt und wartet nun auf die Freischaltung durch einen Administrator.</p>
          <div class="pending-details">
            <div class="pending-info">
              <strong>Name:</strong> ${window.currentUser?.name || 'Unbekannt'}
            </div>
            <div class="pending-info">
              <strong>E-Mail:</strong> Aus Sicherheitsgründen ausgeblendet
            </div>
            <div class="pending-info">
              <strong>Status:</strong> <span class="pending-status">Warten auf Freischaltung</span>
            </div>
          </div>
          <div class="pending-actions">
            <p><strong>Was passiert als nächstes?</strong></p>
            <ul>
              <li>Ein Administrator wird Ihren Account in Kürze überprüfen</li>
              <li>Sie erhalten eine E-Mail, sobald Ihr Account freigeschaltet wurde</li>
              <li>Nach der Freischaltung haben Sie Zugriff auf alle freigegebenen Module</li>
            </ul>
          </div>
          <div class="pending-contact">
            <p>Bei Fragen wenden Sie sich bitte an einen Administrator.</p>
          </div>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  setupEventListeners() {
    const searchInput = document.querySelector('.dashboard-search__input[data-action="open-search"]');
    if (searchInput) {
      searchInput.addEventListener('click', () => window.globalSearch?.open?.());
      searchInput.addEventListener('focus', () => {
        window.globalSearch?.open?.();
        searchInput.blur();
      });
    }

    const birthdayItems = document.querySelectorAll('.dashboard-birthdays__item[data-id]');
    if (!window.isKunde?.()) {
      birthdayItems.forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.id;
          if (id) window.navigateTo(`/ansprechpartner/${id}`);
        });
      });
    }

    const upcomingItems = document.querySelectorAll('.dashboard-upcoming__item[data-route]');
    upcomingItems.forEach(item => {
      item.addEventListener('click', () => {
        const route = item.dataset.route;
        if (route) window.navigateTo(route);
      });
    });

    const tutorialLink = document.querySelector('.dashboard-kunde-tutorial[data-route]');
    if (tutorialLink) {
      tutorialLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.navigateTo(tutorialLink.dataset.route);
      });
    }
  }

  /**
   * Extrahiert den Vornamen aus dem aktuellen User.
   * Versucht zuerst den ersten Teil des Namens.
   */
  extractVorname() {
    const fullName = window.currentUser?.name || '';
    return fullName.split(' ')[0] || '';
  }

  renderAvatar() {
    const imageUrl = window.currentUser?.profile_image_url || window.currentUser?.avatar_url;
    const userName = (window.currentUser?.name || '').trim();

    if (imageUrl) {
      return `<div class="dashboard-avatar"><img src="${imageUrl}" alt="${userName}" class="dashboard-avatar__img" /></div>`;
    }

    const parts = userName.split(/\s+/).filter(Boolean);
    const initials = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
    return `<div class="dashboard-avatar"><div class="dashboard-avatar__initials">${initials}</div></div>`;
  }

  destroy() {
    // Kein Cleanup nötig - keine Intervals oder globalen Listener
  }
}

export const dashboardModule = new DashboardModule();
