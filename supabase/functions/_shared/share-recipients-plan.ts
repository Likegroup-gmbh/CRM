// Empfänger eines Zugangs: Listen-Link (Konto), Gast-Mail oder keine Mail.
// Reine Logik ohne DB und ohne URL-Importe, damit vitest sie direkt testet.

export type RecipientPlan = {
  listLink: string[];
  guest: string[];
  blocked: { email: string; reason: 'paket' | 'scope' }[];
};

export type Scope = {
  unternehmenId: string | null;
  markeId: string | null;
  markeUnternehmenId: string | null;
  kampagneUnternehmenId: string | null;
  kampagneMarkeId: string | null;
  kampagneMarkeUnternehmenId: string | null;
};

const ACCOUNT_ROUTES: Record<string, (id: string) => string> = {
  kampagne: (id) => `/kampagne/${id}`,
  sourcing: (id) => `/castings/${id}`,
  strategie: (id) => `/konzepte/${id}`,
  skript: (id) => `/skripte/${id}`,
};

export function accountListPath(entityType: string, entityId: string): string | null {
  const build = ACCOUNT_ROUTES[entityType];
  if (!build || !entityId) return null;
  return build(entityId);
}

export function canSee(links: { unternehmenIds: string[]; markeIds: string[] }, scope: Scope | null): boolean {
  if (!scope) return false;
  const companies = new Set(links.unternehmenIds);
  const brands = new Set(links.markeIds);
  const hitCompany = (id: string | null) => Boolean(id) && companies.has(id as string);
  const hitBrand = (id: string | null) => Boolean(id) && brands.has(id as string);
  return hitCompany(scope.unternehmenId)
    || hitBrand(scope.markeId)
    || hitCompany(scope.markeUnternehmenId)
    || hitCompany(scope.kampagneUnternehmenId)
    || hitBrand(scope.kampagneMarkeId)
    || hitCompany(scope.kampagneMarkeUnternehmenId);
}

export type AccountInfo = { canSee: boolean; staff?: boolean };

/**
 * Ohne Konto: Gast. Kundenkonto: Listen-Link, außer bei Skript-Paketen oder ohne Zuordnung (dann keine Mail).
 * Mitarbeiterkonto: Listen-Link, wenn es die Liste im Konto sieht, sonst Gast wie ein Externer.
 */
export function planShareRecipients(
  emails: string[],
  accountsByEmail: Record<string, AccountInfo>,
  entityType: string,
): RecipientPlan {
  const listLink: string[] = [];
  const guest: string[] = [];
  const blocked: RecipientPlan['blocked'] = [];
  for (const raw of emails) {
    const email = String(raw || '').trim().toLowerCase();
    if (!email) continue;
    const account = accountsByEmail[email];
    if (!account) {
      guest.push(email);
      continue;
    }
    if (account.staff) {
      if (entityType !== 'skript_paket' && account.canSee) listLink.push(email);
      else guest.push(email);
      continue;
    }
    if (entityType === 'skript_paket') {
      blocked.push({ email, reason: 'paket' });
      continue;
    }
    if (!account.canSee) {
      blocked.push({ email, reason: 'scope' });
      continue;
    }
    listLink.push(email);
  }
  return { listLink, guest, blocked };
}
