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
  { name: 'ux_ablage_ordner_unternehmen', key: (r) => (r.art === 'unternehmen' && !r.geloescht_at ? `${r.drive_id}|${r.unternehmen_id}` : null) },
  { name: 'ux_ablage_ordner_typ', key: (r) => (r.art === 'typ' && !r.geloescht_at ? `${r.drive_id}|${r.kooperation_id}|${r.typ}` : null) },
];

/** Fake-SharePoint fuer Ordner-Tests: Baum im Speicher, Namen ohne Gross/Klein eindeutig. */
export function createFakeSharePoint({ driveId = 'd1' } = {}) {
  const items = new Map([['root', { id: 'root', name: 'root', parent: null, folder: {} }]]);
  let n = 0;
  const kinder = (pid) => [...items.values()].filter((i) => i.parent === pid);
  const calls = [];
  const sessions = new Map();
  const fake = {
    driveId,
    siteId: 's1',
    items,
    calls,
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
      return { ...it };
    },
    async verschieben(itemId, parentId) {
      calls.push(['verschieben', itemId, parentId]);
      const it = items.get(itemId);
      it.parent = parentId;
      return { ...it };
    },

    // ─── Dateien und Upload-Sessions ───
    sessions,
    async item(itemId) {
      const it = items.get(itemId);
      if (!it) return null;
      return {
        id: it.id, name: it.name, size: it.size ?? 0, eTag: `e-${it.id}-${it.v || 1}`, cTag: `c-${it.id}-${it.v || 1}`,
        webUrl: `https://sp.test/${it.id}`, parentReference: { id: it.parent }, ...(it.folder ? { folder: {} } : { file: {} }),
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
      return { permissionId, url: `https://share.test/${permissionId}`, ablauf: new Date(ablauf).toISOString() };
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
