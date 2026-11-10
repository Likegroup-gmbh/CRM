// Rückweg aus der Gast-Ansicht ins Kundenkonto.
// Die Gast-Sitzung bleibt, bis das Login klappt.

import { clearAllGuestSessions } from './guestSession.js';

const RETURN_KEY = 'cj24.accountReturn';
const NOTICE_KEY = 'cj24.accountNotice';

export const PACKAGE_NOTICE = 'Diese Auswahl gibt es nur als Gast-Zugang. Im Konto liegen die Skripte unter Skripte, sofern die Kampagne zugeordnet ist.';
export const SCOPE_NOTICE = 'Diese Liste ist dem Konto nicht zugeordnet.';

const RESERVED_SKRIPT = new Set(['dna', 'master', 'new', 'neu']);
const LIST_TABLES = {
  kampagne: 'kampagne',
  castings: 'creator_auswahl',
  konzepte: 'strategie',
  skripte: 'skripte',
};

export function isConcreteListPath(path) {
  const clean = String(path || '').split(/[?#]/)[0];
  const match = clean.match(/^\/(kampagne|castings|konzepte|skripte)\/([^/]+)$/);
  if (!match) return false;
  if (match[1] === 'skripte' && RESERVED_SKRIPT.has(match[2])) return false;
  return true;
}

export function beginAccountLogin({ back, after }) {
  sessionStorage.setItem(RETURN_KEY, JSON.stringify({ back, after }));
}

export function readAccountReturn() {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function clearAccountReturn() {
  sessionStorage.removeItem(RETURN_KEY);
}

export function rememberAccountNotice(text) {
  if (text) sessionStorage.setItem(NOTICE_KEY, text);
}

export function takeAccountNotice() {
  const text = sessionStorage.getItem(NOTICE_KEY);
  sessionStorage.removeItem(NOTICE_KEY);
  return text || '';
}

export function finishSuccessfulLogin(pathname) {
  const pending = readAccountReturn();
  clearAccountReturn();
  clearAllGuestSessions();
  if (isConcreteListPath(pathname)) {
    return { reload: pathname };
  }
  if (pending?.after === 'package') {
    return { notice: PACKAGE_NOTICE };
  }
  return {};
}

export function accountLoginBackUrl(pending) {
  if (!pending?.back || pending.back === 'lock') return '/';
  return pending.back;
}

export async function customerCanOpenList(supabase, path) {
  const clean = String(path || '').split(/[?#]/)[0];
  const match = clean.match(/^\/(kampagne|castings|konzepte|skripte)\/([^/]+)$/);
  if (!match || !isConcreteListPath(clean)) return true;
  const { data, error } = await supabase.from(LIST_TABLES[match[1]]).select('id').eq('id', match[2]).maybeSingle();
  if (error) return true;
  return Boolean(data);
}
