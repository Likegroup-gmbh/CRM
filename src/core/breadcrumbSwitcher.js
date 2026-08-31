// breadcrumbSwitcher.js
// Opt-in Geschwister-Liste für den Breadcrumb-Switcher. Sichtbarkeit = Listen-Parität.

import { KampagneUtils } from '../modules/kampagne/KampagneUtils.js';

export const SWITCHER_LIMIT = 25;

function isUnscopedRole() {
  return Boolean(window.isUnscoped?.() || window.isAdmin?.() || window.isKunde?.());
}

async function allowedIds(getter) {
  if (typeof getter !== 'function') return null;
  return getter();
}

async function scopeIn(getter, column) {
  if (isUnscopedRole()) return null;
  const ids = await allowedIds(getter);
  if (ids === null || ids === undefined) return null;
  if (!ids.length) return { empty: true };
  return { in: { column, ids } };
}

async function scopeKampagneColumn(column) {
  if (isUnscopedRole()) return null;
  const ids = await KampagneUtils.loadAllowedKampagneIds();
  if (ids === null) return null;
  if (!ids.length) return { empty: true };
  return { in: { column, ids } };
}

async function scopeKooperation() {
  if (isUnscopedRole()) return null;
  const kampagneIds = await KampagneUtils.loadAllowedKampagneIds();
  if (kampagneIds === null) return null;
  const parts = [];
  const userId = window.currentUser?.id;
  if (userId) parts.push(`assignee_id.eq.${userId}`);
  if (kampagneIds.length) parts.push(`kampagne_id.in.(${kampagneIds.join(',')})`);
  if (!parts.length) return { empty: true };
  return { or: parts.join(',') };
}

async function scopeRechnung() {
  if (isUnscopedRole()) return null;
  const [kampagneIds, unternehmenIds] = await Promise.all([
    KampagneUtils.loadAllowedKampagneIds(),
    allowedIds(window.getAllowedUnternehmenIds)
  ]);
  if (kampagneIds === null) return null;
  const parts = ['rechnungstyp.eq.contracting'];
  if (kampagneIds.length) parts.push(`kampagne_id.in.(${kampagneIds.join(',')})`);
  if (Array.isArray(unternehmenIds) && unternehmenIds.length) {
    parts.push(`unternehmen_id.in.(${unternehmenIds.join(',')})`);
  }
  return { or: parts.join(',') };
}

async function scopeBriefing() {
  if (isUnscopedRole()) return null;
  const [unternehmenIds, markenIds] = await Promise.all([
    allowedIds(window.getAllowedUnternehmenIds),
    allowedIds(window.getAllowedMarkenIds)
  ]);
  if (unternehmenIds === null || unternehmenIds === undefined) return null;
  const parts = [];
  if (Array.isArray(unternehmenIds) && unternehmenIds.length) {
    parts.push(`unternehmen_id.in.(${unternehmenIds.join(',')})`);
  }
  if (Array.isArray(markenIds) && markenIds.length) {
    parts.push(`marke_id.in.(${markenIds.join(',')})`);
  }
  if (!parts.length) return { empty: true };
  return { or: parts.join(',') };
}

async function scopeAnsprechpartner() {
  if (isUnscopedRole()) return null;
  const [unternehmenIds, markenIds] = await Promise.all([
    allowedIds(window.getAllowedUnternehmenIds),
    allowedIds(window.getAllowedMarkenIds)
  ]);
  if (unternehmenIds === null && markenIds === null) return null;
  if (unternehmenIds === undefined && markenIds === undefined) return null;

  const requests = [];
  if (Array.isArray(unternehmenIds) && unternehmenIds.length) {
    requests.push(
      window.supabase
        .from('ansprechpartner_unternehmen')
        .select('ansprechpartner_id')
        .in('unternehmen_id', unternehmenIds)
    );
  }
  if (Array.isArray(markenIds) && markenIds.length) {
    requests.push(
      window.supabase
        .from('ansprechpartner_marke')
        .select('ansprechpartner_id')
        .in('marke_id', markenIds)
    );
  }
  if (!requests.length) return { empty: true };

  const results = await Promise.all(requests);
  const ids = new Set();
  for (const { data } of results) {
    (data || []).forEach((row) => {
      if (row.ansprechpartner_id) ids.add(row.ansprechpartner_id);
    });
  }
  if (!ids.size) return { empty: true };
  return { in: { column: 'id', ids: [...ids] } };
}

async function scopeOwnerNested(context, { ownerColumn, junctionTable, junctionEntityColumn }) {
  if (context?.typ === 'marke' && context.ownerId) {
    const { data } = await window.supabase
      .from(junctionTable)
      .select(junctionEntityColumn)
      .eq('marke_id', context.ownerId);
    const ids = [...new Set((data || []).map((row) => row[junctionEntityColumn]).filter(Boolean))];
    if (!ids.length) return { empty: true };
    return { in: { column: 'id', ids } };
  }
  const unternehmenId = context?.unternehmenId
    || (context?.typ === 'unternehmen' ? context.ownerId : null);
  if (!unternehmenId) return { empty: true };
  return { in: { column: ownerColumn, ids: [unternehmenId] } };
}

async function scopeProduktList() {
  if (isUnscopedRole()) return null;
  const userId = window.currentUser?.id;
  if (!userId) return { empty: true };
  const { ProduktService } = await import('../modules/produkt/ProduktService.js');
  const scope = await ProduktService.getAllowedProduktScopeForUser(userId);
  if (scope?.all) return null;
  if (!scope?.produktIds?.length) return { empty: true };
  return { in: { column: 'id', ids: scope.produktIds } };
}

function hasNestedOwner(context) {
  if (context?.typ === 'marke' && context.ownerId) return true;
  return Boolean(context?.unternehmenId || (context?.typ === 'unternehmen' && context.ownerId));
}

function nestedOwnerRoute(kind) {
  return (row, context) => {
    if (!row?.id) return '#';
    if (context?.basePath) return `${context.basePath}/${kind}?${kind}=${row.id}`;
    return `/${kind}/${row.id}`;
  };
}

export const SWITCHER_CONFIG = {
  unternehmen: {
    table: 'unternehmen',
    permKey: 'unternehmen',
    routePrefix: '/unternehmen',
    labelField: 'firmenname',
    searchFields: ['firmenname', 'internes_kuerzel', 'webseite', 'invoice_email'],
    resolveScope: () => scopeIn(window.getAllowedUnternehmenIds, 'id')
  },
  marke: {
    table: 'marke',
    permKey: 'marke',
    routePrefix: '/marke',
    labelField: 'markenname',
    searchFields: ['markenname', 'webseite'],
    resolveScope: () => scopeIn(window.getAllowedMarkenIds, 'id')
  },
  kampagne: {
    table: 'kampagne',
    permKey: 'kampagne',
    routePrefix: '/kampagne',
    labelField: ['eigener_name', 'kampagnenname'],
    searchFields: ['kampagnenname', 'eigener_name'],
    buildLabel: (row) => KampagneUtils.getDisplayName(row),
    resolveScope: () => scopeKampagneColumn('id')
  },
  creator: {
    table: 'creator',
    permKey: 'creator',
    routePrefix: '/creator',
    labelField: ['vorname', 'nachname'],
    searchFields: ['vorname', 'nachname', 'instagram', 'tiktok', 'mail'],
    resolveScope: async () => null
  },
  auftrag: {
    table: 'auftrag',
    permKey: 'auftrag',
    routePrefix: '/auftrag',
    labelField: 'auftragsname',
    searchFields: ['auftragsname', 'po', 'externe_po', 're_nr', 'angebotsnummer'],
    resolveScope: () => scopeIn(window.getAllowedUnternehmenIds, 'unternehmen_id')
  },
  briefing: {
    table: 'campaign_briefings',
    permKey: 'briefing',
    routePrefix: '/briefing',
    labelField: 'aktivierung_name',
    searchFields: ['aktivierung_name'],
    resolveScope: scopeBriefing
  },
  ansprechpartner: {
    table: 'ansprechpartner',
    permKey: 'ansprechpartner',
    routePrefix: '/ansprechpartner',
    labelField: ['vorname', 'nachname'],
    searchFields: ['vorname', 'nachname', 'email'],
    resolveScope: scopeAnsprechpartner
  },
  kooperation: {
    table: 'kooperationen',
    permKey: 'kooperation',
    routePrefix: '/kooperation',
    labelField: 'name',
    searchFields: ['name'],
    resolveScope: scopeKooperation
  },
  mitarbeiter: {
    table: 'benutzer',
    permKey: 'mitarbeiter',
    routePrefix: '/mitarbeiter',
    labelField: 'name',
    searchFields: ['name', 'email'],
    extra: (query) => query.neq('rolle', 'kunde').neq('rolle', 'gast'),
    resolveScope: async () => null
  },
  strategie: {
    table: 'strategie',
    permKey: 'strategie',
    routePrefix: '/strategie',
    labelField: 'name',
    searchFields: ['name'],
    resolveScope: () => scopeKampagneColumn('kampagne_id')
  },
  sourcing: {
    table: 'creator_auswahl',
    permKey: 'sourcing',
    routePrefix: '/sourcing',
    labelField: 'name',
    searchFields: ['name'],
    resolveScope: () => scopeKampagneColumn('kampagne_id')
  },
  rechnung: {
    table: 'rechnung',
    permKey: 'rechnung',
    routePrefix: '/rechnung',
    labelField: 'rechnung_nr',
    searchFields: ['rechnung_nr', 'externe_angebotsnummer'],
    resolveScope: scopeRechnung
  },
  persona: {
    table: 'personas',
    permKey: (context) => context?.typ === 'marke' ? 'marke' : 'unternehmen',
    labelField: ['oberbegriff', 'name'],
    searchFields: ['name', 'oberbegriff'],
    buildLabel: (row) => [row.oberbegriff, row.name].filter(Boolean).join(' · ') || 'Persona',
    buildRoute: nestedOwnerRoute('persona'),
    resolveScope: (context) => scopeOwnerNested(context, {
      ownerColumn: 'unternehmen_id',
      junctionTable: 'persona_marke',
      junctionEntityColumn: 'persona_id'
    })
  },
  produkt: {
    table: 'produkt',
    permKey: 'produkt',
    labelField: 'name',
    searchFields: ['name'],
    buildRoute: nestedOwnerRoute('produkt'),
    resolveScope: (context) => hasNestedOwner(context)
      ? scopeOwnerNested(context, {
          ownerColumn: 'unternehmen_id',
          junctionTable: 'produkt_marke',
          junctionEntityColumn: 'produkt_id'
        })
      : scopeProduktList()
  }
};

export function getSwitcherConfig(segment) {
  return SWITCHER_CONFIG[segment] || null;
}

export function hasSwitcherConfig(segment) {
  return Boolean(SWITCHER_CONFIG[segment]);
}

export function nestedSwitcherContext(segment, id, ctx) {
  if (!id || !ctx) return null;
  return {
    segment,
    id,
    typ: ctx.typ,
    ownerId: ctx.markeId || ctx.unternehmenId,
    unternehmenId: ctx.unternehmenId,
    basePath: ctx.basePath
  };
}

export function canViewSwitcher(permKey) {
  if (typeof window.canViewPage !== 'function') return true;
  return window.canViewPage(permKey) === true;
}

export function shouldEnableSwitcher(segment, id, options = {}) {
  if (!id || id === 'new') return false;
  if (options.action) return false;
  if (options.isChild) return false;
  const config = SWITCHER_CONFIG[segment];
  if (!config) return false;
  const permKey = typeof config.permKey === 'function' ? config.permKey(options.context) : config.permKey;
  return canViewSwitcher(permKey);
}

export function escapeSwitcherQuery(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/,/g, '');
}

function selectColumns(config) {
  const cols = new Set(['id']);
  for (const field of config.searchFields || []) cols.add(field);
  const labelField = config.labelField;
  if (Array.isArray(labelField)) labelField.forEach((field) => cols.add(field));
  else if (labelField) cols.add(labelField);
  return [...cols].join(', ');
}

function buildLabel(row, config) {
  if (typeof config.buildLabel === 'function') return config.buildLabel(row);
  const labelField = config.labelField;
  if (Array.isArray(labelField)) {
    return labelField.map((field) => row[field] || '').filter(Boolean).join(' ').trim() || '—';
  }
  return row[labelField] != null && row[labelField] !== '' ? String(row[labelField]) : '—';
}

function applySearch(query, config, rawQuery) {
  const needle = escapeSwitcherQuery(rawQuery.trim());
  if (!needle) return query;
  const parts = (config.searchFields || []).map((field) => `${field}.ilike.%${needle}%`);
  if (!parts.length) return query;
  return query.or(parts.join(','));
}

function isMissingOrderColumn(error) {
  const message = String(error?.message || error?.details || '');
  return error?.code === '42703' || message.includes('updated_at');
}

async function runQuery(config, { search, scope }) {
  const build = (orderField) => {
    let query = window.supabase.from(config.table).select(selectColumns(config));
    if (typeof config.extra === 'function') query = config.extra(query);
    if (scope?.in) query = query.in(scope.in.column, scope.in.ids);
    if (scope?.or) query = query.or(scope.or);
    query = applySearch(query, config, search);
    return query.order(orderField, { ascending: false }).limit(SWITCHER_LIMIT);
  };

  let result = await build('updated_at');
  if (result?.error && isMissingOrderColumn(result.error)) {
    result = await build('created_at');
  }
  return result || { data: [], error: null };
}

export async function loadSwitcherItems({ segment, query = '', context } = {}) {
  const config = SWITCHER_CONFIG[segment];
  if (!config) return { items: [], error: null };
  const permKey = typeof config.permKey === 'function' ? config.permKey(context) : config.permKey;
  if (!canViewSwitcher(permKey)) return { items: [], error: null };
  if (!window.supabase) return { items: [], error: new Error('Supabase nicht verfügbar') };

  try {
    const scope = await config.resolveScope(context);
    if (scope?.empty) return { items: [], error: null };

    const { data, error } = await runQuery(config, { search: query, scope });
    if (error) return { items: [], error };

    const items = (data || []).map((row) => ({
      id: row.id,
      label: buildLabel(row, config),
      route: typeof config.buildRoute === 'function'
        ? config.buildRoute(row, context)
        : `${config.routePrefix}/${row.id}`
    }));
    return { items, error: null };
  } catch (error) {
    return { items: [], error };
  }
}
