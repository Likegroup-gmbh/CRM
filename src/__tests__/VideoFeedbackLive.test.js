import { describe, it, expect, afterEach } from 'vitest';
import { VideoTableRealtimeHandler } from '../modules/kampagne/VideoTableRealtimeHandler.js';

function commentQuery(rows) {
  const result = Promise.resolve({ data: rows, error: null });
  const chain = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    order: () => result
  };
  return chain;
}

function tableWith(videoId) {
  return {
    videos: { k1: [{ id: videoId }] },
    videoComments: {},
    feedbackSaveController: { isDirty: () => false },
    _rowHeightSync: { schedule() {} }
  };
}

describe('Feedback kommt ohne Neuladen an', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete window.supabase;
  });

  it('zeigt den Text aus dem Live-Update, auch wenn die Nachlese leer ist', async () => {
    document.body.innerHTML = `
      <textarea data-entity="video" data-id="v1" data-field="feedback_kunde_r1"></textarea>
    `;
    window.supabase = { from: () => commentQuery([]) };
    const table = tableWith('v1');

    await new VideoTableRealtimeHandler(table).handleCommentChange({
      new: {
        video_id: 'v1',
        runde: 1,
        feedback_typ: 'kunde',
        text: 'Bitte den Hook kürzen',
        deleted_at: null
      }
    });

    expect(document.querySelector('textarea').value).toBe('Bitte den Hook kürzen');
  });

  it('lässt ein Zeilen-Update die schon gefüllte Feedback-Zelle stehen', () => {
    document.body.innerHTML = `
      <textarea data-entity="video" data-id="v1" data-field="feedback_cj_r1">Passt so</textarea>
      <input data-entity="video" data-id="v1" data-field="video_name" value="Alt" />
    `;
    const table = tableWith('v1');
    table.videoComments.v1 = { cjR1: [{ text: 'Passt so' }] };

    new VideoTableRealtimeHandler(table).updateVideoFieldsInDOM('v1', {
      id: 'v1',
      video_name: 'Neu',
      feedback_cj_r1: null
    });

    expect(document.querySelector('textarea').value).toBe('Passt so');
    expect(document.querySelector('input').value).toBe('Neu');
  });
});
