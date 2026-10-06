import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  backTarget,
  collapse,
  composeCrumbs,
  createLabelCache,
  isFormRoute,
  navigateBack,
  nextTrail,
  replaceRoute,
  trailForRoute,
  trailProduktion
} from '../core/breadcrumbTrail.js';

const produktionPage = [
  { label: 'Kampagnen', url: '/kampagne', clickable: true },
  { label: 'Sommer', url: '/kampagne/k1', clickable: true },
  { label: 'Serum Oktober', url: '/produktion/p1', clickable: false }
];

describe('nextTrail', () => {
  it('Produktion → Casting: Pfad ist die Produktions-Kette mit aktuellem Tab', () => {
    const trail = nextTrail({
      currentCrumbs: produktionPage,
      currentUrl: '/produktion/p1?tab=casting',
      targetRoute: '/castings/c1'
    });
    expect(trail).toEqual([
      { label: 'Kampagnen', url: '/kampagne' },
      { label: 'Sommer', url: '/kampagne/k1' },
      { label: 'Serum Oktober', url: '/produktion/p1?tab=casting' }
    ]);
  });

  it('Casting → Creator hängt eine Ebene an', () => {
    const currentTrail = [{ label: 'Serum Oktober', url: '/produktion/p1?tab=casting' }];
    const trail = nextTrail({
      currentTrail,
      currentCrumbs: [...currentTrail, { label: 'Sommer Casting', url: '/castings/c1' }],
      currentUrl: '/castings/c1',
      targetRoute: '/creator/cr1'
    });
    expect(trail.map((c) => c.label)).toEqual(['Serum Oktober', 'Sommer Casting']);
  });

  it('Ziel ohne ID (Liste/Sidebar) setzt zurück', () => {
    expect(nextTrail({
      currentTrail: [{ label: 'X', url: '/kampagne/k1' }],
      currentCrumbs: produktionPage,
      currentUrl: '/produktion/p1',
      targetRoute: '/creator'
    })).toEqual([]);
  });

  it('Liste → eigenes Detail zeigt den offiziellen Weg', () => {
    expect(nextTrail({
      currentCrumbs: [{ label: 'Creator', url: '/creator' }],
      currentUrl: '/creator?seite=2',
      targetRoute: '/creator/cr1'
    })).toEqual([]);
  });

  it('Zyklus kürzt bis vor das Ziel', () => {
    const crumbs = [
      { label: 'Kampagne', url: '/kampagne' },
      { label: 'Sommer', url: '/kampagne/k1' },
      { label: 'Max', url: '/creator/cr1' }
    ];
    expect(nextTrail({
      currentTrail: crumbs.slice(0, 2),
      currentCrumbs: crumbs,
      currentUrl: '/creator/cr1',
      targetRoute: '/kampagne/k1'
    })).toEqual([{ label: 'Kampagne', url: '/kampagne' }]);
  });

  it('Tab-Wechsel oder Reload behält den Pfad', () => {
    const currentTrail = [{ label: 'Serum Oktober', url: '/produktion/p1' }];
    expect(nextTrail({
      currentTrail,
      currentCrumbs: [],
      currentUrl: '/creator/cr1',
      targetRoute: '/creator/cr1?tab=vertraege'
    })).toBe(currentTrail);
  });

  it('Geschwister (Switcher) behalten den Pfad', () => {
    const currentTrail = [{ label: 'Serum Oktober', url: '/produktion/p1' }];
    expect(nextTrail({
      currentTrail,
      currentCrumbs: [...currentTrail, { label: 'Max', url: '/creator/cr1' }],
      currentUrl: '/creator/cr1',
      targetRoute: '/creator/cr2'
    })).toBe(currentTrail);
  });

  it('Detail → Bearbeiten hängt das Detail an', () => {
    const trail = nextTrail({
      currentTrail: [],
      currentCrumbs: [{ label: 'Kooperation', url: '/kooperation' }, { label: 'Koop A', url: '/kooperation/1' }],
      currentUrl: '/kooperation/1',
      targetRoute: '/kooperation/1/edit'
    });
    expect(trail.map((c) => c.label)).toEqual(['Kooperation', 'Koop A']);
  });

  it('Liste → Anlegen hält die Liste inkl. Filter als Herkunft', () => {
    expect(nextTrail({
      currentCrumbs: [{ label: 'Creator', url: '/creator' }],
      currentUrl: '/creator?seite=2',
      targetRoute: '/creator/new'
    })).toEqual([{ label: 'Creator', url: '/creator?seite=2' }]);
  });

  it('Liste → Bearbeiten hält die Liste als Herkunft', () => {
    expect(nextTrail({
      currentCrumbs: [{ label: 'Ansprechpartner', url: '/ansprechpartner' }],
      currentUrl: '/ansprechpartner',
      targetRoute: '/ansprechpartner/a1/edit'
    })).toEqual([{ label: 'Ansprechpartner', url: '/ansprechpartner' }]);
  });

  it('Projekt anlegen (ohne ID) hält die Herkunft', () => {
    const trail = nextTrail({
      currentCrumbs: produktionPage,
      currentUrl: '/produktion/p1',
      targetRoute: '/projekt-erstellen'
    });
    expect(trail.map((c) => c.url)).toEqual(['/kampagne', '/kampagne/k1', '/produktion/p1']);
  });

  it('Formular → zurück zur Herkunft kürzt den Pfad', () => {
    const currentTrail = [{ label: 'Kampagnen', url: '/kampagne' }, { label: 'Sommer', url: '/kampagne/k1?tab=produktion' }];
    expect(nextTrail({
      currentTrail,
      currentCrumbs: [...currentTrail, { label: 'Neue Kooperation', url: null }],
      currentUrl: '/kooperation/new',
      targetRoute: '/kampagne/k1?tab=produktion'
    })).toEqual([{ label: 'Kampagnen', url: '/kampagne' }]);
  });
});

describe('isFormRoute', () => {
  it('erkennt Anlegen, Bearbeiten und den Projekt-Wizard', () => {
    expect(isFormRoute('/creator/new?x=1')).toBe(true);
    expect(isFormRoute('/briefing/b1/edit')).toBe(true);
    expect(isFormRoute('/unternehmen/u1/persona/new')).toBe(true);
    expect(isFormRoute('/admin/projekt-erstellen')).toBe(true);
    expect(isFormRoute('/projekt-erstellen/edit/a1?step=kampagnen')).toBe(true);
    expect(isFormRoute('/creator/cr1')).toBe(false);
    expect(isFormRoute('/creator')).toBe(false);
  });
});

describe('composeCrumbs', () => {
  it('ohne Pfad: offizielle Kette', () => {
    expect(composeCrumbs([], produktionPage)).toBe(produktionPage);
  });

  it('mit Pfad: nur das Blatt hängt dran', () => {
    const trail = [{ label: 'Serum Oktober', url: '/produktion/p1' }, { label: 'Sommer Casting', url: '/castings/c1' }];
    const crumbs = composeCrumbs(trail, [
      { label: 'Creator', url: '/creator', clickable: true },
      { label: 'Max', url: '/creator/cr1', clickable: false }
    ]);
    expect(crumbs.map((c) => c.label)).toEqual(['Serum Oktober', 'Sommer Casting', 'Max']);
    expect(crumbs[1]).toMatchObject({ url: '/castings/c1', clickable: true });
  });

  it('setzt die offizielle Kette ab dem letzten Pfad-Crumb fort', () => {
    const trail = [{ label: 'Unternehmen', url: '/unternehmen' }, { label: 'ACME', url: '/unternehmen/u1?tab=personas' }];
    const crumbs = composeCrumbs(trail, [
      { label: 'Unternehmen', url: '/unternehmen', clickable: true },
      { label: 'ACME', url: '/unternehmen/u1', clickable: true },
      { label: 'Personas', url: '/unternehmen/u1?tab=personas', clickable: true },
      { label: 'Gen Z', clickable: false }
    ]);
    expect(crumbs.map((c) => c.label)).toEqual(['Unternehmen', 'ACME', 'Personas', 'Gen Z']);
  });
});

describe('collapse', () => {
  it('lässt kurze Ketten stehen', () => {
    expect(collapse([1, 2, 3].map((n) => ({ label: `${n}` }))).hidden).toEqual([]);
  });

  it('klappt die Mitte zusammen', () => {
    const crumbs = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ label: `${n}` }));
    const { visible, hidden } = collapse(crumbs, 6);
    expect(visible.map((c) => c.label || '…')).toEqual(['1', '…', '5', '6', '7', '8']);
    expect(hidden.map((c) => c.label)).toEqual(['2', '3', '4']);
  });
});

describe('History-State', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'));
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('replaceRoute behält Pfad und Scroll', () => {
    const trail = [{ label: 'Sommer', url: '/kampagne/k1' }];
    window.history.replaceState({ route: '/produkt', trail, scrollTop: 40 }, '', '/produkt');
    replaceRoute('/produkt?unternehmen=u1');
    expect(window.history.state).toEqual({ route: '/produkt?unternehmen=u1', trail, scrollTop: 40 });
    expect(window.location.search).toBe('?unternehmen=u1');
  });

  it('backTarget nimmt die Ebene, von der man kam', () => {
    expect(backTarget('/briefing')).toBe('/briefing');
    window.history.replaceState({
      route: '/briefing/new',
      trail: [{ label: 'Kampagnen', url: '/kampagne' }, { label: 'Serum', url: '/produktion/p1?tab=briefing' }]
    }, '', '/briefing/new');
    expect(backTarget('/briefing')).toBe('/produktion/p1?tab=briefing');
    expect(trailProduktion()).toEqual({ produktionId: 'p1', url: '/produktion/p1?tab=briefing' });
  });

  it('navigateBack: auf Formular-Route zur Herkunft, sonst zum Fallback', () => {
    const navigateTo = vi.fn();
    window.navigateTo = navigateTo;
    const trail = [{ label: 'Serum', url: '/produktion/p1?tab=briefing' }];

    window.history.replaceState({ route: '/briefing/b1/edit', trail }, '', '/briefing/b1/edit');
    navigateBack('/briefing/b1');
    expect(navigateTo).toHaveBeenLastCalledWith('/produktion/p1?tab=briefing');

    window.history.replaceState({ route: '/briefing/b1', trail }, '', '/briefing/b1');
    navigateBack('/briefing/b1');
    expect(navigateTo).toHaveBeenLastCalledWith('/briefing/b1');
  });

  it('trailForRoute ignoriert Pfade fremder Einträge', () => {
    window.history.replaceState({ route: '/creator/cr1', trail: [{ label: 'X', url: '/castings/c1' }] }, '', '/creator/cr1');
    expect(trailForRoute('/creator/cr1?tab=infos')).toHaveLength(1);
    expect(trailForRoute('/dashboard')).toEqual([]);
  });
});

describe('createLabelCache', () => {
  it('merkt sich nur Entitäts-Pfade, keine Platzhalter', () => {
    const cache = createLabelCache();
    cache.set('/creator/cr1?tab=x', 'Max');
    cache.set('/produktion?unternehmen=u1', 'ACME');
    cache.set('/kampagne/k1', '...');
    expect(cache.get('/creator/cr1')).toBe('Max');
    expect(cache.get('/produktion')).toBeNull();
    expect(cache.get('/kampagne/k1')).toBeNull();
  });
});
