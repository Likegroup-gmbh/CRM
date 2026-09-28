// Verfügbarkeit eines Aktionsmenü-Punkts.
// Mehrere Bedingungen werden zu einem Status: klickbar, sichtbar aber grau,
// oder später ganz weg. Der Titel koppelt alle fehlenden Gründe.

const REASON_SEPARATOR = ' · ';

/**
 * @param {Array<{ ok?: boolean, reason?: string }>} checks
 * @param {{ onFail?: 'disabled' | 'hidden' }} [options]
 * @returns {{ mode: 'enabled' | 'disabled' | 'hidden', title: string }}
 */
export function actionState(checks, options = {}) {
  const failed = (checks || []).filter(check => !check?.ok);
  if (failed.length === 0) return { mode: 'enabled', title: '' };

  if (options.onFail === 'hidden') return { mode: 'hidden', title: '' };

  const title = failed
    .map(check => check.reason)
    .filter(Boolean)
    .join(REASON_SEPARATOR);

  return { mode: 'disabled', title };
}
