// Eingang über ein bestehendes Login auf diesem Gerät: Weiterleitung ins Konto oder
// Mitarbeiter-Vorschau. Hier wird kein Zugriff vergeben. Die Weiterleitung prüft die RLS
// mit dem eigenen Login, die Vorschau stellt der Server nur für Mitarbeiter aus (1 h, nur lesen).

import { listVisible } from './accountReturn.js';
import { shareApi } from './shareApi.js';
import { accountListPath } from './shareRecipientPlan.js';

// getSession liest nur den lokalen Speicher (bzw. refresht eine ablaufende Session).
export async function detectAccountSession() {
  try {
    const result = await window.supabase?.auth?.getSession?.();
    return Boolean(result?.data?.session);
  } catch {
    return false;
  }
}

/** Pfad im Konto, wenn das eigene Login die Liste sehen darf. Fehler zählen als "kein Zugriff". */
export async function accountRouteFor(share) {
  const path = accountListPath(share?.entityType, share?.entityId);
  if (!path) return null;
  return (await listVisible(window.supabase, path)) === true ? path : null;
}

/** Vorschau-JWT für Mitarbeiter; null, wenn der Server ablehnt (kein Mitarbeiter, Link gesperrt). */
export async function staffPreview(token) {
  try {
    const res = await shareApi.preview(token);
    return res.ok && res.jwt ? res : null;
  } catch {
    return null;
  }
}

/**
 * Ohne Login: null (weiter mit Gast-Sitzung oder Code).
 * Mit Login: { route } bei sichtbarer Liste, sonst { vorschau } für Mitarbeiter, sonst null.
 */
export async function accountEntry(token, share) {
  if (!(await detectAccountSession())) return null;
  const route = await accountRouteFor(share);
  if (route) return { route };
  const vorschau = await staffPreview(token);
  return vorschau ? { vorschau } : null;
}
