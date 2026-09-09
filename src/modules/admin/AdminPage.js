// AdminPage.js
// Huelle des Adminbereichs (PRD Schritt 8): Route /admin, nur fuer Admins.
// Die reduzierte Navigation im Adminbereich steuert das NavigationSystem
// (Admin-Sektionen statt der vollen Sidebar). Diese Huelle kennt die
// Admin-Unterseiten und delegiert an sie — aktuell nur die
// Datenqualitaetsanzeige (Schritt 9); weitere Seiten (die herunter-
// gebrochenen Bereiche von Dashboard bis KI-Nutzung) kommen hier dazu.

import { DatenqualitaetPage } from './DatenqualitaetPage.js';

const SUB_PAGES = {
  datenqualitaet: {
    headline: 'Adminbereich – Datenqualität',
    create: () => new DatenqualitaetPage(),
  },
};

const DEFAULT_SUB = 'datenqualitaet';

export class AdminPage {
  constructor() {
    this.activePage = null;
  }

  async init(sub) {
    if (!window.isAdmin?.()) {
      window.setContentSafely(window.content, `
        <div class="empty-state">
          <p>Kein Zugriff – der Adminbereich ist nur für Admins.</p>
        </div>
      `);
      return;
    }

    const key = SUB_PAGES[sub] ? sub : DEFAULT_SUB;
    window.setHeadline(SUB_PAGES[key].headline);

    this.activePage = SUB_PAGES[key].create();
    await this.activePage.init();
  }

  destroy() {
    this.activePage?.destroy?.();
    this.activePage = null;
  }
}

export const adminPage = new AdminPage();
