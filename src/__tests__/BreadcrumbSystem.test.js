import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../core/App.js';

describe('BreadcrumbSystem Rework', () => {
  let container;

  beforeEach(() => {
    App.reset();
    container = document.createElement('div');
    container.id = 'breadcrumb-container';
    document.body.innerHTML = '';
    document.body.appendChild(container);
  });

  // Lazy import damit App.mock vor dem Modul-Import greifen kann
  async function createBreadcrumbSystem() {
    // Fresh import durch cache-busting
    const mod = await import('../core/BreadcrumbSystem.js');
    const system = new mod.BreadcrumbSystem();
    system.init();
    return system;
  }

  describe('Zyklus 1: setFromRoute für Listen-Seiten', () => {
    it('rendert einzelnen Crumb mit korrektem Label für "kampagne"', async () => {
      const system = await createBreadcrumbSystem();
      system.setFromRoute('kampagne');

      const nav = container.querySelector('nav.breadcrumb');
      expect(nav).not.toBeNull();
      const items = container.querySelectorAll('.breadcrumb-item');
      expect(items).toHaveLength(1);
      expect(items[0].textContent).toContain('Kampagne');
    });

    it('rendert einzelnen Crumb für "creator"', async () => {
      const system = await createBreadcrumbSystem();
      system.setFromRoute('creator');

      const items = container.querySelectorAll('.breadcrumb-item');
      expect(items).toHaveLength(1);
      expect(items[0].textContent).toContain('Creator');
    });

    it('rendert einzelnen Crumb für "dashboard"', async () => {
      const system = await createBreadcrumbSystem();
      system.setFromRoute('dashboard');

      const items = container.querySelectorAll('.breadcrumb-item');
      expect(items).toHaveLength(1);
      expect(items[0].textContent).toContain('Dashboard');
    });
  });

  describe('Zyklus 2: setFromRoute für Detail-Seiten', () => {
    it('rendert Basis-Label + Platzhalter wenn ID übergeben', async () => {
      const system = await createBreadcrumbSystem();
      system.setFromRoute('kampagne', '123');

      const items = container.querySelectorAll('.breadcrumb-item');
      expect(items).toHaveLength(2);
      expect(items[0].textContent).toContain('Kampagne');
      expect(items[1].textContent).toContain('...');
    });

    it('erster Crumb ist klickbar, zweiter nicht', async () => {
      const system = await createBreadcrumbSystem();
      system.setFromRoute('kampagne', '123');

      const link = container.querySelector('.breadcrumb-link');
      expect(link).not.toBeNull();
      expect(link.textContent).toContain('Kampagne');

      const current = container.querySelector('.breadcrumb-current');
      expect(current).not.toBeNull();
      expect(current.textContent).toContain('...');
    });
  });

  describe('Zyklus 3: updateDetailLabel Happy Path', () => {
    it('ersetzt Platzhalter durch echten Entity-Namen', async () => {
      const system = await createBreadcrumbSystem();
      system.setFromRoute('kampagne', '123');
      system.updateDetailLabel('Sommerkampagne 2025');

      const items = container.querySelectorAll('.breadcrumb-item');
      expect(items).toHaveLength(2);
      expect(items[1].textContent).toContain('Sommerkampagne 2025');
      expect(items[1].textContent).not.toContain('...');
    });
  });

  describe('Zyklus 4: updateDetailLabel Stale-Check', () => {
    it('ignoriert veralteten updateDetailLabel nach neuem setFromRoute', async () => {
      const system = await createBreadcrumbSystem();

      system.setFromRoute('kampagne', '123');
      const staleNavId = system.navigationId;

      system.setFromRoute('auftrag', '456');

      system.updateDetailLabel('Sommerkampagne 2025', null, staleNavId);

      const items = container.querySelectorAll('.breadcrumb-item');
      expect(items[0].textContent).toContain('Aufträge');
      expect(items[1].textContent).toContain('...');
      expect(items[1].textContent).not.toContain('Sommerkampagne');
    });

    it('akzeptiert updateDetailLabel mit aktueller navigationId', async () => {
      const system = await createBreadcrumbSystem();
      system.setFromRoute('kampagne', '123');

      system.updateDetailLabel('Sommerkampagne 2025', null, system.navigationId);

      const items = container.querySelectorAll('.breadcrumb-item');
      expect(items[1].textContent).toContain('Sommerkampagne 2025');
    });
  });

  describe('Zyklus 5: updateDetailLabel mit Edit-Button', () => {
    it('rendert Edit-Button wenn canEdit true', async () => {
      const system = await createBreadcrumbSystem();
      system.setFromRoute('kampagne', '123');
      system.updateDetailLabel('Sommerkampagne', { id: 'btn-edit-kampagne', canEdit: true });

      const editBtn = container.querySelector('.breadcrumb-edit-button');
      expect(editBtn).not.toBeNull();
      expect(editBtn.id).toBe('btn-edit-kampagne');
    });

    it('rendert keinen Edit-Button wenn canEdit false', async () => {
      const system = await createBreadcrumbSystem();
      system.setFromRoute('kampagne', '123');
      system.updateDetailLabel('Sommerkampagne', { id: 'btn-edit-kampagne', canEdit: false });

      const editBtn = container.querySelector('.breadcrumb-edit-button');
      expect(editBtn).toBeNull();
    });
  });

  describe('Zyklus 6: getRouteConfig für bekannte Segmente', () => {
    it('gibt korrektes Label und Icon für kampagne', async () => {
      const { getRouteConfig } = await import('../core/breadcrumbRoutes.js');
      const config = getRouteConfig('kampagne');
      expect(config.label).toBe('Kampagne');
      expect(config.icon).toBe('icon-campaign');
    });

    it('gibt korrektes Label und Icon für creator', async () => {
      const { getRouteConfig } = await import('../core/breadcrumbRoutes.js');
      const config = getRouteConfig('creator');
      expect(config.label).toBe('Creator');
      expect(config.icon).toBe('icon-users');
    });

    it('gibt korrektes Label und Icon für auftrag', async () => {
      const { getRouteConfig } = await import('../core/breadcrumbRoutes.js');
      const config = getRouteConfig('auftrag');
      expect(config.label).toBe('Aufträge');
      expect(config.icon).toBe('icon-briefcase');
    });

    it('gibt korrektes Label für dashboard', async () => {
      const { getRouteConfig } = await import('../core/breadcrumbRoutes.js');
      const config = getRouteConfig('dashboard');
      expect(config.label).toBe('Dashboard');
    });
  });

  describe('Zyklus 7: Container-Recovery nach DOM-Verlust', () => {
    it('re-acquiriert Container wenn alter Node disconnected ist', async () => {
      const system = await createBreadcrumbSystem();
      system.setFromRoute('kampagne');
      expect(container.querySelector('nav.breadcrumb')).not.toBeNull();

      // Container aus DOM entfernen und neu einfügen (simuliert Edge-Case)
      document.body.removeChild(container);
      const newContainer = document.createElement('div');
      newContainer.id = 'breadcrumb-container';
      document.body.appendChild(newContainer);

      system.setFromRoute('auftrag');
      const nav = newContainer.querySelector('nav.breadcrumb');
      expect(nav).not.toBeNull();
      expect(newContainer.querySelector('.breadcrumb-item').textContent).toContain('Aufträge');
    });

    it('funktioniert auch ohne vorheriges init() wenn Container im DOM existiert', async () => {
      const mod = await import('../core/BreadcrumbSystem.js');
      const system = new mod.BreadcrumbSystem();
      // kein init() – Container wird trotzdem über Getter gefunden
      system.setFromRoute('creator');

      const items = container.querySelectorAll('.breadcrumb-item');
      expect(items).toHaveLength(1);
      expect(items[0].textContent).toContain('Creator');
    });
  });

  describe('Zyklus 8: getRouteConfig Unknown Segment', () => {
    it('gibt kapitalisierten Fallback für unbekanntes Segment', async () => {
      const { getRouteConfig } = await import('../core/breadcrumbRoutes.js');
      const config = getRouteConfig('gibts-nicht');
      expect(config.label).toBe('Gibts-nicht');
      expect(config.icon).toBeNull();
    });

    it('gibt kapitalisierten Fallback für undefined', async () => {
      const { getRouteConfig } = await import('../core/breadcrumbRoutes.js');
      const config = getRouteConfig(undefined);
      expect(config.label).toBe('');
      expect(config.icon).toBeNull();
    });
  });
});
