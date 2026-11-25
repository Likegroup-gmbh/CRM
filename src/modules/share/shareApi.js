// Einziger Client für die Edge Function 'share-list' (Drawer, Admin-Seite, Gastseite).
// supabase-js liefert bei Status ≠ 2xx data: null, der Body steckt dann in error.context.
// Er wird trotzdem gelesen: eine 502 nach dem Anlegen trägt shareId, link und code.

const FUNCTION_NAME = 'share-list';
const LEERER_PLAN = Object.freeze({ listLink: [], guest: [], blocked: [] });

async function fehlerBody(error) {
  try {
    if (typeof error?.context?.json === 'function') return await error.context.json();
  } catch { /* kein JSON-Body */ }
  return null;
}

/**
 * Ruft eine Action auf. Ergebnis: Antwort-Body plus
 * `ok` (2xx ohne error), `fehler` (Text vom Server oder null) und `status` (0 = kein HTTP-Status).
 */
export async function call(action, body = {}) {
  const { data, error } = await window.supabase.functions.invoke(FUNCTION_NAME, {
    body: { action, ...body },
  });
  const res = data ?? (error ? await fehlerBody(error) : null) ?? {};
  const fehler = res.error || null;
  return {
    ...res,
    ok: !error && !fehler,
    fehler,
    status: error ? (error.context?.status ?? 0) : 200,
  };
}

export const shareApi = {
  call,

  create: ({ entityType, entityId, label, rechte, emails = [], endsWithKampagne = true, ...rest }) =>
    call('create', { entityType, entityId, label, rechte, emails, endsWithKampagne, ...rest }),

  update: (shareId, patch) => call('update', { shareId, ...patch }),

  rotateCode: (shareId) => call('rotate_code', { shareId }),

  resend: (shareId, { emails, code, ...rest }) => call('resend', { shareId, emails, code, ...rest }),

  revoke: (shareId) => call('revoke', { shareId }),

  sendAccountLinks: ({ entityType, entityId, emails }) => (
    emails?.length
      ? call('send_account_links', { entityType, entityId, emails })
      : Promise.resolve({ ok: true, fehler: null, mailed: 0 })
  ),

  /** Empfänger-Aufteilung vom Server. Leere Liste ohne Request, null bei Fehler. */
  async plan({ emails, entityType, entityId }) {
    if (!emails?.length) return { listLink: [], guest: [], blocked: [] };
    try {
      const res = await call('plan', { emails, entityType, entityId });
      if (!res.ok || !res.plan) return null;
      return { ...LEERER_PLAN, ...res.plan };
    } catch (err) {
      console.error('Empfänger-Aufteilung fehlgeschlagen:', err);
      return null;
    }
  },

  preview: (token) => call('preview', { token }),

  participants: (shareId) => call('participants', { shareId }),

  resolve: (token) => call('resolve', { token }),

  verify: ({ token, code, name }) => call('verify', { token, code, name }),
};
