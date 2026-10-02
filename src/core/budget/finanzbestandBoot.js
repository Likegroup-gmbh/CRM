// finanzbestandBoot.js
// Entscheidung, ob der Boot den Finanzbestand schon vor der Auth-Kette
// anfragt. Der Prefetch ist rein spekulativ (siehe finanzbestand.js): ein
// falscher Tipp kostet einen abgelehnten Request, nie falsche Zahlen.

import { prefetchFinanzbestand } from './finanzbestand.js';
import { prefetchDashboard } from '../../modules/stakeholder/daten/dashboardLoad.js';

export const INVESTOR_HINT_KEY = 'crm:investor-hint';

// Routen, deren Page Finanzzahlen laedt (Dashboard und Datenqualitaet).
const BESTAND_ROUTEN = /^\/(admin(\/(dashboard|stakeholder|datenqualitaet)?)?|stakeholder)\/?$/;
// Die Datenqualitaet braucht die Rohzeilen; das Dashboard nur das gerechnete
// Ergebnis (Netlify-Function). Beides startet seinen eigenen Vorlauf.
const DATENQUALITAET_ROUTE = /^\/admin\/datenqualitaet\/?$/;
// Einstiege, auf denen Investoren beim Boot aufs Dashboard geleitet werden.
const ROOT_ROUTEN = new Set(['', '/', '/dashboard', '/index.html']);

function starteVorlauf(supabase, pathname) {
  if (DATENQUALITAET_ROUTE.test(String(pathname || ''))) prefetchFinanzbestand(supabase);
  else prefetchDashboard(supabase);
}

export function wantsFinanzbestandPrefetch(pathname, investorHint) {
  const path = String(pathname || '');
  if (BESTAND_ROUTEN.test(path)) return true;
  return ROOT_ROUTEN.has(path) && investorHint === '1';
}

// Menue-Hover/-pointerdown: der Klick folgt meist 100 bis 300 ms spaeter. Gleicher
// Vertrag wie der Boot-Prefetch (einmal uebernommen, binnen 15 s, nie gecacht).
// Query/Hash zaehlen nicht zur Route; ohne Accounting-Zugang kein Request.
export function startHoverPrefetch(supabase, route, darfAccounting) {
  if (!darfAccounting) return false;
  const path = String(route || '').split(/[?#]/)[0];
  if (!BESTAND_ROUTEN.test(path)) return false;
  starteVorlauf(supabase, path);
  return true;
}

export function startFinanzbestandPrefetch(supabase, pathname, storage = globalThis.localStorage) {
  let hint = null;
  try { hint = storage?.getItem(INVESTOR_HINT_KEY) ?? null; } catch { /* gesperrt */ }
  if (!wantsFinanzbestandPrefetch(pathname, hint)) return false;
  starteVorlauf(supabase, pathname);
  return true;
}
