import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const k = require('../../netlify/functions/_shared/ablage/klassifizierung.js');

const KO = 'ko1';
const V = 'v1';
const besitz = { unternehmen_id: 'u1', marke_id: null, kampagne_id: 'ka1', kooperation_id: KO };
const reg = (art, extra = {}) => ({ id: `r-${art}`, item_id: `i-${art}`, parent_item_id: 'p', name: art, pfad: `/x/${art}`, art, ...besitz, ...extra });

const R = {
  kooperation: reg('kooperation'),
  videos: reg('typ', { typ: 'videos' }),
  bilder: reg('typ', { typ: 'bilder' }),
  roh: reg('typ', { typ: 'rohmaterial' }),
  video: reg('video', { typ: 'videos', kooperation_video_id: V }),
  schleife: reg('schleife', { typ: 'videos', kooperation_video_id: V, version_number: 2 }),
  variante: reg('variante', { typ: 'videos', kooperation_video_id: V, version_number: 2, variante: 'B', name: 'B' }),
  finale: reg('finale', { typ: 'videos', kooperation_video_id: V }),
  format: reg('format', { typ: 'videos', kooperation_video_id: V, format: '4-5', name: '4-5' }),
  storyVideo: reg('video', { typ: 'storys', kooperation_video_id: V }),
  story: reg('story', { typ: 'storys', kooperation_video_id: V, story_nummer: 3 }),
  storySchleife: reg('schleife', { typ: 'storys', kooperation_video_id: V, story_nummer: 3, version_number: 1 }),
  storyFinale: reg('finale', { typ: 'storys', kooperation_video_id: V, story_nummer: 3 }),
  bilderVideo: reg('video', { typ: 'bilder', kooperation_video_id: V }),
  bilderSchleife: reg('schleife', { typ: 'bilder', kooperation_video_id: V, version_number: 1 }),
  frei: reg('frei', { typ: 'videos', kooperation_video_id: V }),
  test: { id: 'r-test', item_id: 'i-test', art: 'test', name: '_Test', pfad: '/_Test' },
};

const datei = (eltern, extra = {}) => k.dateiEinordnen({ item: { name: 'clip.mov', ...extra.item }, eltern, versuche: 1, jetztMs: Date.parse('2026-11-09T12:00:00Z'), ...extra });
const videoAsset = (row = {}) => ({ typ: 'video', row: { id: 'a1', video_id: V, version_number: 1, variant_name: null, is_final: false, ...row } });

describe('dateiEinordnen: Fachordner bestimmen die Bedeutung', () => {
  it('Datei in einer Variante -> Video-Asset mit Schleife und Variante', () => {
    expect(datei(R.variante)).toEqual({
      aktion: 'asset', typ: 'video', umziehen: false,
      ziel: { kooperation_id: KO, kooperation_video_id: V, story_nummer: null, version_number: 2, is_final: false, variant_name: 'B' },
    });
  });

  it('lose Datei in einer Video-Schleife -> Varianten-Ordner anlegen und verschieben', () => {
    const d = datei(R.schleife);
    expect(d.aktion).toBe('variante');
    expect(d.ziel).toMatchObject({ kooperation_video_id: V, version_number: 2, is_final: false });
  });

  it('CRM-Upload ohne Variante direkt in der Schleife bleibt liegen (keine Verschiebung)', () => {
    const d = datei(R.schleife, { asset: videoAsset({ version_number: 1 }) });
    expect(d).toMatchObject({ aktion: 'asset', typ: 'video', ziel: { version_number: 2, variant_name: null } });
  });

  it('Finale Version: Pixelmass entscheidet den Formatordner', () => {
    expect(datei(R.finale, { item: { breite: 1080, hoehe: 1920 } })).toMatchObject({ aktion: 'format', format: '9:16', ziel: { is_final: true, variant_name: '9:16' } });
    expect(datei(R.finale, { item: { breite: 1080, hoehe: 1350 } })).toMatchObject({ aktion: 'format', format: '4:5' });
    expect(datei(R.finale, { item: { breite: 1080, hoehe: 1080 } })).toMatchObject({ aktion: 'format', format: '1:1' });
  });

  it('Finale ohne Mass: erst warten (video-Facet kommt spaeter), dann Nicht zugeordnet', () => {
    expect(datei(R.finale, { versuche: 1 })).toMatchObject({ aktion: 'warten', grund: 'kein_mass' });
    expect(datei(R.finale, { versuche: k.MASS_VERSUCHE })).toMatchObject({ aktion: 'unzugeordnet', grund: 'format_unbekannt' });
  });

  it('Finale mit 16:9 -> sofort Nicht zugeordnet', () => {
    expect(datei(R.finale, { item: { breite: 1920, hoehe: 1080 } })).toMatchObject({ aktion: 'unzugeordnet', grund: 'format_unbekannt', breite: 1920 });
  });

  it('Datei im Formatordner -> finales Asset mit Format als Variante', () => {
    expect(datei(R.format)).toMatchObject({ aktion: 'asset', typ: 'video', ziel: { is_final: true, variant_name: '4:5', version_number: 1 } });
  });

  it('bestehende Finale direkt in Finale_Version (kein Standardformat) bleibt, wo sie ist', () => {
    const d = datei(R.finale, { asset: videoAsset({ is_final: true, variant_name: 'Hook' }) });
    expect(d).toMatchObject({ aktion: 'asset', ziel: { is_final: true, variant_name: 'Hook' } });
  });

  it('Storys: Schleife direkt -> Story-Asset, Finale direkt -> finale Story', () => {
    expect(datei(R.storySchleife)).toMatchObject({ aktion: 'asset', typ: 'story', ziel: { story_nummer: 3, version_number: 1, is_final: false, variant_name: null } });
    expect(datei(R.storyFinale)).toMatchObject({ aktion: 'asset', typ: 'story', ziel: { story_nummer: 3, is_final: true } });
  });

  it('Bilder: Bilder-Ordner ohne Video, Video-Schleife mit Video', () => {
    expect(datei(R.bilder)).toMatchObject({ aktion: 'asset', typ: 'still', ziel: { kooperation_id: KO, kooperation_video_id: null } });
    expect(datei(R.bilderSchleife)).toMatchObject({ aktion: 'asset', typ: 'still', ziel: { kooperation_video_id: V, version_number: 1 } });
  });

  it('Rohmaterial -> roh-Asset', () => {
    expect(datei(R.roh)).toMatchObject({ aktion: 'asset', typ: 'roh', ziel: { kooperation_id: KO } });
  });

  it('Datei direkt in Kooperation, Videos oder Video_N -> Nicht zugeordnet', () => {
    expect(datei(R.kooperation)).toMatchObject({ aktion: 'unzugeordnet', grund: 'kooperation_ordner' });
    expect(datei(R.videos)).toMatchObject({ aktion: 'unzugeordnet', grund: 'typ_ordner' });
    expect(datei(R.video)).toMatchObject({ aktion: 'unzugeordnet', grund: 'video_ordner' });
    expect(datei(R.story)).toMatchObject({ aktion: 'unzugeordnet', grund: 'story_ordner' });
  });

  it('freie Ordner und _Test: kein Asset', () => {
    expect(datei(R.frei)).toEqual({ aktion: 'ignorieren', grund: 'freier_ordner' });
    expect(datei(R.test)).toEqual({ aktion: 'ignorieren', grund: 'test_ordner' });
  });

  it('Mac-/Office-Muell wird ignoriert, egal wo', () => {
    for (const name of ['.DS_Store', '._clip.mov', '~$angebot.docx', 'clip.mov.crdownload', 'Thumbs.db']) {
      expect(datei(R.variante, { item: { name } })).toEqual({ aktion: 'ignorieren', grund: 'systemdatei' });
    }
  });

  it('Register unvollstaendig (Video ohne kooperation_video_id) -> Nicht zugeordnet statt kaputtem Asset', () => {
    expect(datei({ ...R.variante, kooperation_video_id: null })).toMatchObject({ aktion: 'unzugeordnet', grund: 'register_unvollstaendig' });
    expect(datei({ ...R.storySchleife, story_nummer: null })).toMatchObject({ aktion: 'unzugeordnet', grund: 'register_unvollstaendig' });
  });
});

describe('dateiEinordnen: verschobene Fachdateien, Typwechsel, Eltern unbekannt', () => {
  it('Fachdatei in freien Ordner/Nicht-Fach-Ort verschoben -> zurueck an ihren Platz', () => {
    const asset = videoAsset({ version_number: 2, variant_name: 'B' });
    for (const eltern of [R.frei, R.kooperation, R.test]) {
      expect(datei(eltern, { asset })).toEqual({
        aktion: 'zurueck', typ: 'video',
        ziel: { kooperation_id: null, kooperation_video_id: V, story_id: null, version_number: 2, is_final: false, variant_name: 'B' },
      });
    }
  });

  it('Fachdatei in andere Schleife verschoben -> Asset zieht mit (Version aus dem Ordner)', () => {
    expect(datei({ ...R.variante, version_number: 3 }, { asset: videoAsset({ version_number: 2, variant_name: 'B' }) }))
      .toMatchObject({ aktion: 'asset', ziel: { version_number: 3, variant_name: 'B' }, umziehen: false });
  });

  it('Video-Datei nach Bilder verschoben -> Typwechsel (umziehen)', () => {
    expect(datei(R.bilderSchleife, { asset: videoAsset() })).toMatchObject({ aktion: 'asset', typ: 'still', umziehen: true });
  });

  it('Eltern-Ordner noch nicht registriert: warten, dann Nicht zugeordnet bzw. zurueck', () => {
    expect(datei(null, { elternOffen: true, versuche: 9 })).toMatchObject({ aktion: 'warten', grund: 'eltern_unbekannt' });
    expect(datei(null, { versuche: 1 })).toMatchObject({ aktion: 'warten' });
    expect(datei(null, { versuche: k.ELTERN_VERSUCHE })).toMatchObject({ aktion: 'unzugeordnet', grund: 'eltern_unbekannt' });
    expect(datei(null, { versuche: k.ELTERN_VERSUCHE, asset: videoAsset() }).aktion).toBe('zurueck');
  });

  it('Datei direkt in der Bibliothekswurzel -> sofort Nicht zugeordnet', () => {
    expect(datei(null, { elternIstWurzel: true })).toMatchObject({ aktion: 'unzugeordnet', grund: 'wurzel' });
  });

  it('geloeschter Eltern-Ordner im Register zaehlt wie unbekannt', () => {
    expect(datei({ ...R.variante, geloescht_at: '2026-11-01' }, { versuche: 1 }).aktion).toBe('warten');
  });
});

describe('dateiEinordnen: Uploads aus dem CRM', () => {
  const jetztMs = Date.parse('2026-11-09T12:00:00Z');
  const upload = (min, extra = {}) => ({
    typ: 'video', erstellt_at: new Date(jetztMs - min * 60000).toISOString(), abgeschlossen_at: null,
    kontext: { kooperation_id: KO, kooperation_video_id: V, version_number: 1, variant_name: 'A', is_final: false }, ...extra,
  });

  it('laufender Upload: warten, der Client legt die Zeile an', () => {
    expect(datei(R.schleife, { upload: upload(3), jetztMs })).toMatchObject({ aktion: 'warten', grund: 'upload_laeuft' });
  });

  it('nach 10 Minuten ohne Zeile: Asset aus dem Upload-Kontext (keine Varianten-Verschiebung)', () => {
    expect(datei(R.schleife, { upload: upload(11), jetztMs })).toEqual({
      aktion: 'asset', typ: 'video', umziehen: false, quelle: 'upload',
      ziel: { kooperation_id: KO, kooperation_video_id: V, story_id: null, version_number: 1, is_final: false, variant_name: 'A' },
    });
  });

  it('Commit zaehlt ab abgeschlossen_at', () => {
    const up = upload(30, { abgeschlossen_at: new Date(jetztMs - 2 * 60000).toISOString() });
    expect(datei(R.schleife, { upload: up, jetztMs }).aktion).toBe('warten');
  });

  it('Asset schon da: Upload egal', () => {
    expect(datei(R.variante, { upload: upload(1), asset: videoAsset({ version_number: 2, variant_name: 'B' }), jetztMs }).aktion).toBe('asset');
  });

  it('Umzug-Upload: nach der Wartezeit an die Bestandszeile, nie ein neues Asset', () => {
    const up = upload(11, { id: 'up1', kontext: { kooperation_id: KO, umzug_asset_id: 'a-alt' } });
    expect(datei(R.schleife, { upload: { ...up, erstellt_at: new Date(jetztMs - 60000).toISOString() }, jetztMs }).aktion).toBe('warten');
    expect(datei(R.schleife, { upload: up, jetztMs })).toEqual({ aktion: 'umzug', typ: 'video', asset_id: 'a-alt', upload_id: 'up1' });
  });
});

describe('ordnerEinordnen', () => {
  const ord = (extra = {}) => k.ordnerEinordnen({ item: { item_id: 'neu', name: 'Ordner', parent_item_id: 'i-p', ...extra.item }, versuche: 1, ...extra });

  it('neuer Ordner im Finder -> frei, erbt den fachlichen Ort', () => {
    expect(ord({ eltern: R.kooperation })).toEqual({ aktion: 'frei', besitz: { unternehmen_id: 'u1', kampagne_id: 'ka1', kooperation_id: KO } });
    expect(ord({ eltern: R.variante }).besitz).toMatchObject({ kooperation_video_id: V, version_number: 2, typ: 'videos' });
    expect(ord({ eltern: R.roh }).aktion).toBe('frei');
    expect(ord({ eltern: R.bilderSchleife }).aktion).toBe('frei');
  });

  it('Unterordner einer Video-/Story-Schleife -> Variante', () => {
    expect(ord({ eltern: R.schleife, item: { name: 'Hook kurz' } })).toEqual({ aktion: 'fach', art: 'variante', variante: 'Hook kurz', soll: 'Hook kurz' });
    expect(ord({ eltern: R.storySchleife, item: { name: 'C' } })).toMatchObject({ aktion: 'fach', art: 'variante', variante: 'C' });
  });

  it('Fachordner nach CRM-Muster werden erkannt und auf den CRM-Namen gebracht', () => {
    expect(ord({ eltern: R.videos, item: { name: 'Video_2' } })).toEqual({ aktion: 'fach', art: 'video', position: 2 });
    expect(ord({ eltern: R.storyVideo, item: { name: 'story_4' } })).toEqual({ aktion: 'fach', art: 'story', story_nummer: 4, soll: 'Story_4' });
    expect(ord({ eltern: R.video, item: { name: 'feedbackschleife_3' } })).toEqual({ aktion: 'fach', art: 'schleife', version_number: 3, soll: 'Feedbackschleife_3' });
    expect(ord({ eltern: R.story, item: { name: 'Finale Version' } })).toEqual({ aktion: 'fach', art: 'finale', soll: 'Finale_Version' });
    expect(ord({ eltern: R.finale, item: { name: '9-16' } })).toEqual({ aktion: 'fach', art: 'format', format: '9-16', soll: '9-16' });
  });

  it('Story_k nur unter Storys, Schleifen nicht direkt unter Storys/Video_N', () => {
    expect(ord({ eltern: R.video, item: { name: 'Story_2' } }).aktion).toBe('frei');
    expect(ord({ eltern: R.storyVideo, item: { name: 'Feedbackschleife_1' } }).aktion).toBe('frei');
    expect(ord({ eltern: R.finale, item: { name: '16-9' } }).aktion).toBe('frei');
  });

  it('Fachordner im Finder umbenannt/verschoben -> CRM dreht zurueck', () => {
    const eigen = { ...R.schleife, item_id: 'neu', parent_item_id: 'i-p', name: 'Feedbackschleife_2' };
    expect(ord({ eigen, item: { name: 'Runde 2' } })).toEqual({ aktion: 'zurueck_benennen' });
    expect(ord({ eigen, item: { name: 'Feedbackschleife_2', parent_item_id: 'anders' } })).toEqual({ aktion: 'zurueck_verschieben' });
    expect(ord({ eigen, item: { name: 'Feedbackschleife_2' } })).toEqual({ aktion: 'ignorieren', grund: 'unveraendert' });
  });

  it('Variante umbenannt -> neuer Variantenname (bereinigt)', () => {
    const eigen = { ...R.variante, item_id: 'neu', parent_item_id: 'i-p' };
    expect(ord({ eigen, item: { name: 'Hook: kurz' } })).toEqual({ aktion: 'variante_umbenennen', variante: 'Hook- kurz' });
  });

  it('freier Ordner umbenannt/verschoben -> Register nachziehen, Besitz vom neuen Ort', () => {
    const eigen = { ...R.frei, item_id: 'neu', parent_item_id: 'i-p', name: 'Ordner' };
    expect(ord({ eigen, eltern: R.roh, item: { parent_item_id: 'i-typ' } })).toMatchObject({ aktion: 'frei_aktualisieren', besitz: { typ: 'rohmaterial' } });
    expect(ord({ eigen, item: { name: 'Neu' } }).aktion).toBe('frei_aktualisieren');
    expect(ord({ eigen, item: { parent_item_id: 'unbekannt' } }).aktion).toBe('warten');
  });

  it('Loeschung und Wiederherstellung', () => {
    expect(ord({ eigen: R.schleife, item: { geloescht: true } })).toEqual({ aktion: 'ordner_geloescht' });
    expect(ord({ item: { geloescht: true } })).toEqual({ aktion: 'ignorieren', grund: 'geloescht' });
    expect(ord({ eigen: { ...R.schleife, geloescht_at: '2026-11-01' } })).toEqual({ aktion: 'wiederherstellen' });
  });

  it('neuer Ordner in der Wurzel -> frei ohne Besitzer; Eltern unbekannt -> warten', () => {
    expect(ord({ elternIstWurzel: true })).toEqual({ aktion: 'frei', besitz: {} });
    expect(ord({ versuche: 1 }).aktion).toBe('warten');
    expect(ord({ versuche: k.ELTERN_VERSUCHE })).toEqual({ aktion: 'ignorieren', grund: 'eltern_unbekannt' });
  });

  it('Wurzel selbst', () => {
    expect(ord({ istWurzel: true })).toEqual({ aktion: 'ignorieren', grund: 'wurzel' });
  });
});

describe('naechsteVariante', () => {
  it('naechster freier Buchstabe, ohne Gross/Klein, danach A2', () => {
    expect(k.naechsteVariante([])).toBe('A');
    expect(k.naechsteVariante(['a', 'B', null, 'Hook'])).toBe('C');
    const alle = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
    expect(k.naechsteVariante(alle)).toBe('A2');
  });
});
