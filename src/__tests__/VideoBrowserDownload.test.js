import { describe, expect, it, vi } from 'vitest';

vi.mock('../core/media/downloadMediaAsset.js', () => ({
  downloadMediaAsset: vi.fn(async () => true)
}));

const { collectDownloadItems, currentFolderOf } = await import('../modules/video-browser/videoBrowserLogic.js');
const { downloadFileName, downloadItems } = await import('../modules/video-browser/videoBrowserDownload.js');
const { downloadMediaAsset } = await import('../core/media/downloadMediaAsset.js');

const file = (id, extra = {}) => ({
  id, type: 'video', version: 1, asset: { id, file_path: `/p/${id}.mp4`, ...extra }
});

const rowMitFinal = {
  id: 'v1', number: 1, label: 'Video 1',
  folders: [
    { id: 'raw', kind: 'raw', items: [{ id: 'r1', type: 'roh', asset: { file_path: '/p/roh.mov' } }] },
    { id: 's1', kind: 'schleife', items: [file('a1', { variant_name: 'A', version_number: 1 })] },
    { id: 'final', kind: 'final', items: [file('f1', { is_final: true, variant_name: '9x16' }), file('f2', { is_final: true })] }
  ]
};
const rowNurSchleifen = {
  id: 'v2', number: 2, label: 'Video 2',
  folders: [
    { id: 's1', kind: 'schleife', items: [file('b1')] },
    { id: 's2', kind: 'schleife', items: [file('b2'), file('b3', { file_path: null, file_url: null })] }
  ]
};
const koop = { id: 'k1', name: 'Mia Roth', rows: [rowMitFinal, rowNurSchleifen] };

describe('Video-Browser Downloads', () => {
  it('currentFolderOf: Finale Version vor jüngster Schleife, Rohmaterial nie', () => {
    expect(currentFolderOf(rowMitFinal).id).toBe('final');
    expect(currentFolderOf(rowNurSchleifen).id).toBe('s2');
    expect(currentFolderOf({ folders: [{ id: 'raw', kind: 'raw', items: [file('x')] }] })).toBeNull();
  });

  it('Kooperation: je Video der aktuelle Stand, ohne Dateien ohne Pfad', () => {
    const ids = collectDownloadItems('koop', { koop }).map(e => e.item.id);
    expect(ids).toEqual(['f1', 'f2', 'b2']);
  });

  it('Ordner: alle Dateien des Ordners', () => {
    const folder = rowMitFinal.folders[2];
    const ids = collectDownloadItems('folder', { row: rowMitFinal, folder }).map(e => e.item.id);
    expect(ids).toEqual(['f1', 'f2']);
  });

  it('Einzeln: genau die gewählte Datei', () => {
    const item = rowMitFinal.folders[1].items[0];
    expect(collectDownloadItems('item', { row: rowMitFinal, item })).toHaveLength(1);
    expect(collectDownloadItems('item', { row: rowMitFinal })).toHaveLength(0);
  });

  it('Dateiname: Variante hängt an Schleifen-Dateien, Finals bleiben unverändert', () => {
    const meta = { creatorName: 'Mia Roth', unternehmen: 'Acme', kampagne: 'Sommer' };
    const loop = downloadFileName({ item: rowMitFinal.folders[1].items[0], row: rowMitFinal }, meta);
    expect(loop).toMatch(/_1_v1_A\.mp4$/);
    const final = downloadFileName({ item: rowMitFinal.folders[2].items[0], row: rowMitFinal }, meta);
    expect(final).toMatch(/final/);
    expect(final).not.toMatch(/_A\./);
  });

  it('Mehrfach-Download lädt alle Dateien nacheinander und meldet das Ergebnis', async () => {
    vi.useFakeTimers();
    const toast = vi.fn();
    const entries = collectDownloadItems('koop', { koop });
    const run = downloadItems(entries, { creatorName: 'Mia Roth' }, { toast });
    await vi.runAllTimersAsync();
    const result = await run;
    vi.useRealTimers();
    expect(result).toEqual({ done: 3, failed: 0 });
    expect(downloadMediaAsset).toHaveBeenCalledTimes(3);
    expect(toast).toHaveBeenLastCalledWith('success', '3/3 Dateien heruntergeladen');
  });
});
