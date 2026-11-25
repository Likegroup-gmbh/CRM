import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CreatorListDetail } from '../modules/creator/CreatorListDetail.js';
import {
  masterlisteDarfZiehen,
  masterlisteSorts,
  sichtbareMember,
  syncMasterlisteTableFilter
} from '../modules/creator/masterlisteFilterSpalte.js';

const ada = {
  memberId: 'm-ada',
  addedAt: '2026-01-01',
  hatDatensatz: true,
  creator: {
    name: 'Ada Lovelace', instagram: 'ada', tiktok: '',
    instagram_follower: '10.000-20.000', tiktok_follower: null,
    ig_engagement_rate: 3.2,
    lieferadresse_stadt: 'Wien', branchen: ['Beauty'], sprachen: ['Deutsch'],
    creatorTypes: ['Influencer']
  }
};

const lina = {
  memberId: 'm-lina',
  addedAt: '2026-03-01',
  hatDatensatz: false,
  creator: {
    name: 'Lina K', instagram: 'lina.k', tiktok: 'lina',
    instagram_follower: 800, tiktok_follower: 5000,
    ig_engagement_rate: 1.1,
    lieferadresse_stadt: 'Graz', branchen: ['Food'], sprachen: [],
    creatorTypes: ['Model']
  }
};

function detailMit(members) {
  const detail = { members, searchQuery: '', hidden: [], customColumns: { getOrderedColumns: () => [] } };
  syncMasterlisteTableFilter(detail);
  return detail;
}

describe('Masterlisten-Filterspalte', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/creator-lists/l1');
  });

  it('filtert nach Creator Art, Follower-Spanne und Datensatz', () => {
    const detail = detailMit([ada, lina]);
    detail.tableFilter.setValues({ typ: ['Model'] });
    expect(sichtbareMember(detail).map(member => member.memberId)).toEqual(['m-lina']);

    detail.tableFilter.setValues({ follower_ig: { min: 10000 } });
    expect(sichtbareMember(detail).map(member => member.memberId)).toEqual(['m-ada']);

    detail.tableFilter.setValues({ datensatz: true });
    expect(sichtbareMember(detail).map(member => member.memberId)).toEqual(['m-ada']);
  });

  it('sortiert nach Name und lässt die manuelle Reihenfolge als Standard', () => {
    expect(masterlisteSorts()[0]).toMatchObject({ id: 'manuell' });
    const detail = detailMit([lina, ada]);
    expect(detail.tableFilter.getSort()).toBe('manuell');
    expect(sichtbareMember(detail).map(member => member.memberId)).toEqual(['m-lina', 'm-ada']);

    detail.tableFilter.setSort('name');
    expect(sichtbareMember(detail).map(member => member.memberId)).toEqual(['m-ada', 'm-lina']);
    expect(masterlisteDarfZiehen(detail)).toBe(false);
  });
});

describe('Masterliste mit Filterspalte', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/creator-lists/l1');
    document.body.innerHTML = '<div id="content"></div>';
    window.content = document.getElementById('content');
    window.setContentSafely = (_el, html) => { window.content.innerHTML = html; };
    window.setHeadline = () => {};
    window.canEdit = () => false;
    window.breadcrumbSystem = { updateBreadcrumb() {} };
    window.ActionsDropdown = { init() {} };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('zeigt den Filter neben der Suche und blendet Zeilen aus', () => {
    const page = new CreatorListDetail();
    page.listId = 'l1';
    page.list = { id: 'l1', name: 'Beauty', beschreibung: '', hidden_columns: [] };
    page.members = [ada, lina];
    page.customColumns.getOrderedColumns = () => [];
    page.customColumns.getValue = () => null;
    page.renderShell();

    expect(document.getElementById('ml-filter-toggle')).toBeTruthy();
    expect(document.querySelectorAll('#masterliste-body tr[data-member-id]')).toHaveLength(2);

    page.tableFilter.setValues({ ort: ['Graz'] });
    page.renderTable();
    const zeilen = [...document.querySelectorAll('#masterliste-body tr[data-member-id]')];
    expect(zeilen.map(row => row.dataset.memberId)).toEqual(['m-lina']);
    page.destroy();
  });
});
