// Empfänger eines Zugangs: Listen-Link (Kundenkonto), Gast-Mail oder keine Mail.
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

/** Ohne Kundenkonto: Gast. Mit Konto: Listen-Link, außer bei Skript-Paketen oder ohne Zuordnung. */
export function planShareRecipients(
  emails: string[],
  customersByEmail: Record<string, { canSee: boolean }>,
  entityType: string,
): RecipientPlan {
  const listLink: string[] = [];
  const guest: string[] = [];
  const blocked: RecipientPlan['blocked'] = [];
  for (const raw of emails) {
    const email = String(raw || '').trim().toLowerCase();
    if (!email) continue;
    const customer = customersByEmail[email];
    if (!customer) {
      guest.push(email);
      continue;
    }
    if (entityType === 'skript_paket') {
      blocked.push({ email, reason: 'paket' });
      continue;
    }
    if (!customer.canSee) {
      blocked.push({ email, reason: 'scope' });
      continue;
    }
    listLink.push(email);
  }
  return { listLink, guest, blocked };
}
