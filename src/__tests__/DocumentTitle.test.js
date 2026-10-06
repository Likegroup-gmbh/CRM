import { describe, it, expect, afterEach } from 'vitest';
import { buildDocumentTitle, refreshDocumentTitle } from '../core/documentTitle.js';

const produktionCrumbs = [
  { label: 'Kampagnen' },
  { label: 'Sommer' },
  { label: 'Telekom' }
];

describe('buildDocumentTitle', () => {
  it('Liste mit einem Crumb zeigt nur das Label', () => {
    expect(buildDocumentTitle({
      crumbs: [{ label: 'Briefings' }],
      segment: 'briefing',
      hasId: false
    })).toBe('Briefings');

    expect(buildDocumentTitle({
      crumbs: [{ label: 'Personas' }],
      segment: 'persona',
      hasId: false
    })).toBe('Personas');
  });

  it('Produktion im Tab Briefing', () => {
    expect(buildDocumentTitle({
      crumbs: produktionCrumbs,
      segment: 'produktion',
      tab: 'briefing',
      hasId: true
    })).toBe('Produktion · Telekom · Briefing');
  });

  it('Default-Tab Produktion wird nicht gedoppelt', () => {
    expect(buildDocumentTitle({
      crumbs: produktionCrumbs,
      segment: 'produktion',
      tab: 'produktion',
      hasId: true
    })).toBe('Produktion · Telekom');
  });

  it('Kooperation mit Tab Videos', () => {
    expect(buildDocumentTitle({
      crumbs: [{ label: 'Kooperation' }, { label: 'Lisa' }],
      segment: 'kooperation',
      tab: 'videos',
      hasId: true
    })).toBe('Kooperation · Lisa · Videos');
  });

  it('Briefing-Detail ohne Tab', () => {
    expect(buildDocumentTitle({
      crumbs: [{ label: 'Briefing' }, { label: 'Telekom Q4' }],
      segment: 'briefing',
      hasId: true
    })).toBe('Briefing · Telekom Q4');
  });

  it('Platzhalter: nur der Seitentyp', () => {
    expect(buildDocumentTitle({
      crumbs: [{ label: 'Kooperation' }, { label: '...' }],
      segment: 'kooperation',
      hasId: true
    })).toBe('Kooperation');
  });

  it('Bearbeiten-Blatt fällt raus, der Name bleibt', () => {
    expect(buildDocumentTitle({
      crumbs: [{ label: 'Briefing' }, { label: 'Telekom' }, { label: 'Bearbeiten' }],
      segment: 'briefing',
      hasId: true
    })).toBe('Briefing · Telekom');
  });

  it('unbekannter Query-Tab wird ignoriert', () => {
    expect(buildDocumentTitle({
      crumbs: produktionCrumbs,
      segment: 'produktion',
      tab: 'offen',
      hasId: true
    })).toBe('Produktion · Telekom');
  });

  it('Liste hängt keinen Tab an', () => {
    expect(buildDocumentTitle({
      crumbs: [{ label: 'Briefings' }],
      segment: 'briefing',
      tab: 'briefing',
      hasId: false
    })).toBe('Briefings');
  });
});

describe('refreshDocumentTitle', () => {
  afterEach(() => {
    delete window.breadcrumbSystem;
    window.history.replaceState({}, '', '/');
    document.title = 'CRM Dashboard';
  });

  it('liest Crumbs, Route und ?tab= aus dem Fenster', () => {
    window.breadcrumbSystem = { currentBreadcrumbs: produktionCrumbs };
    window.history.replaceState({}, '', '/produktion/p1?tab=briefing');
    refreshDocumentTitle();
    expect(document.title).toBe('Produktion · Telekom · Briefing');
  });
});
