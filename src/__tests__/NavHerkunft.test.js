import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadProduktion } from '../modules/produktion/ProduktionService.js';
import {
  backTarget,
  isAllowedHerkunft,
  leafCrumbs,
  produktionCrumbList,
  readHerkunft,
  showProduktionLeaf,
  withHerkunft
} from '../core/navHerkunft.js';
import { workflowExitRoute } from '../modules/kampagne/KampagneDetailWorkflow.js';

vi.mock('../modules/produktion/ProduktionService.js', () => ({
  loadProduktion: vi.fn()
}));

function vonQuery(path) {
  return `?${new URLSearchParams({ von: path }).toString()}`;
}

describe('navHerkunft', () => {
  beforeEach(() => {
    loadProduktion.mockReset();
    window.history.pushState({}, '', '/');
    delete window.supabase;
    delete window.breadcrumbSystem;
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    delete window.supabase;
    delete window.breadcrumbSystem;
  });

  it('lehnt fremde Ziele ab und fällt auf die Liste zurück', () => {
    expect(isAllowedHerkunft('https://evil.test/produktion/p1')).toBe(false);
    expect(isAllowedHerkunft('//evil.test/produktion/p1')).toBe(false);
    expect(isAllowedHerkunft('/castings/c1')).toBe(false);
    expect(isAllowedHerkunft('/produktion/p1?next=https://evil.test')).toBe(false);
    expect(backTarget('/briefing', '?von=https://evil.test')).toBe('/briefing');
    expect(backTarget('/skripte', '?von=//evil.test')).toBe('/skripte');
  });

  it('behält den Tab der Produktion', () => {
    const search = vonQuery('/produktion/p1?tab=casting');
    expect(readHerkunft(search)).toBe('/produktion/p1?tab=casting');
    expect(backTarget('/castings', search)).toBe('/produktion/p1?tab=casting');
  });

  it('liest altes returnTo noch als Herkunft', () => {
    const search = `?${new URLSearchParams({ returnTo: '/kampagne/k1' }).toString()}`;
    expect(readHerkunft(search)).toBe('/kampagne/k1');
  });

  it('setzt von beim Verlassen der Produktion', () => {
    window.history.pushState({}, '', '/produktion/p1?tab=briefing');
    const route = withHerkunft('/briefing/b1');
    expect(new URL(route, 'http://local').searchParams.get('von')).toBe('/produktion/p1?tab=briefing');
  });

  it('hängt vorhandenes von an die nächste Route', () => {
    window.history.pushState({}, '', `/briefing/b1${vonQuery('/produktion/p1?tab=briefing')}`);
    const route = withHerkunft('/briefing/b1/edit');
    expect(new URL(route, 'http://local').searchParams.get('von')).toBe('/produktion/p1?tab=briefing');
  });

  it('Produktions-Breadcrumb hat drei Ebenen, die Kampagne ist klickbar', () => {
    const crumbs = produktionCrumbList({
      kampagneId: 'k1',
      kampagneName: 'Sommer',
      produktionId: 'p1',
      produktionTitle: 'Serum Oktober'
    });
    expect(crumbs.map(c => c.label)).toEqual(['Kampagnen', 'Sommer', 'Serum Oktober']);
    expect(crumbs[0].url).toBe('/kampagne');
    expect(crumbs[1]).toMatchObject({ url: '/kampagne/k1', clickable: true });
    expect(crumbs[2].clickable).toBe(false);
  });

  it('Blatt aus der Produktion hängt am Produktions-Crumb inkl. Tab', async () => {
    loadProduktion.mockResolvedValue({
      id: 'p1',
      kampagne_id: 'k1',
      name: 'Linie',
      briefing: { aktivierung_name: 'Serum Oktober' }
    });
    window.supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { eigener_name: 'Sommer' }, error: null })
          })
        })
      })
    };
    window.breadcrumbSystem = { updateBreadcrumb: vi.fn() };
    window.history.pushState({}, '', `/castings/c1${vonQuery('/produktion/p1?tab=casting')}`);

    const standalone = [
      { label: 'Castings', url: '/castings', clickable: true },
      { label: 'Sommer Casting', clickable: false }
    ];
    const crumbs = await leafCrumbs(standalone, 'Sommer Casting');
    expect(crumbs.map(c => c.label)).toEqual(['Kampagnen', 'Sommer', 'Serum Oktober', 'Sommer Casting']);
    expect(crumbs[2]).toMatchObject({
      url: '/produktion/p1?tab=casting',
      clickable: true
    });

    const shown = await showProduktionLeaf('Sommer Casting');
    expect(shown).toBe(true);
    expect(window.breadcrumbSystem.updateBreadcrumb).toHaveBeenCalledWith(
      crumbs,
      null,
      { switcher: null }
    );
  });

  it('ohne von bleibt der Listen-Breadcrumb', async () => {
    window.history.pushState({}, '', '/skripte/s1');
    window.breadcrumbSystem = { updateBreadcrumb: vi.fn() };
    const standalone = [
      { label: 'Skripte', url: '/skripte', clickable: true },
      { label: 'Hook', clickable: false }
    ];
    expect(await leafCrumbs(standalone, 'Hook')).toBe(standalone);
    expect(await showProduktionLeaf('Hook')).toBe(false);
    expect(window.breadcrumbSystem.updateBreadcrumb).not.toHaveBeenCalled();
  });
});

describe('workflowExitRoute', () => {
  it('hängt von mit dem aktiven Tab an', () => {
    const route = workflowExitRoute('briefing', 'b1', { produktionId: 'p1', tab: 'briefing' });
    const url = new URL(route, 'http://local');
    expect(url.pathname).toBe('/briefing/b1');
    expect(url.searchParams.get('von')).toBe('/produktion/p1?tab=briefing');
  });

  it('lässt Creator-Links ohne Herkunft', () => {
    expect(workflowExitRoute('creator', 'c1', { produktionId: 'p1', tab: 'produktion' }))
      .toBe('/creator/c1');
  });

  it('ohne Produktion bleibt die Detailroute', () => {
    expect(workflowExitRoute('sourcing', 'liste-1', {})).toBe('/castings/liste-1');
  });
});
