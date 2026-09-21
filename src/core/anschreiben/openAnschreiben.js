// Ein Einstieg fuer alle Dokumenttypen. Seiten rufen nur openAnschreiben().
// Typ-Logik (PDF, Prefill, Platzhalter) sitzt im Client-Adapter.

import { AnschreibenDrawer } from './AnschreibenDrawer.js';
import { getClientAdapter } from './typen/index.js';

/**
 * @param {Object} opts
 * @param {string} opts.dokumentTyp
 * @param {string} opts.dokumentId
 * @param {Object} [opts.db]
 * @returns {Promise<AnschreibenDrawer|null>}
 */
export async function openAnschreiben(opts) {
  const adapter = getClientAdapter(opts.dokumentTyp);
  const prepared = await adapter.prepare(opts);
  if (!prepared) return null;

  const drawer = new AnschreibenDrawer({
    dokumentTyp: opts.dokumentTyp,
    dokumentId: opts.dokumentId,
    dokumentName: prepared.dokumentName,
    unternehmenId: prepared.unternehmenId,
    markeId: prepared.markeId || null,
    db: opts.db,
    createPdf: () => adapter.createPdf(prepared),
    platzhalter: adapter.platzhalter,
    prefill: prepared.prefill || [],
  });
  await drawer.open();
  return drawer;
}
