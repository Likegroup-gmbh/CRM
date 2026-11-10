import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createFakeSupabase } from './fixtures/fakeSupabase.js';

const require = createRequire(import.meta.url);
const { createStand } = require('../../netlify/functions/_shared/ablage/stand.js');
const { createAlarm, alarmeAus } = require('../../netlify/functions/_shared/ablage/alarm.js');
const ziel = require('../../netlify/functions/_shared/ablage/ziel.js');

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U1 = id(1);
const U2 = id(2);
const START = Date.parse('2026-12-02T08:00:00Z');
const MIN = 60000;
const TAG = 24 * 60 * MIN;
const iso = (t) => new Date(t).toISOString();

afterEach(() => ziel._reset());

function setup({ ablage = true, eingang = [], unternehmenStand } = {}) {
  const uhr = { t: START };
  const supabase = createFakeSupabase({
    tabellen: {
      ablage_einstellung: [{ schluessel: 'notschalter', wert: false }],
      ablage_stand: [{ drive_id: 'd1', letzter_erfolg: iso(START - MIN), abo_ablauf: iso(START + 20 * TAG), alarme: {} }],
      ablage_eingang: eingang,
      ablage_unzugeordnet: eingang.filter((e) => e.status === 'unzugeordnet' && !e.geloescht),
      unternehmen: [{ id: U1, firmenname: 'Alpha', ablage_ziel: 'dropbox' }, { id: U2, firmenname: 'Beta', ablage_ziel: 'sharepoint' }],
      benutzer: [
        { id: 'a1', rolle: 'admin', freigeschaltet: true, email: 'Chef@Firma.de' },
        { id: 'a2', rolle: 'admin', freigeschaltet: false, email: 'alt@firma.de' },
        { id: 'm1', rolle: 'mitarbeiter', freigeschaltet: true, email: 'm@firma.de' },
      ],
    },
    rpc: {
      ablage_unternehmen_stand: () => unternehmenStand ?? [
        { id: U1, firmenname: 'Alpha', ablage_ziel: 'dropbox', ist_test: false, dateien_sharepoint: 0, dateien_dropbox: '12', umzug_offen: 0, umzug_fertig: 0, umzug_fehler: 0, umzug_uebersprungen: 0 },
        { id: U2, firmenname: 'Beta', ablage_ziel: 'sharepoint', ist_test: true, dateien_sharepoint: 3, dateien_dropbox: 2, umzug_offen: 2, umzug_fertig: '5', umzug_fehler: 1, umzug_uebersprungen: 0 },
      ],
    },
  });
  const angestossen = [];
  const umzug = { anlegen: vi.fn(async () => 7) };
  const ab = ablage ? { sp: { driveId: 'd1' }, konfig: { siteUrl: 'https://t.sharepoint.com/sites/Medienablage', driveId: 'd1' }, ordner: { wurzel: vi.fn(async () => ({})) } } : null;
  const s = createStand({
    supabase, ablage: ab, event: {}, benutzer: { id: 'a1', email: 'chef@firma.de' }, jetzt: () => uhr.t, umzug,
    anstossenImpl: async (_e, name, body) => { angestossen.push([name, body.grund]); return true; },
  });
  return { uhr, supabase, db: supabase.db, s, angestossen, umzug, ab };
}

const eintrag = (itemId, status, extra = {}) => ({
  drive_id: 'd1', item_id: itemId, name: `${itemId}.mov`, pfad: `/X/${itemId}.mov`, status, versuche: 3, geloescht: false,
  naechster_versuch: iso(START + 10 * MIN), gesperrt_bis: null, grund: 'x', ...extra,
});

describe('ablage-stand: Stand', () => {
  it('liefert Konfig, Zaehler, Listen, Unternehmen und Umzug im Vertrag der Admin-Seite', async () => {
    const t = setup({
      eingang: [
        eintrag('o1', 'offen'), eintrag('o2', 'offen'), eintrag('f1', 'fehler'),
        eintrag('u1', 'unzugeordnet', { geaendert_at: iso(START - 5 * MIN) }), eintrag('u2', 'unzugeordnet', { geloescht: true }),
        eintrag('e1', 'erledigt', { erledigt_at: iso(START - MIN) }), eintrag('e2', 'erledigt', { erledigt_at: iso(START - 2 * TAG) }),
      ],
    });
    const r = await t.s.stand();
    expect(r.konfig).toEqual({ konfiguriert: true, site_url: 'https://t.sharepoint.com/sites/Medienablage', drive_id: 'd1' });
    expect(r.einstellung).toEqual({ notschalter: false });
    expect(r.stand[0]).toMatchObject({ drive_id: 'd1' });
    expect(r.zaehler).toEqual({ offen: 2, fehler: 1, unzugeordnet: 1, erledigt_24h: 1 });
    expect(r.unzugeordnet.map((x) => x.item_id)).toEqual(['u1']);
    expect(r.fehler).toEqual([expect.objectContaining({ item_id: 'f1', versuche: 3 })]);
    expect(r.unternehmen).toEqual([
      { id: U1, firmenname: 'Alpha', ablage_ziel: 'dropbox', ist_test: false, dateien_sharepoint: 0, dateien_dropbox: 12 },
      { id: U2, firmenname: 'Beta', ablage_ziel: 'sharepoint', ist_test: true, dateien_sharepoint: 3, dateien_dropbox: 2 },
    ]);
    expect(r.umzug).toEqual([{ unternehmen_id: U2, offen: 2, fertig: 5, fehler: 1, uebersprungen: 0 }]);
  });

  it('ohne SharePoint-Konfiguration: nur Notschalter und leere Listen', async () => {
    const t = setup({ ablage: false });
    const r = await t.s.stand();
    expect(r.konfig.konfiguriert).toBe(false);
    expect(r).toMatchObject({ unternehmen: [], umzug: [], unzugeordnet: [], fehler: [] });
    await expect(t.s.jetzt_abgleichen()).rejects.toMatchObject({ status: 409, code: 'nicht_konfiguriert' });
  });
});

describe('ablage-stand: Aktionen', () => {
  it('Notschalter schreibt die Einstellung und wirkt in dieser Instanz sofort', async () => {
    const t = setup();
    expect(await ziel.notschalterAn(t.supabase)).toBe(false);
    await t.s.notschalter({ an: true });
    expect(t.db.ablage_einstellung[0]).toMatchObject({ wert: true, updated_by: 'a1' });
    expect(await ziel.notschalterAn(t.supabase)).toBe(true);
    await expect(t.s.notschalter({ an: 'ja' })).rejects.toMatchObject({ status: 400 });
  });

  it('Weiche: setzt das Ziel, prueft Eingaben', async () => {
    const t = setup();
    await t.s.weiche({ unternehmen_id: U1, ziel: 'sharepoint' });
    expect(t.db.unternehmen[0].ablage_ziel).toBe('sharepoint');
    await expect(t.s.weiche({ unternehmen_id: U1, ziel: 'box' })).rejects.toMatchObject({ status: 400 });
    await expect(t.s.weiche({ unternehmen_id: id(9), ziel: 'dropbox' })).rejects.toMatchObject({ status: 404 });
    const ohne = setup({ ablage: false });
    await expect(ohne.s.weiche({ unternehmen_id: U1, ziel: 'sharepoint' })).rejects.toMatchObject({ status: 409 });
    await ohne.s.weiche({ unternehmen_id: U2, ziel: 'dropbox' });
  });

  it('Erneut: Eintrag wieder offen, sofort faellig, Abgleich angestossen; erledigte bleiben', async () => {
    const t = setup({ eingang: [eintrag('u1', 'unzugeordnet', { gesperrt_bis: iso(START + MIN) }), eintrag('e1', 'erledigt')] });
    await t.s.erneut({ item_id: 'u1' });
    expect(t.db.ablage_eingang[0]).toMatchObject({ status: 'offen', versuche: 0, grund: null, gesperrt_bis: null, naechster_versuch: iso(START) });
    expect(t.angestossen).toEqual([['ablage-abgleich-background', 'erneut']]);
    await expect(t.s.erneut({ item_id: 'e1' })).rejects.toMatchObject({ status: 404 });
  });

  it('Ignorieren', async () => {
    const t = setup({ eingang: [eintrag('f1', 'fehler')] });
    await t.s.ignorieren({ item_id: 'f1' });
    expect(t.db.ablage_eingang[0]).toMatchObject({ status: 'ignoriert', grund: 'admin' });
  });

  it('Vollabgleich setzt das Flag und stoesst an', async () => {
    const t = setup();
    expect(await t.s.voll_abgleich()).toEqual({ ok: true, angestossen: true });
    expect(t.db.ablage_stand[0].voll_abgleich_noetig).toBe(true);
    expect(t.angestossen).toEqual([['ablage-abgleich-background', 'voll']]);
  });

  it('Umzug starten: nur mit Weiche SharePoint, reiht ein und stoesst Laeufer an', async () => {
    const t = setup();
    await expect(t.s.umzug_starten({ unternehmen_id: U1 })).rejects.toMatchObject({ status: 409, code: 'weiche_dropbox' });
    expect(await t.s.umzug_starten({ unternehmen_id: U2 })).toEqual({ ok: true, angelegt: 7 });
    expect(t.umzug.anlegen).toHaveBeenCalledWith(U2);
    expect(t.ab.ordner.wurzel).toHaveBeenCalled();
    expect(t.angestossen).toEqual([['ablage-umzug-background', 'admin']]);
    t.umzug.anlegen.mockResolvedValueOnce(0);
    await t.s.umzug_starten({ unternehmen_id: U2 });
    expect(t.angestossen).toHaveLength(1);
  });
});

describe('Alarme', () => {
  const gesund = {
    drive_id: 'd1', letzter_erfolg: iso(START - MIN), abo_ablauf: iso(START + 20 * TAG), zert_ablauf: iso(START + 200 * TAG),
    quota_used: 10, quota_total: 100, rechte_lauf: iso(START - 5 * MIN),
  };

  it('Schwellen', () => {
    expect(alarmeAus(gesund, START)).toEqual({});
    const a = alarmeAus({
      ...gesund, letzter_erfolg: iso(START - 20 * MIN), fehler: 'Graph 503', abo_ablauf: iso(START + 2 * TAG),
      zert_ablauf: iso(START + 10 * TAG), quota_used: 81, rechte_lauf: iso(START - 90 * MIN),
    }, START);
    expect(Object.keys(a).sort()).toEqual(['abo', 'rechte', 'speicher', 'stillstand', 'zertifikat']);
    expect(a.stillstand).toContain('20 Minuten');
    expect(a.stillstand).toContain('Graph 503');
    expect(alarmeAus({ ...gesund, letzter_erfolg: null, fehler_seit: iso(START - 16 * MIN) }, START)).toHaveProperty('stillstand');
    expect(alarmeAus({ ...gesund, abo_ablauf: null }, START)).toHaveProperty('abo');
    expect(alarmeAus({ ...gesund, quota_total: 0 }, START)).toEqual({});
  });

  function alarmSetup(stand, { belegt = 10 } = {}) {
    const t = setup();
    Object.assign(t.db.ablage_stand[0], stand);
    const mails = [];
    const sp = { quota: vi.fn(async () => ({ used: belegt, total: 100 })) };
    const zertifikat = vi.fn(async () => ({ ablauf: new Date(START + 200 * TAG) }));
    let ok = true;
    const alarm = createAlarm({
      supabase: t.supabase, ablage: { sp, zertifikat }, jetzt: () => t.uhr.t, seitenUrl: 'https://crm.test/',
      sendMail: async (m) => { mails.push(m); return ok ? { ok: true } : { ok: false, error: 'RESEND_API_KEY nicht konfiguriert' }; },
    });
    const lauf = () => alarm.lauf({ ...t.db.ablage_stand[0] });
    return { ...t, mails, sp, zertifikat, lauf, setOk: (v) => { ok = v; } };
  }

  it('Mail beim Auftreten an freigeschaltete Admins, keine Wiederholung, taeglich Erinnerung, Mail beim Beheben', async () => {
    const t = alarmSetup({ ...gesund, letzter_erfolg: iso(START - 20 * MIN) });
    expect(await t.lauf()).toMatchObject({ aktiv: ['stillstand'], gemeldet: ['stillstand'], gesendet: 1 });
    expect(t.mails).toEqual([expect.objectContaining({ to: 'chef@firma.de', subject: 'Medienablage: Abgleich steht' })]);
    expect(t.mails[0].html).toContain('https://crm.test/admin/medienablage');
    expect(t.db.ablage_stand[0].alarme.stillstand).toMatchObject({ seit: iso(START), gemeldet_at: iso(START) });

    t.uhr.t += MIN;
    await t.lauf();
    expect(t.mails).toHaveLength(1);

    t.uhr.t += TAG;
    t.db.ablage_stand[0].rechte_lauf = iso(t.uhr.t);
    await t.lauf();
    expect(t.mails[1].subject).toBe('Medienablage: Erinnerung: Abgleich steht');
    expect(t.db.ablage_stand[0].alarme.stillstand.seit).toBe(iso(START));

    t.db.ablage_stand[0].letzter_erfolg = iso(t.uhr.t);
    expect(await t.lauf()).toMatchObject({ aktiv: [], behoben: ['stillstand'] });
    expect(t.mails[2].subject).toBe('Medienablage: wieder in Ordnung');
    expect(t.db.ablage_stand[0].alarme).toEqual({});
  });

  it('Versand fehlgeschlagen (Staging ohne Resend): in 15 Minuten erneut, nicht jede Minute', async () => {
    const t = alarmSetup({ ...gesund, quota_used: 95 }, { belegt: 95 });
    const frisch = () => Object.assign(t.db.ablage_stand[0], { letzter_erfolg: iso(t.uhr.t), rechte_lauf: iso(t.uhr.t) });
    t.setOk(false);
    await t.lauf();
    expect(t.db.ablage_stand[0].alarme.speicher).toMatchObject({ gemeldet_at: null, versuch_at: iso(START) });
    t.uhr.t += 5 * MIN;
    frisch();
    await t.lauf();
    expect(t.mails).toHaveLength(1);
    t.uhr.t += 11 * MIN;
    frisch();
    t.setOk(true);
    await t.lauf();
    expect(t.mails).toHaveLength(2);
    expect(t.mails[1].subject).toBe('Medienablage: Speicher fast voll');
    expect(t.db.ablage_stand[0].alarme.speicher.gemeldet_at).toBe(iso(t.uhr.t));
  });

  it('Messwerte hoechstens stuendlich: Kontingent und Zertifikatsablauf landen im Stand', async () => {
    const t = alarmSetup({ ...gesund, quota_used: null, quota_total: null, zert_ablauf: null, quota_at: null });
    t.zertifikat.mockResolvedValue({ ablauf: new Date(START + 10 * TAG) });
    const r = await t.lauf();
    expect(t.db.ablage_stand[0]).toMatchObject({ quota_used: 10, quota_total: 100, quota_at: iso(START), zert_ablauf: iso(START + 10 * TAG) });
    expect(r.aktiv).toEqual(['zertifikat']);
    t.uhr.t += 30 * MIN;
    await t.lauf();
    expect(t.sp.quota).toHaveBeenCalledTimes(1);
    t.uhr.t += 31 * MIN;
    await t.lauf();
    expect(t.sp.quota).toHaveBeenCalledTimes(2);
  });
});
