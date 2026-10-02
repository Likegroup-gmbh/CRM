import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProfileDetailV2, profileDetailV2 } from '../modules/admin/ProfileDetailV2.js';
import { dateInputValue, formatDateOnly, getFirmenhandyDisplayHtml } from '../modules/admin/ProfileDetailFormat.js';
import { mergeLatestById, fetchKampagnen, loadKundeEntities, loadMitarbeiterEntities } from '../modules/admin/ProfileDetailEntityLoader.js';
import { readProfileForm } from '../modules/admin/ProfileSave.js';
import { validateProfileImage } from '../modules/admin/ProfileImageService.js';
import { renderProfileMainContent, renderProfileTabNavigation } from '../modules/admin/ProfileDetailRenderer.js';

/**
 * Minimaler Supabase-Fake: jede Query löst mit den Daten der Tabelle auf
 * und merkt sich die Aufrufe (table + Filter).
 */
function createSupabaseFake(tables) {
  const calls = [];
  const from = (table) => {
    const call = { table, filters: [] };
    calls.push(call);
    const builder = {
      select: () => builder,
      eq: (col, val) => { call.filters.push(['eq', col, val]); return builder; },
      in: (col, vals) => { call.filters.push(['in', col, vals]); return builder; },
      order: () => builder,
      limit: () => builder,
      single: () => builder,
      then: (resolve) => resolve({ data: tables[table] ?? [], error: null })
    };
    return builder;
  };
  return { from, calls };
}

describe('ProfileDetailFormat', () => {
  it('dateInputValue liefert YYYY-MM-DD oder leer', () => {
    expect(dateInputValue('2026-03-05T10:00:00Z')).toBe('2026-03-05');
    expect(dateInputValue('kaputt')).toBe('');
    expect(dateInputValue(null)).toBe('');
  });

  it('formatDateOnly formatiert als DD.MM.YYYY', () => {
    expect(formatDateOnly('2026-03-05')).toBe('05.03.2026');
    expect(formatDateOnly('')).toBe('-');
  });

  it('getFirmenhandyDisplayHtml ist leer ohne Nummer', () => {
    expect(getFirmenhandyDisplayHtml({})).toBe('');
    expect(getFirmenhandyDisplayHtml(null)).toBe('');
  });
});

describe('ProfileDetailEntityLoader', () => {
  afterEach(() => { delete window.supabase; });

  it('mergeLatestById dedupliziert und sortiert neueste zuerst', () => {
    const result = mergeLatestById(
      [{ id: 1, created_at: '2026-01-01' }, { id: 2, created_at: '2026-03-01' }],
      [{ id: 1, created_at: '2026-01-01' }, { id: 3, created_at: '2026-02-01' }]
    );
    expect(result.map(r => r.id)).toEqual([2, 3, 1]);
  });

  it('fetchKampagnen fragt nur vorhandene ID-Listen ab', async () => {
    const fake = createSupabaseFake({ kampagne: [{ id: 'k1', created_at: '2026-01-01' }] });
    window.supabase = fake;

    const result = await fetchKampagnen(['m1'], []);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].filters).toEqual([['in', 'marke_id', ['m1']]]);
    expect(result.map(k => k.id)).toEqual(['k1']);
  });

  it('fetchKampagnen macht ohne IDs keine Query', async () => {
    const fake = createSupabaseFake({});
    window.supabase = fake;
    expect(await fetchKampagnen([], [])).toEqual([]);
    expect(fake.calls).toHaveLength(0);
  });

  it('loadKundeEntities setzt leere Listen ohne Zuordnungen', async () => {
    window.supabase = createSupabaseFake({});
    const detail = { userId: 'u1' };
    await loadKundeEntities(detail);
    expect(detail).toMatchObject({ unternehmen: [], marken: [], kampagnen: [], kooperationen: [], videos: [], auftraege: [] });
  });

  it('loadMitarbeiterEntities setzt leere Listen ohne Zuordnungen', async () => {
    window.supabase = createSupabaseFake({});
    const detail = { userId: 'u1' };
    await loadMitarbeiterEntities(detail);
    expect(detail).toMatchObject({ unternehmen: [], marken: [], auftraege: [], kampagnen: [], kooperationen: [], videos: [] });
  });
});

describe('ProfileSave', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="profile-name" value="  Anna  ">
      <input id="profile-geburtsdatum" value="1990-05-06">
      <input id="profile-firmenhandy" value="">
      <select id="profile-firmenhandy-land"><option value=""></option><option value="de" selected>DE</option></select>
    `;
  });

  it('readProfileForm liefert getrimmte Werte', () => {
    const { values } = readProfileForm();
    expect(values).toEqual({ name: 'Anna', geburtsdatum: '1990-05-06', firmenhandy: null, firmenhandyLandId: 'de' });
  });

  it('readProfileForm verlangt einen Namen', () => {
    document.getElementById('profile-name').value = '   ';
    expect(readProfileForm().error).toBe('Bitte gib einen Namen ein.');
  });

  it('readProfileForm verlangt Land bei Firmenhandy', () => {
    document.getElementById('profile-firmenhandy').value = '15123456789';
    document.getElementById('profile-firmenhandy-land').value = '';
    expect(readProfileForm().error).toMatch(/Land/);
  });
});

describe('ProfileImageService.validateProfileImage', () => {
  it('akzeptiert kleine PNGs', () => {
    expect(validateProfileImage({ size: 1024, type: 'image/png' })).toBeNull();
  });

  it('lehnt zu große Bilder ab', () => {
    expect(validateProfileImage({ size: 3 * 1024 * 1024, type: 'image/png' })).toMatch(/zu groß/);
  });

  it('lehnt falsche Dateitypen ab', () => {
    expect(validateProfileImage({ size: 1024, type: 'image/gif' })).toMatch(/PNG, JPG und WebP/);
  });
});

describe('ProfileDetailRenderer', () => {
  function fakeDetail(overrides = {}) {
    return {
      activeMainTab: 'marken',
      unternehmen: [],
      marken: [],
      auftraege: [],
      kampagnen: [],
      kooperationen: [],
      videos: [],
      sanitize: (t) => String(t ?? ''),
      formatDate: (d) => String(d ?? '-'),
      ...overrides
    };
  }

  it('Kunden sehen keinen Aufträge-Tab', () => {
    const detail = fakeDetail();
    expect(renderProfileMainContent(detail, true)).not.toContain('id="main-auftraege"');
    expect(renderProfileMainContent(detail, false)).toContain('id="main-auftraege"');
    // Nav wird durch das Rechtesystem gefiltert, daher nur die Negativ-Prüfung
    expect(renderProfileTabNavigation(detail, true)).not.toContain('auftraege');
  });

  it('markiert nur den aktiven Tab-Pane', () => {
    const html = renderProfileMainContent(fakeDetail(), false);
    expect(html).toMatch(/tab-pane active" id="main-marken"/);
    expect(html).not.toMatch(/tab-pane active" id="main-videos"/);
  });

  it('rendert Marken mit Detail-Link nur für Mitarbeiter', () => {
    const detail = fakeDetail({ marken: [{ id: 'm1', markenname: 'Marke X', unternehmen: { firmenname: 'ACME' } }] });
    expect(renderProfileMainContent(detail, false)).toContain("window.navigateTo('/marke/m1')");
    expect(renderProfileMainContent(detail, true)).not.toContain("window.navigateTo('/marke/m1')");
  });
});

describe('ProfileDetailV2 Fassade', () => {
  it('stellt die öffentliche API bereit', () => {
    expect(profileDetailV2).toBeInstanceOf(ProfileDetailV2);
    ['init', 'render', 'bind', 'destroy', 'openEditDrawer', 'reloadAndRender'].forEach(m => {
      expect(typeof profileDetailV2[m]).toBe('function');
    });
  });
});
