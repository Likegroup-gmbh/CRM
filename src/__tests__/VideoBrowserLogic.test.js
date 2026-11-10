import { describe, expect, it } from 'vitest';
import {
  EMPTY_SELECTION,
  buildTree,
  clearFrom,
  commentsForAsset,
  deriveAblaufschritt,
  deriveBearbeitungsart,
  detectRatio,
  ersterOffenerInhalt,
  fitFrame,
  markerNah,
  markerProzent,
  nextVariantLetters,
  selectLevel,
  selectionDepth,
  selectionFromSearch,
  selectionToSearch,
  statusOf,
  toHandle,
  validateSelection,
  verlaufFor,
  wartetText,
  withAutoItem
} from '../modules/video-browser/videoBrowserLogic.js';

const raw = () => ({
  kooperationen: [
    { id: 'k1', name: 'Koop A', briefing_id: 'b1', creator: { vorname: 'Mia', nachname: 'Roth', instagram: 'https://instagram.com/mia.roth/' } },
    { id: 'k2', name: 'Koop B', briefing_id: null, creator: { vorname: 'Jan', nachname: 'Voss' } }
  ],
  linien: [{ id: 'b1', name: 'UGC' }],
  videos: [
    { id: 'v1', kooperation_id: 'k1', position: 1, titel: 'Hook', created_at: '2026-01-01' },
    { id: 'v2', kooperation_id: 'k1', position: 2, titel: 'Zweites', created_at: '2026-01-02' },
    { id: 'v3', kooperation_id: 'k2', position: 1, titel: 'Leer', created_at: '2026-01-03' }
  ],
  stories: [{ id: 's1', video_id: 'v1', slot_index: 0, slot_name: 'Story-Slot' }],
  videoAssets: [
    { id: 'a1', video_id: 'v1', version_number: 1, variant_name: 'A', is_final: false, created_at: '2026-02-01' },
    { id: 'a2', video_id: 'v1', version_number: 2, variant_name: 'A', is_final: false, created_at: '2026-02-05' },
    { id: 'a3', video_id: 'v2', version_number: 1, variant_name: 'A', is_final: false, created_at: '2026-02-01' },
    { id: 'f1', video_id: 'v2', version_number: 1, variant_name: '9:16', is_final: true, created_at: '2026-03-01' },
    { id: 'f2', video_id: 'v2', version_number: 1, variant_name: '1:1', is_final: true, created_at: '2026-03-02' }
  ],
  storyAssets: [{ id: 'sa1', story_id: 's1', version_number: 1, variant_name: null, is_final: false, created_at: '2026-02-02' }],
  stillAssets: [{ id: 'st1', video_id: 'v2', is_final: true, file_name: 'still.jpg', created_at: '2026-03-03' }],
  rohmaterial: [{ id: 'r1', kooperation_id: 'k1', file_name: 'clip.mov', file_size: 5 * 1024 * 1024, created_at: '2026-01-10' }],
  slotNotes: [{ id: 'n1', video_id: 'v1', runde: 1, feedback_typ: 'cj', text: 'Hook kürzer', author_name: 'Ben', created_at: '2026-02-02' }],
  zeitkommentare: [
    { id: 'z1', video_id: 'v1', runde: 2, feedback_typ: 'kunde', text: 'Logo früher', timecode_sec: '4.50', asset_id: 'a2', author_name: 'Kunde', created_at: '2026-02-06' }
  ]
});

describe('Ablaufschritt', () => {
  it('leitet den Schritt aus den Daten ab', () => {
    expect(deriveAblaufschritt({})).toBeNull();
    expect(deriveAblaufschritt({ rohmaterialCount: 2 })).toBe(2);
    expect(deriveAblaufschritt({ rohmaterialCount: 2, schleifenCount: 1 })).toBe(4);
    expect(deriveAblaufschritt({ schleifenCount: 1, hatFinal: true })).toBe(5);
  });

  it('Bearbeitungsart: Rohmaterial = intern, sonst extern', () => {
    expect(deriveBearbeitungsart(3)).toBe('intern');
    expect(deriveBearbeitungsart(0)).toBe('extern');
  });
});

describe('Auswahl', () => {
  it('Klick auf Ebene d leert alle tieferen Ebenen', () => {
    const sel = { kooperationId: 'k1', videoId: 'v1', folderId: 's1', itemId: 'a1' };
    expect(selectLevel(sel, 1, 'v2')).toEqual({ kooperationId: 'k1', videoId: 'v2', folderId: null, itemId: null });
  });

  it('Klick auf bereits gewählte Zeile leert nur tiefere Ebenen', () => {
    const sel = { kooperationId: 'k1', videoId: 'v1', folderId: 's1', itemId: 'a1' };
    expect(selectLevel(sel, 1, 'v1')).toEqual({ kooperationId: 'k1', videoId: 'v1', folderId: null, itemId: null });
  });

  it('Pfadleiste leert ab einer Ebene', () => {
    const sel = { kooperationId: 'k1', videoId: 'v1', folderId: 's1', itemId: 'a1' };
    expect(clearFrom(sel, 0)).toEqual(EMPTY_SELECTION);
    expect(clearFrom(sel, 2)).toEqual({ kooperationId: 'k1', videoId: 'v1', folderId: null, itemId: null });
  });

  it('tiefste Ebene', () => {
    expect(selectionDepth(EMPTY_SELECTION)).toBe(-1);
    expect(selectionDepth({ ...EMPTY_SELECTION, kooperationId: 'k1', videoId: 'v1' })).toBe(1);
  });

  it('URL-Roundtrip behält fremde Parameter', () => {
    const search = selectionToSearch('?tab=videos&linie=b1', { kooperationId: 'k1', videoId: 'v1', folderId: 's2', itemId: null });
    expect(search).toBe('?tab=videos&linie=b1&k=k1&v=v1&f=s2');
    expect(selectionFromSearch(search)).toEqual({ kooperationId: 'k1', videoId: 'v1', folderId: 's2', itemId: null });
    expect(selectionToSearch('?tab=videos&k=k1', EMPTY_SELECTION)).toBe('?tab=videos');
  });

  it('URL ohne Eltern ignoriert verwaiste Kinder', () => {
    expect(selectionFromSearch('?v=v1&f=s1')).toEqual(EMPTY_SELECTION);
  });
});

describe('Baum', () => {
  const team = buildTree(raw(), { team: true });
  const kunde = buildTree(raw(), { team: false });

  it('Kooperationen mit Creator, Handle, Linie und Bearbeitungsart', () => {
    const k1 = team.kooperationen[0];
    expect(k1.name).toBe('Mia Roth');
    expect(k1.handle).toBe('@mia.roth');
    expect(k1.linie).toEqual({ id: 'b1', name: 'UGC' });
    expect(k1.mode).toBe('intern');
    expect(k1.videoCount).toBe(2);
    expect(team.kooperationen[1].mode).toBe('extern');
  });

  it('Spalte 1: nur Videos, Stories und Bilder liegen in den Ordnern des Videos', () => {
    const rows = team.kooperationen[0].rows;
    expect(rows.map(r => r.label)).toEqual(['Video 1', 'Video 2']);
    expect(team.kooperationen[0].videoCount).toBe(2);
  });

  it('Story liegt in derselben Runde wie das Video', () => {
    const s1 = team.kooperationen[0].rows[0].folders.find(f => f.id === 's1');
    expect(s1.items.map(i => [i.type, i.group])).toEqual([['video', 'Videos'], ['story', 'Stories']]);
    expect(s1.items[1].name).toBe('Story 1');
    expect(s1.meta).toBe('2 Dateien');
  });

  it('Bilder einer Runde stehen zwischen Videos und Stories, Altbilder am ersten Video', () => {
    const data = raw();
    data.stillAssets = [
      { id: 'b1', video_id: 'v1', version_number: 1, is_final: false, file_name: 'a_2.jpg', created_at: '2026-02-03' },
      { id: 'b2', video_id: 'v1', version_number: 1, is_final: false, file_name: 'a_1.jpg', created_at: '2026-02-04' },
      { id: 'alt', video_id: null, kooperation_id: 'k1', version_number: 3, is_final: false, file_name: 'alt.jpg', created_at: '2026-01-02' }
    ];
    const t = buildTree(data, { team: true });
    const v1 = t.kooperationen[0].rows[0];
    const s1 = v1.folders.find(f => f.id === 's1');
    expect(s1.items.map(i => `${i.group}:${i.name}`)).toEqual(['Videos:Video A', 'Bilder:Bild 1', 'Bilder:Bild 2', 'Stories:Story 1']);
    expect(s1.items[1].asset.id).toBe('b2');
    expect(v1.folders.find(f => f.id === 's3').items.map(i => i.asset.id)).toEqual(['alt']);
    expect(t.kooperationen[0].rows[1].folders.some(f => f.items.some(i => i.asset.id === 'alt'))).toBe(false);
  });

  it('Dateititel schlägt die abgeleiteten Namen, ohne Titel bleibt alles wie bisher', () => {
    const data = raw();
    data.videoAssets[0].titel = 'Interview Kudamm';
    data.storyAssets[0].titel = 'Story Teaser';
    data.rohmaterial[0].titel = 'Rohschnitt';
    data.videoAssets.find(a => a.id === 'f1').titel = 'Final Hochkant';
    data.stillAssets.push({ id: 'b1', video_id: 'v1', version_number: 1, is_final: false, file_name: 'x_v1_01.jpg', titel: 'Cover', created_at: '2026-02-03' });
    const t = buildTree(data, { team: true });
    const [v1, v2] = t.kooperationen[0].rows;
    const s1 = v1.folders.find(f => f.id === 's1');
    expect(s1.items.map(i => i.name)).toEqual(['Interview Kudamm', 'Cover', 'Story Teaser']);
    expect(v1.folders.find(f => f.kind === 'raw').items[0].name).toBe('Rohschnitt');
    expect(v1.folders.find(f => f.id === 's2').items[0].name).toBe('Video A');
    const final = v2.folders.find(f => f.kind === 'final').items;
    expect(final.find(i => i.id === 'f1').name).toBe('Final Hochkant');
    expect(final.find(i => i.id === 'f2').name).toBe('Finale Version 1:1');
  });

  it('Finale Version ohne eigenen Titel übernimmt den Titel der Quelldatei', () => {
    const data = raw();
    data.videoAssets.push({ id: 'q1', video_id: 'v1', version_number: 1, is_final: false, titel: 'Interview Kudamm', created_at: '2026-02-01' });
    data.videoAssets.push({ id: 'qf', video_id: 'v1', version_number: 1, variant_name: '9:16', is_final: true, source_asset_id: 'q1', created_at: '2026-02-09' });
    const t = buildTree(data, { team: true });
    const v1 = t.kooperationen[0].rows.find(r => r.id === 'v1');
    expect(v1.folders.find(f => f.kind === 'final').items.find(i => i.id === 'qf').name).toBe('Interview Kudamm');
  });

  it('Runde, die nur Story oder Bild enthält, existiert trotzdem', () => {
    const data = raw();
    data.storyAssets.push({ id: 'sa2', story_id: 's1', version_number: 3, is_final: false, created_at: '2026-02-20' });
    const t = buildTree(data, { team: true });
    const v1 = t.kooperationen[0].rows[0];
    expect(v1.folders.filter(f => f.kind === 'schleife').map(f => f.id)).toEqual(['s1', 's2', 's3']);
    expect(v1.folders.find(f => f.id === 's3').current).toBe(true);
    expect(v1.folders.find(f => f.id === 's2').current).toBe(false);
  });

  it('Finale Version enthält Videos, Bilder und Stories', () => {
    const data = raw();
    data.storyAssets.push({ id: 'sf1', story_id: 's1', version_number: 1, variant_name: '9:16', is_final: true, created_at: '2026-03-05' });
    const t = buildTree(data, { team: true });
    const v2 = t.kooperationen[0].rows.find(r => r.id === 'v2');
    expect(v2.folders.find(f => f.id === 'final').items.map(i => i.group)).toEqual(['Videos', 'Videos', 'Bilder']);
    const v1 = t.kooperationen[0].rows.find(r => r.id === 'v1');
    const final = v1.folders.find(f => f.id === 'final');
    expect(final.items.map(i => [i.type, i.name])).toEqual([['story', 'Story 1 · 9:16']]);
    expect(v1.status.key).toBe('freigegeben');
  });

  it('Team sieht Rohmaterial, Feedbackschleifen, die nächste leere Schleife und den leeren Ordner Finale Version', () => {
    const v1 = team.kooperationen[0].rows[0];
    expect(v1.folders.map(f => f.id)).toEqual(['raw', 's1', 's2', 's3', 'final']);
    expect(v1.folders[3].leer).toBe(true);
    const final = v1.folders[4];
    expect(final).toMatchObject({ leer: true, upload: true, status: null, meta: 'Noch leer', items: [] });
    // Der leere Ordner ändert weder Ablaufschritt noch Status noch die Schleifen
    expect(v1.stage).toBe(4);
    expect(v1.status.key).toBe('wartet');
    expect(v1.folders.find(f => f.id === 's2').current).toBe(true);
  });

  it('Kunde sieht den Ordner Finale Version erst mit Inhalt', () => {
    expect(kunde.kooperationen[0].rows[0].folders.some(f => f.kind === 'final')).toBe(false);
    const v2 = kunde.kooperationen[0].rows.find(r => r.id === 'v2');
    expect(v2.folders.some(f => f.kind === 'final')).toBe(true);
  });

  it('Finale Dateien liegen nach Format sortiert: 9:16, 4:5, 1:1', () => {
    const data = raw();
    data.videoAssets.push(
      { id: 'f3', video_id: 'v2', version_number: 1, variant_name: '1:1', is_final: true, created_at: '2026-03-01' },
      { id: 'f4', video_id: 'v2', version_number: 1, variant_name: '4:5', is_final: true, created_at: '2026-03-04' },
      { id: 'f5', video_id: 'v2', version_number: 1, variant_name: '9:16', is_final: true, created_at: '2026-03-05' }
    );
    const v2 = buildTree(data, { team: true }).kooperationen[0].rows.find(r => r.id === 'v2');
    const videos = v2.folders.find(f => f.id === 'final').items.filter(i => i.type === 'video');
    expect(videos.map(i => i.ratio)).toEqual(['9:16', '9:16', '4:5', '1:1', '1:1']);
  });

  it('Kunde sieht kein Rohmaterial und keine leeren Schleifen', () => {
    const v1 = kunde.kooperationen[0].rows[0];
    expect(v1.folders.map(f => f.id)).toEqual(['s1', 's2']);
    const leer = kunde.kooperationen[1].rows[0];
    expect(leer.folders).toEqual([]);
  });

  it('aktuelle Schleife ist die letzte ohne Finale Version, ältere sind abgeschlossen', () => {
    const [s1, s2] = team.kooperationen[0].rows[0].folders.filter(f => f.id === 's1' || f.id === 's2');
    expect(s1.current).toBe(false);
    expect(s2.current).toBe(true);
  });

  it('Status sagt, wer am Zug ist: wartet, Änderungen angefordert, freigegeben', () => {
    const v1 = team.kooperationen[0].rows[0];
    const [s1, s2] = v1.folders.filter(f => f.id === 's1' || f.id === 's2');
    expect(s1.status.key).toBe('aenderungen');
    expect(s1.status.label).toBe('Änderungen angefordert');
    expect(s2.status.key).toBe('wartet');
    expect(s2.status.label).toBe('Wartet auf Kunde');
    expect(v1.status.key).toBe('wartet');
    // Dateien der Schleife tragen den Status der Schleife
    expect(s2.items[0].status.key).toBe('wartet');
    // Ordner tragen keinen Zähler mehr, der steht an Kooperation (Summe) und Zeile
    expect(s2.badge).toBeUndefined();
    // Seit wann: Datum der jüngsten Datei
    expect(s2.since).toBe('2026-02-05');
  });

  it('Kunde sieht "Zu prüfen" statt "Wartet auf Kunde"', () => {
    const s2 = kunde.kooperationen[0].rows[0].folders.find(f => f.id === 's2');
    expect(s2.status.key).toBe('wartet');
    expect(s2.status.label).toBe('Zu prüfen');
    expect(statusOf('freigegeben', false).label).toBe('Freigegeben');
  });

  it('Mit Finaler Version ist die letzte Schleife freigegeben, die früheren nicht', () => {
    const data = raw();
    data.videoAssets.push({ id: 'a4', video_id: 'v2', version_number: 2, variant_name: 'A', is_final: false, created_at: '2026-02-10' });
    const t = buildTree(data, { team: true });
    const folders = t.kooperationen[0].rows.find(r => r.id === 'v2').folders;
    expect(folders.find(f => f.id === 's1').status.key).toBe('aenderungen');
    expect(folders.find(f => f.id === 's2').status.key).toBe('freigegeben');
    expect(folders.find(f => f.id === 'final').status.key).toBe('freigegeben');
  });

  it('wartetText: seit heute, seit 1 Tag, seit n Tagen', () => {
    const now = new Date('2026-02-10T12:00:00Z');
    expect(wartetText('2026-02-10T08:00:00Z', now)).toBe('Wartet seit heute auf den Kunden.');
    expect(wartetText('2026-02-09T08:00:00Z', now)).toBe('Wartet seit 1 Tag auf den Kunden.');
    expect(wartetText('2026-02-05T08:00:00Z', now)).toBe('Wartet seit 5 Tagen auf den Kunden.');
    expect(wartetText(null, now)).toBe('Wartet auf den Kunden.');
  });

  it('Ordner mit genau einer Datei öffnet direkt die Datei, Rohmaterial und Mehrfach-Ordner nicht', () => {
    const base = { kooperationId: 'k1', videoId: 'v1' };
    expect(withAutoItem({ ...base, folderId: 's2', itemId: null }, team).itemId).toBe('a2');
    // schon gewählte Datei bleibt
    expect(withAutoItem({ ...base, folderId: 's2', itemId: 'a2' }, team).itemId).toBe('a2');
    // Rohmaterial: Liste bleibt der Inhalt
    expect(withAutoItem({ ...base, folderId: 'raw', itemId: null }, team).itemId).toBeNull();
    // leerer Ordner
    expect(withAutoItem({ ...base, folderId: 's3', itemId: null }, team).itemId).toBeNull();
  });

  it('Finale Version: ein File je Seitenverhältnis plus Stills, Schleifen abgeschlossen', () => {
    const v2 = team.kooperationen[0].rows.find(r => r.id === 'v2');
    expect(v2.stage).toBe(5);
    expect(v2.status.key).toBe('freigegeben');
    const final = v2.folders.find(f => f.id === 'final');
    expect(final.meta).toBe('3 Inhalte · 9:16, 1:1');
    expect(final.items.map(i => i.group)).toEqual(['Videos', 'Videos', 'Bilder']);
    expect(v2.folders.find(f => f.id === 's1').current).toBe(false);
    expect(v2.folders.some(f => f.leer && f.kind === 'schleife')).toBe(false);
    expect(v2.offeneCount).toBe(0);
  });

  it('Kommentare: Slot-Notiz und Timecode-Kommentar je Datei', () => {
    const v1 = team.kooperationen[0].rows[0];
    expect(v1.comments).toHaveLength(2);
    const z = v1.comments.find(c => c.timecodeSec !== null);
    expect(z.timecodeSec).toBe(4.5);
    expect(z.author.role).toBe('kunde');
    expect(commentsForAsset(v1.comments, 2, 'a2')).toHaveLength(1);
    expect(commentsForAsset(v1.comments, 2, 'andere')).toHaveLength(0);
    expect(commentsForAsset(v1.comments, 1, 'a1')).toHaveLength(1);
  });

  it('Zähler der Kooperation = offene Dateien der aktuellen Runden', () => {
    expect(team.kooperationen[0].offeneCount).toBe(1);
    const data = raw();
    data.storyAssets.push({ id: 'sa2', story_id: 's1', version_number: 2, is_final: false, created_at: '2026-02-06' });
    data.stillAssets = [{ id: 'b1', video_id: 'v1', version_number: 2, is_final: false, created_at: '2026-02-06' }];
    expect(buildTree(data, { team: true }).kooperationen[0].offeneCount).toBe(3);
  });

  it('Kommentare: Bild-Notizen nur an Bildern, Story ohne Zeitstempel-Kommentare', () => {
    const data = raw();
    data.stillNotes = [{ id: 'sn1', video_id: 'v1', runde: 2, feedback_typ: 'kunde', text: 'Bild 2 heller', author_name: 'Kunde', created_at: '2026-02-07' }];
    const v1 = buildTree(data, { team: true }).kooperationen[0].rows[0];
    expect(commentsForAsset(v1.comments, 2, 'x', 'still').map(c => c.text)).toEqual(['Bild 2 heller']);
    expect(commentsForAsset(v1.comments, 2, 'a2', 'video').map(c => c.text)).toEqual(['Logo früher']);
    expect(commentsForAsset(v1.comments, 2, 'x', 'story')).toEqual([]);
    expect(commentsForAsset(v1.comments, 1, 'x', 'story').map(c => c.text)).toEqual(['Hook kürzer']);
  });

  it('erster offener Inhalt', () => {
    expect(ersterOffenerInhalt(kunde)).toEqual({
      kooperationId: 'k1', videoId: 'v1', folderId: 's2', itemId: 'a2'
    });
  });
});

describe('Varianten und Verlauf', () => {
  const tree = buildTree(raw(), { team: true });
  const v1 = tree.kooperationen[0].rows[0];

  it('vergibt den nächsten freien Buchstaben über alle Schleifen', () => {
    expect(nextVariantLetters(v1, 1)).toEqual(['B']);
    expect(nextVariantLetters({ folders: [] }, 2)).toEqual(['A', 'B']);
  });

  it('Verlauf: dieselbe Variante über die Schleifen, aktueller Eintrag markiert', () => {
    const item = v1.folders.find(f => f.id === 's2').items[0];
    const verlauf = verlaufFor(v1, item);
    expect(verlauf.map(e => e.label)).toEqual(['Feedbackschleife 1', 'Feedbackschleife 2']);
    expect(verlauf.find(e => e.current).itemId).toBe('a2');
  });

  it('Verlauf: Finale Version verweist über source_asset_id auf die Variante', () => {
    const data = raw();
    data.videoAssets.push({ id: 'f3', video_id: 'v1', version_number: 1, variant_name: '9:16', is_final: true, source_asset_id: 'a2', created_at: '2026-03-01' });
    const t = buildTree(data, { team: true });
    const row = t.kooperationen[0].rows[0];
    const finalItem = row.folders.find(f => f.id === 'final').items[0];
    const verlauf = verlaufFor(row, finalItem);
    expect(verlauf.map(e => e.label)).toEqual(['Feedbackschleife 1', 'Feedbackschleife 2', 'Finale Version 9:16']);
    expect(verlauf[2].current).toBe(true);
  });

  it('kein Verlauf ohne Variantennamen', () => {
    const item = { id: 'x', type: 'video', asset: { variant_name: null } };
    expect(verlaufFor(v1, item)).toEqual([]);
  });
});

describe('validateSelection', () => {
  const tree = buildTree(raw(), { team: true });

  it('behält gültige Auswahl', () => {
    const sel = { kooperationId: 'k1', videoId: 'v1', folderId: 's2', itemId: 'a2' };
    expect(validateSelection(sel, tree)).toEqual(sel);
  });

  it('leert ab der ersten unsichtbaren Ebene', () => {
    const kunde = buildTree(raw(), { team: false });
    const sel = { kooperationId: 'k1', videoId: 'v1', folderId: 'raw', itemId: 'r1' };
    expect(validateSelection(sel, kunde)).toEqual({ kooperationId: 'k1', videoId: 'v1', folderId: null, itemId: null });
    expect(validateSelection({ kooperationId: 'weg', videoId: 'v1', folderId: null, itemId: null }, tree)).toEqual(EMPTY_SELECTION);
  });
});

describe('Vorschau', () => {
  it('fitFrame passt den Rahmen in die Box', () => {
    expect(fitFrame('9:16', 300, 360)).toEqual({ w: 203, h: 360 });
    expect(fitFrame('1:1', 300, 360)).toEqual({ w: 300, h: 300 });
    expect(fitFrame('4:5', 300, 360)).toEqual({ w: 288, h: 360 });
  });

  it('Marker auf der Zeitleiste', () => {
    expect(markerProzent(5, 20)).toBe(25);
    expect(markerProzent(5, 0)).toBe(0);
    expect(markerNah(5, 5.5)).toBe(true);
    expect(markerNah(5, 6)).toBe(false);
  });

  it('Format aus den Pixelmaßen: Standardformate mit Toleranz, sonst null', () => {
    expect(detectRatio(1080, 1920)).toBe('9:16');
    expect(detectRatio(1080, 1918)).toBe('9:16');
    expect(detectRatio(1080, 1350)).toBe('4:5');
    expect(detectRatio(1080, 1080)).toBe('1:1');
    expect(detectRatio(1920, 1080)).toBeNull();
    expect(detectRatio(0, 0)).toBeNull();
    expect(detectRatio(undefined, 1080)).toBeNull();
  });

  it('Handle aus URL oder Handle', () => {
    expect(toHandle('@foo')).toBe('@foo');
    expect(toHandle('https://www.instagram.com/foo/?hl=de')).toBe('@foo');
    expect(toHandle('')).toBe('');
  });
});
