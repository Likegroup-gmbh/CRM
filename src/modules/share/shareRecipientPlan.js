// Teilt Empfänger eines Listen-Zugangs in Listen-Link, Gast-Zugang und Sperre.
// Kundenkonto = benutzer.rolle kunde oder kunde_editor, auch ohne Freischaltung.

export const LIST_LINK_TEXT = 'Listen-Link per Mail';
export const GUEST_TEXT = 'Gast-Zugang mit Link und Code';

export const BLOCKED_TEXT = {
  paket: 'Eine bereits registrierte Ansprechperson kann diese Auswahl nicht per Mail bekommen. Die Auswahl gibt es nur als Gast-Zugang.',
  scope: 'Keine Mail. Zuerst Unternehmen oder Marke zuordnen.',
};

const ACCOUNT_ROUTES = {
  kampagne: (id) => `/kampagne/${id}`,
  sourcing: (id) => `/castings/${id}`,
  strategie: (id) => `/konzepte/${id}`,
  skript: (id) => `/skripte/${id}`,
};

export function accountListPath(entityType, entityId) {
  const build = ACCOUNT_ROUTES[entityType];
  if (!build || !entityId) return null;
  return build(entityId);
}

export function accountListUrl(entityType, entityId, origin = '') {
  const path = accountListPath(entityType, entityId);
  if (!path) return null;
  return `${origin}${path}`;
}

export function canCustomerSee(links, scope) {
  if (!scope) return false;
  const companies = new Set(links?.unternehmenIds || []);
  const brands = new Set(links?.markeIds || []);
  const hitCompany = (id) => Boolean(id) && companies.has(id);
  const hitBrand = (id) => Boolean(id) && brands.has(id);
  return hitCompany(scope.unternehmenId)
    || hitBrand(scope.markeId)
    || hitCompany(scope.markeUnternehmenId)
    || hitCompany(scope.kampagneUnternehmenId)
    || hitBrand(scope.kampagneMarkeId)
    || hitCompany(scope.kampagneMarkeUnternehmenId);
}

export function planShareRecipients({ emails = [], customersByEmail = {}, entityType }) {
  const listLink = [];
  const guest = [];
  const blocked = [];
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

export function recipientPlanRows(plan) {
  if (!plan) return [];
  return [
    ...plan.listLink.map((email) => ({ email, text: LIST_LINK_TEXT })),
    ...plan.guest.map((email) => ({ email, text: GUEST_TEXT })),
    ...plan.blocked.map((row) => ({ email: row.email, text: BLOCKED_TEXT[row.reason] || BLOCKED_TEXT.scope })),
  ];
}

async function one(supabase, table, id, columns) {
  const { data, error } = await supabase.from(table).select(columns).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function companyOfMarke(supabase, markeId) {
  if (!markeId) return null;
  const row = await one(supabase, 'marke', markeId, 'unternehmen_id');
  return row?.unternehmen_id || null;
}

async function finishScope(supabase, scope) {
  scope.markeUnternehmenId = await companyOfMarke(supabase, scope.markeId);
  scope.kampagneMarkeUnternehmenId = scope.kampagneMarkeId && scope.kampagneMarkeId !== scope.markeId
    ? await companyOfMarke(supabase, scope.kampagneMarkeId)
    : scope.markeUnternehmenId;
  return scope;
}

async function loadScope(supabase, entityType, entityId) {
  if (entityType === 'skript_paket' || !entityId) return null;
  if (entityType === 'kampagne') {
    const row = await one(supabase, 'kampagne', entityId, 'unternehmen_id, marke_id');
    if (!row) return null;
    return finishScope(supabase, {
      unternehmenId: row.unternehmen_id,
      markeId: row.marke_id,
      kampagneUnternehmenId: row.unternehmen_id,
      kampagneMarkeId: row.marke_id,
    });
  }
  if (entityType === 'skript') {
    const row = await one(supabase, 'skripte', entityId, 'unternehmen_id, marke_id, kampagne_id');
    if (!row) return null;
    const kampagne = row.kampagne_id
      ? await one(supabase, 'kampagne', row.kampagne_id, 'unternehmen_id, marke_id')
      : null;
    return finishScope(supabase, {
      unternehmenId: row.unternehmen_id,
      markeId: row.marke_id,
      kampagneUnternehmenId: kampagne?.unternehmen_id || null,
      kampagneMarkeId: kampagne?.marke_id || null,
    });
  }
  const table = entityType === 'sourcing' ? 'creator_auswahl' : 'strategie';
  const columns = entityType === 'sourcing'
    ? 'kampagne_id'
    : 'unternehmen_id, marke_id, kampagne_id';
  const row = await one(supabase, table, entityId, columns);
  if (!row) return null;
  const kampagne = row.kampagne_id
    ? await one(supabase, 'kampagne', row.kampagne_id, 'unternehmen_id, marke_id')
    : null;
  return finishScope(supabase, {
    unternehmenId: row.unternehmen_id || null,
    markeId: row.marke_id || null,
    kampagneUnternehmenId: kampagne?.unternehmen_id || null,
    kampagneMarkeId: kampagne?.marke_id || null,
  });
}

export async function classifyShareEmails(supabase, { emails, entityType, entityId }) {
  const normalized = [...new Set(emails.map((email) => String(email || '').trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) {
    return { listLink: [], guest: [], blocked: [] };
  }

  const { data: users, error } = await supabase
    .from('benutzer')
    .select('id, email, rolle')
    .in('rolle', ['kunde', 'kunde_editor']);
  if (error) throw error;

  const wanted = new Set(normalized);
  const customers = (users || []).filter((row) => wanted.has(String(row.email || '').trim().toLowerCase()));
  const scope = customers.length ? await loadScope(supabase, entityType, entityId) : null;

  let companyRows = [];
  let brandRows = [];
  if (customers.length) {
    const ids = customers.map((row) => row.id);
    const companies = await supabase.from('kunde_unternehmen').select('kunde_id, unternehmen_id').in('kunde_id', ids);
    if (companies.error) throw companies.error;
    const brands = await supabase.from('kunde_marke').select('kunde_id, marke_id').in('kunde_id', ids);
    if (brands.error) throw brands.error;
    companyRows = companies.data || [];
    brandRows = brands.data || [];
  }

  const customersByEmail = {};
  for (const row of customers) {
    const email = String(row.email || '').trim().toLowerCase();
    customersByEmail[email] = {
      canSee: canCustomerSee({
        unternehmenIds: companyRows.filter((link) => link.kunde_id === row.id).map((link) => link.unternehmen_id),
        markeIds: brandRows.filter((link) => link.kunde_id === row.id).map((link) => link.marke_id),
      }, scope),
    };
  }

  return planShareRecipients({ emails: normalized, customersByEmail, entityType });
}
