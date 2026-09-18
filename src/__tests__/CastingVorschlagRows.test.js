import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderItemRow } from '../modules/creator-auswahl/CreatorAuswahlTemplates.js';
import {
  vorschlagToItem,
  CastingVorschlagService,
  JOB_START_WATCHDOG_MS
} from '../modules/creator-auswahl/CastingVorschlagService.js';

function baseCtx(overrides = {}) {
  return { isKunde: false, hiddenColumns: [], canEdit: true, canCreate: true, canDelete: true, ...overrides };
}

function rowDoc(item = {}, ctx = {}) {
  const html = renderItemRow(baseCtx(ctx), { id: 'i1', ...item }, 0);
  return new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
}

const vorschlag = {
  id: 'v-1',
  creator_id: 'c-1',
  fit_grund: 'Passt zur Zielgruppe Food 25-34.',
  persona_ids: ['p-food'],
  kategorie_hint: null,
  scores: { fit: 58, track: 36, fresh: 100, castings: 4 },
  matching_score: 57,
  creator: {
    id: 'c-1',
    vorname: 'Jessie',
    nachname: 'Leidig',
    instagram: 'hierkochtjessie',
    tiktok: null,
    instagram_follower: 26039,
    lieferadresse_stadt: 'Köln',
    mail: 'jessie@example.com',
    telefonnummer: '+49111',
    profilbild_thumb_url: 'https://cdn.test/jessie_thumb.avif',
    profilbild_url: 'https://cdn.test/jessie.avif',
    creator_creator_type: [{ creator_type_id: { id: 't1', name: 'UGC Paid' } }]
  }
};

describe('vorschlagToItem', () => {
  it('mappt Creator-Daten und fit_grund in die Tabellenfelder', () => {
    const item = vorschlagToItem(vorschlag);

    expect(item.isVorschlag).toBe(true);
    expect(item.id).toBe('v-1');
    expect(item.name).toBe('Jessie Leidig');
    expect(item.notiz).toBe('Passt zur Zielgruppe Food 25-34.');
    expect(item.link_instagram).toBe('https://instagram.com/hierkochtjessie');
    expect(item.profile_image_thumb_url).toBe('https://cdn.test/jessie_thumb.avif');
    expect(item.wohnort).toBe('Köln');
    expect(item.email).toBe('jessie@example.com');
    expect(item.typ).toBe('UGC Paid');
    expect(item.persona_id).toBe('p-food');
    expect(item.kategorie).toBeNull();
    expect(item.matching_score).toBe(57);
    expect(item.matching_scores).toEqual({ fit: 58, track: 36, fresh: 100, castings: 4 });
  });

  it('rechnet den Score selbst, wenn kein persistierter matching_score da ist', () => {
    const alt = { ...vorschlag, matching_score: null };
    const item = vorschlagToItem(alt);
    // 0.8*58 + 0.15*36 + 0.05*100 = 56.8 -> 57
    expect(item.matching_score).toBe(57);
  });
});

describe('KI-Vorschlag als Tabellenzeile', () => {
  it('markiert die Zeile und fuellt Bild, Notiz, Matching und IG-Link', () => {
    const item = vorschlagToItem(vorschlag);
    const doc = rowDoc(item);
    const tr = doc.querySelector('tr.item-row');

    expect(tr.classList.contains('item-row--vorschlag')).toBe(true);
    expect(tr.getAttribute('data-vorschlag-id')).toBe('v-1');
    expect(doc.querySelector('td.cp-col-bild img').getAttribute('src'))
      .toBe('https://cdn.test/jessie_thumb.avif');
    expect(doc.querySelector('td.cp-col-notiz').textContent)
      .toContain('Passt zur Zielgruppe Food 25-34.');
    expect(doc.querySelector('td.cp-col-matching .sourcing-matching__score').textContent)
      .toBe('57/100');
    expect(doc.querySelector('td.cp-col-link-ig a').getAttribute('href'))
      .toBe('https://instagram.com/hierkochtjessie');
  });

  it('bietet Aktivieren und Verwerfen statt Loeschen', () => {
    const doc = rowDoc(vorschlagToItem(vorschlag));
    const menu = doc.querySelector('.actions-dropdown');

    expect(menu.querySelector('[data-action="activate-vorschlag"]').textContent)
      .toContain('Aktivieren');
    expect(menu.querySelector('[data-action="discard-vorschlag"]').textContent)
      .toContain('Verwerfen');
    expect(menu.querySelector('[data-action="delete-item"]')).toBeNull();
    expect(doc.querySelector('[data-entity-type="casting_vorschlag"]')).not.toBeNull();
  });

  it('schreibt keine editierbaren Felder in die Vorschlagszeile', () => {
    const doc = rowDoc(vorschlagToItem(vorschlag));

    expect(doc.querySelector('textarea[data-field="name"]')).toBeNull();
    expect(doc.querySelector('textarea[data-field="notiz"]')).toBeNull();
    expect(doc.querySelector('.sourcing-item-check')).toBeNull();
    expect(doc.querySelector('tr.item-row').classList.contains('draggable')).toBe(false);
  });
});

describe('CastingVorschlagService.aktivieren', () => {
  beforeEach(() => {
    window.supabase = {
      from: vi.fn()
    };
  });

  it('schreibt Bild, IG-URL, fit_grund und matching_score ins Item', async () => {
    const created = { id: 'item-1' };
    const creatorQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: vorschlag.creator, error: null })
    };
    const updateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null })
    };
    window.supabase.from.mockImplementation((table) => {
      if (table === 'creator') return creatorQuery;
      if (table === 'casting_vorschlag') return updateQuery;
      return {};
    });

    const createItem = vi.fn().mockResolvedValue(created);
    const { creatorAuswahlService } = await import('../modules/creator-auswahl/CreatorAuswahlService.js');
    const spy = vi.spyOn(creatorAuswahlService, 'createItem').mockImplementation(createItem);

    const item = await CastingVorschlagService.aktivieren(vorschlag, {
      listeId: 'liste-1',
      listeTyp: 'ugc',
      personaIds: ['p-food']
    });

    expect(item).toEqual(created);
    expect(createItem).toHaveBeenCalledWith(expect.objectContaining({
      creator_auswahl_id: 'liste-1',
      name: 'Jessie Leidig',
      link_instagram: 'https://instagram.com/hierkochtjessie',
      notiz: 'Passt zur Zielgruppe Food 25-34.',
      profile_image_thumb_url: 'https://cdn.test/jessie_thumb.avif',
      profile_image_url: 'https://cdn.test/jessie.avif',
      matching_score: 57,
      matching_scores: { fit: 58, track: 36, fresh: 100, castings: 4 },
      creator_id: 'c-1',
      persona_id: 'p-food',
      kategorie: null
    }));
    spy.mockRestore();
  });
});

describe('CastingVorschlagService.starteJob', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete window.supabase;
  });

  it('bricht ab, wenn der Job pending bleibt und nie startet', async () => {
    vi.useFakeTimers();
    const jobs = {
      insert() { return this; },
      select() { return this; },
      eq() { return this; },
      single: vi.fn().mockResolvedValue({ data: { id: 'job-1' }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { status: 'pending', progress_step: null, progress_steps: [], result: null, error_message: null },
        error: null
      })
    };
    window.supabase = {
      from: vi.fn(() => jobs),
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok', user: { id: 'u1' } } } }) }
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 202, ok: true }));

    const pending = expect(CastingVorschlagService.starteJob({ castingId: 'c1' }))
      .rejects.toThrow('Die Generierung ist nicht angelaufen');
    await vi.advanceTimersByTimeAsync(JOB_START_WATCHDOG_MS + 2000);
    await pending;
  });
});
