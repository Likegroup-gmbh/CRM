import { describe, it, expect } from 'vitest';
import { CreatorListPage } from '../modules/creator/CreatorListPage.js';
import {
  DEFAULT_HIDDEN,
  compareMembers,
  creatorReturnPath,
  filterMembers,
  resolveHidden,
  safeReturnPath,
  visibleColumns
} from '../modules/creator/masterliste.js';
import { renderMasterlisteRow } from '../modules/creator/masterlisteTable.js';
import { formatEngagement } from '../modules/creator-auswahl/castingEngagement.js';

const member = {
  memberId: 'mem-1',
  position: 0,
  addedAt: '2026-01-01',
  creator: {
    id: 'cr-1',
    vorname: 'Ada',
    nachname: 'Lovelace',
    name: 'Ada Lovelace',
    instagram: 'ada',
    tiktok: '',
    instagram_follower: 12000,
    tiktok_follower: null,
    ig_engagement_rate: 3.2,
    ig_engagement_rate_clean: null,
    ig_trial_gate: null,
    lieferadresse_stadt: 'Wien',
    lieferadresse_land: 'Österreich',
    mail: 'ada@example.com',
    telefonnummer: '',
    profilbild_thumb_url: '',
    profilbild_url: '',
    branchen: ['Beauty'],
    sprachen: ['Deutsch'],
    creatorTypes: ['Macro']
  }
};

describe('Masterliste', () => {
  it('nimmt ohne gespeichertes Layout das Startset', () => {
    expect(resolveHidden(null)).toEqual(DEFAULT_HIDDEN);
    expect(resolveHidden(null)).toEqual([
      'ml-col-art',
      'ml-col-sprachen',
      'ml-col-mail',
      'ml-col-telefon'
    ]);
  });

  it('behält ein gespeichertes Layout, auch wenn nichts ausgeblendet ist', () => {
    expect(resolveHidden([])).toEqual([]);
    expect(resolveHidden(['ml-col-ort', 3, null])).toEqual(['ml-col-ort']);
  });

  it('zeigt Ziehen und Aktionen nur, wer die Liste pflegen darf', () => {
    const hidden = resolveHidden(null);
    const pflege = visibleColumns(hidden, { canManage: true }).map(col => col.key);
    const lesen = visibleColumns(hidden, { canManage: false }).map(col => col.key);
    expect(pflege).toContain('ml-col-drag');
    expect(pflege).toContain('ml-col-actions');
    expect(pflege).not.toContain('ml-col-mail');
    expect(pflege).toContain('ml-col-engagement');
    expect(lesen).not.toContain('ml-col-drag');
    expect(lesen).not.toContain('ml-col-actions');
    expect(lesen).toContain('ml-col-ig');
    expect(lesen).toContain('ml-col-engagement');
  });

  it('filtert Creator nach Name, Handle und Branche', () => {
    expect(filterMembers([member], 'beauty')).toHaveLength(1);
    expect(filterMembers([member], 'ada')).toHaveLength(1);
    expect(filterMembers([member], 'tiktokstar')).toHaveLength(0);
  });

  it('sortiert gezogene Positionen nach vorn und leere nach hinten', () => {
    const ungeordnet = [
      { position: null, addedAt: '2026-02-01' },
      { position: 1, addedAt: '2026-01-01' },
      { position: 0, addedAt: '2026-03-01' }
    ];
    expect(ungeordnet.slice().sort(compareMembers).map(row => row.position)).toEqual([0, 1, null]);
  });

  it('lässt nur interne Rückwege zu', () => {
    expect(safeReturnPath('/creator-lists/1')).toBe('/creator-lists/1');
    expect(safeReturnPath('https://example.com')).toBeNull();
    expect(safeReturnPath('//example.com')).toBeNull();
    window.history.replaceState({}, '', '/creator/1/edit?returnTo=%2Fcreator-lists%2Fabc');
    expect(creatorReturnPath()).toBe('/creator-lists/abc');
  });

  it('zeigt die leere Übersicht und den Anlage-Drawer', async () => {
    document.body.innerHTML = '<div id="content"></div>';
    window.content = document.getElementById('content');
    window.setContentSafely = (_el, html) => { window.content.innerHTML = html; };
    window.setHeadline = () => {};
    window.canEdit = (entity) => entity === 'creator-lists';
    window.ActionsDropdown = { init() {} };
    window.supabase = {
      from() {
        return {
          select() { return this; },
          order() { return Promise.resolve({ data: [], error: null }); }
        };
      }
    };

    const page = new CreatorListPage();
    await page.init();
    expect(window.content.textContent).toContain('Keine Masterlisten');
    document.querySelector('[data-action="create-masterliste"]').click();
    expect(document.getElementById('masterliste-name')).toBeTruthy();
    expect(document.body.textContent).toContain('Neue Masterliste');
    page.destroy();
  });

  it('rendert Instagram als Link und nicht als Eingabe', () => {
    const columns = visibleColumns(resolveHidden(null), { canManage: true });
    const html = renderMasterlisteRow(member, columns, 'liste-1');
    expect(html).toContain('href="https://instagram.com/ada"');
    expect(html).toContain(formatEngagement(3.2));
    expect(html).toContain('data-return-to="/creator-lists/liste-1"');
    expect(html).toContain('Von der Liste nehmen');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('Zur Masterliste');
    expect(html).not.toContain('>Löschen<');
  });
});
