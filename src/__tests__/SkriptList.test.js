// SkriptList.test.js
// Smoke + Ordner-Aggregation + Deep-Link-Params.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { skriptEditorPath, STATUS_LABELS, OHNE_QUERY, OHNE_MARKE_LABEL } from '../modules/skripte/SkripteUtils.js';
import {
  SkriptList,
  matchesMarke,
  matchesKampagne,
  scopedByUnternehmen
} from '../modules/skripte/SkriptList.js';
import { createButtonHtml } from '../modules/skripte/SkriptListRenderer.js';

const U1 = {
  id: 'u1',
  firmenname: 'Acme',
  logo_url: null
};
const M1 = { id: 'm1', markenname: 'Acme Brand', logo_url: null };
const K1 = { id: 'k1', kampagnenname: 'Sommer', eigener_name: null };

function item(overrides) {
  return {
    id: 's1',
    titel: 'Hook',
    status: 'entwurf',
    unternehmen_id: 'u1',
    marke_id: 'm1',
    kampagne_id: 'k1',
    unternehmen: U1,
    marke: M1,
    kampagne: K1,
    ...overrides
  };
}

describe('SkriptList Smoke', () => {
  it('SkriptList-Modul ist importierbar', async () => {
    const list = new SkriptList();
    expect(typeof list.init).toBe('function');
    expect(typeof list.buildCompanyFolders).toBe('function');
  });

  it('skriptEditorPath mappt neu/new und UUIDs', () => {
    expect(skriptEditorPath('neu')).toBe('/skripte/new');
    expect(skriptEditorPath('new')).toBe('/skripte/new');
    expect(skriptEditorPath('abc-123')).toBe('/skripte/abc-123');
  });

  it('STATUS_LABELS deckt die Editor-Zustaende ab', () => {
    expect(STATUS_LABELS.fragen).toBe('Rückfragen offen');
    expect(STATUS_LABELS.entwurf).toBe('Entwurf');
    expect(STATUS_LABELS.final).toBe('Final');
  });
});

describe('SkriptList Ordner', () => {
  it('matchesMarke/Kampagne behandeln null als ohne', () => {
    expect(matchesMarke({ marke_id: null }, null)).toBe(true);
    expect(matchesMarke({ marke_id: 'm1' }, null)).toBe(false);
    expect(matchesKampagne({ kampagne_id: null }, null)).toBe(true);
    expect(matchesKampagne({ kampagne_id: 'k1' }, 'k1')).toBe(true);
  });

  it('buildCompanyFolders gruppiert und skippt ohne Unternehmen', () => {
    const list = new SkriptList();
    list.skripte = [
      item({ id: 'a' }),
      item({ id: 'b' }),
      item({ id: 'c', unternehmen_id: null, unternehmen: null })
    ];
    list.buildCompanyFolders();
    expect(list.companyFolders).toHaveLength(1);
    expect(list.companyFolders[0].id).toBe('u1');
    expect(list.companyFolders[0].count).toBe(2);
  });

  it('buildCompanyFolders nutzt unternehmen_id wenn Embed keine id hat', () => {
    const list = new SkriptList();
    list.skripte = [
      item({
        id: 'a',
        unternehmen: { firmenname: 'Acme', logo_url: '/logo.png' }
      }),
      item({
        id: 'b',
        unternehmen: null
      })
    ];
    list.buildCompanyFolders();
    expect(list.companyFolders).toHaveLength(1);
    expect(list.companyFolders[0].id).toBe('u1');
    expect(list.companyFolders[0].firmenname).toBe('Acme');
    expect(list.companyFolders[0].logo_url).toBe('/logo.png');
    expect(list.companyFolders[0].count).toBe(2);
  });

  it('buildBrandFolders hängt virtuellen Ohne-Marke-Ordner an', () => {
    const list = new SkriptList();
    list.currentUnternehmenId = 'u1';
    list.skripte = [
      item({ id: 'a' }),
      item({ id: 'b', marke_id: null, marke: null })
    ];
    list.buildBrandFolders();
    expect(list.brandFolders).toHaveLength(2);
    expect(list.brandFolders[0].virtual).toBe(false);
    expect(list.brandFolders[1].virtual).toBe(true);
    expect(list.brandFolders[1].markenname).toBe(OHNE_MARKE_LABEL);
    expect(list.brandFolders[1].count).toBe(1);
  });

  it('buildBrandFolders nutzt marke_id wenn Embed keine id hat', () => {
    const list = new SkriptList();
    list.currentUnternehmenId = 'u1';
    list.skripte = [
      item({
        id: 'a',
        marke: { markenname: 'Acme Brand', logo_url: '/brand.png' }
      }),
      item({
        id: 'b',
        marke: null
      })
    ];
    list.buildBrandFolders();
    const real = list.brandFolders.filter((f) => !f.virtual);
    expect(real).toHaveLength(1);
    expect(real[0].id).toBe('m1');
    expect(real[0].markenname).toBe('Acme Brand');
    expect(real[0].logo_url).toBe('/brand.png');
    expect(real[0].count).toBe(2);
  });

  it('buildCampaignFolders trennt Kampagnen und ohne Kampagne', () => {
    const list = new SkriptList();
    list.currentUnternehmenId = 'u1';
    list.currentMarkeId = 'm1';
    list.skripte = [
      item({ id: 'a' }),
      item({ id: 'b', kampagne_id: null, kampagne: null })
    ];
    list.buildCampaignFolders();
    expect(list.campaignFolders).toHaveLength(1);
    expect(list.campaignFolders[0].name).toBe('Sommer');
    expect(list.campaignlessItems).toHaveLength(1);
  });

  it('buildCurrentItems filtert Unternehmen + Marke + Kampagne', () => {
    const list = new SkriptList();
    list.currentUnternehmenId = 'u1';
    list.currentMarkeId = 'm1';
    list.currentKampagneId = 'k1';
    list.skripte = [
      item({ id: 'a' }),
      item({ id: 'b', kampagne_id: null, kampagne: null }),
      item({ id: 'c', marke_id: null, marke: null })
    ];
    list.buildCurrentItems();
    expect(list.currentItems.map((s) => s.id)).toEqual(['a']);
  });

  it('scopedByUnternehmen filtert korrekt', () => {
    expect(scopedByUnternehmen([item(), item({ unternehmen_id: 'u2' })], 'u1')).toHaveLength(1);
  });
});

describe('SkriptList Deep-Links', () => {
  it('ohne Params → companies', () => {
    const list = new SkriptList();
    list.applyQueryParams(new URLSearchParams(''));
    expect(list.viewMode).toBe('companies');
  });

  it('nur Unternehmen → brands', () => {
    const list = new SkriptList();
    list.applyQueryParams(new URLSearchParams('unternehmen=u1&unternehmen_name=Acme'));
    expect(list.viewMode).toBe('brands');
    expect(list.currentUnternehmenId).toBe('u1');
  });

  it('Unternehmen + Marke → campaigns', () => {
    const list = new SkriptList();
    list.applyQueryParams(new URLSearchParams('unternehmen=u1&marke=m1&marke_name=Brand'));
    expect(list.viewMode).toBe('campaigns');
    expect(list.currentMarkeId).toBe('m1');
  });

  it('marke=ohne → campaigns ohne Marke', () => {
    const list = new SkriptList();
    list.applyQueryParams(new URLSearchParams(`unternehmen=u1&marke=${OHNE_QUERY}`));
    expect(list.viewMode).toBe('campaigns');
    expect(list.currentMarkeId).toBeNull();
    expect(list.currentMarkeName).toBe(OHNE_MARKE_LABEL);
  });

  it('kampagne gesetzt → items', () => {
    const list = new SkriptList();
    list.applyQueryParams(new URLSearchParams('unternehmen=u1&marke=m1&kampagne=k1&kampagne_name=Sommer'));
    expect(list.viewMode).toBe('items');
    expect(list.currentKampagneId).toBe('k1');
  });
});

describe('createButtonHtml Kunden', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('intern zeigt Create-Button', () => {
    window.isKunde = vi.fn(() => false);
    expect(createButtonHtml()).toContain('btn-skript-new');
  });

  it('Kunde sieht keinen Create-Button', () => {
    window.isKunde = vi.fn(() => true);
    expect(createButtonHtml()).toBe('');
  });
});
