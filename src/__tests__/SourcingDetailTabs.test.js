import { describe, it, expect, beforeEach } from 'vitest';
import { renderSecondaryNav, getTabIcon } from '../core/TabUtils.js';
import { entityIcon } from '../core/icons/entityIcons.js';
import { getTabsConfig } from '../modules/marke/MarkeDetailRendererCore.js';
import { renderTabNavigation } from '../modules/unternehmen/UnternehmenDetailRendererCore.js';

describe('Sourcing- und Kundenrechnungen-Tabs', () => {
  beforeEach(() => {
    window.isAdmin = () => true;
  });

  it('Tab-Key sourcing liefert das zentrale Sourcing-Icon, nicht missing', () => {
    const html = getTabIcon('sourcing');
    expect(html).toContain('crm-icon-sourcing');
    expect(html).not.toContain('crm-icon-missing');
    expect(entityIcon('sourcing')).toContain('crm-icon-sourcing');
  });

  it('Tab-Key kundenrechnungen liefert dasselbe Rechnungs-Icon wie ausgangsrechnungen', () => {
    const html = getTabIcon('kundenrechnungen');
    expect(html).toContain('crm-icon-rechnung');
    expect(html).not.toContain('crm-icon-missing');
    expect(entityIcon('kundenrechnungen')).toBe(entityIcon('ausgangsrechnungen'));
  });

  it('Secondary-Nav rendert Sourcing-Label und Sourcing-Icon', () => {
    const html = renderSecondaryNav([
      { tab: 'sourcing', label: 'Sourcing', showIcon: true }
    ]);
    expect(html).toContain('data-tab="sourcing"');
    expect(html).toContain('Sourcing');
    expect(html).not.toContain('Creator-Auswahl');
    expect(html).toContain('crm-icon-sourcing');
  });

  it('Marke-Detail hat einen Sourcing-Tab', () => {
    const tabs = getTabsConfig({
      ansprechpartner: [],
      auftraege: [],
      kampagnen: [],
      briefings: [],
      strategien: [],
      sourcingListen: [{ id: '1' }],
      kooperationen: [],
      rechnungen: [],
      personas: [],
      produkte: [],
      activeMainTab: 'sourcing'
    });
    const sourcing = tabs.find(t => t.tab === 'sourcing');
    expect(sourcing).toEqual(expect.objectContaining({
      tab: 'sourcing',
      label: 'Sourcing',
      count: 1,
      isActive: true
    }));
  });

  it('Unternehmen-Detail rendert Sourcing- und Kundenrechnungen-Tabs mit zentralen Icons', () => {
    const empty = [];
    const html = renderTabNavigation({
      marken: empty,
      personas: empty,
      produkte: empty,
      ansprechpartner: empty,
      auftraege: empty,
      auftragsdetails: empty,
      kampagnen: empty,
      briefings: empty,
      strategien: empty,
      creatorAuswahlen: [{ id: '1' }],
      kooperationen: empty,
      creators: empty,
      rechnungen: empty,
      kundenrechnungen: empty,
      vertraege: empty,
      activeMainTab: 'sourcing'
    });
    expect(html).toContain('data-tab="sourcing"');
    expect(html).toContain('Sourcing');
    expect(html).not.toContain('Creator-Auswahl');
    expect(html).not.toContain('data-tab="creatorauswahl"');
    expect(html).toContain('crm-icon-sourcing');
    expect(html).toContain('data-tab="kundenrechnungen"');
    expect(html).toContain('Kundenrechnungen');
    expect(html).toContain('crm-icon-rechnung');
  });
});
