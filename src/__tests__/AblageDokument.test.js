import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createFakeSupabase, createFakeSharePoint, ORDNER_UNIQUE, strukturOffen } from './fixtures/fakeSupabase.js';

const require = createRequire(import.meta.url);
const dokument = require('../../netlify/functions/_shared/ablage/dokument.js');
const { createStruktur } = require('../../netlify/functions/_shared/ablage/struktur.js');
const { createSchreiben } = require('../../netlify/functions/_shared/ablage/schreiben.js');
const { createLesen } = require('../../netlify/functions/_shared/ablage/lesen.js');
const { createOrdner } = require('../../netlify/functions/_shared/ablage/ordner.js');
const ziel = require('../../netlify/functions/_shared/ablage/ziel.js');

const ENV = { MS_TENANT_ID: 't', MS_CLIENT_ID: 'c', SP_SITE_URL: 'https://x.sharepoint.com/sites/Medienablage', SP_SITE_ID: 's1', SP_DRIVE_ID: 'd1' };

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U1 = id(1);
const U2 = id(2);
const M1 = id(3);
const KA1 = id(4);
const AU1 = id(5);
const VT1 = id(6);
const VT2 = id(7);
const R1 = id(8);
const R2 = id(9);
const P1 = id(10);
const P2 = id(11);
const KA2 = id(12);

const MA = { id: 'b1', rolle: 'mitarbeiter', freigeschaltet: true };
const KUNDE = { id: 'b9', rolle: 'kunde' };

function setup({ dokZiel = 'sharepoint', notschalter = false, istTest = false, tabellen = {} } = {}) {
  const supabase = createFakeSupabase({
    tabellen: {
      ablage_einstellung: [{ schluessel: 'notschalter', wert: false }, { schluessel: 'notschalter_dokumente', wert: notschalter }],
      ablage_stand: [{ drive_id: 'd1', root_item_id: 'root' }],
      ablage_ordner: [],
      ablage_upload: [],
      ablage_eingang: [],
      unternehmen: [
        { id: U1, firmenname: 'Firma', ist_test: istTest, ablage_ziel: 'dropbox', dokument_ablage_ziel: dokZiel },
        { id: U2, firmenname: 'Kunde Zwei', ist_test: false, ablage_ziel: 'dropbox', dokument_ablage_ziel: dokZiel },
      ],
      marke: [{ id: M1, markenname: 'Marke A', unternehmen_id: U1 }],
      kampagne: [{ id: KA1, kampagnenname: 'Auftrag', eigener_name: 'Sommer', unternehmen_id: U1, marke_id: M1 }],
      auftrag: [{ id: AU1, auftragsname: 'AU-1', titel: 'Rahmen 2027', unternehmen_id: U1, marke_id: M1 }],
      produktion: [{ id: P1, name: 'Stay Loose', kampagne_id: KA1 }, { id: P2, name: 'Fremd', kampagne_id: KA2 }],
      vertraege: [
        { id: VT1, name: 'V1', kunde_unternehmen_id: U1, kampagne_id: KA1, datei_ablage: 'dropbox', signiert_ablage: 'dropbox' },
        { id: VT2, name: 'V2', kunde_unternehmen_id: U2, kampagne_id: KA1, datei_ablage: 'dropbox', signiert_ablage: 'dropbox' },
      ],
      rechnung: [
        { id: R1, rechnung_nr: 'RE-2026/01', unternehmen_id: U1, kampagne_id: KA1 },
        { id: R2, rechnung_nr: 'RE-2', unternehmen_id: U1, auftrag_id: AU1 },
      ],
      rechnung_pdfs: [],
      rechnung_belege: [],
      auftrag_dokumente: [],
      kooperation_video_asset: [],
      kooperation_story_asset: [],
      kooperation_bilder_asset: [],
      kooperation_rohmaterial_asset: [],
      ...tabellen,
    },
    unique: { ablage_ordner: ORDNER_UNIQUE },
    rpc: { ablage_pfad_umschreiben: () => 0, ablage_nachfahren: () => [], ablage_struktur_offen: strukturOffen },
  });
  const sp = createFakeSharePoint();
  const ordner = createOrdner({ supabase, sp, schlafen: async () => {} });
  const ablage = { sp, ordner, konfig: { siteUrl: ENV.SP_SITE_URL } };
  const s = createSchreiben({ supabase, ablage });
  return { supabase, sp, ordner, ablage, s, caller: supabase };
}

beforeEach(() => {
  Object.assign(process.env, ENV);
  ziel._reset();
});
afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k];
  delete process.env.ABLAGE_ZIEL;
});

describe('Registry', () => {
  it('quelleVon: Ablage-Spalte schlaegt Pfad-Heuristik, Altbestand ueber Storage', () => {
    expect(dokument.quelleVon('vertrag', { datei_ablage: 'sharepoint', datei_drive_id: 'd1', datei_item_id: 'x', datei_path: '/Firma/Verträge/v.pdf' }))
      .toEqual({ quelle: 'sharepoint', drive_id: 'd1', item_id: 'x' });
    expect(dokument.quelleVon('vertrag', { datei_ablage: 'dropbox', datei_path: '/CRM/Vertraege/v.pdf', datei_url: 'https://www.dropbox.com/s/v?dl=0' }))
      .toEqual({ quelle: 'dropbox', pfad: '/CRM/Vertraege/v.pdf' });
    expect(dokument.quelleVon('vertrag', { datei_path: 'kampagne/v.pdf' })).toEqual({ quelle: 'storage', bucket: 'vertraege', pfad: 'kampagne/v.pdf' });
    expect(dokument.quelleVon('rechnung', { file_url: 'https://p.supabase.co/storage/v1/object/public/rechnungen/a%20b.pdf' }))
      .toEqual({ quelle: 'storage', bucket: 'rechnungen', pfad: 'a b.pdf' });
    expect(dokument.quelleVon('vertrag_unterschrieben', { unterschriebener_vertrag_path: 'x/s.pdf' }))
      .toEqual({ quelle: 'storage', bucket: 'unterschriebene-vertraege', pfad: 'x/s.pdf' });
    expect(dokument.quelleVon('auftragsdokument', { dropbox_file_url: 'https://example.com/ab.pdf' })).toEqual({ quelle: 'link', url: 'https://example.com/ab.pdf' });
    expect(dokument.quelleVon('beleg', { file_url: null, file_path: null })).toBeNull();
  });

  it('spaltenAusItem: Spaltensatz je Typ', () => {
    const item = { id: 'i9', name: 'v.pdf', size: 12, webUrl: 'https://sp.test/v.pdf', eTag: 'e', cTag: 'c' };
    expect(dokument.spaltenAusItem('vertrag_unterschrieben', item, { driveId: 'd1', pfad: '/F/v.pdf' })).toEqual({
      signiert_ablage: 'sharepoint', signiert_drive_id: 'd1', signiert_item_id: 'i9', dropbox_file_url: 'https://sp.test/v.pdf', dropbox_file_path: '/F/v.pdf',
    });
    expect(dokument.spaltenAusItem('auftragsdokument', item, { driveId: 'd1', pfad: '/F/v.pdf' })).toMatchObject({
      ablage: 'sharepoint', item_id: 'i9', dropbox_file_url: 'https://sp.test/v.pdf', dateiname: 'v.pdf', dateigroesse: 12, etag: 'e', ctag: 'c',
    });
  });

  it('dokumentEbenen: Marke nur, wenn sie zum Unternehmen gehoert; Contracting ohne Kampagne', () => {
    const marke = { id: M1, markenname: 'Marke A', unternehmen_id: U1 };
    const kampagne = { id: KA1, eigener_name: 'Sommer' };
    const auftrag = { id: AU1, titel: 'Rahmen 2027' };
    const namen = (e) => e.map((x) => `${x.ebene}:${x.name}`);
    expect(namen(dokument.dokumentEbenen('vertrag', { unternehmen: { id: U1 }, marke, kampagne }))).toEqual(['marke:Marke A', 'kampagne:Sommer']);
    expect(namen(dokument.dokumentEbenen('vertrag', { unternehmen: { id: U2 }, marke, kampagne }))).toEqual(['kampagne:Sommer']);
    expect(namen(dokument.dokumentEbenen('vertrag', { unternehmen: { id: U1 }, marke: null, auftrag })))
      .toEqual(['contracting:Contracting', 'auftrag:Rahmen 2027']);
    expect(namen(dokument.dokumentEbenen('beleg', { unternehmen: { id: U1 }, marke, kampagne, rechnung: { id: R1, rechnung_nr: 'RE-2026/01' } })))
      .toEqual(['marke:Marke A', 'kampagne:Sommer', 'rechnung:RE-2026-01', 'belege:Belege']);
    expect(namen(dokument.dokumentEbenen('auftragsdokument', { unternehmen: { id: U1 }, marke, auftrag }, { dokumentTyp: 'rechnung' })))
      .toEqual(['marke:Marke A', 'auftrag:Rahmen 2027', 'rechnungen:Rechnungen']);
    const contracting = dokument.dokumentEbenen('rechnung', { unternehmen: { id: U1 }, marke: null, auftrag, rechnung: { id: R2, rechnung_nr: 'RE-2' } });
    expect(contracting[0]).toMatchObject({ ebene: 'contracting', ref: 'ohne_marke' });
  });

  it('dokumentEbenen: Produktion unter der Kampagne, nur bei Verträgen und nur aus derselben Kampagne', () => {
    const kampagne = { id: KA1, eigener_name: 'Sommer' };
    const produktion = { id: P1, name: 'Stay Loose', kampagne_id: KA1 };
    const namen = (e) => e.map((x) => `${x.ebene}:${x.name}`);
    const ebenen = dokument.dokumentEbenen('vertrag', { unternehmen: { id: U1 }, marke: null, kampagne, produktion });
    expect(namen(ebenen)).toEqual(['kampagne:Sommer', 'produktion:Stay Loose']);
    expect(ebenen[1]).toMatchObject({ ref: P1, extra: { kampagne_id: KA1, produktion_id: P1, marke_id: null } });
    expect(namen(dokument.dokumentEbenen('vertrag', { unternehmen: { id: U1 }, kampagne, produktion: { ...produktion, kampagne_id: KA2 } })))
      .toEqual(['kampagne:Sommer']);
    expect(namen(dokument.dokumentEbenen('rechnung', { unternehmen: { id: U1 }, kampagne, produktion, rechnung: { id: R1, rechnung_nr: 'RE-1' } })))
      .toEqual(['kampagne:Sommer', 'rechnung:RE-1']);
  });
});

describe('dokumentKette', () => {
  it('Daten/<Firma>/Verträge/<Marke>/<Kampagne>, idempotent, Test-Unternehmen unter _Test', async () => {
    const t = setup();
    const b = await dokument.ladeBezug(t.supabase, 'vertrag', VT1);
    const ebenen = dokument.dokumentEbenen('vertrag', b);
    const o = await t.ordner.dokumentKette(b.unternehmen, 'vertraege', ebenen);
    expect(o.pfad).toBe('/Firma/Verträge/Marke A/Sommer');
    const nochmal = await t.ordner.dokumentKette(b.unternehmen, 'vertraege', ebenen);
    expect(nochmal.item_id).toBe(o.item_id);
    const dok = t.supabase.db.ablage_ordner.filter((r) => r.art === 'dokument');
    expect(dok.map((r) => r.dok_schluessel)).toEqual([`vertraege:${U1}:marke:${M1}`, `vertraege:${U1}:kampagne:${KA1}`]);
    expect(dok[1]).toMatchObject({ bereich: 'vertraege', unternehmen_id: U1, ebene: 'kampagne', kampagne_id: KA1, marke_id: M1 });

    const tt = setup({ istTest: true });
    const bt = await dokument.ladeBezug(tt.supabase, 'rechnung', R1);
    const ot = await tt.ordner.dokumentKette(bt.unternehmen, 'rechnungen', dokument.dokumentEbenen('rechnung', bt));
    expect(ot.pfad).toBe('/_Test/Firma/Rechnungen/Marke A/Sommer/RE-2026-01');
  });

  it('Vertrag eines anderen Kunden-Unternehmens: eigener Ordner, keine fremde Marke', async () => {
    const t = setup();
    const b = await dokument.ladeBezug(t.supabase, 'vertrag', VT2);
    expect(b.unternehmen.id).toBe(U2);
    const o = await t.ordner.dokumentKette(b.unternehmen, 'vertraege', dokument.dokumentEbenen('vertrag', b));
    expect(o.pfad).toBe('/Kunde Zwei/Verträge/Sommer');
  });

  it('Vertrag mit Produktion: Verträge/<Marke>/<Kampagne>/<Produktion>', async () => {
    const t = setup();
    t.supabase.db.vertraege.find((v) => v.id === VT1).produktion_id = P1;
    const b = await dokument.ladeBezug(t.supabase, 'vertrag', VT1);
    expect(b.produktion).toEqual({ id: P1, name: 'Stay Loose', kampagne_id: KA1 });
    const o = await t.ordner.dokumentKette(b.unternehmen, 'vertraege', dokument.dokumentEbenen('vertrag', b));
    expect(o).toMatchObject({
      pfad: '/Firma/Verträge/Marke A/Sommer/Stay Loose', art: 'dokument', ebene: 'produktion', produktion_id: P1,
      dok_schluessel: `vertraege:${U1}:produktion:${P1}`,
    });
  });
});

describe('Struktur: Vertrag folgt seiner Produktion', () => {
  async function mitVertrag(t, { frei = false } = {}) {
    const b = await dokument.ladeBezug(t.supabase, 'vertrag', VT1);
    let ordner = await t.ordner.dokumentKette(b.unternehmen, 'vertraege', dokument.dokumentEbenen('vertrag', b));
    if (frei) {
      const { item } = await t.sp.ordnerAnlegen(ordner.item_id, 'Alt');
      ordner = { id: 'frei1', drive_id: 'd1', item_id: item.id, parent_item_id: ordner.item_id, name: 'Alt', art: 'frei', bereich: 'vertraege', pfad: `${ordner.pfad}/Alt` };
      t.supabase.db.ablage_ordner.push(ordner);
    }
    const f = t.sp.datei(ordner.item_id, 'vertrag.pdf');
    const v = t.supabase.db.vertraege.find((x) => x.id === VT1);
    Object.assign(v, {
      datei_ablage: 'sharepoint', datei_drive_id: 'd1', datei_item_id: f.id, datei_path: `${ordner.pfad}/vertrag.pdf`, datei_url: t.sp.url(f.id),
    });
    t.supabase.db.ablage_eingang.push({
      drive_id: 'd1', item_id: f.id, parent_item_id: ordner.item_id, name: 'vertrag.pdf', pfad: `${ordner.pfad}/vertrag.pdf`, ist_ordner: false, geloescht: false,
    });
    return { v, f, struktur: createStruktur({ supabase: t.supabase, sp: t.sp, ordner: t.ordner }) };
  }

  it('Produktion gesetzt: PDF zieht in den Produktions-Ordner, ohne Produktion zurueck in die Kampagne', async () => {
    const t = setup();
    const { v, f, struktur } = await mitVertrag(t);
    expect(await struktur.offen()).toEqual([]);

    v.produktion_id = P1;
    expect(await struktur.offen()).toEqual([{ art: 'vertrag', id: VT1, unternehmen_id: U1, produktion_id: P1, ordner_da: false }]);
    expect(await struktur.vertragNachziehen(VT1)).toMatchObject({ verschoben: 1 });
    const ziel = '/Firma/Verträge/Marke A/Sommer/Stay Loose';
    const prodOrdner = t.supabase.db.ablage_ordner.find((o) => o.ebene === 'produktion');
    expect(prodOrdner.pfad).toBe(ziel);
    expect(v).toMatchObject({ datei_item_id: f.id, datei_path: `${ziel}/vertrag.pdf`, datei_url: t.sp.url(f.id) });
    expect(t.sp.items.get(f.id).parent).toBe(prodOrdner.item_id);
    expect(t.supabase.db.ablage_eingang.find((e) => e.item_id === f.id)).toMatchObject({ parent_item_id: prodOrdner.item_id, pfad: `${ziel}/vertrag.pdf` });
    expect(await struktur.offen()).toEqual([]);

    v.produktion_id = null;
    expect(await struktur.offen()).toHaveLength(1);
    await struktur.vertragNachziehen(VT1);
    expect(v.datei_path).toBe('/Firma/Verträge/Marke A/Sommer/vertrag.pdf');
    expect(await struktur.offen()).toEqual([]);
  });

  it('Produktion einer fremden Kampagne und freie Unterordner: bleibt liegen', async () => {
    const t = setup();
    const { v, struktur } = await mitVertrag(t);
    v.produktion_id = P2;
    expect(await struktur.offen()).toEqual([]);

    const t2 = setup();
    const b = await mitVertrag(t2, { frei: true });
    b.v.produktion_id = P1;
    expect(await b.struktur.offen()).toEqual([]);
  });
});

describe('Upload-Ziel und Commit', () => {
  it('Weiche dropbox, Notschalter, ABLAGE_ZIEL: { ziel: dropbox }', async () => {
    for (const opts of [{ dokZiel: 'dropbox' }, { notschalter: true }]) {
      ziel._reset();
      const t = setup(opts);
      expect(await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: { typ: 'vertrag', bezug_id: VT1, file_name: 'v.pdf', file_size: 10 } }))
        .toEqual({ ziel: 'dropbox' });
      expect(t.sp.calls.filter(([op]) => op === 'uploadSession')).toHaveLength(0);
    }
    ziel._reset();
    process.env.ABLAGE_ZIEL = 'dropbox';
    const t = setup();
    expect((await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: { typ: 'rechnung', bezug_id: R1, file_name: 'r.pdf', file_size: 10 } })).ziel).toBe('dropbox');
  });

  it('Vertrag: Session im Kampagnen-Ordner, Commit liefert die Datei', async () => {
    const t = setup();
    const z = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: { typ: 'vertrag', bezug_id: VT1, file_name: 'Vertrag.PDF', file_size: 10 } });
    expect(z).toMatchObject({ ziel: 'sharepoint', file_name: 'Vertrag.pdf' });
    expect(z.ordner.pfad).toBe('/Firma/Verträge/Marke A/Sommer');
    expect(t.supabase.db.ablage_upload[0]).toMatchObject({ typ: 'vertrag', kontext: { typ: 'vertrag', bezug_id: VT1 } });
    const item = t.sp.hochladen(z.upload_url, 10);
    const c = await t.s.uploadCommit({ benutzer: MA, body: { upload_id: z.upload_id, item_id: item.id } });
    expect(c).toMatchObject({ ablage: 'sharepoint', drive_id: 'd1', item_id: item.id, file_path: '/Firma/Verträge/Marke A/Sommer/Vertrag.pdf' });
  });

  it('Ersetzen eines SharePoint-Vertrags: neue Version desselben Items, bei Notschalter 503', async () => {
    const t = setup();
    const z = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: { typ: 'vertrag', bezug_id: VT1, file_name: 'v.pdf', file_size: 10 } });
    const item = t.sp.hochladen(z.upload_url, 10);
    Object.assign(t.supabase.db.vertraege[0], dokument.spaltenAusItem('vertrag', await t.sp.item(item.id), { driveId: 'd1', pfad: `${z.ordner.pfad}/v.pdf` }));
    const neu = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: { typ: 'vertrag', bezug_id: VT1, file_name: 'v2.pdf', file_size: 12 } });
    expect(t.sp.calls).toContainEqual(['uploadSessionFuerItem', item.id]);
    expect(t.supabase.db.ablage_upload.at(-1)).toMatchObject({ item_id: item.id, kontext: { gleiches_item: true } });
    expect(neu.ordner.pfad).toBe(z.ordner.pfad);

    t.supabase.db.ablage_einstellung[1].wert = true;
    ziel._reset();
    await expect(t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: { typ: 'vertrag', bezug_id: VT1, file_name: 'v3.pdf', file_size: 12 } }))
      .rejects.toMatchObject({ status: 503, code: 'notschalter' });
  });

  it('Auftragsdokument Rechnung landet in Aufträge/<Marke>/<Auftrag>/Rechnungen; Kunden duerfen nicht hochladen', async () => {
    const t = setup();
    const z = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: { typ: 'auftragsdokument', bezug_id: AU1, dokument_typ: 'rechnung', file_name: 'r.pdf', file_size: 3 } });
    expect(z.ordner.pfad).toBe('/Firma/Aufträge/Marke A/Rahmen 2027/Rechnungen');
    await expect(t.s.uploadZiel({ benutzer: KUNDE, caller: t.caller, body: { typ: 'beleg', bezug_id: R1, file_name: 'b.pdf', file_size: 3 } }))
      .rejects.toMatchObject({ status: 403 });
    await expect(t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: { typ: 'auftragsdokument', bezug_id: AU1, dokument_typ: 'x', file_name: 'r.pdf', file_size: 3 } }))
      .rejects.toMatchObject({ status: 400 });
  });

  it('Contracting-Rechnung ohne Kampagne: Rechnungen/<Marke>/Contracting/<Auftrag>/<Nr>', async () => {
    const t = setup();
    const z = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: { typ: 'rechnung', bezug_id: R2, file_name: 'r.pdf', file_size: 3 } });
    expect(z.ordner.pfad).toBe('/Firma/Rechnungen/Marke A/Contracting/Rahmen 2027/RE-2');
  });
});

describe('Loeschen, Umbenennen, Links', () => {
  async function mitRechnungPdf() {
    const t = setup();
    const o = await t.ordner.dokumentKette({ id: U1, firmenname: 'Firma' }, 'rechnungen', [{ ebene: 'rechnung', ref: R1, name: 'RE', extra: { rechnung_id: R1 } }]);
    const f = t.sp.datei(o.item_id, 'r.pdf', 5);
    t.supabase.db.rechnung_pdfs.push({ id: id(50), rechnung_id: R1, ...dokument.spaltenAusItem('rechnung', await t.sp.item(f.id), { driveId: 'd1', pfad: `${o.pfad}/r.pdf` }) });
    return { t, f, o };
  }

  it('Loeschen: Papierkorb, solange keine andere Zeile auf das Item zeigt', async () => {
    const { t, f } = await mitRechnungPdf();
    t.supabase.db.rechnung_pdfs.push({ ...t.supabase.db.rechnung_pdfs[0], id: id(51) });
    expect(await t.s.dateiLoeschen({ benutzer: MA, caller: t.caller, body: { typ: 'rechnung', id: id(50) } })).toEqual({ geloescht: false, quelle: 'sharepoint' });
    t.supabase.db.rechnung_pdfs.pop();
    expect(await t.s.dateiLoeschen({ benutzer: MA, caller: t.caller, body: { typ: 'rechnung', id: id(50) } })).toEqual({ geloescht: true, quelle: 'sharepoint' });
    expect(t.sp.calls).toContainEqual(['loeschen', f.id]);
  });

  it('Umbenennen: Endung bleibt, Spalten ziehen mit', async () => {
    const { t, o } = await mitRechnungPdf();
    const patch = await t.s.dateiUmbenennen({ benutzer: MA, caller: t.caller, body: { typ: 'rechnung', id: id(50), name: 'Final' } });
    expect(patch).toMatchObject({ file_name: 'Final.pdf', file_path: `${o.pfad}/Final.pdf` });
    expect(t.supabase.db.rechnung_pdfs[0].file_name).toBe('Final.pdf');
  });

  it('ablage-link: Dokument-Schluessel typ:id, URL-Lookup fuer Render-Stellen', async () => {
    const { t, f } = await mitRechnungPdf();
    const lesen = createLesen({ supabase: t.supabase, ablage: t.ablage, dropbox: { downloadUrl: async () => null } });
    const r = await lesen.links({ benutzer: MA, caller: t.caller, body: { items: [{ typ: 'rechnung', id: id(50) }, { typ: 'vertrag', id: VT1 }] } });
    expect(r.links[`rechnung:${id(50)}`].url).toBe(`https://dl.test/${f.id}`);
    expect(r.fehlend).toEqual([`vertrag:${VT1}`]);
    const u = await lesen.links({ benutzer: MA, caller: t.caller, body: { dokument_urls: [t.supabase.db.rechnung_pdfs[0].file_url, 'https://x/y'] } });
    expect(u.links[t.supabase.db.rechnung_pdfs[0].file_url].url).toBe(`https://dl.test/${f.id}`);
    expect(u.fehlend).toEqual(['https://x/y']);
  });

  it('Unternehmen loeschen: Dokument-Bereiche nur in den Papierkorb', async () => {
    const { t, o } = await mitRechnungPdf();
    const bereich = t.supabase.db.ablage_ordner.find((r) => r.art === 'bereich' && r.bereich === 'rechnungen');
    const u = t.supabase.db.ablage_ordner.find((r) => r.art === 'unternehmen');
    const r = await t.s.entityLoeschen({ benutzer: { ...MA, rolle: 'admin' }, caller: t.caller, body: { entity: 'unternehmen', id: U1 } });
    expect(r).toMatchObject({ papierkorb: 1, fehler: [] });
    expect(t.sp.calls).toContainEqual(['loeschen', bereich.item_id]);
    expect(t.sp.calls.find(([op, itemId]) => op === 'endgueltigLoeschen' && itemId === bereich.item_id)).toBeUndefined();
    expect(t.sp.calls).toContainEqual(['endgueltigLoeschen', u.item_id]);
    expect(o.pfad).toContain('/Firma/Rechnungen');
  });
});

describe('Abgleich: Datei aus Upload ohne CRM-Zeile', () => {
  it('Klassifizierung: Dokument-Upload nach 10 Minuten -> dokument_upload', () => {
    const k = require('../../netlify/functions/_shared/ablage/klassifizierung.js');
    const eltern = { art: 'dokument', bereich: 'rechnungen', ebene: 'rechnung', unternehmen_id: U1 };
    const upload = { id: 'up1', typ: 'beleg', kontext: { typ: 'beleg', bezug_id: R1 }, erstellt_at: '2026-11-09T11:00:00Z' };
    expect(k.dateiEinordnen({ item: { name: 'b.pdf' }, eltern, upload, versuche: 1, jetztMs: Date.parse('2026-11-09T12:00:00Z') }))
      .toEqual({ aktion: 'dokument_upload', typ: 'beleg', upload_id: 'up1' });
    expect(k.dateiEinordnen({ item: { name: 'b.pdf' }, eltern, versuche: 1, jetztMs: Date.parse('2026-11-09T12:00:00Z') }))
      .toEqual({ aktion: 'ignorieren', grund: 'dokument_ohne_crm' });
  });
});
