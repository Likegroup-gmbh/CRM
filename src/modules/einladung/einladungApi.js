// einladungApi.js
// Schnittstelle der öffentlichen Einladungsformulare zur Edge Function `einladung`.
// Der Kunde hat kein Konto: Zugriff läuft über Token + Code und eine Sitzung (6 h),
// die an genau eine Einladung gebunden ist. Die Sitzung liegt nur im sessionStorage.

const BUCKET = 'einreichung';

function sitzungKey(token) {
  return `cj24.einladung.${token}`;
}

export function ladeSitzung(token) {
  try {
    const raw = sessionStorage.getItem(sitzungKey(token));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function speichereSitzung(token, sitzung) {
  try {
    sessionStorage.setItem(sitzungKey(token), JSON.stringify(sitzung));
  } catch { /* ohne Speicher muss der Code beim Neuladen erneut eingegeben werden */ }
}

export function loescheSitzung(token) {
  try {
    sessionStorage.removeItem(sitzungKey(token));
  } catch { /* ignore */ }
}

async function lesFehler(error) {
  try {
    if (error?.context && typeof error.context.json === 'function') {
      return await error.context.json();
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Ruft eine Aktion der Edge Function auf.
 * Rückgabe: { ok, data, fehler, sitzungAbgelaufen }
 */
export async function einladungAufruf(action, body = {}) {
  const { data, error } = await window.supabase.functions.invoke('einladung', {
    body: { action, ...body }
  });

  if (!error && data && !data.error) return { ok: true, data };

  const antwort = data?.error ? data : await lesFehler(error);
  return {
    ok: false,
    data: null,
    fehler: antwort?.error || 'Die Verbindung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
    sitzungAbgelaufen: antwort?.sitzungAbgelaufen === true
  };
}

export function einladungResolve(token) {
  return einladungAufruf('resolve', { token });
}

export function einladungVerify(token, code, name) {
  return einladungAufruf('verify', { token, code, name });
}

export function einladungSubmit(token, sitzung, formData) {
  return einladungAufruf('submit', { token, sitzung, formData });
}

/**
 * Lädt eine Datei über eine signierte Upload-URL in den Bucket `einreichung`.
 * Rückgabe: { ok, pfad, name } oder { ok: false, fehler, sitzungAbgelaufen }
 */
export async function ladeDateiHoch({ token, sitzung, datei, slot }) {
  const url = await einladungAufruf('upload_url', {
    token,
    sitzung,
    slot,
    name: datei.name,
    mime: datei.type,
    groesse: datei.size
  });
  if (!url.ok) return url;

  const { error } = await window.supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(url.data.pfad, url.data.token, datei, { contentType: datei.type });
  if (error) {
    return { ok: false, fehler: 'Der Upload ist fehlgeschlagen. Bitte versuchen Sie es erneut.' };
  }
  return { ok: true, pfad: url.data.pfad, name: datei.name };
}
