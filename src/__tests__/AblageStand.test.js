import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import { createFakeSupabase } from './fixtures/fakeSupabase.js';

const require = createRequire(import.meta.url);
const { createStand, AKTIONEN } = require('../../netlify/functions/_shared/ablage/stand.js');
const { createAlarm, alarmeAus } = require('../../netlify/functions/_shared/ablage/alarm.js');

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U1 = id(1);
const U2 = id(2);
const START = Date.parse('2026-12-02T08:00:00Z');
const MIN = 60000;
const TAG = 24 * 60 * MIN;
const iso = (t) => new Date(t).toISOString();

function setup({ ablage = true, eingang = [] } = {}) {
  const uhr = { t: START };
  const supabase = createFakeSupabase({
    tabellen: {
      ablage_stand: [{ drive_id: 'd1', letzter_erfolg: iso(START - MIN), abo_ablauf: iso(START + 20 * TAG), alarme: {} }],
      ablage_eingang: eingang,
      ablage_unzugeordnet: eingang.filter((e) => e.status === 'unzugeordnet' && !e.geloescht),
      unternehmen: [{ id: U1, firmenname: 'Alpha' }, { id: U2, firmenname: 'Beta', ist_test: true }],
      benutzer: [
        { id: 'a1', rolle: 'admin', freigeschaltet: true, email: 'Chef@Firma.de' },
        { id: 'a2', rolle: 'admin', freigeschaltet: false, email: 'alt@firma.de' },
        { id: 'm1', rolle: 'mitarbeiter', freigeschaltet: true, email: 'm@firma.de' },
      ],
    },
  });
  const angestossen = [];
  const finalSpiegel = { stand: vi.fn(async () => ({ offen: 0, fertig: 4 })) };
  const ab = ablage ? { sp: { driveId: 'd1' }, konfig: { siteUrl: 'https://t.sharepoint.com/sites/Medienablage', driveId: 'd1' }, ordner: { wurzel: vi.fn(async () => ({})) } } : null;
  const s = createStand({
    supabase, ablage: ab, event: {}, benutzer: { id: 'a1', email: 'chef@firma.de' }, jetzt: () => uhr.t, finalSpiegel,
    anstossenImpl: async (_e, name, body) => { angestossen.push([name, body.grund]); return true; },
  });
  return { uhr, supabase, db: supabase.db, s, angestossen, ab };
}

const eintrag = (itemId, status, extra = {}) => ({
  drive_id: 'd1', item_id: itemId, name: `${itemId}.mov`, pfad: `/X/${itemId}.mov`, status, versuche: 3, geloescht: false,
  naechster_versuch: iso(START + 10 * MIN), gesperrt_bis: null, grund: 'x', ...extra,
});

describe('ablage-stand: Stand', () => {
  it('liefert Konfig, Zaehler, Listen, Unternehmen und Finale im Vertrag der Admin-Seite', async () => {
    const t = setup({
      eingang: [
        eintrag('o1', 'offen'), eintrag('o2', 'offen'), eintrag('f1', 'fehler'),
        eintrag('u1', 'unzugeordnet', { geaendert_at: iso(START - 5 * MIN) }), eintrag('u2', 'unzugeordnet', { geloescht: true }),
        eintrag('e1', 'erledigt', { erledigt_at: iso(START - MIN) }), eintrag('e2', 'erledigt', { erledigt_at: iso(START - 2 * TAG) }),
      ],
    });
    const r = await t.s.stand();
    expect(r.konfig).toEqual({ konfiguriert: true, site_url: 'https://t.sharepoint.com/sites/Medienablage', drive_id: 'd1' });
    expect(r.stand[0]).toMatchObject({ drive_id: 'd1' });
    expect(r.zaehler).toEqual({ offen: 2, fehler: 1, unzugeordnet: 1, erledigt_24h: 1 });
    expect(r.unzugeordnet.map((x) => x.item_id)).toEqual(['u1']);
    expect(r.fehler).toEqual([expect.objectContaining({ item_id: 'f1', versuche: 3 })]);
    expect(r.unternehmen).toEqual([
      { id: U1, firmenname: 'Alpha', ist_test: false },
      { id: U2, firmenname: 'Beta', ist_test: true },
    ]);
    expect(r.final_spiegel).toEqual({ offen: 0, fertig: 4 });
    expect(r).not.toHaveProperty('einstellung');
    expect(r).not.toHaveProperty('umzug');
  });

  it('ohne SharePoint-Konfiguration: leere Listen, Aktionen mit 409', async () => {
    const t = setup({ ablage: false });
    const r = await t.s.stand();
    expect(r.konfig.konfiguriert).toBe(false);
    expect(r).toMatchObject({ unternehmen: [], unzugeordnet: [], fehler: [], final_spiegel: null });
    await expect(t.s.jetzt_abgleichen()).rejects.toMatchObject({ status: 409, code: 'nicht_konfiguriert' });
  });

  it('kennt keine Weiche, keinen Notschalter und keinen Umzug mehr', () => {
    for (const alt of ['notschalter', 'weiche', 'umzug_starten', 'dokument_umzug_starten']) expect(AKTIONEN.has(alt)).toBe(false);
  });
});

describe('ablage-stand: Aktionen', () => {
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
