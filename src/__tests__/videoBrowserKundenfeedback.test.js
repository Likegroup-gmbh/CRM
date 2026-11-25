import { describe, expect, it } from 'vitest';
import { buildTree, ersterOffenerInhalt, feedbackText, statusOf } from '../modules/video-browser/videoBrowserLogic.js';
import { kannFreigeben } from '../modules/video-browser/videoBrowserFreigabe.js';
import { naechsterSchritt, renderDetail } from '../modules/video-browser/videoBrowserRenderDetail.js';

// Ein Video mit einer Datei in Feedbackschleife 1
const raw = (extra = {}) => ({
  kooperationen: [{ id: 'k1', name: 'Koop A', briefing_id: null, creator: { vorname: 'Mia', nachname: 'Roth' } }],
  videos: [{ id: 'v1', kooperation_id: 'k1', position: 1, titel: 'Hook', created_at: '2026-01-01' }],
  stories: [],
  videoAssets: [{ id: 'a1', video_id: 'v1', version_number: 1, is_final: false, created_at: '2026-02-01T10:00:00Z' }],
  storyAssets: [],
  stillAssets: [],
  slotNotes: [],
  zeitkommentare: [],
  stillNotes: [],
  ...extra
});

const kommentar = (id, runde, extra = {}) => ({
  id, video_id: 'v1', runde, feedback_typ: 'kunde', text: 'Bitte kürzer', author_name: 'Kunde', created_at: '2026-02-02T10:00:00Z', ...extra
});
const bild = (id, created_at = '2026-02-01T10:00:00Z') => ({ id, video_id: 'v1', kooperation_id: 'k1', version_number: 1, file_name: `${id}.jpg`, is_final: false, created_at });

const treeOf = (data, team = true) => buildTree(data, { team });
const rowOf = (data, team = true) => treeOf(data, team).kooperationen[0].rows[0];
const schleife = (row, n) => row.folders.find(f => f.id === `s${n}`);
const statusJeDatei = (folder) => Object.fromEntries(folder.items.map(i => [i.id, i.status.key]));

describe('Kundenfeedback in der aktuellen Feedbackschleife', () => {
  it('ohne Kundenfeedback wartet die Datei auf den Kunden', () => {
    const row = rowOf(raw());
    expect(row.status.key).toBe('wartet');
    expect(schleife(row, 1).status.key).toBe('wartet');
    expect(row.offeneCount).toBe(1);
  });

  it('Kundenkommentar an der Datei: Datei, Schleife und Video haben Feedback, nichts zählt mehr', () => {
    const data = raw({ zeitkommentare: [kommentar('z1', 1, { asset_id: 'a1', timecode_sec: '2.00' })] });
    const tree = treeOf(data);
    const row = tree.kooperationen[0].rows[0];
    expect(statusJeDatei(schleife(row, 1))).toEqual({ a1: 'feedback' });
    expect(schleife(row, 1).status).toEqual({ key: 'feedback', label: 'Feedback erhalten', tone: 'info' });
    expect(row.status.key).toBe('feedback');
    expect(row.offeneCount).toBe(0);
    expect(tree.kooperationen[0].offeneCount).toBe(0);
    expect(ersterOffenerInhalt(treeOf(data, false))).toBeNull();
    expect(rowOf(data, false).status.label).toBe('Feedback gegeben');
    expect(statusOf('feedback', false).label).toBe('Feedback gegeben');
  });

  it('teilweise: Video kommentiert, Bild nicht. Die Schleife wartet, gezählt und geöffnet wird das Bild', () => {
    const data = raw({
      stillAssets: [bild('b1')],
      zeitkommentare: [kommentar('z1', 1, { asset_id: 'a1' })]
    });
    const row = rowOf(data);
    expect(statusJeDatei(schleife(row, 1))).toEqual({ a1: 'feedback', b1: 'wartet' });
    expect(schleife(row, 1).status.key).toBe('wartet');
    expect(row.status.key).toBe('wartet');
    expect(row.offeneCount).toBe(1);
    expect(ersterOffenerInhalt(treeOf(data, false))).toEqual({ kooperationId: 'k1', videoId: 'v1', folderId: 's1', itemId: 'b1' });
  });

  it('Runden-Notiz (Kunde Feedback N) gilt für Videos und Stories, nicht für Bilder; die Bild-Notiz für Bilder', () => {
    const data = raw({
      stories: [{ id: 's1', video_id: 'v1', slot_index: 0 }],
      storyAssets: [{ id: 'sa1', video_id: 'v1', story_id: 's1', version_number: 1, is_final: false, created_at: '2026-02-01T10:00:00Z' }],
      stillAssets: [bild('b1')],
      slotNotes: [kommentar('n1', 1)]
    });
    expect(statusJeDatei(schleife(rowOf(data), 1))).toEqual({ a1: 'feedback', sa1: 'feedback', b1: 'wartet' });

    data.stillNotes = [kommentar('sn1', 1, { text: 'Bild heller' })];
    const row = rowOf(data);
    expect(statusJeDatei(schleife(row, 1))).toEqual({ a1: 'feedback', sa1: 'feedback', b1: 'feedback' });
    expect(row.status.key).toBe('feedback');
  });

  it('Team-Kommentare zählen nicht als Kundenfeedback', () => {
    const data = raw({
      zeitkommentare: [kommentar('z1', 1, { asset_id: 'a1', feedback_typ: 'cj', author_name: 'Ben' })],
      slotNotes: [kommentar('n1', 1, { feedback_typ: 'cj' })]
    });
    expect(rowOf(data).status.key).toBe('wartet');
  });

  it('ein älterer Kommentar gilt nicht für eine Datei, die danach in dieselbe Schleife kam', () => {
    const data = raw({ slotNotes: [kommentar('n1', 1)] });
    data.videoAssets.push({ id: 'a3', video_id: 'v1', version_number: 1, is_final: false, created_at: '2026-02-03T10:00:00Z' });
    const row = rowOf(data);
    expect(statusJeDatei(schleife(row, 1))).toEqual({ a1: 'feedback', a3: 'wartet' });
    expect(row.offeneCount).toBe(1);
  });

  it('jüngste Runde nur aus Kommentaren: nicht gelb, der leere Ordner hat keinen Status', () => {
    const data = raw({ slotNotes: [kommentar('n2', 2)] });
    const row = rowOf(data);
    expect(schleife(row, 2)).toMatchObject({ leer: true, current: true, status: null });
    expect(schleife(row, 1).status.key).toBe('aenderungen');
    expect(row.status.key).toBe('aenderungen');
    expect(row.offeneCount).toBe(0);
    expect(rowOf(data, false).status.key).toBe('aenderungen');
  });

  it('die Kundenseite kann nach ihrem Feedback weiter freigeben', () => {
    const data = raw({ zeitkommentare: [kommentar('z1', 1, { asset_id: 'a1' })] });
    expect(kannFreigeben({ team: false, canComment: true }, rowOf(data, false))).toBe(true);
  });
});

describe('Texte nach dem Kundenfeedback', () => {
  const data = raw({ zeitkommentare: [kommentar('z1', 1, { asset_id: 'a1' })] });

  it('Nächster Schritt: das Team legt die Überarbeitung in der nächsten Schleife ab, der Kunde wartet', () => {
    expect(naechsterSchritt(rowOf(data), true)).toEqual({
      text: 'Kundenfeedback liegt vor. Die Überarbeitung kommt in Feedbackschleife 2.',
      ziel: 's2',
      label: 'Zur nächsten Feedbackschleife'
    });
    expect(naechsterSchritt(rowOf(data, false), false)).toEqual({
      text: 'Dein Feedback ist beim Team. Die Überarbeitung erscheint in Feedbackschleife 2.',
      ziel: 's1',
      label: 'Zur Feedbackschleife'
    });
  });

  it('nach der letzten möglichen Schleife ohne Ziel', () => {
    expect(feedbackText(3, true)).toBe('Kundenfeedback liegt vor. Die Überarbeitung steht an.');
    expect(feedbackText(3, false)).toBe('Dein Feedback ist beim Team. Die Überarbeitung erscheint hier, sobald sie bereitsteht.');
  });

  it('Was gerade ansteht (Team): Überarbeitung statt "beim Kunden"', () => {
    document.body.innerHTML = renderDetail({ tree: treeOf(data), team: true, resolved: {}, zeigeLinie: false });
    const todo = document.querySelector('.vb-todo');
    expect(todo.textContent).toContain('Kundenfeedback liegt vor (Feedbackschleife 1), Überarbeitung steht an');
    expect(todo.dataset.gotoFolder).toBe('s2');
  });
});
