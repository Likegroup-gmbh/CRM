// dashboardLoad.js
// Laedt das gerechnete Dashboard-Ergebnis fuer das Investor-Dashboard.
//
// Normalweg: die Netlify-Function stakeholder-dashboard rechnet und liefert
// je Auftrag eine Zeile plus die Monatsauswertung (statt 2 MB Rohzeilen).
// Fallback: ist die Function nicht erreichbar (lokal ohne Netlify, Deploy-
// Versatz), laedt der Browser den Finanzbestand und rechnet mit demselben
// Modul selbst — kein zweiter Rechenweg, nur ein anderer Ort.
//
// Frische-Vertrag wie beim Finanzbestand (core/budget/vorlauf.js): nichts
// wird gecacht, nur In-Flight und der Boot-Prefetch ueberlappen Wartezeit.

import { getAccessToken, SessionExpiredError } from '../../../core/auth/getAccessToken.js';
import { navMark } from '../../../core/dev/navTrace.js';
import {
  PREFETCH_MAX_ALTER_MS,
  invalidateFinanzbestand,
  loadFinanzbestand,
} from '../../../core/budget/finanzbestand.js';
import { createVorlauf } from '../../../core/budget/vorlauf.js';
import { DASHBOARD_VERSION, berechneDashboard } from './stakeholderDashboard.js';

export const DASHBOARD_ENDPOINT = '/.netlify/functions/stakeholder-dashboard';

// Hier gibt es keine Function oder sie ist gerade nicht da: Browser rechnet.
// 501 = RPC-Migration fehlt; der Tabellen-Scan im Finanzbestand deckt das ab.
const FALLBACK_STATUS = new Set([404, 501, 502, 503, 504]);

// Antwortet die Function mit 404 (z. B. `vite dev` ohne Netlify), fragen wir
// in dieser Sitzung nicht erneut: sonst steht bei jedem Laden ein roter
// 404 in der Konsole. Logout/Invalidate setzt das zurueck.
let functionFehlt = false;

function istGueltig(body) {
  return !!body
    && typeof body === 'object'
    && body.version === DASHBOARD_VERSION
    && Array.isArray(body.zeilen);
}

// null = Function nicht nutzbar, Caller faellt auf den Browser zurueck.
// Echte Fehler (kein Zugriff, Sitzung, Rechenfehler) werfen.
async function ladeViaFunction() {
  if (functionFehlt) return null;

  let token;
  try {
    // Kein Auto-Logout: der Prefetch laeuft vor der Auth-Kette, ein fehlender
    // Token ist dort kein Grund, jemanden abzumelden.
    token = await getAccessToken({ autoLogout: false });
  } catch {
    return null;
  }

  let response;
  try {
    response = await fetch(DASHBOARD_ENDPOINT, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    return null;
  }

  if (response.status === 404) functionFehlt = true;
  if (FALLBACK_STATUS.has(response.status)) return null;

  const body = await response.json().catch(() => null);

  if (response.status === 401) {
    throw new SessionExpiredError(body?.error || undefined);
  }
  if (!response.ok) {
    const fehler = new Error(body?.error || `Dashboard-Function antwortete mit ${response.status}`);
    fehler.code = body?.code;
    throw fehler;
  }
  // Kein JSON (z. B. SPA-Fallback im Dev-Server) oder anderes Schema.
  return istGueltig(body) ? body : null;
}

async function ladeImBrowser(supabase) {
  const bestand = await loadFinanzbestand(supabase);
  return berechneDashboard(bestand);
}

async function lade(supabase) {
  navMark('dashboard:start');
  const ergebnis = (await ladeViaFunction()) || (await ladeImBrowser(supabase));
  navMark('dashboard:ende');
  return ergebnis;
}

const vorlauf = createVorlauf(lade, { maxAlterMs: PREFETCH_MAX_ALTER_MS });

export function prefetchDashboard(supabase) {
  if (!supabase) return;
  vorlauf.prefetch(supabase);
}

export function loadDashboard(supabase) {
  if (!supabase) return Promise.reject(new Error('Supabase nicht verfügbar'));
  return vorlauf.load(supabase);
}

// Logout: weder Dashboard-Ergebnis noch Finanzbestand ueberleben die Sitzung.
export function invalidateDashboard() {
  functionFehlt = false;
  vorlauf.invalidate();
  invalidateFinanzbestand();
}
