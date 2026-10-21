// Routen prüfen, umschreiben und freigeben, bevor ein Modul gewechselt wird.

import { invalidateFinanzbestand } from '../budget/finanzbestand.js';

export async function prepareRoute(registry, route, skipPushState = false) {
  // Gast-Modus (Share-Link): strikt nur die geteilte Entität, keine anderen Routen
  if (window.guestShare) {
    const normalizedRoute = String(route || '').split(/[?#]/)[0];
    const allowed = window.guestShare.allowedRoute;
    if (normalizedRoute !== allowed && !normalizedRoute.startsWith(`${allowed}/`)) {
      console.log('🚫 Navigation blockiert: Gast-Zugang ist auf die geteilte Liste beschränkt');
      window.toastSystem?.show('Ihr Zugang ist auf die geteilte Liste beschränkt.', 'warning');
      return { proceed: false };
    }
    // URL bleibt beim Share-Link (Reload-fähig)
    skipPushState = true;
  }

  if (window.currentUser?.isBlocked === true) {
    const allowedRoutes = ['/', '/dashboard', ''];
    const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
    if (!allowedRoutes.includes(normalizedRoute)) {
      console.log('🚫 Navigation blockiert: Benutzer nicht freigeschaltet');
      window.toastSystem?.show('Ihr Account wartet auf Freischaltung', 'warning');
      return { proceed: false };
    }
  }

  // Alias: /kampagnen(/...) → /kampagne(/...) (Safety-Net für alte Links/Tippfehler)
  // Alias: /strategie → /konzepte, /sourcing → /castings (Umbenennung, Alt-Links bleiben gültig)
  route = String(route || '')
    .replace(/^(\/?)kampagnen(?=[/?#]|$)/, '$1kampagne')
    .replace(/^(\/?)strategie(?=[/?#]|$)/, '$1konzepte')
    .replace(/^(\/?)sourcing(?=[/?#]|$)/, '$1castings');

  if (!skipPushState) {
    try {
      if (window.history && window.history.pushState) {
        const url = route.startsWith('/') ? route : `/${route}`;
        window.history.pushState({ route: url }, '', url);
      }
    } catch (err) {
      console.warn('⚠️ History pushState fehlgeschlagen:', err?.message);
    }
  }

  // Pfad vor den Alias-Rewrites merken: die Navigations-Bereichswahl
  // (Haupt- vs. Accounting-Bereich) haengt am sichtbaren Pfad, nicht am
  // internen Modul-Namen (z. B. /admin/auftrag -> /auftrag).
  const navPath = String(route || '').split(/[?#]/)[0];

  // Accounting-Bereich nur Admins und Investoren — nicht Mitarbeiter/Lead
  // per Direkt-URL in die /admin-Huelle.
  const canAccounting = (typeof window.canViewAccounting === 'function' && window.canViewAccounting())
    || (typeof window.isAdmin === 'function' && window.isAdmin());
  if ((navPath === '/admin' || navPath.startsWith('/admin/')) && !canAccounting) {
    console.log('🚫 Navigation blockiert: kein Accounting-Zugang');
    return { proceed: false, value: registry._redirect('/dashboard') };
  }

  try {
    // Weggezogene Admin-Seiten: URL auf den Hauptpfad ziehen, sonst
    // bleibt die Sidebar im Accounting-Bereich.
    const ADMIN_MOVED = {
      kunden: '/kunden-admin',
      mitarbeiter: '/mitarbeiter',
      shares: '/shares',
      'ki-usage': '/ki-usage',
      unternehmen: '/unternehmen',
    };
    // Accounting-Nav-Punkte unter /admin/..., Module unter ihrem
    // bisherigen Pfad. /admin und /admin/datenqualitaet: Dashboard
    // wird unten auf Stakeholder umgeschrieben, Datenqualitaet bleibt
    // bei der Admin-Huelle. navPath bleibt der sichtbare /admin-Pfad.
    const ADMIN_ALIASES = {
      dashboard: '/stakeholder',
      stakeholder: '/stakeholder',
      'projekt-erstellen': '/projekt-erstellen',
      auftrag: '/auftrag',
      ausgangsrechnungen: '/ausgangsrechnungen',
      rechnung: '/rechnung',
    };
    const adminAlias = String(route || '').match(/^\/admin\/([^/?#]+)(.*)$/);
    if (adminAlias && ADMIN_MOVED[adminAlias[1]]) {
      const dest = ADMIN_MOVED[adminAlias[1]] + adminAlias[2];
      try {
        if (window.history?.replaceState) {
          window.history.replaceState({ route: dest }, '', dest);
        }
      } catch (err) {
        console.warn('⚠️ History replaceState fehlgeschlagen:', err?.message);
      }
      return { proceed: false, value: registry._doNavigate(dest, true) };
    }
    if (navPath === '/admin' || navPath === '/admin/') {
      route = '/stakeholder';
    } else if (adminAlias && ADMIN_ALIASES[adminAlias[1]]) {
      route = ADMIN_ALIASES[adminAlias[1]] + adminAlias[2];
    } else if (route === '/kunde' || route.startsWith('/kunde/')) {
      // Aktionsmenü baut /kunde/:id(/edit) — das Modul heißt kunden-admin / kunden-detail.
      route = `/kunden-admin${route.slice('/kunde'.length)}`;
    }
  } catch (err) {
    console.warn('⚠️ Route-Mapping fehlgeschlagen:', err?.message);
  }

  const pathOnly = String(route || '').split(/[?#]/)[0];
  const path = pathOnly.replace(/^\//, '');

  // Finanzbestand (Admin-Finanzseiten) halten, solange man im Adminbereich,
  // auf der Stakeholder-Uebersicht oder auf dem Dashboard bleibt. Sobald die
  // Route auf eine Detailseite zeigt (Video/Kampagne/Auftrag/Rechnung/…),
  // wird verworfen — die naechste Datenqualitaet liest frisch.
  const FINANZBESTAND_KEEP = /^\/?(admin|stakeholder|dashboard)(\/|$)/;
  if (!FINANZBESTAND_KEEP.test(pathOnly)) {
    invalidateFinanzbestand();
  }

  const pathParts = path.split('/');
  const [segment, idRaw, actionRaw] = pathParts;
  const idFromPath = idRaw ? idRaw.split('?')[0] : idRaw;
  // Alias fuer Alt-Links: /unternehmen/neu war der einzige Pfad mit deutschem
  // "neu", alle anderen Entitaeten nutzen "new". Normalisiert, damit die
  // ID-basierten Weichen unten nicht "neu" fuer eine Entity-ID halten.
  const id = idFromPath === 'neu' ? 'new' : idFromPath;
  const action = actionRaw ? actionRaw.split('?')[0] : actionRaw;

  // Route-Guard fuer Anlage- und Bearbeiten-Routen: kein Create/Edit-Recht,
  // keine Seite — sonst landet z.B. ein Investor per Direkt-URL auf einer
  // leeren Form, die die RLS dann erst beim Submit ablehnt. Segment → Entitaet.
  if (id === 'new' || action === 'edit') {
    const segmentEntity = {
      unternehmen: 'unternehmen', marke: 'marke', produkt: 'produkt',
      persona: 'persona', ansprechpartner: 'ansprechpartner', creator: 'creator',
      kampagne: 'kampagne', kooperation: 'kooperation', briefing: 'briefing',
      auftrag: 'auftrag', auftragsdetails: 'auftragsdetails', rechnung: 'rechnung',
      strategie: 'strategie', sourcing: 'sourcing', skripte: 'skripte',
      // Aliase nach dem Rewrite (/strategie → /konzepte, /sourcing → /castings)
      konzepte: 'strategie', castings: 'sourcing',
      vertraege: 'vertraege', management: 'management'
    }[segment];
    if (segmentEntity) {
      const verb = id === 'new' ? 'create' : 'edit';
      const allowed = id === 'new'
        ? window.canCreate?.(segmentEntity)
        : window.canEdit?.(segmentEntity);
      if (allowed === false) {
        console.log(`🚫 Navigation blockiert: kein ${verb}-Recht fuer ${segmentEntity}`);
        window.toastSystem?.show('Sie haben keine Berechtigung für diese Aktion.', 'warning');
        return { proceed: false };
      }
    }
  }

  if (segment === 'creator' && id && id !== 'new') {
    const canViewViaPage = window.canViewPage?.('creator');
    const canViewViaPerm = window.currentUser?.permissions?.creator?.can_view;
    const canViewCreator = canViewViaPage !== false && canViewViaPerm !== false;

    if (!canViewCreator) {
      console.log('🚫 Navigation blockiert: Keine Berechtigung für Creator-Profile');
      window.toastSystem?.show('Sie haben keine Berechtigung, Creator-Profile anzuzeigen.', 'warning');
      return { proceed: false };
    }
  }

  if (segment === 'marke' && id && id !== 'new') {
    const canViewViaPage = window.canViewPage?.('marke');
    const canViewViaPerm = window.currentUser?.permissions?.marke?.can_view;
    if (canViewViaPage === false || canViewViaPerm === false) {
      console.log('🚫 Navigation blockiert: Keine Berechtigung für Marken-Seiten');
      window.toastSystem?.show('Sie haben keine Berechtigung, Marken-Seiten anzuzeigen.', 'warning');
      return { proceed: false };
    }
  }

  if (segment === 'auftrag' && id && id !== 'new') {
    const isKunde = window.isKunde();
    if (isKunde) {
      console.log('🚫 Navigation blockiert: Kunden dürfen nicht auf Auftrags-Detailseite');
      window.toastSystem?.show('Sie können Aufträge nur in der Übersicht einsehen.', 'warning');
      return { proceed: false };
    }
  }

  if (segment === 'auftragsdetails' && id && id !== 'new') {
    const canViewViaPage = window.canViewPage?.('auftragsdetails');
    const canViewViaPerm = window.currentUser?.permissions?.auftragsdetails?.can_view;
    if (canViewViaPage === false || canViewViaPerm === false) {
      console.log('🚫 Navigation blockiert: Keine Berechtigung für Auftragsdetails');
      window.toastSystem?.show('Sie haben keine Berechtigung, Auftragsdetails anzuzeigen.', 'warning');
      return { proceed: false };
    }
  }

  if (import.meta.env.DEV) {
    console.log(`🧭 Navigation zu: ${segment}${id ? ` (ID: ${id})` : ''}${action ? ` (Action: ${action})` : ''}`);
    console.log(`🔍 Verfügbare Module:`, Array.from(registry.modules.keys()));
    console.log(`🎯 Gesuchtes Modul: ${segment}`);
  }
  return {
    proceed: true,
    navPath,
    segment,
    id,
    action,
  };
}
