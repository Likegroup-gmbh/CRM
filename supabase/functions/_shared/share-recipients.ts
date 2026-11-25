// Empfänger eines Zugangs aus der DB bestimmen: Kunden- und Mitarbeiterkonten und deren Sicht.
// Die Entscheidung selbst liegt in share-recipients-plan.ts.

import type { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { canSee, planShareRecipients } from './share-recipients-plan.ts';
import type { AccountInfo, RecipientPlan, Scope } from './share-recipients-plan.ts';
import { staffVisibility } from './share-recipients-staff.ts';

export { accountListPath } from './share-recipients-plan.ts';
export type { RecipientPlan } from './share-recipients-plan.ts';

type Admin = ReturnType<typeof createClient>;
type UserRow = { id: string; email?: string | null; rolle: string; auth_user_id: string | null; freigeschaltet?: boolean | null };

const CUSTOMER_ROLES = ['kunde', 'kunde_editor'];
const STAFF_ROLES = ['admin', 'mitarbeiter'];

const emailOf = (row: { email?: string | null }) => String(row.email || '').trim().toLowerCase();

async function one(admin: Admin, table: string, id: string, columns: string) {
  const { data, error } = await admin.from(table).select(columns).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Record<string, string | null> | null;
}

async function companyOfMarke(admin: Admin, markeId: string | null): Promise<string | null> {
  if (!markeId) return null;
  const row = await one(admin, 'marke', markeId, 'unternehmen_id');
  return row?.unternehmen_id || null;
}

async function finishScope(admin: Admin, scope: Omit<Scope, 'markeUnternehmenId' | 'kampagneMarkeUnternehmenId'>): Promise<Scope> {
  const markeUnternehmenId = await companyOfMarke(admin, scope.markeId);
  const kampagneMarkeUnternehmenId = scope.kampagneMarkeId && scope.kampagneMarkeId !== scope.markeId
    ? await companyOfMarke(admin, scope.kampagneMarkeId)
    : markeUnternehmenId;
  return { ...scope, markeUnternehmenId, kampagneMarkeUnternehmenId };
}

async function loadScope(admin: Admin, entityType: string, entityId: string): Promise<Scope | null> {
  if (entityType === 'skript_paket' || !entityId) return null;
  if (entityType === 'kampagne') {
    const row = await one(admin, 'kampagne', entityId, 'unternehmen_id, marke_id');
    if (!row) return null;
    return finishScope(admin, {
      unternehmenId: row.unternehmen_id,
      markeId: row.marke_id,
      kampagneUnternehmenId: row.unternehmen_id,
      kampagneMarkeId: row.marke_id,
    });
  }
  if (entityType === 'skript') {
    const row = await one(admin, 'skripte', entityId, 'unternehmen_id, marke_id, kampagne_id');
    if (!row) return null;
    const kampagne = row.kampagne_id
      ? await one(admin, 'kampagne', row.kampagne_id, 'unternehmen_id, marke_id')
      : null;
    return finishScope(admin, {
      unternehmenId: row.unternehmen_id,
      markeId: row.marke_id,
      kampagneUnternehmenId: kampagne?.unternehmen_id || null,
      kampagneMarkeId: kampagne?.marke_id || null,
    });
  }
  const table = entityType === 'sourcing' ? 'creator_auswahl' : 'strategie';
  const columns = entityType === 'sourcing' ? 'kampagne_id' : 'unternehmen_id, marke_id, kampagne_id';
  const row = await one(admin, table, entityId, columns);
  if (!row) return null;
  const kampagne = row.kampagne_id
    ? await one(admin, 'kampagne', row.kampagne_id, 'unternehmen_id, marke_id')
    : null;
  return finishScope(admin, {
    unternehmenId: row.unternehmen_id || null,
    markeId: row.marke_id || null,
    kampagneUnternehmenId: kampagne?.unternehmen_id || null,
    kampagneMarkeId: kampagne?.marke_id || null,
  });
}

export async function classifyShareEmails(
  admin: Admin,
  emails: string[],
  entityType: string,
  entityId: string,
): Promise<RecipientPlan> {
  const normalized = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) return { listLink: [], guest: [], blocked: [] };

  const { data: users, error } = await admin
    .from('benutzer')
    .select('id, email, rolle, auth_user_id, freigeschaltet')
    .in('rolle', [...CUSTOMER_ROLES, ...STAFF_ROLES]);
  if (error) throw error;

  const wanted = new Set(normalized);
  const accounts = ((users || []) as UserRow[]).filter((row) => wanted.has(emailOf(row)));
  const customers = accounts.filter((row) => CUSTOMER_ROLES.includes(row.rolle));
  // Nicht freigeschaltete Mitarbeiter können sich nicht anmelden und gelten als Gast.
  const staff = accounts.filter((row) => STAFF_ROLES.includes(row.rolle) && row.freigeschaltet === true);
  const scope = customers.length ? await loadScope(admin, entityType, entityId) : null;

  let companyRows: { kunde_id: string; unternehmen_id: string }[] = [];
  let brandRows: { kunde_id: string; marke_id: string }[] = [];
  if (customers.length) {
    const ids = customers.map((row) => row.id);
    const companies = await admin.from('kunde_unternehmen').select('kunde_id, unternehmen_id').in('kunde_id', ids);
    if (companies.error) throw companies.error;
    const brands = await admin.from('kunde_marke').select('kunde_id, marke_id').in('kunde_id', ids);
    if (brands.error) throw brands.error;
    companyRows = companies.data || [];
    brandRows = brands.data || [];
  }

  const accountsByEmail: Record<string, AccountInfo> = {};
  for (const row of customers) {
    accountsByEmail[emailOf(row)] = {
      canSee: canSee({
        unternehmenIds: companyRows.filter((link) => link.kunde_id === row.id).map((link) => link.unternehmen_id),
        markeIds: brandRows.filter((link) => link.kunde_id === row.id).map((link) => link.marke_id),
      }, scope),
    };
  }
  const staffSees = staff.length ? await staffVisibility(admin, staff, entityType, entityId) : {};
  for (const row of staff) {
    accountsByEmail[emailOf(row)] = { canSee: staffSees[row.id] === true, staff: true };
  }

  return planShareRecipients(normalized, accountsByEmail, entityType);
}
