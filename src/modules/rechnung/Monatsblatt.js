// Monatsblatt.js
// Ein Modul: Blatt fuer Jahr/Monat. Listen sind Renderer.
// entity: 'rechnung' | 'kundenrechnung'

import {
  ALL_TAB,
  NO_RENR_TAB,
  UNDATED_TAB,
  countRowsByMonth,
  filterRowsByMonthYear,
  getInvoiceTabKey,
  hasInvoiceNumber
} from '../auftrag/logic/InvoiceMonthFilter.js';
import { FINAL_AUFTRAG_OR_FILTER, isFinalAuftrag } from '../../core/finalisiert.js';
import { sortRowsByPrefixedNumberDesc } from '../auftrag/logic/PrefixedNumberSort.js';
import { sumInvoiceRows, sumPaidRechnungRows } from './invoiceCardTotals.js';

export { sumInvoiceRows, sumPaidRechnungRows };

export { isFinalAuftrag };

export const ENTITY_RECHNUNG = 'rechnung';
export const ENTITY_KUNDENRECHNUNG = 'kundenrechnung';

export function getRechnungTabKey(row) {
  if (!row?.gestellt_am) return UNDATED_TAB;
  const date = new Date(row.gestellt_am);
  if (Number.isNaN(date.getTime())) return UNDATED_TAB;
  return { year: date.getFullYear(), month: date.getMonth() };
}

const TR_FIELDS = [
  're_nr', 'externe_po', 'nettobetrag', 'ust_betrag', 'bruttobetrag',
  'rechnung_gestellt', 'rechnung_gestellt_am', 're_faelligkeit',
  'erwarteter_monat_zahlungseingang',
  'ueberwiesen', 'ueberwiesen_am'
];

const RECHNUNG_LIST_SELECT = `
id,
rechnung_nr,
po_nummer,
created_at,
unternehmen_id,
land,
gestellt_am,
zahlungsziel,
nettobetrag,
ust_betrag,
videoanzahl,
bruttobetrag,
ksk_pflichtig,
ksk_betrag,
status,
created_by_id,
rechnungstyp,
auftrag_id,
kampagne_id,
kooperation_id,
pdf_url,
vertrag_id,
unternehmen:unternehmen_id(id, firmenname),
auftrag:auftrag_id(id, auftragsname, auftrag_details(id)),
creator:creator_id(id, vorname, nachname),
created_by:created_by_id(id, name, profile_image_url),
vertrag:vertrag_id(id, name, unterschriebener_vertrag_url, dropbox_file_url, datei_url)
`;

const RECHNUNG_PDF_SELECT = 'id, rechnung_id, file_name, file_path, file_url';
const ROW_PAGE_SIZE = 1000;
const PDF_ID_CHUNK = 200;

const KUNDEN_SLIM_SELECT = `
id,
re_nr,
rechnung_gestellt_am,
ueberwiesen_am,
erwarteter_monat_zahlungseingang,
re_faelligkeit,
auftragtype,
is_draft
`;

const KUNDEN_ROW_SELECT = `
id,
auftragsname,
auftragtype,
angebotsnummer,
anzahl_teilrechnungen,
status,
po,
externe_po,
re_nr,
re_faelligkeit,
erwarteter_monat_zahlungseingang,
zahlungsziel_tage,
start,
ende,
is_draft,
nettobetrag,
ust_prozent,
ust_betrag,
bruttobetrag,
rechnung_gestellt,
rechnung_gestellt_am,
ueberwiesen,
ueberwiesen_am,
created_by_id,
created_at,
unternehmen:unternehmen_id(id, firmenname, internes_kuerzel, logo_url, logo_thumb_url),
marke:marke_id(id, markenname, logo_url, logo_thumb_url),
created_by:created_by_id(id, name, profile_image_url, profile_image_thumb_url),
auftrag_details(id),
kampagne_arten:auftrag_kampagne_art(art:kampagne_art_id(id, name))
`;

export function monthDateBounds(year, monthIndex) {
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

function emptyCounts() {
  return { [UNDATED_TAB]: 0, [NO_RENR_TAB]: 0, [ALL_TAB]: 0, months: Array(12).fill(0) };
}

function emptyStatusCounts(statusIds = []) {
  const counts = { alle: 0 };
  for (const id of statusIds) {
    if (id !== 'alle') counts[id] = 0;
  }
  return counts;
}

function applyRechnungType(query, typeTab) {
  if (typeTab === 'contracting') return query.eq('rechnungstyp', 'contracting');
  if (typeTab === 'rechnung') return query.or('rechnungstyp.is.null,rechnungstyp.neq.contracting');
  return query;
}

function applyRechnungMonth(query, year, month) {
  if (month === ALL_TAB) return query;
  if (month === UNDATED_TAB) return query.is('gestellt_am', null);
  if (month === NO_RENR_TAB) return query;
  const { start, end } = monthDateBounds(year, month);
  return query.gte('gestellt_am', start).lt('gestellt_am', end);
}

function applyRechnungFilters(query, filters = {}) {
  const {
    rechnung_nr,
    rechnungstyp,
    auftrag_id,
    status,
    land,
    gestellt_am,
    unternehmen_id,
    unternehmen_ids
  } = filters;

  if (rechnung_nr) query = query.ilike('rechnung_nr', `%${rechnung_nr}%`);
  if (rechnungstyp) query = query.eq('rechnungstyp', rechnungstyp);
  if (auftrag_id) query = query.eq('auftrag_id', auftrag_id);
  if (status) query = query.eq('status', status);
  if (land) query = query.ilike('land', `%${land}%`);
  if (unternehmen_id) query = query.eq('unternehmen_id', unternehmen_id);
  if (Array.isArray(unternehmen_ids) && unternehmen_ids.length > 0) {
    query = query.in('unternehmen_id', unternehmen_ids);
  }
  if (gestellt_am && typeof gestellt_am === 'object') {
    if (gestellt_am.from) query = query.gte('gestellt_am', gestellt_am.from);
    if (gestellt_am.to) query = query.lte('gestellt_am', gestellt_am.to);
  }
  return query;
}

async function lookupIds(table, applyFilter) {
  if (!window.supabase) return [];
  const { data, error } = await applyFilter(window.supabase.from(table).select('id'));
  if (error) return [];
  return (data || []).map(row => row.id).filter(Boolean);
}

async function resolveRechnungSearchParts(search) {
  const term = String(search || '').trim();
  if (!term || !window.supabase) return null;

  const like = `%${term}%`;
  const [unternehmenIds, auftragIds, kampagneIds, creatorIds] = await Promise.all([
    lookupIds('unternehmen', query => query.ilike('firmenname', like)),
    lookupIds('auftrag', query => query.ilike('auftragsname', like)),
    lookupIds('kampagne', query => query.or(`eigener_name.ilike.${like},kampagnenname.ilike.${like}`)),
    lookupIds('creator', query => query.or(`vorname.ilike.${like},nachname.ilike.${like}`))
  ]);

  return { term, unternehmenIds, auftragIds, kampagneIds, creatorIds };
}

function applyRechnungSearch(query, searchParts) {
  if (!searchParts?.term) return query;
  const { term, unternehmenIds = [], auftragIds = [], kampagneIds = [], creatorIds = [] } = searchParts;
  const orParts = [
    `rechnung_nr.ilike.%${term}%`,
    `po_nummer.ilike.%${term}%`,
    `land.ilike.%${term}%`,
    `status.ilike.%${term}%`
  ];
  if (unternehmenIds.length) orParts.push(`unternehmen_id.in.(${unternehmenIds.join(',')})`);
  if (auftragIds.length) orParts.push(`auftrag_id.in.(${auftragIds.join(',')})`);
  if (kampagneIds.length) orParts.push(`kampagne_id.in.(${kampagneIds.join(',')})`);
  if (creatorIds.length) orParts.push(`creator_id.in.(${creatorIds.join(',')})`);
  return query.or(orParts.join(','));
}

function applyRechnungPermissions(query, allowed) {
  if (!allowed) return query;
  const { kampagneIds = [], koopIds = [], unternehmenIds = [] } = allowed;
  if (!kampagneIds.length && !koopIds.length && !unternehmenIds.length) {
    return { shortCircuit: true };
  }
  const parts = ['rechnungstyp.eq.contracting'];
  if (kampagneIds.length) parts.push(`kampagne_id.in.(${kampagneIds.join(',')})`);
  if (koopIds.length) parts.push(`kooperation_id.in.(${koopIds.join(',')})`);
  if (unternehmenIds.length) parts.push(`unternehmen_id.in.(${unternehmenIds.join(',')})`);
  return query.or(parts.join(','));
}

function applyAuftragMode(query, mode) {
  if (mode === 'contracts') return query.eq('auftragtype', 'Contracting');
  return query.neq('auftragtype', 'Contracting');
}

function applyTeilrechnungFields(row, tr) {
  for (const field of TR_FIELDS) {
    if (tr[field] !== undefined) row[field] = tr[field];
  }
  return row;
}

// Eine Zeile je Teilrechnung, sonst der Auftrag selbst. Dieselbe Aufteilung
// wie die Kundenrechnungs-Liste, damit Kachelsumme und Dashboard dieselben
// Beträge sehen.
export function kundenrechnungZeilen(auftraege, teilrechnungen) {
  const trByAuftrag = new Map();
  for (const tr of (teilrechnungen || [])) {
    if (!trByAuftrag.has(tr.auftrag_id)) trByAuftrag.set(tr.auftrag_id, []);
    trByAuftrag.get(tr.auftrag_id).push(tr);
  }

  const rows = [];
  for (const auftrag of (auftraege || []).filter(isFinalAuftrag)) {
    const trs = trByAuftrag.get(auftrag.id);
    if (trs?.length) {
      const total = trs.length;
      for (const tr of trs) {
        const row = applyTeilrechnungFields({ ...auftrag }, tr);
        row.teilrechnung_id = tr.id;
        row._teilrechnung = { position: tr.position, total, label: `${tr.position} von ${total}` };
        rows.push(row);
      }
    } else {
      rows.push({
        ...auftrag,
        teilrechnung_id: null,
        _teilrechnung: { position: 1, total: 1, label: '1 von 1' }
      });
    }
  }
  return rows;
}

function decorateKundenrechnungZeile(row, createdByFallbacks) {
  const details = row.auftrag_details;
  const detailsId = Array.isArray(details) ? details[0]?.id : details?.id;
  row.has_auftragsdetails = Boolean(detailsId);
  row.auftragsdetails_id = detailsId || null;
  row.created_by = row.created_by || createdByFallbacks.get(row.created_by_id) || null;
  row.unternehmen = row.unternehmen ? {
    id: row.unternehmen.id,
    firmenname: row.unternehmen.firmenname,
    internes_kuerzel: row.unternehmen.internes_kuerzel,
    logo_url: row.unternehmen.logo_url,
    logo_thumb_url: row.unternehmen.logo_thumb_url
  } : null;
  row.marke = row.marke ? {
    id: row.marke.id,
    markenname: row.marke.markenname,
    logo_url: row.marke.logo_url,
    logo_thumb_url: row.marke.logo_thumb_url
  } : null;
  row.art_der_kampagne = (row.kampagne_arten || [])
    .map(ka => ka.art?.name)
    .filter(Boolean);
  return row;
}

function explodeTeilrechnungen(auftraege, teilrechnungen, createdByFallbacks) {
  return kundenrechnungZeilen(auftraege, teilrechnungen)
    .map(row => decorateKundenrechnungZeile(row, createdByFallbacks));
}

async function loadCreatedByFallbacks(auftraege) {
  const missingIds = [...new Set((auftraege || [])
    .filter(auftrag => auftrag.created_by_id && !auftrag.created_by?.name)
    .map(auftrag => auftrag.created_by_id))];
  if (!missingIds.length || !window.supabase) return new Map();

  const fields = 'id, auth_user_id, name, profile_image_url, profile_image_thumb_url';
  try {
    const [{ data: byBenutzerId }, { data: byAuthUserId }] = await Promise.all([
      window.supabase.from('benutzer').select(fields).in('id', missingIds),
      window.supabase.from('benutzer').select(fields).in('auth_user_id', missingIds)
    ]);
    const map = new Map();
    (byBenutzerId || []).forEach(user => map.set(user.id, user));
    (byAuthUserId || []).forEach(user => map.set(user.auth_user_id, user));
    return map;
  } catch (error) {
    console.warn('⚠️ Erstellt-von-Fallback konnte nicht geladen werden:', error);
    return new Map();
  }
}

async function mergeTeilrechnungSearchIds(auftragIds, searchTerm, mode) {
  if (!searchTerm || !window.supabase) return auftragIds;

  const { data: trHits, error } = await window.supabase
    .from('auftrag_teilrechnung')
    .select('auftrag_id')
    .ilike('re_nr', `%${searchTerm}%`);
  if (error) return auftragIds;

  const known = new Set(auftragIds);
  const extraIds = [...new Set((trHits || []).map(row => row.auftrag_id).filter(Boolean))]
    .filter(id => !known.has(id));
  if (!extraIds.length) return auftragIds;

  let extraQuery = window.supabase.from('auftrag').select('id').in('id', extraIds);
  extraQuery = applyAuftragMode(extraQuery, mode).or(FINAL_AUFTRAG_OR_FILTER);
  const { data: extraRows, error: extraError } = await extraQuery;
  if (extraError) return auftragIds;
  return auftragIds.concat((extraRows || []).map(row => row.id));
}

async function resolveKundenIds(filters, search, mode) {
  let query = window.supabase
    .from('auftrag')
    .select('id')
    .or(FINAL_AUFTRAG_OR_FILTER);
  query = applyAuftragMode(query, mode);

  const searchTerm = String(search || filters.auftragsname || '').trim();
  if (searchTerm) {
    const [{ data: matchU }, { data: matchM }] = await Promise.all([
      window.supabase.from('unternehmen').select('id').ilike('firmenname', `%${searchTerm}%`),
      window.supabase.from('marke').select('id').ilike('markenname', `%${searchTerm}%`)
    ]);
    const orParts = [
      `auftragsname.ilike.%${searchTerm}%`,
      `po.ilike.%${searchTerm}%`,
      `externe_po.ilike.%${searchTerm}%`,
      `re_nr.ilike.%${searchTerm}%`,
      `angebotsnummer.ilike.%${searchTerm}%`
    ];
    if (matchU?.length) orParts.push(`unternehmen_id.in.(${matchU.map(u => u.id).join(',')})`);
    if (matchM?.length) orParts.push(`marke_id.in.(${matchM.map(m => m.id).join(',')})`);
    query = query.or(orParts.join(','));
  }

  const rest = { ...filters };
  delete rest.auftragsname;
  query = applyAuftragFilters(query, rest);

  const { data, error } = await query;
  if (error) throw error;
  return mergeTeilrechnungSearchIds((data || []).map(r => r.id), searchTerm, mode);
}

function applyAuftragFilters(query, filters = {}) {
  if (filters.unternehmen_id) query = query.eq('unternehmen_id', filters.unternehmen_id);
  if (filters.marke_id) query = query.eq('marke_id', filters.marke_id);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.rechnung_gestellt !== undefined && filters.rechnung_gestellt !== '') {
    query = query.eq('rechnung_gestellt', filters.rechnung_gestellt);
  }
  if (filters.ueberwiesen !== undefined && filters.ueberwiesen !== '') {
    query = query.eq('ueberwiesen', filters.ueberwiesen);
  }
  return query;
}

function statusCountsFromRows(rows, statusIds) {
  const counts = emptyStatusCounts(statusIds);
  counts.alle = (rows || []).length;
  for (const row of (rows || [])) {
    if (row.status && counts[row.status] != null) counts[row.status] += 1;
  }
  return counts;
}

function buildRechnungQuery(selectArgs, { year, month, filters, typeTab, allowed, searchParts, skipMonth }) {
  let query = window.supabase.from('rechnung').select(...selectArgs);
  if (!skipMonth) query = applyRechnungMonth(query, year, month);
  query = applyRechnungFilters(query, filters);
  query = applyRechnungSearch(query, searchParts);
  query = applyRechnungType(query, typeTab);
  return applyRechnungPermissions(query, allowed);
}

export function applyRechnungOrder(query, sortBy) {
  if (sortBy === 'zahlungsziel') {
    return query
      .order('zahlungsziel', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
  }
  return query
    .order('gestellt_am', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
}

async function fetchRechnungPages(opts) {
  const rows = [];
  let from = 0;
  while (true) {
    const query = buildRechnungQuery([RECHNUNG_LIST_SELECT], opts);
    if (query?.shortCircuit) return [];
    const { data, error } = await applyRechnungOrder(query, opts.sortBy)
      .range(from, from + ROW_PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < ROW_PAGE_SIZE) break;
    from += ROW_PAGE_SIZE;
  }
  return rows;
}

function normalizeRechnungPdfUrls(rows) {
  for (const r of rows || []) {
    if (!r.rechnung_pdfs) { r.rechnung_pdfs = []; continue; }
    for (const pdf of r.rechnung_pdfs) {
      let openUrl = pdf.file_url || '';
      if (pdf.file_path && !pdf.file_path.startsWith('/') && window.supabase?.storage) {
        const { data } = window.supabase.storage.from('rechnungen').getPublicUrl(pdf.file_path);
        openUrl = data?.publicUrl || openUrl;
      }
      pdf.open_url = openUrl;
    }
  }
}

async function hydrateRechnungPdfs(rows) {
  if (!rows.length || !window.supabase) return rows;
  const ids = rows.map(row => row.id).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < ids.length; i += PDF_ID_CHUNK) {
    chunks.push(ids.slice(i, i + PDF_ID_CHUNK));
  }
  const pages = await Promise.all(chunks.map(chunk => window.supabase
    .from('rechnung_pdfs')
    .select(RECHNUNG_PDF_SELECT)
    .in('rechnung_id', chunk)));
  const pdfs = [];
  for (const { data, error } of pages) {
    if (error) throw error;
    pdfs.push(...(data || []));
  }
  const byRechnung = new Map();
  for (const pdf of pdfs) {
    if (!byRechnung.has(pdf.rechnung_id)) byRechnung.set(pdf.rechnung_id, []);
    byRechnung.get(pdf.rechnung_id).push(pdf);
  }
  for (const row of rows) {
    row.rechnung_pdfs = byRechnung.get(row.id) || [];
  }
  normalizeRechnungPdfUrls(rows);
  return rows;
}

async function loadRechnungRows({ year, month, filters, search, typeTab, allowed, sortBy }) {
  if (!window.supabase) return [];
  const searchParts = await resolveRechnungSearchParts(search);
  const rows = await fetchRechnungPages({
    year,
    month,
    filters,
    typeTab,
    allowed,
    searchParts,
    sortBy,
    skipMonth: Boolean(searchParts)
  });
  return rows;
}

async function headCount(query) {
  if (!query || query.shortCircuit) return 0;
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function loadRechnungCounts({ year, filters, search, typeTab, allowed, statusIds }) {
  if (!window.supabase) {
    return { months: emptyCounts(), status: emptyStatusCounts(statusIds), type: { rechnung: 0, contracting: 0 } };
  }

  const searchParts = await resolveRechnungSearchParts(search);
  const baseOpts = { year, month: ALL_TAB, filters, typeTab, allowed, searchParts, skipMonth: true };

  const typed = extra => buildRechnungQuery(['id', { count: 'exact', head: true }], {
    ...baseOpts,
    ...extra
  });

  const allQuery = typed({});
  if (allQuery?.shortCircuit) {
    return { months: emptyCounts(), status: emptyStatusCounts(statusIds), type: { rechnung: 0, contracting: 0 } };
  }

  const monthQueries = Array.from({ length: 12 }, (_, index) => typed({
    month: index,
    skipMonth: false
  }));

  const [alle, undated, ...rest] = await Promise.all([
    headCount(allQuery),
    headCount(typed({ month: UNDATED_TAB, skipMonth: false })),
    ...monthQueries.map(query => headCount(query)),
    headCount(typed({ typeTab: 'rechnung' })),
    headCount(typed({ typeTab: 'contracting' }))
  ]);

  return {
    months: {
      [UNDATED_TAB]: undated,
      [NO_RENR_TAB]: 0,
      [ALL_TAB]: alle,
      months: rest.slice(0, 12)
    },
    status: emptyStatusCounts(statusIds),
    type: { rechnung: rest[12], contracting: rest[13] }
  };
}

async function loadKundenRows({ year, month, filters, search, mode }) {
  if (!window.supabase) return [];

  const auftragIds = await resolveKundenIds(filters, search, mode);
  if (!auftragIds.length) return [];

  const [{ data: slim, error: slimError }, { data: teilrechnungen, error: trError }] = await Promise.all([
    window.supabase.from('auftrag').select(KUNDEN_SLIM_SELECT).in('id', auftragIds),
    window.supabase.from('auftrag_teilrechnung').select('*').in('auftrag_id', auftragIds).order('position', { ascending: true })
  ]);
  if (slimError) throw slimError;
  if (trError) throw trError;

  const exploded = explodeTeilrechnungen(slim || [], teilrechnungen, new Map());
  const sortedKeys = sortRowsByPrefixedNumberDesc(exploded, 're_nr');
  const visible = mode === 'contracts'
    ? sortedKeys
    : filterRowsByMonthYear(sortedKeys, { year, month });

  if (!visible.length) return [];

  const visibleAuftragIds = [...new Set(visible.map(row => row.id))];
  const { data: fat, error: fatError } = await window.supabase
    .from('auftrag')
    .select(KUNDEN_ROW_SELECT)
    .in('id', visibleAuftragIds);
  if (fatError) throw fatError;

  const createdByFallbacks = await loadCreatedByFallbacks(fat || []);
  const visibleTrs = (teilrechnungen || []).filter(tr => visibleAuftragIds.includes(tr.auftrag_id));
  const fatExploded = explodeTeilrechnungen(fat || [], visibleTrs, createdByFallbacks);
  const monthFiltered = mode === 'contracts'
    ? fatExploded
    : filterRowsByMonthYear(fatExploded, { year, month });
  return sortRowsByPrefixedNumberDesc(monthFiltered, 're_nr');
}

async function loadKundenCounts({ year, filters, search, mode }) {
  if (!window.supabase) return { months: emptyCounts() };

  const auftragIds = await resolveKundenIds(filters, search, mode);
  if (!auftragIds.length) return { months: emptyCounts() };

  const [{ data: slim, error: slimError }, { data: teilrechnungen, error: trError }] = await Promise.all([
    window.supabase.from('auftrag').select(KUNDEN_SLIM_SELECT).in('id', auftragIds),
    window.supabase
      .from('auftrag_teilrechnung')
      .select('id, auftrag_id, re_nr, rechnung_gestellt_am, ueberwiesen_am, erwarteter_monat_zahlungseingang, re_faelligkeit, position')
      .in('auftrag_id', auftragIds)
  ]);
  if (slimError) throw slimError;
  if (trError) throw trError;

  const exploded = explodeTeilrechnungen(slim || [], teilrechnungen, new Map());
  return { months: countRowsByMonth(exploded, year, getInvoiceTabKey) };
}

export async function loadRows(opts = {}) {
  const entity = opts.entity || ENTITY_RECHNUNG;
  if (entity === ENTITY_KUNDENRECHNUNG) {
    const rows = await loadKundenRows(opts);
    return { rows, totals: sumInvoiceRows(rows) };
  }
  const rows = await loadRechnungRows(opts);
  return { rows, totals: sumInvoiceRows(rows) };
}

export async function loadCounts(opts = {}) {
  const entity = opts.entity || ENTITY_RECHNUNG;
  if (entity === ENTITY_KUNDENRECHNUNG) return loadKundenCounts(opts);
  return loadRechnungCounts(opts);
}

export async function loadBlatt(opts = {}) {
  const [rowsResult, counts] = await Promise.all([
    loadRows(opts),
    loadCounts(opts)
  ]);
  const status = statusCountsFromRows(rowsResult.rows, opts.statusIds || []);
  return {
    rows: rowsResult.rows,
    totals: rowsResult.totals,
    counts: { ...counts, status }
  };
}

export { hasInvoiceNumber, hydrateRechnungPdfs, TR_FIELDS };
