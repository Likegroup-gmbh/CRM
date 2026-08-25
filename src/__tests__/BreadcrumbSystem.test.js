import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import App from '../core/App.js';
import * as breadcrumbSwitcher from '../core/breadcrumbSwitcher.js';

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
      expect(config.entity).toBe('kampagne');
    });

    it('gibt korrektes Label und Icon für creator', async () => {
      const { getRouteConfig } = await import('../core/breadcrumbRoutes.js');
      const config = getRouteConfig('creator');
      expect(config.label).toBe('Creator');
      expect(config.entity).toBe('creator');
    });

    it('gibt korrektes Label und Icon für auftrag', async () => {
      const { getRouteConfig } = await import('../core/breadcrumbRoutes.js');
      const config = getRouteConfig('auftrag');
      expect(config.label).toBe('Aufträge');
      expect(config.entity).toBe('auftrag');
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

  describe('Skripte-Kinder dna/master', () => {
    it('setzt DNA statt Platzhalter für /skripte/dna', async () => {
      const system = await createBreadcrumbSystem();
      system.setFromRoute('skripte', 'dna');

      const items = container.querySelectorAll('.breadcrumb-item');
      expect(items).toHaveLength(2);
      expect(items[0].textContent).toContain('Skripte');
      expect(items[1].textContent).toContain('DNA');
      expect(items[1].textContent).not.toContain('...');
      expect(container.querySelector('.breadcrumb-link')?.getAttribute('data-route')).toBe('/skripte');
    });

    it('setzt Master-Regelwerk für /skripte/master', async () => {
      const system = await createBreadcrumbSystem();
      system.setFromRoute('skripte', 'master');

      const items = container.querySelectorAll('.breadcrumb-item');
      expect(items).toHaveLength(2);
      expect(items[1].textContent).toContain('Master-Regelwerk');
    });

    it('drittes Segment Neu auf /skripte/dna/new', async () => {
      const system = await createBreadcrumbSystem();
      system.setFromRoute('skripte', 'dna', { action: 'new' });

      const items = container.querySelectorAll('.breadcrumb-item');
      expect(items).toHaveLength(3);
      expect(items[1].textContent).toContain('DNA');
      expect(items[2].textContent).toContain('Neu');
      expect(container.querySelector('.breadcrumb-link[data-route="/skripte/dna"]')).not.toBeNull();
    });

    it('unbekannte Skript-ID bleibt Platzhalter', async () => {
      const system = await createBreadcrumbSystem();
      system.setFromRoute('skripte', 'abc-uuid');

      const items = container.querySelectorAll('.breadcrumb-item');
      expect(items[1].textContent).toContain('...');
    });
  });

  describe('Zyklus 8: getRouteConfig Unknown Segment', () => {
    it('gibt kapitalisierten Fallback für unbekanntes Segment', async () => {
      const { getRouteConfig } = await import('../core/breadcrumbRoutes.js');
      const config = getRouteConfig('gibts-nicht');
      expect(config.label).toBe('Gibts-nicht');
      expect(config.entity).toBeNull();
    });

    it('gibt kapitalisierten Fallback für undefined', async () => {
      const { getRouteConfig } = await import('../core/breadcrumbRoutes.js');
      const config = getRouteConfig(undefined);
      expect(config.label).toBe('');
      expect(config.entity).toBeNull();
    });
  });

  describe('Switcher-Gate', () => {
    afterEach(() => {
      window.currentUser = null;
      document.querySelector('.breadcrumb-switcher-portal')?.remove();
    });

    it('zeigt keinen Switcher auf der Liste', async () => {
      window.currentUser = { id: 'a', rolle: 'admin' };
      const system = await createBreadcrumbSystem();
      system.setFromRoute('kampagne');
      expect(container.querySelector('.breadcrumb-switcher')).toBeNull();
    });

    it('zeigt keinen Switcher auf /new', async () => {
      window.currentUser = { id: 'a', rolle: 'admin' };
      const system = await createBreadcrumbSystem();
      system.setFromRoute('kampagne', 'new');
      expect(container.querySelector('.breadcrumb-switcher')).toBeNull();
    });

    it('zeigt keinen Switcher auf statischen Kindern', async () => {
      window.currentUser = { id: 'a', rolle: 'admin' };
      const system = await createBreadcrumbSystem();
      system.setFromRoute('skripte', 'dna');
      expect(container.querySelector('.breadcrumb-switcher')).toBeNull();
    });

    it('zeigt keinen Switcher ohne can_view', async () => {
      window.currentUser = null;
      const system = await createBreadcrumbSystem();
      system.setFromRoute('kampagne', '123');
      expect(container.querySelector('.breadcrumb-switcher')).toBeNull();
      expect(container.querySelector('.breadcrumb-current')).not.toBeNull();
    });

    it('macht den letzten Crumb zum Switcher auf der Detailseite', async () => {
      window.currentUser = { id: 'a', rolle: 'admin' };
      const system = await createBreadcrumbSystem();
      system.setFromRoute('kampagne', '123');
      system.updateDetailLabel('Sommerkampagne 2025');

      const switcher = container.querySelector('.breadcrumb-switcher');
      expect(switcher).not.toBeNull();
      expect(switcher.textContent).toContain('Sommerkampagne 2025');
      expect(container.querySelector('.breadcrumb-link')?.getAttribute('data-route')).toBe('/kampagne');
    });

    it('behält den Switcher nach updateBreadcrumb', async () => {
      window.currentUser = { id: 'a', rolle: 'admin' };
      const system = await createBreadcrumbSystem();
      system.setFromRoute('kampagne', '123');
      system.updateBreadcrumb([
        { label: 'Kampagne', url: '/kampagne', clickable: true },
        { label: 'Custom Name', url: '/kampagne/123', clickable: false }
      ]);
      expect(container.querySelector('.breadcrumb-switcher')?.textContent).toContain('Custom Name');
    });
  });

  describe('Switcher-Dropdown', () => {
    afterEach(() => {
      window.currentUser = null;
      delete window.navigateTo;
      document.querySelectorAll('.breadcrumb-switcher-portal').forEach((node) => node.remove());
      vi.restoreAllMocks();
    });

    async function openKampagneSwitcher(system) {
      window.currentUser = { id: 'a', rolle: 'admin' };
      vi.spyOn(breadcrumbSwitcher, 'loadSwitcherItems').mockResolvedValue({
        items: [
          { id: '123', label: 'Sommerkampagne 2025', route: '/kampagne/123' },
          { id: '456', label: 'Winterkampagne', route: '/kampagne/456' }
        ],
        error: null
      });
      system.setFromRoute('kampagne', '123');
      system.updateDetailLabel('Sommerkampagne 2025');
      container.querySelector('.breadcrumb-switcher').click();
      await vi.waitFor(() => {
        expect(document.querySelector('.breadcrumb-switcher-item')).not.toBeNull();
      });
    }

    it('öffnet das Portal mit Typeahead und markiert das aktuelle Item', async () => {
      const system = await createBreadcrumbSystem();
      await openKampagneSwitcher(system);

      expect(document.querySelector('.breadcrumb-switcher-portal')).not.toBeNull();
      expect(document.querySelector('.breadcrumb-switcher-input')).not.toBeNull();
      expect(document.querySelector('.breadcrumb-switcher-item.is-active')?.textContent)
        .toContain('Sommerkampagne 2025');
    });

    it('sucht nach Debounce serverseitig', async () => {
      const system = await createBreadcrumbSystem();
      await openKampagneSwitcher(system);

      vi.useFakeTimers();
      const input = document.querySelector('.breadcrumb-switcher-input');
      input.value = 'winter';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(200);
      vi.useRealTimers();

      expect(breadcrumbSwitcher.loadSwitcherItems).toHaveBeenLastCalledWith({
        segment: 'kampagne',
        query: 'winter'
      });
    });

    it('navigiert auf einen anderen Eintrag', async () => {
      window.navigateTo = vi.fn();
      const system = await createBreadcrumbSystem();
      await openKampagneSwitcher(system);

      const winter = [...document.querySelectorAll('.breadcrumb-switcher-item')]
        .find((el) => el.textContent.includes('Winterkampagne'));
      winter.click();

      expect(window.navigateTo).toHaveBeenCalledWith('/kampagne/456');
      expect(document.querySelector('.breadcrumb-switcher-portal')).toBeNull();
    });

    it('schließt nur, wenn der aktuelle Eintrag geklickt wird', async () => {
      window.navigateTo = vi.fn();
      const system = await createBreadcrumbSystem();
      await openKampagneSwitcher(system);

      document.querySelector('.breadcrumb-switcher-item.is-active').click();
      expect(window.navigateTo).not.toHaveBeenCalled();
      expect(document.querySelector('.breadcrumb-switcher-portal')).toBeNull();
    });
  });
});

