import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import { createFakeSupabase } from './fixtures/fakeSupabase.js';

const require = createRequire(import.meta.url);
const { createRechteAbgleich, rechteSoll, linkEntzogen } = require('../../netlify/functions/_shared/ablage/rechte.js');
const { rechteFaellig } = require('../../netlify/functions/ablage-zeitplan.js');

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U1 = id(1);
const UT = id(2);
const MA1 = id(3);
const KA1 = id(4);
const KO1 = id(5);
const KOT = id(6);
const A = id(11);
const F = id(12);
const M1 = id(13);
const M2 = id(14);
const M3 = id(15);
const M4 = id(16);
const M5 = id(17);
const KU = id(18);
const KU2 = id(19);
const KF = id(21);
const START = Date.parse('2026-11-09T12:00:00Z');
const iso = (ms) => new Date(ms).toISOString();
const H = 3600 * 1000;

const benutzer = () => [
  { id: A, rolle: 'admin', freigeschaltet: true, email: 'a@firma.de' },
  { id: F, rolle: 'admin', freigeschaltet: true, email: 'f@firma.de', mitarbeiter_klasse_id: KF },
  { id: M1, rolle: 'mitarbeiter', freigeschaltet: true, email: 'm1@gmail.com', microsoft_konto: 'M1@Firma.de' },
  { id: M2, rolle: 'mitarbeiter', freigeschaltet: true, email: 'm2@firma.de' },
  { id: M3, rolle: 'mitarbeiter', freigeschaltet: true, email: 'm3@firma.de', mitarbeiter_klasse_id: KF },
  { id: M4, rolle: 'mitarbeiter', freigeschaltet: false, email: 'm4@firma.de' },
  { id: M5, rolle: 'mitarbeiter', freigeschaltet: true, email: null },
  { id: KU, rolle: 'kunde', freigeschaltet: true, email: 'k@kunde.de' },
  { id: KU2, rolle: 'kunde', freigeschaltet: true, email: 'k2@kunde.de' },
];

const ordner = () => [
  { id: 'o-u1', drive_id: 'd1', item_id: 'iu1', parent_item_id: 'root', art: 'unternehmen', unternehmen_id: U1 },
  { id: 'o-m1', drive_id: 'd1', item_id: 'im1', parent_item_id: 'iu1', art: 'marke', unternehmen_id: U1, marke_id: MA1 },
  { id: 'o-k1', drive_id: 'd1', item_id: 'ik1', parent_item_id: 'im1', art: 'kampagne', unternehmen_id: U1, marke_id: MA1, kampagne_id: KA1 },
  { id: 'o-ko1', drive_id: 'd1', item_id: 'iko1', parent_item_id: 'ik1', art: 'kooperation', unternehmen_id: U1, marke_id: MA1, kampagne_id: KA1, kooperation_id: KO1 },
  { id: 'o-ty', drive_id: 'd1', item_id: 'ity', parent_item_id: 'iko1', art: 'typ', typ: 'videos', unternehmen_id: U1, marke_id: MA1, kampagne_id: KA1, kooperation_id: KO1 },
  { id: 'o-f1', drive_id: 'd1', item_id: 'if1', parent_item_id: 'iu1', art: 'frei', unternehmen_id: U1 },
  { id: 'o-f2', drive_id: 'd1', item_id: 'if2', parent_item_id: 'if1', art: 'frei', unternehmen_id: U1 },
  { id: 'o-t', drive_id: 'd1', item_id: 'it', parent_item_id: 'root', art: 'test' },
  { id: 'o-ut', drive_id: 'd1', item_id: 'iut', parent_item_id: 'it', art: 'unternehmen', unternehmen_id: UT },
  { id: 'o-weg', drive_id: 'd1', item_id: 'iweg', parent_item_id: 'root', art: 'unternehmen', unternehmen_id: id(7), geloescht_at: iso(START - H) },
];
const LI = { iu1: 11, im1: 12, ik1: 13, ity: 14, if1: 15, if2: 16, it: 17, iut: 18, iweg: 19 };

const zuordnung = () => ({
  mitarbeiter_unternehmen: [
    { mitarbeiter_id: M1, unternehmen_id: U1 },
    { mitarbeiter_id: M3, unternehmen_id: U1 },
    { mitarbeiter_id: M4, unternehmen_id: U1 },
    { mitarbeiter_id: M5, unternehmen_id: U1 },
    { mitarbeiter_id: A, unternehmen_id: U1 },
    { mitarbeiter_id: M1, unternehmen_id: UT },
  ],
  marke_mitarbeiter: [],
  kampagne_mitarbeiter: [{ id: 'km1', mitarbeiter_id: M2, kampagne_id: KA1 }],
});

/** SharePoint-Rollen in-memory: Scopes (Liste oder List-Item) mit Principals und Rollen-IDs. */
function fakeRechte({ unbekannt = [] } = {}) {
  const STUFEN = { lesen: 2, ohne_loeschen: 9, bearbeiten: 3 };
  const LIMITED = 1;
  const VOLL = 5;
  const principals = new Map();
  const nachKonto = new Map();
  let next = 100;
  const scopes = new Map();
  const calls = [];
  const scope = (lid) => {
    const k = lid ?? 'liste';
    if (!scopes.has(k)) scopes.set(k, { eigen: false, zuw: new Map() });
    return scopes.get(k);
  };
  const pidVon = (konto, typ = 1) => {
    if (!nachKonto.has(konto)) {
      const p = next++;
      nachKonto.set(konto, p);
      principals.set(p, { konto, typ });
    }
    return nachKonto.get(konto);
  };
  return {
    STUFEN,
    LIMITED,
    VOLL,
    calls,
    setze(lid, eigen, eintraege) {
      const x = scope(lid);
      x.eigen = eigen;
      x.zuw = new Map(eintraege.map(([konto, rollen, typ]) => [pidVon(konto, typ), new Set(rollen)]));
    },
    sicht(lid) {
      const x = scope(lid);
      const out = {};
      for (const [p, r] of x.zuw) out[principals.get(p).konto] = [...r].sort((a, b) => a - b);
      return { eigen: x.eigen, rechte: out };
    },
    aenderungen: () => calls.filter((c) => ['dazu', 'weg', 'brechen', 'erben'].includes(c[0])),
    async stufen() { return STUFEN; },
    async benutzer(konto) {
      calls.push(['ensure', konto]);
      return unbekannt.includes(konto) ? null : pidVon(konto);
    },
    async hatEigeneRechte(_l, lid) {
      calls.push(['pruefen', lid]);
      return scope(lid).eigen;
    },
    async vererbungUnterbrechen(_l, lid) {
      calls.push(['brechen', lid]);
      Object.assign(scope(lid), { eigen: true, zuw: new Map() });
    },
    async vererbungWiederherstellen(_l, lid) {
      calls.push(['erben', lid]);
      Object.assign(scope(lid), { eigen: false, zuw: new Map() });
    },
    async zuweisungen(_l, lid) {
      return [...scope(lid).zuw].map(([p, r]) => {
        const k = principals.get(p);
        return {
          principalId: p,
          login: k.typ === 1 ? `i:0#.f|membership|${k.konto}` : k.konto,
          konto: k.typ === 1 ? k.konto : null,
          typ: k.typ,
          rollen: [...r].map((rid) => ({ id: rid, typ: rid === LIMITED ? 1 : 0 })),
        };
      });
    },
    async zuweisen(_l, lid, p, r) {
      calls.push(['dazu', lid, principals.get(p).konto, r]);
      const x = scope(lid);
      if (!x.zuw.has(p)) x.zuw.set(p, new Set());
      x.zuw.get(p).add(r);
    },
    async entziehen(_l, lid, p, r) {
      calls.push(['weg', lid, principals.get(p).konto, r]);
      const x = scope(lid);
      x.zuw.get(p)?.delete(r);
      if (!x.zuw.get(p)?.size) x.zuw.delete(p);
    },
  };
}

function setup({ tabellen = {}, unbekannt, listItem } = {}) {
  const uhr = { t: START };
  const z = zuordnung();
  const supabase = createFakeSupabase({
    tabellen: {
      benutzer: benutzer(),
      mitarbeiter_klasse: [{ id: KF, name: 'Finanzen' }],
      unternehmen: [{ id: U1, ist_test: false }, { id: UT, ist_test: true }],
      kooperationen: [{ id: KO1, unternehmen_id: U1 }, { id: KOT, unternehmen_id: UT }],
      kunde_unternehmen: [{ kunde_id: KU, unternehmen_id: U1 }, { kunde_id: KU, unternehmen_id: UT }],
      ablage_ordner: ordner(),
      ablage_freigabelink: [],
      ablage_stand: [{ drive_id: 'd1', rechte_faellig: true }],
      ...z,
      ...tabellen,
    },
    rpc: {
      ablage_rechte_lease_holen: ({ p_drive_id, p_sekunden }, db) => {
        const s = db.ablage_stand.find((x) => x.drive_id === p_drive_id);
        if (!s || (s.rechte_lease_bis && Date.parse(s.rechte_lease_bis) > uhr.t)) return false;
        s.rechte_lease_bis = iso(uhr.t + p_sekunden * 1000);
        s.rechte_faellig = false;
        return true;
      },
    },
  });
  const rechte = fakeRechte({ unbekannt });
  const sp = {
    driveId: 'd1',
    listeId: vi.fn(async () => 'L'),
    listItemId: vi.fn(listItem || (async (item) => LI[item] ?? null)),
    freigabeEntfernen: vi.fn(async () => {}),
  };
  const ablage = { sp, rechte, ordner: { wurzel: async () => ({ item_id: 'root' }) } };
  const ra = createRechteAbgleich({ supabase, ablage, jetzt: () => uhr.t });
  const reg = (oid) => supabase.db.ablage_ordner.find((o) => o.id === oid);
  const stand = () => supabase.db.ablage_stand[0];
  return { uhr, supabase, db: supabase.db, rechte, sp, ra, reg, stand };
}

const ADMINS = { 'a@firma.de': [3], 'f@firma.de': [2] };
const U1_SOLL = { ...ADMINS, 'm1@firma.de': [9], 'm3@firma.de': [2] };

describe('rechteSoll (rein)', () => {
  const soll = (extra = []) => {
    const klasse = { name: 'Finanzen' };
    const b = benutzer().map((x) => ({ ...x, mitarbeiter_klasse: x.mitarbeiter_klasse_id ? klasse : null }));
    const z = zuordnung();
    return rechteSoll({
      benutzer: b,
      ordner: [...ordner().filter((o) => !o.geloescht_at), ...extra],
      zuordnung: { unternehmen: z.mitarbeiter_unternehmen, marke: z.marke_mitarbeiter, kampagne: z.kampagne_mitarbeiter },
      testUnternehmen: new Set([UT]),
      mitLink: new Set(['ity']),
    });
  };
  const scope = (r, item) => r.scopes.find((s) => s.ordner.item_id === item)?.soll;

  it('Bibliothek: nur Admins, Finanzen-Admin liest nur', () => {
    expect(soll().bibliothek).toMatchObject({ modus: 'eigen', rechte: { 'a@firma.de': 'bearbeiten', 'f@firma.de': 'lesen' } });
  });

  it('Unternehmen: Admins + zugeordnete Mitarbeiter, Stufe nach Klasse; gesperrte und Kunden nie', () => {
    const s = scope(soll(), 'iu1');
    expect(s.modus).toBe('eigen');
    expect(s.rechte).toEqual({ 'a@firma.de': 'bearbeiten', 'f@firma.de': 'lesen', 'm1@firma.de': 'ohne_loeschen', 'm3@firma.de': 'lesen' });
  });

  it('microsoft_konto vor E-Mail, ohne Konto gemeldet', () => {
    const r = soll();
    expect(scope(r, 'iu1').rechte['m1@firma.de']).toBe('ohne_loeschen');
    expect(r.ohneKonto).toEqual([M5]);
  });

  it('Marke ohne eigene Zuordnung erbt, Kampagne mit Zusatz bekommt eigene Rechte', () => {
    const r = soll();
    expect(scope(r, 'im1').modus).toBe('erben');
    expect(scope(r, 'ik1')).toMatchObject({ modus: 'eigen', rechte: { ...scope(r, 'iu1').rechte, 'm2@firma.de': 'ohne_loeschen' } });
  });

  it('oberster freier Ordner: Upload-Recht wird Bearbeiten, Lesen bleibt; verschachtelte erben', () => {
    const r = soll();
    expect(scope(r, 'if1').rechte).toEqual({ 'a@firma.de': 'bearbeiten', 'f@firma.de': 'lesen', 'm1@firma.de': 'bearbeiten', 'm3@firma.de': 'lesen' });
    expect(scope(r, 'if2')).toBeUndefined();
  });

  it('Bereiche Medien/ und Verträge/ erben vom Unternehmen; freier Ordner in Verträge/ wie direkt unter dem Unternehmen', () => {
    const r = soll([
      { id: 'o-bm', drive_id: 'd1', item_id: 'ibm', parent_item_id: 'iu1', art: 'bereich', bereich: 'medien', unternehmen_id: U1 },
      { id: 'o-bv', drive_id: 'd1', item_id: 'ibv', parent_item_id: 'iu1', art: 'bereich', bereich: 'vertraege', unternehmen_id: U1 },
      { id: 'o-fv', drive_id: 'd1', item_id: 'ifv', parent_item_id: 'ibv', art: 'frei', bereich: 'vertraege', unternehmen_id: U1 },
    ]);
    expect(scope(r, 'ibm')).toBeUndefined();
    expect(scope(r, 'ibv')).toBeUndefined();
    expect(scope(r, 'ifv').rechte).toEqual(scope(r, 'if1').rechte);
  });

  it('_Test und Testunternehmen erben (nur Admins), auch mit Zuordnung', () => {
    const r = soll();
    expect(scope(r, 'it').modus).toBe('erben');
    expect(scope(r, 'iut').modus).toBe('erben');
  });

  it('Typ-Ordner mit Kunden-Link läuft mit der Kampagne mit, Kooperation wird nicht verwaltet', () => {
    const r = soll();
    expect(scope(r, 'ity')).toMatchObject({ modus: 'mitlaufen', rechte: scope(r, 'ik1').rechte });
    expect(scope(r, 'iko1')).toBeUndefined();
  });

  it('gleiches Konto bei zwei Benutzern: höhere Stufe gewinnt; Hash stabil gegen Reihenfolge', () => {
    const b = [
      { id: A, rolle: 'admin', email: 'a@firma.de' },
      { id: M1, rolle: 'mitarbeiter', email: 'x@firma.de', mitarbeiter_klasse: { name: 'Finanzen' } },
      { id: M2, rolle: 'mitarbeiter', email: 'X@firma.de' },
    ];
    const o = [{ item_id: 'u', art: 'unternehmen', unternehmen_id: U1 }];
    const mu = [{ mitarbeiter_id: M1, unternehmen_id: U1 }, { mitarbeiter_id: M2, unternehmen_id: U1 }];
    const r1 = rechteSoll({ benutzer: b, ordner: o, zuordnung: { unternehmen: mu } });
    const r2 = rechteSoll({ benutzer: [...b].reverse(), ordner: o, zuordnung: { unternehmen: [...mu].reverse() } });
    expect(r1.scopes[0].soll.rechte['x@firma.de']).toBe('ohne_loeschen');
    expect(r1.scopes[0].soll.hash).toBe(r2.scopes[0].soll.hash);
  });
});

describe('linkEntzogen', () => {
  const ctx = {
    benutzer: new Map([
      [KU, { id: KU, rolle: 'kunde' }],
      [KU2, { id: KU2, rolle: 'kunde', freigeschaltet: false }],
      [M1, { id: M1, rolle: 'mitarbeiter', freigeschaltet: false }],
      [id(30), { id: id(30), rolle: 'gast' }],
    ]),
    koopUnternehmen: new Map([[KO1, U1], [KOT, UT]]),
    kundeUnternehmen: new Set([`${KU}|${U1}`, `${KU}|${UT}`, `${KU2}|${U1}`]),
    testUnternehmen: new Set([UT]),
  };
  it.each([
    ['Kunde mit Zuordnung', { erstellt_von: KU, kooperation_id: KO1 }, false],
    ['Kunde auf Testunternehmen', { erstellt_von: KU, kooperation_id: KOT }, true],
    ['gesperrter Kunde', { erstellt_von: KU2, kooperation_id: KO1 }, true],
    ['Staff-Link bleibt, auch gesperrt', { erstellt_von: M1, kooperation_id: KO1 }, false],
    ['Ersteller gelöscht', { erstellt_von: null, kooperation_id: KO1 }, true],
    ['andere Rolle', { erstellt_von: id(30), kooperation_id: KO1 }, true],
    ['Kooperation ohne Unternehmen', { erstellt_von: KU, kooperation_id: id(99) }, true],
  ])('%s', (_n, link, erwartet) => {
    expect(linkEntzogen(link, ctx)).toBe(erwartet);
  });
});

describe('Rechte-Abgleich', () => {
  it('erster Lauf: Bibliothek, Unternehmen, Kampagne, freier Ordner bekommen eigene Rechte', async () => {
    const t = setup();
    const r = await t.ra.lauf();
    expect(r).toMatchObject({ lease: true, fehler: [], ohne_konto: 1 });
    expect(t.rechte.sicht(null)).toEqual({ eigen: true, rechte: ADMINS });
    expect(t.rechte.sicht(11)).toEqual({ eigen: true, rechte: U1_SOLL });
    expect(t.rechte.sicht(13)).toEqual({ eigen: true, rechte: { ...U1_SOLL, 'm2@firma.de': [9] } });
    expect(t.rechte.sicht(15)).toEqual({ eigen: true, rechte: { ...U1_SOLL, 'm1@firma.de': [3] } });
    for (const lid of [12, 14, 16, 17, 18, 19]) expect(t.rechte.sicht(lid).eigen).toBe(false);
    expect(t.reg('o-u1')).toMatchObject({ rechte_eigen: true, list_item_id: 11, rechte_geprueft_at: iso(START) });
    expect(t.reg('o-m1')).toMatchObject({ rechte_eigen: false, list_item_id: 12 });
    expect(t.reg('o-m1').rechte_hash).toBeTruthy();
    expect(t.stand()).toMatchObject({ rechte_lease_bis: null, rechte_lauf: iso(START), rechte_fehler: null });
  });

  it('zweiter Lauf ohne Änderung: nur die Bibliothek wird geprüft', async () => {
    const t = setup();
    await t.ra.lauf();
    t.rechte.calls.length = 0;
    await t.ra.lauf();
    expect(t.rechte.aenderungen()).toEqual([]);
    expect(t.rechte.calls.filter((c) => c[0] === 'pruefen')).toEqual([['pruefen', null]]);
  });

  it('Zuordnung entfernt: Rollen weg, Gruppen und Limited Access bleiben', async () => {
    const t = setup();
    await t.ra.lauf();
    t.rechte.setze(11, true, [
      ...Object.entries(U1_SOLL).map(([k, r]) => [k, r]),
      ['Medienablage-Besitzer', [t.rechte.VOLL], 8],
      ['m9@firma.de', [t.rechte.LIMITED]],
    ]);
    t.db.mitarbeiter_unternehmen = t.db.mitarbeiter_unternehmen.filter((z) => z.mitarbeiter_id !== M1);
    await t.ra.lauf();
    expect(t.rechte.sicht(11).rechte).toEqual({ ...ADMINS, 'm3@firma.de': [2], 'Medienablage-Besitzer': [5], 'm9@firma.de': [1] });
    expect(t.rechte.sicht(13).rechte['m1@firma.de']).toBeUndefined();
    expect(t.rechte.sicht(15).rechte['m1@firma.de']).toBeUndefined();
  });

  it('Klasse wird Finanzen: erst Lesen zuweisen, dann Upload-Stufe entziehen', async () => {
    const t = setup();
    await t.ra.lauf();
    t.rechte.calls.length = 0;
    t.db.benutzer.find((b) => b.id === M1).mitarbeiter_klasse_id = KF;
    await t.ra.lauf();
    const u1 = t.rechte.aenderungen().filter((c) => c[1] === 11);
    expect(u1).toEqual([['dazu', 11, 'm1@firma.de', 2], ['weg', 11, 'm1@firma.de', 9]]);
    // ohne Upload-Recht weicht der freie Ordner nicht mehr ab und erbt Lesen vom Unternehmen
    expect(t.rechte.sicht(15).eigen).toBe(false);
    expect(t.reg('o-f1').rechte_eigen).toBe(false);
  });

  it('Marke bekommt eigene Zuordnung und verliert sie wieder: Vererbung zurück', async () => {
    const t = setup();
    await t.ra.lauf();
    t.db.marke_mitarbeiter.push({ mitarbeiter_id: M2, marke_id: MA1 });
    await t.ra.lauf();
    expect(t.rechte.sicht(12)).toEqual({ eigen: true, rechte: { ...U1_SOLL, 'm2@firma.de': [9] } });
    // Kampagne erbt jetzt von der Marke dasselbe
    expect(t.rechte.sicht(13).eigen).toBe(false);
    t.db.marke_mitarbeiter = [];
    await t.ra.lauf();
    expect(t.rechte.sicht(12).eigen).toBe(false);
    expect(t.rechte.sicht(13)).toEqual({ eigen: true, rechte: { ...U1_SOLL, 'm2@firma.de': [9] } });
    expect(t.reg('o-m1').rechte_eigen).toBe(false);
  });

  it('Unternehmen wird Testunternehmen: Vererbung wiederhergestellt', async () => {
    const t = setup();
    await t.ra.lauf();
    t.db.unternehmen.find((u) => u.id === U1).ist_test = true;
    await t.ra.lauf();
    for (const lid of [11, 13, 15]) expect(t.rechte.sicht(lid).eigen).toBe(false);
  });

  it('unbekanntes Konto: Rest gesetzt, nach einer Stunde erneut versucht', async () => {
    const t = setup({ unbekannt: ['m3@firma.de'] });
    const r = await t.ra.lauf();
    expect(r.unbekannt).toEqual(['m3@firma.de']);
    expect(t.rechte.sicht(11).rechte).toEqual({ ...ADMINS, 'm1@firma.de': [9] });
    expect(t.reg('o-u1').rechte_hash).toMatch(/\?$/);
    t.rechte.calls.length = 0;
    t.uhr.t += 30 * 60 * 1000;
    await t.ra.lauf();
    expect(t.rechte.calls.some((c) => c[0] === 'pruefen' && c[1] === 11)).toBe(false);
    t.uhr.t += 31 * 60 * 1000;
    await t.ra.lauf();
    expect(t.rechte.calls.some((c) => c[0] === 'pruefen' && c[1] === 11)).toBe(true);
  });

  it('nach 24 Stunden: Abweichung von Hand wird korrigiert', async () => {
    const t = setup();
    await t.ra.lauf();
    t.rechte.setze(11, true, [...Object.entries(U1_SOLL), ['fremd@firma.de', [3]]]);
    t.uhr.t += 23 * H;
    await t.ra.lauf();
    expect(t.rechte.sicht(11).rechte['fremd@firma.de']).toEqual([3]);
    t.uhr.t += 2 * H;
    await t.ra.lauf();
    expect(t.rechte.sicht(11).rechte).toEqual(U1_SOLL);
  });

  it('Typ-Ordner mit Link: nur wenn SharePoint die Vererbung unterbrochen hat, Link-Gruppe bleibt', async () => {
    const t = setup({ tabellen: { ablage_freigabelink: [{ id: 'l1', drive_id: 'd1', item_id: 'ity', kooperation_id: KO1, erstellt_von: KU, laeuft_ab_at: iso(START + 30 * 24 * H) }] } });
    await t.ra.lauf();
    expect(t.rechte.sicht(14).eigen).toBe(false);
    expect(t.rechte.aenderungen().some((c) => c[1] === 14)).toBe(false);
    // Link-Erstellung kopiert die Eltern-Rechte von damals (m1 noch drin) und legt eine Link-Gruppe an
    t.rechte.setze(14, true, [['alt@firma.de', [9]], ['a@firma.de', [3]], ['SharingLinks.abc', [t.rechte.LIMITED], 8]]);
    t.uhr.t += 25 * H;
    await t.ra.lauf();
    expect(t.rechte.sicht(14)).toEqual({ eigen: true, rechte: { ...U1_SOLL, 'm2@firma.de': [9], 'SharingLinks.abc': [1] } });
  });

  it('Lease gehalten: Lauf endet sofort', async () => {
    const t = setup();
    t.stand().rechte_lease_bis = iso(START + 60000);
    expect(await t.ra.lauf()).toEqual({ lease: false });
    expect(t.rechte.calls).toEqual([]);
  });

  it('kein Admin mit Konto: Abbruch ohne Änderung', async () => {
    const t = setup();
    for (const b of t.db.benutzer) if (b.rolle === 'admin') b.email = null;
    const r = await t.ra.lauf();
    expect(r.abbruch).toMatch(/Kein Admin/);
    expect(t.rechte.aenderungen()).toEqual([]);
    expect(t.stand()).toMatchObject({ rechte_lease_bis: null, rechte_fehler: r.abbruch });
  });

  it('Fehler an einem Ordner: Rest läuft, Ordner im nächsten Lauf erneut', async () => {
    const t = setup({ listItem: async (item) => { if (item === 'ik1') throw new Error('Graph 503'); return LI[item]; } });
    const r = await t.ra.lauf();
    expect(r.fehler).toEqual(['kampagne ik1: Graph 503']);
    expect(t.rechte.sicht(11).eigen).toBe(true);
    expect(t.stand().rechte_fehler).toMatch(/^1 Ordner: kampagne ik1/);
    expect(t.reg('o-k1').rechte_hash).toBeUndefined();
  });

  it('Budget erschöpft: mehr + rechte_faellig für den Zeitplan', async () => {
    const t = setup();
    const r = await t.ra.lauf({ budgetMs: 0 });
    expect(r.mehr).toBe(true);
    expect(t.stand().rechte_faellig).toBe(true);
    expect(t.rechte.sicht(null).eigen).toBe(true);
  });

  it('Kunden-Leselinks: entzogene widerrufen, gültige und Staff-Links bleiben', async () => {
    const bald = iso(START + 20 * 24 * H);
    const link = (lid, erstellt_von, kooperation_id = KO1, extra = {}) => ({
      id: lid, drive_id: 'd1', item_id: 'ity', permission_id: `p-${lid}`, kooperation_id, erstellt_von, laeuft_ab_at: bald, widerrufen_at: null, ...extra,
    });
    const t = setup({
      tabellen: {
        ablage_freigabelink: [
          link('ok', KU),
          link('ohne', KU2),
          link('staff', M1),
          link('weg', null),
          link('test', KU, KOT),
          link('abgelaufen', KU2, KO1, { laeuft_ab_at: iso(START - H) }),
          link('schon', KU2, KO1, { widerrufen_at: iso(START - H), widerruf_grund: 'manuell' }),
        ],
      },
    });
    const r = await t.ra.lauf();
    expect(r.links).toBe(3);
    const status = Object.fromEntries(t.db.ablage_freigabelink.map((l) => [l.id, l.widerruf_grund || null]));
    expect(status).toEqual({ ok: null, ohne: 'zugriff_entzogen', staff: null, weg: 'zugriff_entzogen', test: 'zugriff_entzogen', abgelaufen: null, schon: 'manuell' });
    expect(t.sp.freigabeEntfernen.mock.calls.map((c) => c[1]).sort()).toEqual(['p-ohne', 'p-test', 'p-weg']);
  });
});

describe('Zeitplan: rechteFaellig', () => {
  const t = START;
  it.each([
    ['kein Stand', null, false],
    ['Stand mit Fehler', { fehler: 'x' }, false],
    ['nie gelaufen', { drive_id: 'd1' }, true],
    ['fällig markiert', { drive_id: 'd1', rechte_faellig: true, rechte_lauf: iso(t - 60000) }, true],
    ['läuft gerade', { drive_id: 'd1', rechte_faellig: true, rechte_lease_bis: iso(t + 60000) }, false],
    ['vor 10 Minuten', { drive_id: 'd1', rechte_lauf: iso(t - 10 * 60000) }, false],
    ['vor 15 Minuten', { drive_id: 'd1', rechte_lauf: iso(t - 15 * 60000) }, true],
  ])('%s', (_n, stand, erwartet) => {
    expect(rechteFaellig(stand, t)).toBe(erwartet);
  });
});
