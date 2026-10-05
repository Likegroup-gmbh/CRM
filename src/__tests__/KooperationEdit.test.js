import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FormRenderer } from '../core/form/FormRenderer.js';
import { FormConfig } from '../core/form/FormConfig.js';
import { FormSearchableSelect } from '../core/form/logic/FormSearchableSelect.js';
import { OptionsManager } from '../core/form/data/OptionsManager.js';
import { KooperationEditLoader } from '../modules/kooperation/KooperationEditLoader.js';
import { FormVideoHandler } from '../core/form/logic/FormVideoHandler.js';
import { addVideoRow } from '../core/form/logic/events/VideosFields.js';

const IDS = {
  kooperation: 'koop-1',
  unternehmen: 'u-1',
  marke: 'm-1',
  kampagne: 'k-1',
  creator: 'c-1',
  briefing: 'b-1',
  video: 'vid-1'
};

function applyFilters(rows, filters) {
  return rows.filter((row) => filters.every((filter) => {
    if (filter.op === 'eq') return row[filter.col] === filter.val;
    if (filter.op === 'neq') return row[filter.col] !== filter.val;
    return true;
  }));
}

function createSupabase(tables) {
  return {
    from(table) {
      const filters = [];
      const builder = {
        select() { return builder; },
        eq(col, val) { filters.push({ op: 'eq', col, val }); return builder; },
        neq(col, val) { filters.push({ op: 'neq', col, val }); return builder; },
        order() { return builder; },
        in() { return builder; },
        single() {
          const rows = applyFilters(tables[table] || [], filters);
          return Promise.resolve({
            data: rows[0] || null,
            error: rows[0] ? null : { message: 'not found' }
          });
        },
        then(onFulfilled, onRejected) {
          const rows = applyFilters(tables[table] || [], filters);
          return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
        }
      };
      return builder;
    }
  };
}

function editTables() {
  return {
    unternehmen: [{ id: IDS.unternehmen, firmenname: 'BURGA' }],
    marke: [{ id: IDS.marke, markenname: 'Burga' }],
    kampagne: [{
      id: IDS.kampagne,
      kampagnenname: 'Sommerkampagne',
      eigener_name: null,
      auftrag_id: 'a-1',
      videoanzahl: 10,
      ugc_paid_video_anzahl: 0,
      ugc_organic_video_anzahl: 0,
      influencer_video_anzahl: 0,
      story_video_anzahl: 0,
      vor_ort_video_anzahl: 0,
      ugc_video_anzahl: 0,
      igc_video_anzahl: 0
    }],
    campaign_briefings: [{ id: IDS.briefing, aktivierung_name: 'Launch' }],
    creator: [{ id: IDS.creator, vorname: 'Mia', nachname: 'Sommer', umsatzsteuerpflichtig: true }],
    auftrag_kampagne_art: [],
    kampagne_art_typen: [{ id: 'art-1', name: 'Influencer' }],
    kooperationen: [{ id: 'koop-other', kampagne_id: IDS.kampagne, videoanzahl: 1 }],
    kooperation_videos: [{
      id: IDS.video,
      kooperation_id: IDS.kooperation,
      content_art: 'Reel',
      kampagnenart: 'Influencer',
      einkaufspreis_netto: 100,
      verkaufspreis_netto: 200,
      skript_deadline: null,
      content_deadline: null,
      titel: null,
      asset_url: null,
      kommentar: null,
      position: 1
    }],
    kooperation_tag_typen: [],
    kooperation_tags: [],
    auftrag_kampagnenart_blocks: []
  };
}

function visibleInput(form, fieldName) {
  const select = form.querySelector(`#field-${fieldName}`);
  return select?.parentNode.querySelector('.searchable-select-input') || null;
}

describe('Kooperation bearbeiten', () => {
  let previousSupabase;

  beforeEach(() => {
    previousSupabase = window.supabase;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    window.supabase = previousSupabase;
    document.body.innerHTML = '';
  });

  it('zeigt Zuordnung und bestehendes Video, nachdem die Suchfelder initialisiert wurden', async () => {
    window.supabase = createSupabase(editTables());

    const renderer = new FormRenderer();
    const config = new FormConfig();
    renderer.getFormConfig = config.getFormConfig.bind(config);

    const data = {
      id: IDS.kooperation,
      _isEditMode: true,
      _entityId: IDS.kooperation,
      name: 'Mia Sommer 1/3',
      videoanzahl: 1,
      unternehmen_id: IDS.unternehmen,
      marke_id: IDS.marke,
      kampagne_id: IDS.kampagne,
      briefing_id: IDS.briefing,
      creator_id: IDS.creator,
      kampagne: { id: IDS.kampagne, marke: { id: IDS.marke } },
      einkaufspreis_netto: 100,
      verkaufspreis_netto: 200
    };

    document.body.innerHTML = renderer.renderFormOnly('kooperation', data);
    const form = document.getElementById('kooperation-form');
    const loader = new KooperationEditLoader();
    const loaded = await loader.load(form, data);
    expect(loaded.success).toBe(true);

    const searchable = new FormSearchableSelect(new OptionsManager());
    searchable.initializeSearchableSelects(form);
    await loader.bindEvents(form, data);

    expect(visibleInput(form, 'unternehmen_id').value).toBe('BURGA');
    expect(visibleInput(form, 'unternehmen_id').disabled).toBe(true);
    expect(visibleInput(form, 'kampagne_id').value).toBe('Sommerkampagne');
    expect(visibleInput(form, 'kampagne_id').disabled).toBe(true);
    expect(visibleInput(form, 'creator_id').value).toBe('Mia Sommer');
    expect(visibleInput(form, 'creator_id').disabled).toBe(false);

    const video = form.querySelector('.video-item');
    expect(video).not.toBeNull();
    expect(video.dataset.videoId).toBe(IDS.video);
    expect(video.querySelector('.video-content-select').value).toBe('Reel');
  });

  it('behält die Datenbank-ID an der Videozeile', () => {
    const list = document.createElement('div');
    addVideoRow(list, ['Reel'], {
      id: IDS.video,
      content_art: 'Reel',
      kampagnenart: 'Influencer',
      einkaufspreis_netto: 100,
      verkaufspreis_netto: 200
    }, ['Influencer']);

    expect(list.querySelector('.video-item').dataset.videoId).toBe(IDS.video);
  });

  it('ordnet ein neues Video per ID zu und überschreibt das bestehende nicht', async () => {
    const updates = [];
    const inserts = [];
    window.supabase = {
      from() {
        const state = { mode: 'select', filters: {} };
        const builder = {
          select() { return builder; },
          eq(col, val) { state.filters[col] = val; return builder; },
          order() { return builder; },
          update(payload) { state.mode = 'update'; state.payload = payload; return builder; },
          insert(rows) { state.mode = 'insert'; state.rows = rows; return builder; },
          then(onFulfilled, onRejected) {
            if (state.mode === 'update') {
              updates.push({ id: state.filters.id, payload: state.payload });
              return Promise.resolve({ error: null }).then(onFulfilled, onRejected);
            }
            if (state.mode === 'insert') {
              inserts.push(state.rows);
              return Promise.resolve({ data: [{ id: 'vid-new' }], error: null }).then(onFulfilled, onRejected);
            }
            return Promise.resolve({
              data: [{
                id: IDS.video,
                position: 1,
                content_art: 'Reel',
                kampagnenart: 'Influencer',
                einkaufspreis_netto: 100,
                verkaufspreis_netto: 200,
                skript_deadline: null,
                content_deadline: null
              }],
              error: null
            }).then(onFulfilled, onRejected);
          }
        };
        return builder;
      }
    };

    document.body.innerHTML = `
      <form id="kooperation-form" data-entity-id="${IDS.kooperation}">
        <input name="videoanzahl" value="2">
        <div class="videos-list">
          <div class="video-item" data-video-id="video-new-1">
            <select name="video_content_art_video-new-1"><option value="" selected></option></select>
            <select name="video_kampagnenart_video-new-1"><option value="" selected></option></select>
            <input name="video_ek_netto_video-new-1" value="">
            <input name="video_vk_netto_video-new-1" value="">
            <input name="video_skript_deadline_video-new-1" value="">
            <input name="video_content_deadline_video-new-1" value="">
          </div>
          <div class="video-item" data-video-id="${IDS.video}">
            <select name="video_content_art_${IDS.video}"><option value="Reel" selected>Reel</option></select>
            <select name="video_kampagnenart_${IDS.video}"><option value="Influencer" selected>Influencer</option></select>
            <input name="video_ek_netto_${IDS.video}" value="100">
            <input name="video_vk_netto_${IDS.video}" value="200">
            <input name="video_skript_deadline_${IDS.video}" value="">
            <input name="video_content_deadline_${IDS.video}" value="">
          </div>
        </div>
      </form>
    `;

    const form = document.getElementById('kooperation-form');
    const result = await new FormVideoHandler().handleKooperationVideos(IDS.kooperation, form);

    expect(result.success).toBe(true);
    const kept = updates.find((entry) => entry.id === IDS.video);
    expect(kept?.payload.content_art === undefined || kept.payload.content_art === 'Reel').toBe(true);
    expect(kept?.payload.einkaufspreis_netto === undefined || kept.payload.einkaufspreis_netto === 100).toBe(true);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toHaveLength(1);
    expect(inserts[0][0].content_art).toBeNull();
    expect(inserts[0][0].einkaufspreis_netto).toBe(0);
    expect(inserts[0][0].position).toBe(1);
  });

  it('meldet einen fehlgeschlagenen Video-Insert als Fehler', async () => {
    window.supabase = {
      from() {
        const state = { mode: 'select' };
        const builder = {
          select() { return builder; },
          eq() { return builder; },
          order() { return builder; },
          update() { state.mode = 'update'; return builder; },
          insert() { state.mode = 'insert'; return builder; },
          then(onFulfilled, onRejected) {
            if (state.mode === 'insert') {
              return Promise.resolve({ data: null, error: { message: 'insert failed' } }).then(onFulfilled, onRejected);
            }
            if (state.mode === 'update') {
              return Promise.resolve({ error: null }).then(onFulfilled, onRejected);
            }
            return Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected);
          }
        };
        return builder;
      }
    };

    document.body.innerHTML = `
      <form id="kooperation-form" data-entity-id="${IDS.kooperation}">
        <input name="videoanzahl" value="1">
        <div class="videos-list">
          <div class="video-item" data-video-id="video-new-1">
            <select name="video_content_art_video-new-1"><option value="" selected></option></select>
            <select name="video_kampagnenart_video-new-1"><option value="" selected></option></select>
            <input name="video_ek_netto_video-new-1" value="">
            <input name="video_vk_netto_video-new-1" value="">
            <input name="video_skript_deadline_video-new-1" value="">
            <input name="video_content_deadline_video-new-1" value="">
          </div>
        </div>
      </form>
    `;

    const result = await new FormVideoHandler().handleKooperationVideos(
      IDS.kooperation,
      document.getElementById('kooperation-form')
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insert failed/);
  });
});
