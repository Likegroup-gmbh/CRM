// _shared/ablage/rechte.js
// Rechte-Abgleich CRM -> SharePoint. Das CRM fuehrt (Zuordnung + Klasse), SharePoint folgt.
// Verwaltete Scopes: Bibliothek (nur Admins), Unternehmen (+ zugeordnete Mitarbeiter),
// Marke/Kampagne (nur wenn eigene Zuordnungen dazukommen), oberste freie Ordner (Loeschen
// erlaubt) und Typ-Ordner mit Kunden-Leselink (der Link hat dort die Vererbung unterbrochen).
// Angefasst werden nur Benutzer-Principals und die drei eigenen Stufen; Gruppen, Limited
// Access und Vollzugriff bleiben. Kunden, Creator und Gaeste bekommen nie direkten Zugriff.
// Zusaetzlich: Kunden-Leselinks widerrufen, deren Ersteller die Kooperation nicht mehr sieht.

const crypto = require('crypto');
const { darfMediaUpload, istStaff } = require('./zugriff');
const { linksWiderrufen } = require('./freigabe');
const { SEITE, stuecke } = require('./liste');

const LEASE_SEK = 840;
const BUDGET_MS = 12 * 60 * 1000;
const PRUEFEN_MS = 24 * 3600 * 1000;
// Soll mit unbekanntem Konto (noch kein Microsoft-Konto): stuendlich erneut versuchen
const OFFEN_MS = 3600 * 1000;
const PRINCIPAL_BENUTZER = 1;

const RANG = { lesen: 1, ohne_loeschen: 2, bearbeiten: 3 };
const VERWALTET = ['unternehmen', 'marke', 'kampagne', 'frei', 'test'];
const ORDNER_SPALTEN = 'id, item_id, parent_item_id, art, unternehmen_id, marke_id, kampagne_id, list_item_id, rechte_eigen, rechte_hash, rechte_geprueft_at';

const kontoVon = (b) => String(b?.microsoft_konto || b?.email || '').trim().toLowerCase() || null;

/** Admin mit Upload-Recht darf loeschen, Mitarbeiter mit Upload-Recht nicht, alle anderen lesen. */
function stufeVon(b) {
  if (!darfMediaUpload(b)) return 'lesen';
  return b.rolle === 'admin' ? 'bearbeiten' : 'ohne_loeschen';
}

function vereinen(a, b) {
  const r = { ...a };
  for (const [k, s] of Object.entries(b)) if (!r[k] || RANG[s] > RANG[r[k]]) r[k] = s;
  return r;
}

function gleich(a, b) {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

function sollVon(modus, rechte = {}) {
  const eintraege = Object.entries(rechte).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
  const hash = crypto.createHash('sha256').update(JSON.stringify([modus, eintraege])).digest('hex').slice(0, 32);
  return { modus, rechte, hash };
}

// Eigene Rechte nur, wenn der Scope vom geerbten Stand abweicht
const abweichung = (geerbt, eigen) => (gleich(geerbt, eigen) ? sollVon('erben') : sollVon('eigen', eigen));

// Freie Ordner: wer hochladen darf, darf dort auch loeschen
const mitLoeschen = (rechte) => Object.fromEntries(
  Object.entries(rechte).map(([k, s]) => [k, s === 'ohne_loeschen' ? 'bearbeiten' : s]),
);

/**
 * Reiner Sollzustand.
 * @param {object} d
 * @param {object[]} d.benutzer Admins und Mitarbeiter, mitarbeiter_klasse: { name }
 * @param {object[]} d.ordner Register-Zeilen der verwalteten Scopes (+ Typ-Ordner mit Link)
 * @param {{ unternehmen?: object[], marke?: object[], kampagne?: object[] }} d.zuordnung
 * @param {Set<string>} d.testUnternehmen
 * @param {Set<string>} [d.mitLink] item_ids der Typ-Ordner mit Kunden-Leselink
 * @returns {{ bibliothek, scopes: { ordner, soll }[], ohneKonto: string[] }}
 *   soll = { modus: 'eigen'|'erben'|'mitlaufen', rechte: { konto: stufe }, hash }
 *   mitlaufen: Benutzer angleichen, falls SharePoint die Vererbung unterbrochen hat, sonst nichts.
 */
function rechteSoll({ benutzer = [], ordner = [], zuordnung = {}, testUnternehmen = new Set(), mitLink = new Set() }) {
  const aktiv = benutzer.filter(istStaff);
  const nachId = new Map(aktiv.map((b) => [b.id, b]));
  const ohneKonto = new Set();

  const rechteAus = (liste) => {
    const r = {};
    for (const b of liste) {
      const k = kontoVon(b);
      if (!k) {
        ohneKonto.add(b.id);
        continue;
      }
      const s = stufeVon(b);
      if (!r[k] || RANG[s] > RANG[r[k]]) r[k] = s;
    }
    return r;
  };

  // wie rls_my_kooperation_ids: Zuordnungen zaehlen nur fuer die Rolle mitarbeiter
  const gruppe = (liste, schluessel) => {
    const m = new Map();
    for (const z of liste || []) {
      const b = nachId.get(z.mitarbeiter_id);
      if (!b || b.rolle !== 'mitarbeiter') continue;
      if (!m.has(z[schluessel])) m.set(z[schluessel], []);
      m.get(z[schluessel]).push(b);
    }
    return m;
  };

  const basis = rechteAus(aktiv.filter((b) => b.rolle === 'admin'));
  const mu = gruppe(zuordnung.unternehmen, 'unternehmen_id');
  const mm = gruppe(zuordnung.marke, 'marke_id');
  const mk = gruppe(zuordnung.kampagne, 'kampagne_id');
  // Testunternehmen liegen unter _Test und sehen nur Admins
  const test = (u) => !!u && testUnternehmen.has(u);

  const effU = (u) => (!u || test(u) ? basis : vereinen(basis, rechteAus(mu.get(u) || [])));
  const effM = (m, u) => (!m || test(u) ? effU(u) : vereinen(effU(u), rechteAus(mm.get(m) || [])));
  const effK = (k, m, u) => (!k || test(u) ? effM(m, u) : vereinen(effM(m, u), rechteAus(mk.get(k) || [])));
  const effVon = (o) => effK(o.kampagne_id, o.marke_id, o.unternehmen_id);

  const freiIds = new Set(ordner.filter((o) => o.art === 'frei').map((o) => o.item_id));
  const scopes = [];
  for (const o of ordner) {
    let soll;
    if (o.art === 'unternehmen') {
      soll = !o.unternehmen_id || test(o.unternehmen_id) ? sollVon('erben') : sollVon('eigen', effU(o.unternehmen_id));
    } else if (o.art === 'marke') {
      soll = abweichung(effU(o.unternehmen_id), effM(o.marke_id, o.unternehmen_id));
    } else if (o.art === 'kampagne') {
      soll = abweichung(effM(o.marke_id, o.unternehmen_id), effK(o.kampagne_id, o.marke_id, o.unternehmen_id));
    } else if (o.art === 'frei') {
      // verschachtelte freie Ordner erben vom obersten
      if (freiIds.has(o.parent_item_id)) continue;
      const geerbt = effVon(o);
      soll = abweichung(geerbt, mitLoeschen(geerbt));
    } else if (o.art === 'test') {
      soll = sollVon('erben');
    } else if (o.art === 'typ' && mitLink.has(o.item_id)) {
      soll = sollVon('mitlaufen', effVon(o));
    } else {
      continue;
    }
    scopes.push({ ordner: o, soll });
  }
  return { bibliothek: sollVon('eigen', basis), scopes, ohneKonto: [...ohneKonto] };
}

/**
 * Hat der Ersteller eines Kunden-Leselinks den Zugriff verloren?
 * Staff-Links bleiben (sie sind fuer Kunden gedacht); Kunden-Links nur mit kunde_unternehmen
 * auf das Unternehmen der Kooperation (Regel kooperationen_select + testunternehmen_hide);
 * ohne bekannten Ersteller oder mit anderer Rolle: widerrufen.
 */
function linkEntzogen(link, { benutzer, koopUnternehmen, kundeUnternehmen, testUnternehmen }) {
  const b = link.erstellt_von ? benutzer.get(link.erstellt_von) : null;
  if (!b) return true;
  if (b.rolle === 'admin' || b.rolle === 'mitarbeiter') return false;
  if (b.rolle !== 'kunde' || b.freigeschaltet === false) return true;
  const u = koopUnternehmen.get(link.kooperation_id);
  return !u || testUnternehmen.has(u) || !kundeUnternehmen.has(`${b.id}|${u}`);
}

/**
 * @param {object} deps
 * @param {object} deps.supabase Service-Client
 * @param {object} deps.ablage ablageAusEnv()
 */
function createRechteAbgleich({ supabase, ablage, jetzt = () => Date.now() }) {
  const { sp } = ablage;
  const driveId = sp.driveId;
  const iso = (ms = jetzt()) => new Date(ms).toISOString();
  const principals = new Map();

  async function alle(bauen) {
    const out = [];
    for (let von = 0; ; von += SEITE) {
      const { data, error } = await bauen().range(von, von + SEITE - 1);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < SEITE) return out;
    }
  }

  async function inStuecken(ids, bauen) {
    const out = [];
    for (const teil of stuecke([...new Set(ids)].filter(Boolean))) {
      const { data, error } = await bauen(teil);
      if (error) throw error;
      out.push(...(data || []));
    }
    return out;
  }

  async function laden() {
    const [benutzer, klassen, mu, mm, mk, test, ordner, linkItems] = await Promise.all([
      alle(() => supabase.from('benutzer').select('id, rolle, freigeschaltet, email, microsoft_konto, mitarbeiter_klasse_id')
        .in('rolle', ['admin', 'mitarbeiter']).order('id')),
      alle(() => supabase.from('mitarbeiter_klasse').select('id, name').order('id')),
      alle(() => supabase.from('mitarbeiter_unternehmen').select('mitarbeiter_id, unternehmen_id').order('mitarbeiter_id').order('unternehmen_id')),
      alle(() => supabase.from('marke_mitarbeiter').select('mitarbeiter_id, marke_id').order('mitarbeiter_id').order('marke_id')),
      alle(() => supabase.from('kampagne_mitarbeiter').select('mitarbeiter_id, kampagne_id').order('id')),
      alle(() => supabase.from('unternehmen').select('id').eq('ist_test', true).order('id')),
      alle(() => supabase.from('ablage_ordner').select(ORDNER_SPALTEN).eq('drive_id', driveId).in('art', VERWALTET)
        .is('geloescht_at', null).not('item_id', 'is', null).order('id')),
      alle(() => supabase.from('ablage_freigabelink').select('item_id').eq('drive_id', driveId).order('id')),
    ]);
    const klasse = new Map(klassen.map((k) => [k.id, k.name]));
    for (const b of benutzer) b.mitarbeiter_klasse = { name: klasse.get(b.mitarbeiter_klasse_id) || null };
    const mitLink = new Set(linkItems.map((l) => l.item_id));
    const typOrdner = await inStuecken([...mitLink], (teil) => supabase.from('ablage_ordner').select(ORDNER_SPALTEN)
      .eq('drive_id', driveId).eq('art', 'typ').is('geloescht_at', null).in('item_id', teil));
    return {
      benutzer,
      ordner: [...ordner, ...typOrdner],
      zuordnung: { unternehmen: mu, marke: mm, kampagne: mk },
      testUnternehmen: new Set(test.map((u) => u.id)),
      mitLink,
    };
  }

  async function principal(rechte, konto) {
    if (!principals.has(konto)) principals.set(konto, await rechte.benutzer(konto));
    return principals.get(konto);
  }

  /** Ist an Soll angleichen. Erst zuweisen, dann entziehen (kein Moment ohne Zugriff). */
  async function anwenden(ctx, listItemId, soll) {
    const { rechte, listeId, stufen, verwaltet } = ctx;
    const r = { dazu: 0, weg: 0, unbekannt: [], vererbung: null };
    const eigen = await rechte.hatEigeneRechte(listeId, listItemId);
    r.eigen = eigen;
    if (soll.modus === 'erben') {
      if (eigen && listItemId) {
        await rechte.vererbungWiederherstellen(listeId, listItemId);
        r.vererbung = 'wiederhergestellt';
        r.eigen = false;
      }
      return r;
    }
    if (soll.modus === 'mitlaufen' && !eigen) return r;
    if (!eigen) {
      await rechte.vererbungUnterbrechen(listeId, listItemId);
      r.vererbung = 'unterbrochen';
      r.eigen = true;
    }

    const ist = new Map();
    for (const z of await rechte.zuweisungen(listeId, listItemId)) {
      if (z.typ === PRINCIPAL_BENUTZER && z.konto) ist.set(z.konto, z);
    }
    for (const [konto, stufe] of Object.entries(soll.rechte)) {
      const rolle = stufen[stufe];
      const z = ist.get(konto);
      const principalId = z?.principalId ?? await principal(rechte, konto);
      if (principalId == null) {
        r.unbekannt.push(konto);
        continue;
      }
      if (!(z?.rollen || []).some((x) => x.id === rolle)) {
        await rechte.zuweisen(listeId, listItemId, principalId, rolle);
        r.dazu++;
      }
      for (const x of z?.rollen || []) {
        if (x.id === rolle || !verwaltet.has(x.id)) continue;
        await rechte.entziehen(listeId, listItemId, principalId, x.id);
        r.weg++;
      }
    }
    for (const [konto, z] of ist) {
      if (soll.rechte[konto]) continue;
      for (const x of z.rollen) {
        if (!verwaltet.has(x.id)) continue;
        await rechte.entziehen(listeId, listItemId, z.principalId, x.id);
        r.weg++;
      }
    }
    return r;
  }

  function faellig(o, soll) {
    const gueltig = o.rechte_hash === soll.hash ? PRUEFEN_MS : o.rechte_hash === `${soll.hash}?` ? OFFEN_MS : 0;
    return !gueltig || !o.rechte_geprueft_at || jetzt() - Date.parse(o.rechte_geprueft_at) >= gueltig;
  }

  async function scopeAbgleichen(ctx, { ordner: o, soll }) {
    const listItemId = o.list_item_id || Number(await sp.listItemId(o.item_id)) || null;
    if (!listItemId) throw new Error('List-Item fehlt');
    const r = await anwenden(ctx, listItemId, soll);
    const { error } = await supabase.from('ablage_ordner').update({
      list_item_id: listItemId,
      rechte_eigen: r.eigen,
      rechte_hash: r.unbekannt.length ? `${soll.hash}?` : soll.hash,
      rechte_geprueft_at: iso(),
    }).eq('id', o.id);
    if (error) throw error;
    return r;
  }

  async function linksPruefen(testUnternehmen) {
    const links = await alle(() => supabase.from('ablage_freigabelink')
      .select('id, drive_id, item_id, permission_id, kooperation_id, erstellt_von')
      .is('widerrufen_at', null).gt('laeuft_ab_at', iso()).order('id'));
    if (!links.length) return 0;
    const benutzer = await inStuecken(links.map((l) => l.erstellt_von), (teil) => supabase.from('benutzer')
      .select('id, rolle, freigeschaltet').in('id', teil));
    const koops = await inStuecken(links.map((l) => l.kooperation_id), (teil) => supabase.from('kooperationen')
      .select('id, unternehmen_id').in('id', teil));
    const kunden = benutzer.filter((b) => b.rolle === 'kunde').map((b) => b.id);
    const ku = await inStuecken(kunden, (teil) => supabase.from('kunde_unternehmen')
      .select('kunde_id, unternehmen_id').in('kunde_id', teil));
    const ctx = {
      benutzer: new Map(benutzer.map((b) => [b.id, b])),
      koopUnternehmen: new Map(koops.map((k) => [k.id, k.unternehmen_id])),
      kundeUnternehmen: new Set(ku.map((z) => `${z.kunde_id}|${z.unternehmen_id}`)),
      testUnternehmen,
    };
    const weg = links.filter((l) => linkEntzogen(l, ctx));
    return weg.length ? linksWiderrufen({ supabase, sp, jetzt }, weg, 'zugriff_entzogen') : 0;
  }

  async function standSetzen(patch) {
    const { error } = await supabase.from('ablage_stand').update({ ...patch, updated_at: iso() }).eq('drive_id', driveId);
    if (error) throw error;
  }

  async function lauf({ budgetMs = BUDGET_MS } = {}) {
    const bis = jetzt() + budgetMs;
    await ablage.ordner.wurzel();
    const { data: lease, error: lErr } = await supabase.rpc('ablage_rechte_lease_holen', { p_drive_id: driveId, p_sekunden: LEASE_SEK });
    if (lErr) throw new Error(`ablage_rechte_lease_holen: ${lErr.message}`);
    if (!lease) return { lease: false };
    principals.clear();

    const r = { lease: true, scopes: 0, faellig: 0, geaendert: 0, unbekannt: [], fehler: [], links: 0 };
    const ende = { rechte_lease_bis: null };
    try {
      const daten = await laden();
      const { bibliothek, scopes, ohneKonto } = rechteSoll(daten);
      r.scopes = scopes.length;
      r.ohne_konto = ohneKonto.length;
      // Ohne Admin-Konto wuerde die Bibliothek fuer alle gesperrt
      if (!Object.keys(bibliothek.rechte).length) throw new Error('Kein Admin mit Microsoft-Konto, Rechte bleiben unveraendert');

      const rechte = ablage.rechte;
      const stufen = await rechte.stufen();
      const ctx = {
        rechte,
        stufen,
        listeId: await sp.listeId(),
        verwaltet: new Set([stufen.lesen, stufen.ohne_loeschen, stufen.bearbeiten]),
      };
      const unbekannt = new Set();
      const notiere = (x) => {
        if (x.vererbung || x.dazu || x.weg) r.geaendert++;
        for (const k of x.unbekannt) unbekannt.add(k);
      };

      notiere(await anwenden(ctx, null, bibliothek));

      // geaenderte Solls vor der taeglichen Pruefung
      const offen = scopes.filter((s) => faellig(s.ordner, s.soll))
        .sort((a, b) => Number(a.ordner.rechte_hash === a.soll.hash) - Number(b.ordner.rechte_hash === b.soll.hash));
      r.faellig = offen.length;
      for (const s of offen) {
        if (jetzt() >= bis) {
          r.mehr = true;
          break;
        }
        try {
          notiere(await scopeAbgleichen(ctx, s));
        } catch (err) {
          r.fehler.push(`${s.ordner.art} ${s.ordner.item_id}: ${String(err?.message || err).slice(0, 200)}`);
        }
      }
      r.unbekannt = [...unbekannt];
      r.links = await linksPruefen(daten.testUnternehmen);
      ende.rechte_fehler = r.fehler.length ? `${r.fehler.length} Ordner: ${r.fehler[0]}`.slice(0, 500) : null;
      // Rest im naechsten Lauf; der Zeitplan stoesst ihn sofort an
      if (r.mehr) ende.rechte_faellig = true;
    } catch (err) {
      r.abbruch = String(err?.message || err).slice(0, 500);
      ende.rechte_fehler = r.abbruch;
    } finally {
      ende.rechte_lauf = iso();
      await standSetzen(ende).catch((e) => console.error('[ablage-rechte] Stand:', e.message));
    }
    return r;
  }

  return { lauf, laden, anwenden, linksPruefen };
}

module.exports = {
  createRechteAbgleich,
  rechteSoll,
  linkEntzogen,
  stufeVon,
  kontoVon,
  LEASE_SEK,
};
