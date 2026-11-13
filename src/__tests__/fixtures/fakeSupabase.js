// In-Memory-Supabase fuer Server-Tests (Medienablage): Filterketten, insert/update/delete/upsert,
// Unique-Constraints mit Postgres-Fehlercode 23505, rpc-Stubs. Joins im select werden nicht
// aufgeloest: verschachtelte Objekte legt der Test direkt in die Zeile.

import { randomUUID } from 'node:crypto';

export function createFakeSupabase({ tabellen = {}, unique = {}, rpc = {} } = {}) {
  const db = {};
  for (const [t, rows] of Object.entries(tabellen)) db[t] = rows.map((r) => ({ ...r }));
  const log = [];

  const tabelle = (t) => (db[t] ||= []);

  function verletzt(t, kandidat, ignoreId) {
    for (const c of unique[t] || []) {
      const key = c.key(kandidat);
      if (key == null) continue;
      const hit = tabelle(t).find((r) => r.id !== ignoreId && c.key(r) === key);
      if (hit) return { code: '23505', message: `duplicate key value violates unique constraint "${c.name}"`, details: '' };
    }
    return null;
  }

  function builder(t) {
    const filter = [];
    let op = 'select';
    let payload = null;
    let opts = {};
    let order = null;
    let limit = null;
    let single = null;
    let countMode = null;
    let wantReturn = false;

    const api = {
      select(_cols, o = {}) {
        if (op === 'select') countMode = o.count || null;
        if (o.head) opts.head = true;
        wantReturn = true;
        return api;
      },
      insert(rows) { op = 'insert'; payload = rows; return api; },
      update(patch) { op = 'update'; payload = patch; return api; },
      upsert(rows, o = {}) { op = 'upsert'; payload = rows; opts = { ...opts, ...o }; return api; },
      delete() { op = 'delete'; return api; },
      eq(k, v) { filter.push((r) => r[k] === v); return api; },
      neq(k, v) { filter.push((r) => r[k] !== v); return api; },
      is(k, v) { filter.push((r) => (v === null ? r[k] == null : r[k] === v)); return api; },
      not(k, o, v) { if (o === 'is' && v === null) filter.push((r) => r[k] != null); return api; },
      in(k, vs) { filter.push((r) => vs.includes(r[k])); return api; },
      gt(k, v) { filter.push((r) => r[k] > v); return api; },
      gte(k, v) { filter.push((r) => r[k] >= v); return api; },
      lt(k, v) { filter.push((r) => r[k] < v); return api; },
      lte(k, v) { filter.push((r) => r[k] <= v); return api; },
      like(k, p) { const re = new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`); filter.push((r) => re.test(String(r[k] ?? ''))); return api; },
      ilike(k, p) {
        const re = new RegExp(`^${p.replace(/\\([%_\\])/g, '$1').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        filter.push((r) => re.test(String(r[k] ?? '')));
        return api;
      },
      or() { return api; },
      order(k, o = {}) { order = { k, asc: o.ascending !== false }; return api; },
      limit(n) { limit = n; return api; },
      range(a, b) { limit = b - a + 1; return api; },
      maybeSingle() { single = 'maybe'; return api; },
      single() { single = 'one'; return api; },
      then(res, rej) { return Promise.resolve(ausfuehren()).then(res, rej); },
    };

    const passt = (r) => filter.every((f) => f(r));

    function ergebnis(rows) {
      if (opts.head) return { data: null, count: rows.length, error: null };
      if (single === 'one') {
        if (rows.length !== 1) return { data: null, error: { code: 'PGRST116', message: `${rows.length} Zeilen` } };
        return { data: rows[0], error: null, count: countMode ? 1 : null };
      }
      if (single === 'maybe') {
        if (rows.length > 1) return { data: null, error: { code: 'PGRST116', message: 'mehrere Zeilen' } };
        return { data: rows[0] || null, error: null };
      }
      return { data: rows, error: null, count: countMode ? rows.length : null };
    }

    function ausfuehren() {
      log.push({ t, op, payload });
      const rows = tabelle(t);
      if (op === 'select') {
        let out = rows.filter(passt);
        if (order) out = [...out].sort((a, b) => ((a[order.k] > b[order.k]) === order.asc ? 1 : -1));
        if (limit != null) out = out.slice(0, limit);
        return ergebnis(out.map((r) => ({ ...r })));
      }
      if (op === 'insert') {
        const list = Array.isArray(payload) ? payload : [payload];
        const neu = [];
        for (const p of list) {
          const row = { id: randomUUID(), created_at: new Date().toISOString(), ...p };
          const err = verletzt(t, row, null);
          if (err) return { data: null, error: err };
          rows.push(row);
          neu.push({ ...row });
        }
        return wantReturn ? ergebnis(neu) : { data: null, error: null };
      }
      if (op === 'update') {
        const ziele = rows.filter(passt);
        for (const r of ziele) {
          const err = verletzt(t, { ...r, ...payload }, r.id);
          if (err) return { data: null, error: err };
        }
        for (const r of ziele) Object.assign(r, payload);
        return wantReturn ? ergebnis(ziele.map((r) => ({ ...r }))) : { data: null, error: null };
      }
      if (op === 'upsert') {
        const list = Array.isArray(payload) ? payload : [payload];
        const keys = String(opts.onConflict || 'id').split(',').map((s) => s.trim());
        const out = [];
        for (const p of list) {
          const hit = rows.find((r) => keys.every((k) => r[k] === p[k]));
          if (hit) {
            if (!opts.ignoreDuplicates) Object.assign(hit, p);
            else continue;
            out.push({ ...hit });
          } else {
            const row = { id: randomUUID(), ...p };
            rows.push(row);
            out.push({ ...row });
          }
        }
        return wantReturn ? ergebnis(out) : { data: null, error: null };
      }
      if (op === 'delete') {
        const weg = rows.filter(passt);
        db[t] = rows.filter((r) => !passt(r));
        return wantReturn ? ergebnis(weg) : { data: null, error: null };
      }
      return { data: null, error: { message: `op ${op}` } };
    }

    return api;
  }

  return {
    db,
    log,
    from: (t) => builder(t),
    rpc: async (name, args) => {
      log.push({ rpc: name, args });
      const fn = rpc[name];
      if (!fn) return { data: null, error: { message: `rpc ${name} fehlt` } };
      try {
        return { data: await fn(args, db), error: null };
      } catch (err) {
        return { data: null, error: { message: err.message } };
      }
    },
  };
}

/** Unique-Constraints von ablage_ordner wie in 20261201. */
export const ORDNER_UNIQUE = [
  { name: 'ux_ablage_ordner_item', key: (r) => (r.item_id ? `${r.drive_id}|${r.item_id}` : null) },
  { name: 'ux_ablage_ordner_name', key: (r) => (!r.geloescht_at && r.art !== 'frei' ? `${r.drive_id}|${r.parent_item_id}|${String(r.name).toLowerCase()}` : null) },
  { name: 'ux_ablage_ordner_kooperation', key: (r) => (r.art === 'kooperation' && !r.geloescht_at ? `${r.drive_id}|${r.kooperation_id}` : null) },
  { name: 'ux_ablage_ordner_kampagne', key: (r) => (r.art === 'kampagne' && !r.geloescht_at ? `${r.drive_id}|${r.kampagne_id}` : null) },
  { name: 'ux_ablage_ordner_produktion', key: (r) => (r.art === 'produktion' && !r.geloescht_at && r.produktion_id ? `${r.drive_id}|${r.produktion_id}` : null) },
  { name: 'ux_ablage_ordner_unternehmen', key: (r) => (r.art === 'unternehmen' && !r.geloescht_at ? `${r.drive_id}|${r.unternehmen_id}` : null) },
  { name: 'ux_ablage_ordner_bereich', key: (r) => (r.art === 'bereich' && !r.geloescht_at ? `${r.drive_id}|${r.unternehmen_id}|${r.bereich}` : null) },
  { name: 'ux_ablage_ordner_typ', key: (r) => (r.art === 'typ' && !r.geloescht_at ? `${r.drive_id}|${r.kooperation_id}|${r.typ}` : null) },
  { name: 'ux_ablage_ordner_dokument', key: (r) => (r.art === 'dokument' && !r.geloescht_at ? `${r.drive_id}|${r.dok_schluessel}` : null) },
];

/** Dateispalten der Dokumente wie in 20261210: [Tabelle, Pfad, URL, Ablage, Drive]. */
const DOKUMENT_SPALTEN = [
  ['vertraege', 'datei_path', 'datei_url', 'datei_ablage', 'datei_drive_id'],
  ['vertraege', 'dropbox_file_path', 'dropbox_file_url', 'signiert_ablage', 'signiert_drive_id'],
  ['rechnung_pdfs', 'file_path', 'file_url', 'ablage', 'drive_id'],
  ['rechnung_belege', 'file_path', 'file_url', 'ablage', 'drive_id'],
  ['auftrag_dokumente', 'dropbox_file_path', 'dropbox_file_url', 'ablage', 'drive_id'],
];

const ASSET_TABELLEN = ['kooperation_video_asset', 'kooperation_story_asset', 'kooperation_bilder_asset', 'kooperation_rohmaterial_asset'];
const URL_SPALTEN = [
  ...ASSET_TABELLEN.map((t) => [t, 'file_url', true]),
  ['kooperation_rohmaterial_asset', 'folder_url'],
  ['kooperation_videos', 'folder_url'],
  ['kooperation_videos', 'story_folder_url'],
  ['kooperationen', 'bilder_folder_url'],
];

/** rpc ablage_pfad_umschreiben wie in 20261201: Nachfahren in Register, Eingang und Assets. */
export function pfadUmschreiben({ p_drive_id: driveId, p_alt: alt, p_neu: neu }, db) {
  if (!alt || !neu || alt === neu) return 0;
  let n = 0;
  const ziehen = (r, spalte) => {
    const v = r[spalte];
    if (r.drive_id !== driveId || typeof v !== 'string' || !v.startsWith(`${alt}/`)) return;
    r[spalte] = neu + v.slice(alt.length);
    n++;
  };
  for (const r of db.ablage_ordner || []) ziehen(r, 'pfad');
  for (const r of db.ablage_eingang || []) ziehen(r, 'pfad');
  for (const t of ASSET_TABELLEN) for (const r of db[t] || []) if (r.ablage === 'sharepoint') ziehen(r, 'file_path');
  for (const [t, pfad, , ablage, drive] of DOKUMENT_SPALTEN) {
    for (const r of db[t] || []) {
      if (r[ablage] !== 'sharepoint' || r[drive] !== driveId) continue;
      const v = r[pfad];
      if (typeof v === 'string' && v.startsWith(`${alt}/`)) {
        r[pfad] = neu + v.slice(alt.length);
        n++;
      }
    }
  }
  return n;
}

/** rpc ablage_url_umschreiben wie in 20261209: Präfix in file_url und den Ordner-Links ersetzen. */
export function urlUmschreiben({ p_drive_id: driveId, p_alt: alt, p_neu: neu }, db) {
  if (!alt || !neu || alt === neu) return 0;
  let n = 0;
  for (const [t, spalte, mitDrive] of URL_SPALTEN) {
    for (const r of db[t] || []) {
      if (mitDrive && (r.ablage !== 'sharepoint' || r.drive_id !== driveId)) continue;
      const v = r[spalte];
      if (typeof v !== 'string' || !(v === alt || v.startsWith(`${alt}/`))) continue;
      r[spalte] = neu + v.slice(alt.length);
      n++;
    }
  }
  for (const [t, , url, ablage, drive] of DOKUMENT_SPALTEN) {
    for (const r of db[t] || []) {
      if (r[ablage] !== 'sharepoint' || r[drive] !== driveId) continue;
      const v = r[url];
      if (typeof v === 'string' && (v === alt || v.startsWith(`${alt}/`))) {
        r[url] = neu + v.slice(alt.length);
        n++;
      }
    }
  }
  return n;
}

/** rpc ablage_struktur_offen wie in 20261211 (ohne Zufall): Kooperationen, dann Verträge. */
export function strukturOffen({ p_drive_id: driveId, p_unternehmen_id: unternehmenId = null, p_limit: limit = 5 }, db) {
  const ordner = (db.ablage_ordner || []).filter((o) => o.drive_id === driveId && !o.geloescht_at);
  const nachItem = (itemId) => ordner.find((o) => o.item_id === itemId) || null;
  const da = (pred) => ordner.some((x) => x.item_id && pred(x));
  const out = [];
  for (const o of ordner) {
    if (o.art !== 'kooperation' || !o.item_id || (unternehmenId && o.unternehmen_id !== unternehmenId)) continue;
    const ko = (db.kooperationen || []).find((k) => k.id === o.kooperation_id);
    const p = nachItem(o.parent_item_id);
    if (!ko || !p) continue;
    const pid = ko.produktion_id || null;
    const falsch = pid ? !(p.art === 'produktion' && p.produktion_id === pid) : p.art === 'produktion';
    if (!falsch) continue;
    out.push({ art: 'kooperation', id: ko.id, unternehmen_id: o.unternehmen_id, produktion_id: pid, ordner_da: !pid || da((x) => x.art === 'produktion' && x.produktion_id === pid) });
  }
  for (const v of db.vertraege || []) {
    const pr = (db.produktion || []).find((x) => x.id === v.produktion_id && x.kampagne_id === v.kampagne_id) || null;
    for (const [drive, item] of [[v.datei_drive_id, v.datei_item_id], [v.signiert_drive_id, v.signiert_item_id]]) {
      if (drive !== driveId || !item) continue;
      const e = (db.ablage_eingang || []).find((x) => x.drive_id === driveId && x.item_id === item && !x.geloescht);
      const p = e ? nachItem(e.parent_item_id) : null;
      if (!p || p.art !== 'dokument' || p.bereich !== 'vertraege' || !['kampagne', 'produktion'].includes(p.ebene)) continue;
      if (unternehmenId && p.unternehmen_id !== unternehmenId) continue;
      const falsch = pr ? !(p.ebene === 'produktion' && p.produktion_id === pr.id) : p.ebene === 'produktion';
      if (!falsch || out.some((x) => x.art === 'vertrag' && x.id === v.id)) continue;
      out.push({
        art: 'vertrag', id: v.id, unternehmen_id: p.unternehmen_id, produktion_id: pr?.id || null,
        ordner_da: !pr || da((x) => x.art === 'dokument' && x.ebene === 'produktion' && x.bereich === 'vertraege' && x.produktion_id === pr.id && x.unternehmen_id === p.unternehmen_id),
      });
    }
  }
  return out.slice(0, limit);
}

/** Fake-SharePoint fuer Ordner-Tests: Baum im Speicher, Namen ohne Gross/Klein eindeutig. */
export function createFakeSharePoint({ driveId = 'd1' } = {}) {
  const items = new Map([['root', { id: 'root', name: 'root', parent: null, folder: {} }]]);
  let n = 0;
  const kinder = (pid) => [...items.values()].filter((i) => i.parent === pid);
  const calls = [];
  const sessions = new Map();
  // webUrl pfadbasiert wie bei Graph: aendert sich mit jedem Verschieben/Umbenennen darueber
  const url = (itemId) => {
    const teile = [];
    for (let it = items.get(itemId); it && it.parent; it = items.get(it.parent)) teile.unshift(encodeURIComponent(it.name));
    return `https://sp.test/${teile.join('/')}`;
  };
  const fake = {
    driveId,
    siteId: 's1',
    items,
    calls,
    url,
    async wurzel() { return { id: 'root' }; },
    async ordnerAnlegen(parentId, name) {
      calls.push(['ordnerAnlegen', parentId, name]);
      const hit = kinder(parentId).find((i) => i.name.toLowerCase() === name.toLowerCase());
      if (hit) return { item: { ...hit }, konflikt: true };
      const item = { id: `i${++n}`, name, parent: parentId, folder: {} };
      items.set(item.id, item);
      return { item: { ...item }, konflikt: false };
    },
    async umbenennen(itemId, name) {
      calls.push(['umbenennen', itemId, name]);
      const it = items.get(itemId);
      if (kinder(it.parent).some((i) => i.id !== itemId && i.name.toLowerCase() === name.toLowerCase())) {
        const err = new Error('nameAlreadyExists'); err.status = 409; throw err;
      }
      it.name = name;
      return { ...it, webUrl: url(itemId) };
    },
    async verschieben(itemId, parentId) {
      calls.push(['verschieben', itemId, parentId]);
      const it = items.get(itemId);
      it.parent = parentId;
      return { ...it, webUrl: url(itemId) };
    },

    // ─── Dateien und Upload-Sessions ───
    sessions,
    async item(itemId) {
      const it = items.get(itemId);
      if (!it) return null;
      return {
        id: it.id, name: it.name, size: it.size ?? 0, eTag: `e-${it.id}-${it.v || 1}`, cTag: `c-${it.id}-${it.v || 1}`,
        webUrl: url(it.id), parentReference: { id: it.parent }, ...(it.folder ? { folder: {} } : { file: {} }),
        ...(it.breite ? { video: { width: it.breite, height: it.hoehe } } : {}),
        ...(it.erstellt ? { createdDateTime: it.erstellt } : {}),
      };
    },
    async kindNachName(parentId, name) {
      const hit = kinder(parentId).find((i) => i.name.toLowerCase() === name.toLowerCase());
      return hit ? this.item(hit.id) : null;
    },
    async uploadSession(parentId, name, { conflict = 'rename', deferCommit = false } = {}) {
      calls.push(['uploadSession', parentId, name, { conflict, deferCommit }]);
      const url = `https://upload.test/${++n}`;
      sessions.set(url, { parentId, name, conflict, deferCommit });
      return { uploadUrl: url };
    },
    async uploadSessionFuerItem(itemId) {
      calls.push(['uploadSessionFuerItem', itemId]);
      const url = `https://upload.test/${++n}`;
      sessions.set(url, { itemId });
      return { uploadUrl: url };
    },
    /** Was der Browser tut: alle Bytes in die Session. Ohne deferCommit entsteht das Item sofort. */
    hochladen(url, size) {
      const s = sessions.get(url);
      if (!s) throw new Error('Session unbekannt');
      s.size = size;
      s.fertig = true;
      if (s.deferCommit) return null;
      return { ...anlegen(url) };
    },
    async sessionStatus(url) {
      const s = sessions.get(url);
      return s ? { nextExpectedRanges: s.fertig ? [] : [`${s.empfangen || 0}-`] } : null;
    },
    /** Server-seitige Chunks (Umzug). Bytes muessen lueckenlos kommen wie bei Graph. */
    async chunkHochladen(url, buffer, start, gesamt) {
      calls.push(['chunk', url, start, start + buffer.length - 1, gesamt]);
      const s = sessions.get(url);
      if (!s) {
        const err = new Error('itemNotFound');
        err.status = 404;
        throw err;
      }
      if (start !== (s.empfangen || 0)) {
        const err = new Error('invalidRange');
        err.status = 416;
        throw err;
      }
      s.inhalt = Buffer.concat([s.inhalt || Buffer.alloc(0), buffer]);
      s.empfangen = start + buffer.length;
      s.size = gesamt;
      if (s.empfangen < gesamt) return { status: 202, fertig: false, body: { nextExpectedRanges: [`${s.empfangen}-`] } };
      s.fertig = true;
      if (s.deferCommit) return { status: 202, fertig: false, body: { nextExpectedRanges: [] } };
      return { status: 201, fertig: true, body: await fake.item(anlegen(url).id) };
    },
    async sessionAbschliessen(url) {
      calls.push(['sessionAbschliessen', url]);
      return fake.item(anlegen(url).id);
    },
    async sessionVerwerfen(url) {
      calls.push(['sessionVerwerfen', url]);
      sessions.delete(url);
      return true;
    },
    async loeschen(itemId) {
      calls.push(['loeschen', itemId]);
      return items.delete(itemId);
    },
    async endgueltigLoeschen(itemId) {
      calls.push(['endgueltigLoeschen', itemId]);
      for (const k of kinder(itemId)) await this.endgueltigLoeschen(k.id);
      return items.delete(itemId);
    },
    datei(parentId, name, size = 1) {
      const item = { id: `i${++n}`, name, parent: parentId, size };
      items.set(item.id, item);
      return item;
    },

    // ─── Lesen und Freigaben ───
    links: new Map(),
    async kinder(itemId) {
      return Promise.all(kinder(itemId).map((k) => fake.item(k.id).then((i) => ({ ...i, lastModifiedDateTime: '2026-11-01T00:00:00Z' }))));
    },
    async downloadUrl(itemId) {
      const it = items.get(itemId);
      return it ? { url: `https://dl.test/${itemId}`, name: it.name, groesse: it.size, etag: `e-${itemId}` } : null;
    },
    async downloadUrls(itemIds) {
      calls.push(['downloadUrls', itemIds]);
      return new Map(itemIds.map((id) => [id, items.has(id) ? `https://dl.test/${id}` : null]));
    },
    async thumbnailUrls(itemIds, groesse) {
      calls.push(['thumbnailUrls', itemIds, groesse]);
      return itemIds.map((id) => (items.has(id)
        ? { ok: true, url: `https://thumb.test/${id}` }
        : { ok: false, fehler: 'sharepoint:itemNotFound', permanent: true }));
    },
    async leselink(itemId, ablauf) {
      calls.push(['leselink', itemId]);
      const permissionId = `p${++n}`;
      fake.links.set(permissionId, itemId);
      return { permissionId, url: `https://share.test/${permissionId}`, ablauf: ablauf ? new Date(ablauf).toISOString() : null };
    },
    async freigabeEntfernen(itemId, permissionId) {
      calls.push(['freigabeEntfernen', itemId, permissionId]);
      return fake.links.delete(permissionId);
    },
  };

  function anlegen(url) {
    const s = sessions.get(url);
    sessions.delete(url);
    if (s.itemId) {
      const it = items.get(s.itemId);
      it.size = s.size;
      it.v = (it.v || 1) + 1;
      return it;
    }
    let name = s.name;
    const dot = name.lastIndexOf('.');
    for (let i = 1; kinder(s.parentId).some((x) => x.name.toLowerCase() === name.toLowerCase()); i++) {
      name = dot > 0 ? `${s.name.slice(0, dot)} ${i}${s.name.slice(dot)}` : `${s.name} ${i}`;
    }
    const item = { id: `i${++n}`, name, parent: s.parentId, size: s.size, ...(s.inhalt ? { inhalt: s.inhalt } : {}) };
    items.set(item.id, item);
    return item;
  }
  return fake;
}
