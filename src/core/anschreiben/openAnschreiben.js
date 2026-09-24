// Ein Einstieg fuer alle Dokumenttypen. Seiten rufen nur openAnschreiben().
// warmAnschreiben startet prepare und den Snapshot, sobald das Dokument offen ist.
// Der Klick wartet auf denselben Lauf und malt nur noch.

import { AnschreibenDrawer } from './AnschreibenDrawer.js';
import { loadAnschreibenSnapshot } from './snapshot.js';
import { getClientAdapter } from './typen/index.js';

const warm = new Map();
const opening = new Map();

function cacheKey(opts) {
  return `${opts.dokumentTyp}:${opts.dokumentId}`;
}

async function runWarm(opts) {
  const adapter = getClientAdapter(opts.dokumentTyp);
  const db = opts.db || window.supabase;
  const prepared = await adapter.prepare(opts);
  if (!prepared) return null;
  const snapshot = await loadAnschreibenSnapshot({
    db,
    dokumentTyp: opts.dokumentTyp,
    loadEmpfaengerScope: prepared.loadEmpfaengerScope || null,
    createPdf: (hint) => adapter.createPdf(prepared, db, hint),
  });
  return { adapter, prepared, snapshot, db };
}

export function warmAnschreiben(opts) {
  const key = cacheKey(opts);
  if (warm.has(key)) return warm.get(key);
  let promise;
  promise = runWarm(opts).then((result) => {
    if (warm.get(key) !== promise) return { stale: true };
    if (!result) warm.delete(key);
    return result;
  }).catch((err) => {
    if (warm.get(key) === promise) warm.delete(key);
    throw err;
  });
  warm.set(key, promise);
  return promise;
}

export function dropAnschreibenWarm(dokumentTyp, dokumentId) {
  warm.delete(`${dokumentTyp}:${dokumentId}`);
}

function drawerOptions(opts, run) {
  const { adapter, prepared, db } = run;
  const client = opts.db || db;
  return {
    dokumentTyp: opts.dokumentTyp,
    dokumentId: opts.dokumentId,
    dokumentName: prepared.dokumentName,
    unternehmenId: prepared.unternehmenId,
    markeId: prepared.markeId || null,
    db: client,
    createPdf: (hint) => adapter.createPdf(prepared, client, hint),
    platzhalter: adapter.platzhalter,
    prefill: opts.prefill ?? prepared.prefill ?? [],
    empfaengerFest: opts.empfaengerFest ?? prepared.empfaengerFest ?? false,
    extraTabs: prepared.extraTabs || [],
    loadEmpfaengerScope: prepared.loadEmpfaengerScope || null,
    buildAnhaenge: adapter.buildAnhaenge
      ? (empfaenger) => adapter.buildAnhaenge(prepared, client, empfaenger)
      : null,
    mountExtras: prepared.mountExtras || null,
    rewriteMail: prepared.rewriteMail || null,
  };
}

async function openFromWarm(opts) {
  const key = cacheKey(opts);
  const pending = warmAnschreiben(opts);
  const result = await pending;
  if (result?.stale) return openFromWarm(opts);
  if (!result) return null;
  if (warm.get(key) !== pending) return openFromWarm(opts);

  const drawer = new AnschreibenDrawer(drawerOptions(opts, result));
  await drawer.open(result.snapshot);
  return drawer;
}

/**
 * @param {Object} opts
 * @param {string} opts.dokumentTyp
 * @param {string} opts.dokumentId
 * @param {Object} [opts.db]
 * @param {boolean} [opts.empfaengerFest] - Call-Site sticht Adapter
 * @param {Array} [opts.prefill] - Call-Site sticht Adapter
 * @returns {Promise<AnschreibenDrawer|null>}
 */
export function openAnschreiben(opts) {
  const key = cacheKey(opts);
  if (opening.has(key)) return opening.get(key);
  const promise = openFromWarm(opts).finally(() => {
    if (opening.get(key) === promise) opening.delete(key);
  });
  opening.set(key, promise);
  return promise;
}
