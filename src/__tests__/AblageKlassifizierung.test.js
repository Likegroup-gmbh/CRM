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
  rundeStory: reg('story', { typ: 'videos', kooperation_video_id: V, story_nummer: 2, version_number: 1 }),
  finaleStory: reg('story', { typ: 'videos', kooperation_video_id: V, story_nummer: 2, version_number: null }),
  frei: reg('frei', { typ: 'videos', kooperation_video_id: V }),
  test: { id: 'r-test', item_id: 'i-test', art: 'test', name: '_Test', pfad: '/_Test' },
  unternehmen: { id: 'r-u', item_id: 'i-u', art: 'unternehmen', name: 'Firma', pfad: '/Firma', unternehmen_id: 'u1' },
  medien: { id: 'r-m', item_id: 'i-m', art: 'bereich', bereich: 'medien', name: 'Medien', pfad: '/Firma/Medien', unternehmen_id: 'u1' },
  vertraege: { id: 'r-v', item_id: 'i-v', art: 'bereich', bereich: 'vertraege', name: 'Verträge', pfad: '/Firma/Verträge', unternehmen_id: 'u1' },
};

const datei = (eltern, extra = {}) => k.dateiEinordnen({ item: { name: 'clip.mov', ...extra.item }, eltern, versuche: 1, jetztMs: Date.parse('2026-11-09T12:00:00Z'), ...extra });
const videoAsset = (row = {}) => ({ typ: 'video', row: { id: 'a1', video_id: V, version_number: 1, variant_name: null, is_final: false, ...row } });

describe('dateiEinordnen: Fachordner bestimmen die Bedeutung', () => {
  it('neue Datei in einem alten Varianten-Ordner -> flach in die Schleife, ohne Variante', () => {
    expect(datei(R.variante)).toEqual({
      aktion: 'zurueck', typ: 'video',
      ziel: { kooperation_id: KO, kooperation_video_id: V, story_nummer: null, version_number: 2, is_final: false, variant_name: null },
    });
    expect(datei(R.variante, { item: { name: 'foto.jpg' } })).toMatchObject({ aktion: 'zurueck', typ: 'still' });
    expect(datei(R.variante, { item: { name: 'notiz.pdf' } })).toMatchObject({ aktion: 'unzugeordnet', grund: 'dateityp' });
  });

  it('bestehende Datei im alten Varianten-Ordner -> flach in die Schleife, Variante bleibt an der Zeile', () => {
    expect(datei(R.variante, { asset: videoAsset({ version_number: 2, variant_name: 'B' }) })).toEqual({
      aktion: 'zurueck', typ: 'video',
      ziel: { kooperation_id: null, kooperation_video_id: V, story_id: null, version_number: 2, is_final: false, variant_name: 'B' },
    });
  });

  it('Story_K in einer Feedbackschleife -> Story-Asset der Runde (auch Bilder)', () => {
    expect(datei(R.rundeStory)).toMatchObject({ aktion: 'asset', typ: 'story', ziel: { kooperation_video_id: V, story_nummer: 2, version_number: 1, is_final: false, variant_name: null } });
    expect(datei(R.rundeStory, { item: { name: 'story.jpg' } })).toMatchObject({ aktion: 'asset', typ: 'story' });
  });

  it('Story_K in der Finalen Version: Seitenverhaeltnis aus dem Pixelmass, kein Format-Ordner', () => {
    expect(datei(R.finaleStory, { item: { breite: 1080, hoehe: 1920 } })).toMatchObject({ aktion: 'asset', typ: 'story', ziel: { story_nummer: 2, is_final: true, version_number: 1, variant_name: '9:16' } });
    expect(datei(R.finaleStory, { versuche: 1 })).toMatchObject({ aktion: 'warten', grund: 'kein_mass' });
    expect(datei(R.finaleStory, { versuche: k.MASS_VERSUCHE })).toMatchObject({ aktion: 'unzugeordnet', grund: 'format_unbekannt' });
    const final = { typ: 'story', row: { id: 's1', video_id: V, story_id: 'st1', version_number: 1, variant_name: '4:5', is_final: true } };
    expect(datei(R.finaleStory, { asset: final })).toMatchObject({ aktion: 'asset', ziel: { is_final: true, variant_name: '4:5' } });
  });

  it('lose Video in einer Video-Schleife -> Video-Asset ohne Variante, bleibt liegen', () => {
    const d = datei(R.schleife);
    expect(d).toMatchObject({ aktion: 'asset', typ: 'video', umziehen: false });
    expect(d.ziel).toMatchObject({ kooperation_video_id: V, version_number: 2, is_final: false, variant_name: null });
  });

  it('loses Bild in einer Video-Schleife -> Bild-Asset, nicht Video', () => {
    for (const name of ['foto.jpg', 'Foto.PNG', 'x.heic']) {
      const d = datei(R.schleife, { item: { name } });
      expect(d).toMatchObject({ aktion: 'asset', typ: 'still', ziel: { kooperation_video_id: V, version_number: 2, is_final: false, variant_name: null } });
    }
  });

  it('falsch als Video angelegtes Bild wird auf Bild umgestellt', () => {
    const d = datei(R.schleife, { item: { name: 'foto.jpg' }, asset: videoAsset({ variant_name: 'C', version_number: 2 }) });
    expect(d).toMatchObject({ aktion: 'asset', typ: 'still', umziehen: true });
  });

  it('unbekannte Endung in der Video-Schleife -> Nicht zugeordnet', () => {
    expect(datei(R.schleife, { item: { name: 'notiz.pdf' } })).toMatchObject({ aktion: 'unzugeordnet', grund: 'dateityp' });
  });

  it('Bild in Finale_Version -> finales Bild ohne Formatordner', () => {
    const d = datei(R.finale, { item: { name: 'foto.jpg', breite: 1080, hoehe: 1350 } });
    expect(d).toMatchObject({ aktion: 'asset', typ: 'still', ziel: { is_final: true, version_number: 1 } });
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

  it('Altbestand Storys: Schleife direkt -> Story-Asset, Finale direkt -> finale Story', () => {
    expect(datei(R.storySchleife)).toMatchObject({ aktion: 'asset', typ: 'story', ziel: { story_nummer: 3, version_number: 1, is_final: false, variant_name: null } });
    expect(datei(R.storyFinale)).toMatchObject({ aktion: 'asset', typ: 'story', ziel: { story_nummer: 3, is_final: true } });
  });

  it('Altbestand Bilder: Bilder-Ordner ohne Video, Video-Schleife mit Video', () => {
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

  it('Bereiche: Datei in Verträge/ wird ignoriert, direkt in Medien/ Nicht zugeordnet', () => {
    expect(datei(R.vertraege, { item: { name: 'Vertrag.pdf' } })).toEqual({ aktion: 'ignorieren', grund: 'vertraege' });
    expect(datei(R.medien)).toEqual({ aktion: 'unzugeordnet', grund: 'bereich_ordner' });
    expect(datei(R.unternehmen)).toEqual({ aktion: 'unzugeordnet', grund: 'unternehmen_ordner' });
  });

  it('Bereiche: Fachdatei nach Verträge/ oder Medien/ verschoben -> zurueck an ihren Platz', () => {
    for (const eltern of [R.vertraege, R.medien]) expect(datei(eltern, { asset: videoAsset() }).aktion).toBe('zurueck');
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

  it('Fachdatei in andere Schleife verschoben -> Asset zieht mit (Version aus dem Ordner, Variante bleibt)', () => {
    expect(datei({ ...R.schleife, version_number: 3 }, { asset: videoAsset({ version_number: 2, variant_name: 'B' }) }))
      .toMatchObject({ aktion: 'asset', ziel: { version_number: 3, variant_name: 'B' }, umziehen: false });
  });

  it('Video-Datei in einen Story_K-Ordner verschoben -> wird Story (umziehen)', () => {
    expect(datei(R.rundeStory, { asset: videoAsset() })).toMatchObject({ aktion: 'asset', typ: 'story', umziehen: true });
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
    expect(datei(R.schleife, { upload: upload(1), asset: videoAsset({ version_number: 2, variant_name: 'B' }), jetztMs }).aktion).toBe('asset');
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

  it('Unterordner einer Video-Schleife: Story_K ist Fachordner, alles andere frei (keine Varianten mehr)', () => {
    expect(ord({ eltern: R.schleife, item: { name: 'story_2' } })).toEqual({ aktion: 'fach', art: 'story', story_nummer: 2, soll: 'Story_2' });
    expect(ord({ eltern: R.finale, item: { name: 'Story_1' } })).toEqual({ aktion: 'fach', art: 'story', story_nummer: 1, soll: 'Story_1' });
    expect(ord({ eltern: R.schleife, item: { name: 'Hook kurz' } }).aktion).toBe('frei');
    expect(ord({ eltern: R.schleife, item: { name: 'A' } }).aktion).toBe('frei');
  });

  it('Altbestand: Unterordner einer Story-Schleife unter Storys/ -> Variante', () => {
    expect(ord({ eltern: R.storySchleife, item: { name: 'C' } })).toMatchObject({ aktion: 'fach', art: 'variante', variante: 'C' });
  });

  it('neuer Story_K unter Schleife/Finale bekommt Schleife bzw. keine (= Finale) als Besitz', () => {
    expect(ord({ eltern: R.schleife, item: { name: 'Story_3' } }).aktion).toBe('fach');
    expect(k.besitzVon(R.schleife)).toMatchObject({ typ: 'videos', kooperation_video_id: V, version_number: 2 });
    expect(k.besitzVon(R.finale).version_number).toBeUndefined();
  });

  it('Story_K-Ordner hat keine Unterordner nach Muster', () => {
    expect(ord({ eltern: R.rundeStory, item: { name: 'Feedbackschleife_1' } }).aktion).toBe('frei');
  });

  it('Fachordner nach CRM-Muster werden erkannt und auf den CRM-Namen gebracht', () => {
    expect(ord({ eltern: R.videos, item: { name: 'Video_2' } })).toEqual({ aktion: 'fach', art: 'video', position: 2 });
    expect(ord({ eltern: R.storyVideo, item: { name: 'story_4' } })).toEqual({ aktion: 'fach', art: 'story', story_nummer: 4, soll: 'Story_4' });
    expect(ord({ eltern: R.video, item: { name: 'feedbackschleife_3' } })).toEqual({ aktion: 'fach', art: 'schleife', version_number: 3, soll: 'Feedbackschleife_3' });
    expect(ord({ eltern: R.story, item: { name: 'Finale Version' } })).toEqual({ aktion: 'fach', art: 'finale', soll: 'Finale_Version' });
    expect(ord({ eltern: R.finale, item: { name: '9-16' } })).toEqual({ aktion: 'fach', art: 'format', format: '9-16', soll: '9-16' });
  });

  it('unter dem Unternehmen: Medien und Verträge sind Bereiche (auch NFD aus dem Finder), alles andere frei', () => {
    expect(ord({ eltern: R.unternehmen, item: { name: 'medien' } })).toEqual({ aktion: 'fach', art: 'bereich', bereich: 'medien', soll: 'Medien' });
    expect(ord({ eltern: R.unternehmen, item: { name: 'Verträge'.normalize('NFD') } })).toEqual({ aktion: 'fach', art: 'bereich', bereich: 'vertraege', soll: 'Verträge' });
    expect(ord({ eltern: R.unternehmen, item: { name: 'Vertraege' } }).aktion).toBe('frei');
    expect(ord({ eltern: R.unternehmen, item: { name: 'Rechnungen' } })).toEqual({ aktion: 'frei', besitz: { unternehmen_id: 'u1' } });
  });

  it('Ordner unter Verträge/ und Medien/: frei mit Bereich als Besitz', () => {
    expect(ord({ eltern: R.vertraege, item: { name: 'Max Muster' } })).toEqual({ aktion: 'frei', besitz: { unternehmen_id: 'u1', bereich: 'vertraege' } });
    expect(ord({ eltern: R.medien, item: { name: 'Medien' } }).aktion).toBe('frei');
  });

  it('Bereich im Finder umbenannt -> CRM dreht zurueck; nur NFD statt NFC ist keine Umbenennung', () => {
    const eigen = { ...R.vertraege, item_id: 'neu', parent_item_id: 'i-p' };
    expect(ord({ eigen, item: { name: 'Contracts' } })).toEqual({ aktion: 'zurueck_benennen' });
    expect(ord({ eigen, item: { name: 'Verträge'.normalize('NFD') } })).toEqual({ aktion: 'ignorieren', grund: 'unveraendert' });
    expect(ord({ eigen, item: { name: 'Verträge', parent_item_id: 'anders' } })).toEqual({ aktion: 'zurueck_verschieben' });
  });

  it('Story_k nicht direkt unter Video_N, Schleifen nicht direkt unter Storys/Video_N', () => {
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