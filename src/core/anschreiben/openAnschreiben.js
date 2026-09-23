// Ein Einstieg fuer alle Dokumenttypen. Seiten rufen nur openAnschreiben().
// Typ-Logik (PDF, Prefill, Platzhalter) sitzt im Client-Adapter.

import { AnschreibenDrawer } from './AnschreibenDrawer.js';
import { getClientAdapter } from './typen/index.js';

/**
 * @param {Object} opts
 * @param {string} opts.dokumentTyp
 * @param {string} opts.dokumentId
 * @param {Object} [opts.db]
 * @param {boolean} [opts.empfaengerFest] - Call-Site sticht Adapter
 * @param {Array} [opts.prefill] - Call-Site sticht Adapter
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
    createPdf: (hint) => adapter.createPdf(prepared, opts.db, hint),
    platzhalter: adapter.platzhalter,
    prefill: opts.prefill ?? prepared.prefill ?? [],
    empfaengerFest: opts.empfaengerFest ?? prepared.empfaengerFest ?? false,
    extraTabs: prepared.extraTabs || [],
    loadEmpfaengerScope: prepared.loadEmpfaengerScope || null,
    buildAnhaenge: adapter.buildAnhaenge
      ? (empfaenger) => adapter.buildAnhaenge(prepared, opts.db, empfaenger)
      : null,
    mountExtras: prepared.mountExtras || null,
    rewriteMail: prepared.rewriteMail || null,
  });
  await drawer.open();
  return drawer;
}
