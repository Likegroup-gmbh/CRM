// Empfänger eines Zugangs: Listen-Link, Gast-Mail oder keine Mail.
// Spiegelt src/modules/share/shareRecipientPlan.js.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Admin = ReturnType<typeof createClient>;

export type RecipientPlan = {
  listLink: string[];
  guest: string[];
  blocked: { email: string; reason: 'paket' | 'scope' }[];
};

type Scope = {
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

function canSee(links: { unternehmenIds: string[]; markeIds: string[] }, scope: Scope | null): boolean {
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

export function planShareRecipients(
  emails: string[],
  customersByEmail: Record<string, { canSee: boolean }>,
  entityType: string,
): RecipientPlan {
  const listLink: string[] = [];
  const guest: string[] = [];
  const blocked: RecipientPlan['blocked'] = [];
  for (const email of emails) {
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
    .select('id, email, rolle')
    .in('rolle', ['kunde', 'kunde_editor']);
  if (error) throw error;

  const wanted = new Set(normalized);
  const customers = (users || []).filter((row: { email?: string }) => wanted.has(String(row.email || '').trim().toLowerCase()));
  const scope = customers.length ? await loadScope(admin, entityType, entityId) : null;

  let companyRows: { kunde_id: string; unternehmen_id: string }[] = [];
  let brandRows: { kunde_id: string; marke_id: string }[] = [];
  if (customers.length) {
    const ids = customers.map((row: { id: string }) => row.id);
    const companies = await admin.from('kunde_unternehmen').select('kunde_id, unternehmen_id').in('kunde_id', ids);
    if (companies.error) throw companies.error;
    const brands = await admin.from('kunde_marke').select('kunde_id, marke_id').in('kunde_id', ids);
    if (brands.error) throw brands.error;
    companyRows = companies.data || [];
    brandRows = brands.data || [];
  }

  const customersByEmail: Record<string, { canSee: boolean }> = {};
  for (const row of customers as { id: string; email?: string }[]) {
    const email = String(row.email || '').trim().toLowerCase();
    customersByEmail[email] = {
      canSee: canSee({
        unternehmenIds: companyRows.filter((link) => link.kunde_id === row.id).map((link) => link.unternehmen_id),
        markeIds: brandRows.filter((link) => link.kunde_id === row.id).map((link) => link.marke_id),
      }, scope),
    };
  }

  return planShareRecipients(normalized, customersByEmail, entityType);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function accountLinkMail(params: {
  entityLabel: string;
  entityName: string;
  url: string;
  sharedByName: string;
}): { betreff: string; html: string } {
  const betreff = `${params.entityLabel} „${params.entityName}"`;
  const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><title>${escapeHtml(betreff)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="padding:32px 40px;color:#1a1a1a;font-size:15px;line-height:1.6;">
          <h2 style="margin:0 0 16px 0;font-size:20px;">${escapeHtml(params.entityLabel)} „${escapeHtml(params.entityName)}"</h2>
          <p style="margin:0 0 16px 0;">${escapeHtml(params.sharedByName)} hat Ihnen diese Liste geschickt. Sie haben bereits ein Kundenkonto. Öffnen Sie den Link und melden Sie sich an.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
            <tr><td style="border-radius:6px;background:#111111;">
              <a href="${params.url}" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">Liste öffnen</a>
            </td></tr>
          </table>
          <p style="margin:0;color:#999;font-size:12px;">Falls der Button nicht funktioniert, kopieren Sie diesen Link:<br><a href="${params.url}" style="color:#111111;word-break:break-all;">${params.url}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { betreff, html };
}
