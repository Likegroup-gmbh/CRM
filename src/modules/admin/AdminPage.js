// AdminPage.js
// Huelle fuer die Admin-Unterseiten im Accounting-Bereich
// (/admin/datenqualitaet, /admin/medienablage, /admin/teams-kanaele). Das
// Accounting-Dashboard (/admin) ist die Stakeholder-Uebersicht und laeuft
// nicht mehr durch diese Huelle.

import { DatenqualitaetPage } from './DatenqualitaetPage.js';
import { MedienablagePage } from './MedienablagePage.js';
import { TeamsKanaelePage } from './TeamsKanaelePage.js';

const SUB_PAGES = {
  datenqualitaet: {
    headline: 'Accounting – Datenqualität',
    create: () => new DatenqualitaetPage(),
  },
  medienablage: {
    headline: 'Accounting – Medienablage',
    create: () => new MedienablagePage(),
  },
  'teams-kanaele': {
    headline: 'Accounting – Teams-Kanäle',
    create: () => new TeamsKanaelePage(),
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
          <p>Kein Zugriff – der Accounting-Bereich ist nur für Admins.</p>
        </div>
      `);
      return;
    }

    const key = SUB_PAGES[sub] ? sub : DEFAULT_SUB;
    window.setHeadline(SUB_PAGES[key].headline);

    this.activePage = SUB_PAGES[key].create();
    await this.activePage.init();
  }

  // Reicht das Ready der Unterseite durch (Skeleton-Muster, siehe ModuleRegistry).
  get ready() {
    return this.activePage?.ready ?? Promise.resolve();
  }

  destroy() {
    this.activePage?.destroy?.();
    this.activePage = null;
  }
}

export const adminPage = new AdminPage();
