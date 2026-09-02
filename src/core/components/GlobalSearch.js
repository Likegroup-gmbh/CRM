// GlobalSearch.js – globale Command-Palette-Suche (nur für Mitarbeiter/Admin)

import { KampagneUtils } from '../../modules/kampagne/KampagneUtils.js';
import { icon } from '../icons/IconSystem.js';

const SEARCH_LIMIT = 5;
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const CROSS_REF_LIMIT_PER_TYPE = 3;
const CROSS_REF_LIMIT_TOTAL = 15;

/** Konfiguration pro Entität: Tabelle, Route, Suchfelder, Label für Sublabel-Anzeige */
const SEARCH_CONFIG = [
  {
    key: 'creator',
    table: 'creator',
    routePrefix: '/creator',
    labelField: ['vorname', 'nachname'],
    searchFields: ['vorname', 'nachname', 'instagram', 'tiktok', 'mail', 'telefonnummer', 'lieferadresse_stadt', 'lieferadresse_plz', 'lieferadresse_land', 'notiz'],
    fieldLabels: { vorname: 'Vorname', nachname: 'Nachname', instagram: 'Instagram', tiktok: 'TikTok', mail: 'E-Mail', telefonnummer: 'Telefon', lieferadresse_stadt: 'Stadt', lieferadresse_plz: 'PLZ', lieferadresse_land: 'Land', notiz: 'Notiz' },
    icon: 'creator',
    category: 'Stammdaten',
    permKey: 'creator'
  },
  {
    key: 'unternehmen',
    table: 'unternehmen',
    routePrefix: '/unternehmen',
    labelField: 'firmenname',
    searchFields: ['firmenname', 'internes_kuerzel', 'webseite', 'telefonnummer', 'invoice_email', 'rechnungsadresse_stadt', 'rechnungsadresse_plz', 'notiz', 'status'],
    fieldLabels: { firmenname: 'Firma', internes_kuerzel: 'Kürzel', webseite: 'Webseite', telefonnummer: 'Telefon', invoice_email: 'Rechnungs-E-Mail', rechnungsadresse_stadt: 'Stadt', rechnungsadresse_plz: 'PLZ', notiz: 'Notiz', status: 'Status' },
    icon: 'icon-building',
    category: 'Stammdaten',
    permKey: 'unternehmen'
  },
  {
    key: 'marke',
    table: 'marke',
    routePrefix: '/marke',
    labelField: 'markenname',
    searchFields: ['markenname', 'webseite'],
    fieldLabels: { markenname: 'Marke', webseite: 'Webseite' },
    icon: 'icon-tag',
    category: 'Stammdaten',
    permKey: 'marke'
  },
  {
    key: 'ansprechpartner',
    table: 'ansprechpartner',
    routePrefix: '/ansprechpartner',
    labelField: ['vorname', 'nachname'],
    searchFields: ['vorname', 'nachname', 'email', 'telefonnummer', 'linkedin', 'stadt', 'land', 'notiz'],
    fieldLabels: { vorname: 'Vorname', nachname: 'Nachname', email: 'E-Mail', telefonnummer: 'Telefon', linkedin: 'LinkedIn', stadt: 'Stadt', land: 'Land', notiz: 'Notiz' },
    icon: 'icon-user-circle',
    category: 'Stammdaten',
    permKey: 'ansprechpartner'
  },
  {
    key: 'produkt',
    table: 'produkt',
    // Produkte leben unter ihrem Unternehmen, es gibt keine eigene Detailroute
    routeFields: ['unternehmen_id'],
    buildRoute: (row) => (row.unternehmen_id ? `/unternehmen/${row.unternehmen_id}/produkt?produkt=${row.id}` : null),
    labelField: 'name',
    searchFields: ['name', 'url', 'kurzbeschreibung', 'usp'],
    fieldLabels: { name: 'Name', url: 'Shop-URL', kurzbeschreibung: 'Kurzbeschreibung', usp: 'USP' },
    icon: 'icon-cube',
    category: 'Stammdaten',
    permKey: 'produkt'
  },
  {
    key: 'persona',
    table: 'personas',
    routePrefix: '/persona',
    labelField: 'name',
    searchFields: ['name', 'oberbegriff', 'beruf', 'wohnort_region', 'beschreibung'],
    fieldLabels: { name: 'Name', oberbegriff: 'Oberbegriff', beruf: 'Beruf', wohnort_region: 'Region', beschreibung: 'Beschreibung' },
    icon: 'icon-user',
    category: 'Stammdaten',
    permKey: 'persona'
  },
  {
    key: 'kampagne',
    table: 'kampagne',
    routePrefix: '/kampagne',
    labelField: 'kampagnenname',
    searchFields: ['kampagnenname', 'eigener_name', 'kampagne_typ', 'drehort_beschreibung'],
    fieldLabels: { kampagnenname: 'Kampagne', eigener_name: 'Eigener Name', kampagne_typ: 'Typ', drehort_beschreibung: 'Drehort' },
    icon: 'icon-campaign',
    category: 'Projektmanagement',
    permKey: 'kampagne'
  },
  {
    key: 'auftrag',
    table: 'auftrag',
    routePrefix: '/auftrag',
    labelField: 'auftragsname',
    searchFields: ['auftragsname', 'po', 'externe_po', 're_nr', 'angebotsnummer', 'notiz', 'status'],
    fieldLabels: { auftragsname: 'Auftrag', po: 'PO', externe_po: 'Externe PO', re_nr: 'RE-Nr.', angebotsnummer: 'Angebotsnr.', notiz: 'Notiz', status: 'Status' },
    icon: 'auftrag',
    category: 'Projektmanagement',
    permKey: 'auftrag'
  },
  {
    key: 'rechnung',
    table: 'rechnung',
    routePrefix: '/rechnung',
    labelField: 'rechnung_nr',
    searchFields: ['rechnung_nr', 'externe_angebotsnummer', 'status'],
    fieldLabels: { rechnung_nr: 'Rechnungsnr.', externe_angebotsnummer: 'Externe Angebotsnr.', status: 'Status' },
    icon: 'rechnung',
    category: 'Content & Strategie',
    permKey: 'rechnung'
  }
];

/** Cross-Referenzen: pro Quell-Entität welche verknüpften Entitäten nachladen (Phase 2). */
const CROSS_REF_CONFIG = {
  creator: [
    { targetKey: 'kooperation', type: 'fk', table: 'kooperationen', fk: 'creator_id', labelField: 'name' },
    { targetKey: 'kampagne', type: 'junction', junctionTable: 'kampagne_creator', sourceIdColumn: 'creator_id', targetIdColumn: 'kampagne_id', targetTable: 'kampagne', targetLabelField: 'kampagnenname' }
  ],
  unternehmen: [
    { targetKey: 'marke', type: 'fk', table: 'marke', fk: 'unternehmen_id', labelField: 'markenname' },
    { targetKey: 'auftrag', type: 'fk', table: 'auftrag', fk: 'unternehmen_id', labelField: 'auftragsname' },
    { targetKey: 'kampagne', type: 'fk', table: 'kampagne', fk: 'unternehmen_id', labelField: 'kampagnenname' },
    { targetKey: 'produkt', type: 'fk', table: 'produkt', fk: 'unternehmen_id', labelField: 'name' }
  ],
  marke: [
    { targetKey: 'kampagne', type: 'fk', table: 'kampagne', fk: 'marke_id', labelField: 'kampagnenname' },
    { targetKey: 'produkt', type: 'junction', junctionTable: 'produkt_marke', sourceIdColumn: 'marke_id', targetIdColumn: 'produkt_id', targetTable: 'produkt', targetLabelField: 'name' }
  ],
  ansprechpartner: [
    { targetKey: 'unternehmen', type: 'junction', junctionTable: 'ansprechpartner_unternehmen', sourceIdColumn: 'ansprechpartner_id', targetIdColumn: 'unternehmen_id', targetTable: 'unternehmen', targetLabelField: 'firmenname' },
    { targetKey: 'kampagne', type: 'junction', junctionTable: 'ansprechpartner_kampagne', sourceIdColumn: 'ansprechpartner_id', targetIdColumn: 'kampagne_id', targetTable: 'kampagne', targetLabelField: 'kampagnenname' }
  ],
  kampagne: [
    { targetKey: 'kooperation', type: 'fk', table: 'kooperationen', fk: 'kampagne_id', labelField: 'name' }
  ],
  auftrag: [
    { targetKey: 'kampagne', type: 'fk', table: 'kampagne', fk: 'auftrag_id', labelField: 'kampagnenname' }
  ]
};

/** Display-Config für Entitäten, die nur als Cross-Ref erscheinen (nicht in SEARCH_CONFIG). */
const REF_ENTITY_DISPLAY = {
  kooperation: { routePrefix: '/kooperation', icon: 'icon-handshake', category: 'Projektmanagement', permKey: 'kooperation' }
};

// Legacy-Keys ('icon-*') auf zentrale Icon-Keys mappen
const ICON_KEY_MAP = {
  'icon-users': 'users',
  'icon-building': 'unternehmen',
  'icon-tag': 'tag',
  'icon-user-circle': 'user-circle',
  'icon-cube': 'cube',
  'icon-campaign': 'campaign',
  'icon-briefcase': 'briefcase',
  'icon-currency-euro': 'document-currency',
  'icon-handshake': 'handshake',
  'icon-search': 'search',
};

function getSearchIcon(name) {
  const key = ICON_KEY_MAP[name] || name;
  return icon(key, { stroke: 1.5 });
}


function escapeIlike(q) {
  if (!q || typeof q !== 'string') return '';
  return q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** Escaped HTML für Anzeige in innerHTML (XSS-Schutz). */
function escapeHtml(str) {
  if (str == null || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getLabel(row, config) {
  const lf = config.labelField;
  if (Array.isArray(lf)) {
    return lf.map(f => (row[f] || '')).filter(Boolean).join(' ').trim() || '—';
  }
  return (row[lf] != null && row[lf] !== '') ? String(row[lf]) : '—';
}

function findMatchedField(row, config, query) {
  const q = query.trim().toLowerCase();
  for (const f of config.searchFields) {
    const v = row[f];
    if (v != null && String(v).toLowerCase().includes(q)) {
      const label = (config.fieldLabels && config.fieldLabels[f]) || f;
      return `${label}: ${v}`;
    }
  }
  return null;
}

function getDisplayForTargetKey(targetKey) {
  const fromSearch = SEARCH_CONFIG.find((c) => c.key === targetKey);
  if (fromSearch) {
    return {
      routePrefix: fromSearch.routePrefix, buildRoute: fromSearch.buildRoute,
      icon: fromSearch.icon, category: fromSearch.category, permKey: fromSearch.permKey
    };
  }
  return REF_ENTITY_DISPLAY[targetKey] || null;
}

/**
 * Route zu einem Treffer. Entitaeten ohne eigene Detailroute (Produkte) liefern
 * ihre Route ueber buildRoute und fallen ohne Elterndaten auf null zurueck -
 * solche Treffer werden verworfen statt auf eine tote URL zu zeigen.
 */
function buildResultRoute(config, row) {
  if (config.buildRoute) return config.buildRoute(row);
  return config.routePrefix ? `${config.routePrefix}/${row.id}` : null;
}

function getTargetLabel(row, labelField) {
  if (Array.isArray(labelField)) {
    return labelField.map((f) => row[f] || '').filter(Boolean).join(' ').trim() || '—';
  }
  return (row[labelField] != null && row[labelField] !== '') ? String(row[labelField]) : '—';
}

export class GlobalSearch {
  constructor() {
    this.container = null;
    this.overlay = null;
    this.input = null;
    this.resultsContainer = null;
    this.results = [];
    this.selectedIndex = -1;
    this.debounceTimer = null;
    this.boundKeydown = this.handleKeydown.bind(this);
    this.boundClickOverlay = (e) => { if (e.target === this.overlay) this.close(); };
    /** @type {Object<string, string[]|null>|null} Cache für erlaubte IDs pro Entity (null = kein Filter nötig) */
    this._allowedIdsCache = null;
    /** @type {Promise|null} */
    this._allowedIdsCachePromise = null;
  }

  /** Nur Mitarbeiter und Admin dürfen die Suche nutzen. */
  isAllowed() {
    return window.canUseGlobalSearch();
  }

  canViewEntity(permKey) {
    if (window.isAdmin()) return true;
    const perms = window.permissionSystem?.getEntityPermissions(permKey);
    return !!perms?.can_view;
  }

  /** Prüft ob der aktuelle User Admin ist. */
  _isAdmin() {
    return window.isAdmin();
  }

  /**
   * Lädt alle erlaubten IDs für Mitarbeiter und speichert sie im Cache.
   * Für Admins wird kein Cache gesetzt (= keine Filterung).
   */
  async _loadAllowedIdsForMitarbeiter() {
    if (window.isAdmin()) {
      this._allowedIdsCache = null;
      return;
    }

    if (!window.isInternal()) {
      this._allowedIdsCache = null;
      return;
    }

    try {
      // Phase 1: Basis-IDs parallel laden
      const [unternehmenIds, markenIds, kampagneIds] = await Promise.all([
        window.permissionSystem?.getAllowedUnternehmenIds?.() ?? [],
        window.permissionSystem?.getAllowedMarkenIds?.() ?? [],
        KampagneUtils.loadAllowedKampagneIds()
      ]);

      // Phase 2: Abgeleitete IDs parallel laden
      const [ansprechpartnerIds, produktIds, rechnungIds] = await Promise.all([
        this._loadAllowedAnsprechpartnerIds(unternehmenIds, markenIds),
        this._loadAllowedProduktIds(unternehmenIds, markenIds),
        this._loadAllowedRechnungIds(kampagneIds, unternehmenIds)
      ]);

      this._allowedIdsCache = {
        creator: null,          // Creators: keine Einschränkung
        unternehmen: unternehmenIds ?? [],
        marke: markenIds ?? [],
        kampagne: kampagneIds ?? [],
        auftrag: [],            // Aufträge: IMMER gesperrt für Mitarbeiter
        ansprechpartner: ansprechpartnerIds,
        produkt: produktIds,
        rechnung: rechnungIds
      };
    } catch (error) {
      console.error('GlobalSearch: Fehler beim Laden der erlaubten IDs:', error);
      // Sicherheits-Fallback: Alles sperren außer Creator
      this._allowedIdsCache = {
        creator: null,
        unternehmen: [],
        marke: [],
        kampagne: [],
        auftrag: [],
        ansprechpartner: [],
        produkt: [],
        rechnung: []
      };
    }
  }

  /** Ansprechpartner-IDs basierend auf erlaubten Unternehmen + Marken laden. */
  async _loadAllowedAnsprechpartnerIds(unternehmenIds, markenIds) {
    try {
      const ids = new Set();
      const promises = [];

      if (Array.isArray(unternehmenIds) && unternehmenIds.length > 0) {
        promises.push(
          window.supabase
            .from('ansprechpartner_unternehmen')
            .select('ansprechpartner_id')
            .in('unternehmen_id', unternehmenIds)
            .then(({ data }) => (data || []).forEach(r => { if (r.ansprechpartner_id) ids.add(r.ansprechpartner_id); }))
        );
      }

      if (Array.isArray(markenIds) && markenIds.length > 0) {
        promises.push(
          window.supabase
            .from('ansprechpartner_marke')
            .select('ansprechpartner_id')
            .in('marke_id', markenIds)
            .then(({ data }) => (data || []).forEach(r => { if (r.ansprechpartner_id) ids.add(r.ansprechpartner_id); }))
        );
      }

      await Promise.all(promises);
      return [...ids];
    } catch (error) {
      console.warn('GlobalSearch: Fehler bei Ansprechpartner-IDs:', error);
      return [];
    }
  }

  /**
   * Produkt-IDs aus erlaubten Unternehmen und Marken laden.
   * unternehmen_id ist der Besitzer, die Marken-Zuordnung steht in produkt_marke.
   */
  async _loadAllowedProduktIds(unternehmenIds, markenIds) {
    try {
      const ohneUnternehmenFilter = !Array.isArray(unternehmenIds);
      const ohneMarkenFilter = !Array.isArray(markenIds);
      if (ohneUnternehmenFilter && ohneMarkenFilter) return null; // keine Filterung

      const ids = new Set();
      const promises = [];

      if (Array.isArray(unternehmenIds) && unternehmenIds.length > 0) {
        promises.push(
          window.supabase
            .from('produkt')
            .select('id')
            .in('unternehmen_id', unternehmenIds)
            .then(({ data }) => (data || []).forEach(r => ids.add(r.id)))
        );
      }

      if (Array.isArray(markenIds) && markenIds.length > 0) {
        promises.push(
          window.supabase
            .from('produkt_marke')
            .select('produkt_id')
            .in('marke_id', markenIds)
            .then(({ data }) => (data || []).forEach(r => { if (r.produkt_id) ids.add(r.produkt_id); }))
        );
      }

      await Promise.all(promises);
      return [...ids];
    } catch (error) {
      console.warn('GlobalSearch: Fehler bei Produkt-IDs:', error);
      return [];
    }
  }

  /** Rechnung-IDs basierend auf erlaubten Kampagnen + Unternehmen laden. */
  async _loadAllowedRechnungIds(kampagneIds, unternehmenIds) {
    try {
      const ids = new Set();
      const promises = [];

      if (Array.isArray(kampagneIds) && kampagneIds.length > 0) {
        promises.push(
          window.supabase
            .from('rechnung')
            .select('id')
            .in('kampagne_id', kampagneIds)
            .then(({ data }) => (data || []).forEach(r => ids.add(r.id)))
        );
      }

      if (Array.isArray(unternehmenIds) && unternehmenIds.length > 0) {
        promises.push(
          window.supabase
            .from('rechnung')
            .select('id')
            .in('unternehmen_id', unternehmenIds)
            .then(({ data }) => (data || []).forEach(r => ids.add(r.id)))
        );
      }

      await Promise.all(promises);
      return [...ids];
    } catch (error) {
      console.warn('GlobalSearch: Fehler bei Rechnung-IDs:', error);
      return [];
    }
  }

  sourceKeyToLabel(key) {
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  async loadCrossRefs(directResults) {
    if (!window.supabase || directResults.length === 0) return [];
    const isAdmin = this._isAdmin();
    const byKey = {};
    directResults.forEach((r) => {
      if (!byKey[r.key]) byKey[r.key] = [];
      byKey[r.key].push({ id: r.id, label: r.label, route: r.route });
    });

    const all = [];
    for (const sourceKey of Object.keys(CROSS_REF_CONFIG)) {
      // Auftrags-Quellen für Nicht-Admins komplett überspringen
      if (!isAdmin && sourceKey === 'auftrag') continue;

      const refs = CROSS_REF_CONFIG[sourceKey];
      const sourceItems = (byKey[sourceKey] || []).slice(0, 5);
      if (sourceItems.length === 0) continue;
      const sourceIds = sourceItems.map((i) => i.id);
      const sourceLabelById = Object.fromEntries(sourceItems.map((i) => [i.id, i.label]));
      const sourceTypeLabel = this.sourceKeyToLabel(sourceKey);

      for (const ref of refs) {
        // Auftrags-Ziele für Nicht-Admins komplett überspringen
        if (!isAdmin && ref.targetKey === 'auftrag') continue;

        const display = getDisplayForTargetKey(ref.targetKey);
        if (!display || !this.canViewEntity(display.permKey)) continue;

        // Daten-Level: Prüfen ob Target-Entität überhaupt erlaubte IDs hat
        if (this._allowedIdsCache) {
          const allowedIds = this._allowedIdsCache[ref.targetKey];
          if (Array.isArray(allowedIds) && allowedIds.length === 0) continue;
        }

        try {
          if (ref.type === 'fk') {
            const selectFields = ['id', ref.labelField, ref.fk].filter((f, i, a) => a.indexOf(f) === i);
            let crossQuery = window.supabase
              .from(ref.table)
              .select(selectFields.join(','))
              .in(ref.fk, sourceIds)
              .limit(CROSS_REF_LIMIT_PER_TYPE);

            // Allowed-IDs-Filter für Cross-Refs
            if (this._allowedIdsCache) {
              const allowedIds = this._allowedIdsCache[ref.targetKey];
              if (Array.isArray(allowedIds) && allowedIds.length > 0) {
                crossQuery = crossQuery.in('id', allowedIds);
              }
            }

            const { data: rows, error } = await crossQuery;
            if (error) throw error;
            for (const row of (rows || [])) {
              const route = buildResultRoute(display, row);
              if (!route) continue;
              const viaLabel = sourceLabelById[row[ref.fk]] != null ? `via ${sourceTypeLabel} ${sourceLabelById[row[ref.fk]]}` : '';
              all.push({
                id: row.id,
                label: getTargetLabel(row, ref.labelField),
                sublabel: '',
                route,
                icon: display.icon,
                category: display.category,
                key: ref.targetKey,
                viaLabel,
                isCrossRef: true
              });
            }
          } else if (ref.type === 'junction') {
            const { data: jRows, error: jErr } = await window.supabase
              .from(ref.junctionTable)
              .select(`${ref.sourceIdColumn},${ref.targetIdColumn}`)
              .in(ref.sourceIdColumn, sourceIds)
              .limit(CROSS_REF_LIMIT_PER_TYPE);
            if (jErr || !jRows?.length) continue;
            let targetIds = [...new Set(jRows.map((r) => r[ref.targetIdColumn]))];

            // Allowed-IDs-Filter für Junction-Cross-Refs
            if (this._allowedIdsCache) {
              const allowedIds = this._allowedIdsCache[ref.targetKey];
              if (Array.isArray(allowedIds)) {
                const allowedSet = new Set(allowedIds);
                targetIds = targetIds.filter(id => allowedSet.has(id));
              }
            }
            if (targetIds.length === 0) continue;

            const { data: targetRows, error: tErr } = await window.supabase
              .from(ref.targetTable)
              .select(`id,${ref.targetLabelField}`)
              .in('id', targetIds);
            if (tErr || !targetRows?.length) continue;
            const targetById = Object.fromEntries(targetRows.map((r) => [r.id, r]));
            for (const j of jRows) {
              const target = targetById[j[ref.targetIdColumn]];
              if (!target) continue;
              const route = buildResultRoute(display, target);
              if (!route) continue;
              const viaLabel = sourceLabelById[j[ref.sourceIdColumn]] != null ? `via ${sourceTypeLabel} ${sourceLabelById[j[ref.sourceIdColumn]]}` : '';
              all.push({
                id: target.id,
                label: getTargetLabel(target, ref.targetLabelField),
                sublabel: '',
                route,
                icon: display.icon,
                category: display.category,
                key: ref.targetKey,
                viaLabel,
                isCrossRef: true
              });
            }
          }
        } catch (err) {
          console.warn('GlobalSearch loadCrossRefs:', sourceKey, ref.targetKey, err);
        }
      }
    }
    return all.slice(0, CROSS_REF_LIMIT_TOTAL);
  }

  open() {
    if (!this.isAllowed()) return;
    if (!this.container) this.render();
    this.container.classList.add('global-search-visible');
    this.overlay.classList.add('global-search-visible');
    this.results = [];
    this.selectedIndex = -1;
    this._loading = false;
    this.renderResults([]);
    if (this.input) {
      this.input.value = '';
      this.input.focus();
    }
    document.addEventListener('keydown', this.boundKeydown);
    this.overlay.addEventListener('click', this.boundClickOverlay);

    // Cache zurücksetzen und erlaubte IDs vorladen (wird in runSearch() awaitet)
    this._allowedIdsCache = null;
    this._allowedIdsCachePromise = this._loadAllowedIdsForMitarbeiter();
  }

  close() {
    if (!this.container) return;
    this.container.classList.remove('global-search-visible');
    this.overlay.classList.remove('global-search-visible');
    document.removeEventListener('keydown', this.boundKeydown);
    this.overlay.removeEventListener('click', this.boundClickOverlay);
  }

  handleKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      return;
    }
    if (!this.container?.classList.contains('global-search-visible')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.results.length - 1);
      this.highlightSelected();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
      this.highlightSelected();
      return;
    }
    if (e.key === 'Enter' && this.selectedIndex >= 0 && this.results[this.selectedIndex]) {
      e.preventDefault();
      this.navigateToResult(this.results[this.selectedIndex]);
      return;
    }
  }

  highlightSelected() {
    const items = this.resultsContainer?.querySelectorAll('.global-search-result-item');
    if (!items) return;
    const sel = String(this.selectedIndex);
    items.forEach((el) => el.classList.toggle('global-search-result-item-active', el.dataset.index === sel));
  }

  navigateToResult(item) {
    const route = item.route;
    this.close();
    if (typeof window.navigateTo === 'function') window.navigateTo(route);
  }

  runSearch(query) {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      this.results = [];
      this._loading = false;
      this.renderResults([]);
      return;
    }
    if (!window.supabase) {
      this.results = [];
      this._loading = false;
      this.renderResults([]);
      return;
    }
    this._searchRequestId = (this._searchRequestId || 0) + 1;
    const requestId = this._searchRequestId;
    this._loading = true;
    this.renderResults([]);

    const isAdmin = this._isAdmin();

    // Warte auf den Cache (wird in open() gestartet)
    const cacheReady = this._allowedIdsCachePromise || Promise.resolve();

    cacheReady.then(() => {
      // Basis-Filterung: nur Entitäten mit can_view
      let configs = SEARCH_CONFIG.filter(c => this.canViewEntity(c.permKey));
      // Aufträge HART ausfiltern für Nicht-Admins (unabhängig von Permission-Overrides)
      if (!isAdmin) {
        configs = configs.filter(c => c.key !== 'auftrag');
      }

      const tokens = q.split(/\s+/).filter((t) => t.length >= 2);

      const promises = configs.map(async (config) => {
        const selectFields = [...new Set(['id', ...config.searchFields, ...(config.routeFields || [])])];
        try {
          // Daten-Level-Filter: Erlaubte IDs prüfen
          if (this._allowedIdsCache) {
            const allowedIds = this._allowedIdsCache[config.key];
            if (Array.isArray(allowedIds) && allowedIds.length === 0) {
              return { config, rows: [] }; // Kein Zugriff auf diese Entität
            }
          }

          let dbQuery = window.supabase
            .from(config.table)
            .select(selectFields.join(','))
            .limit(SEARCH_LIMIT);

          // Allowed-IDs-Filter zur Query hinzufügen
          if (this._allowedIdsCache) {
            const allowedIds = this._allowedIdsCache[config.key];
            if (Array.isArray(allowedIds) && allowedIds.length > 0) {
              dbQuery = dbQuery.in('id', allowedIds);
            }
          }

          if (tokens.length <= 1) {
            const pattern = `%${escapeIlike(tokens.length === 1 ? tokens[0] : q)}%`;
            const orClause = config.searchFields.map((f) => `${f}.ilike.${pattern}`).join(',');
            dbQuery = dbQuery.or(orClause);
          } else {
            for (const token of tokens) {
              const pattern = `%${escapeIlike(token)}%`;
              const orClause = config.searchFields.map((f) => `${f}.ilike.${pattern}`).join(',');
              dbQuery = dbQuery.or(orClause);
            }
          }
          const { data, error } = await dbQuery;
          if (error) throw error;
          return { config, rows: data || [] };
        } catch (err) {
          console.warn('GlobalSearch:', config.key, err);
          return { config, rows: [] };
        }
      });

      Promise.allSettled(promises).then(async (outcomes) => {
        if (requestId !== this._searchRequestId) return;
        this._loading = false;
        const flat = [];
        outcomes.forEach((out) => {
          if (out.status !== 'fulfilled' || !out.value) return;
          const { config, rows } = out.value;
          rows.forEach((row) => {
            const route = buildResultRoute(config, row);
            if (!route) return;
            const label = getLabel(row, config);
            const sublabel = findMatchedField(row, config, q);
            flat.push({
              id: row.id,
              label,
              sublabel: sublabel || '',
              route,
              icon: config.icon,
              category: config.category,
              key: config.key,
              isCrossRef: false
            });
          });
        });

        const crossRefItems = await this.loadCrossRefs(flat);
        const directRoutes = new Set(flat.map((r) => r.route));
        const deduped = crossRefItems.filter((it) => !directRoutes.has(it.route));
        this.results = flat.concat(deduped);
        this.selectedIndex = -1;
        this.renderResults(this.results);
        this.highlightSelected();
      });
    });
  }

  onInput() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.runSearch(this.input?.value || '');
    }, DEBOUNCE_MS);
  }

  render() {
    const appRoot = document.getElementById('app-root');
    if (!appRoot) return;

    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const shortcut = isMac ? '⌘K' : 'Strg+K';

    this.overlay = document.createElement('div');
    this.overlay.className = 'global-search-overlay';
    this.overlay.setAttribute('aria-hidden', 'true');

    this.container = document.createElement('div');
    this.container.className = 'global-search-modal';
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-label', 'Globale Suche');
    this.container.innerHTML = `
      <div class="global-search-input-wrap">
        <span class="global-search-input-icon" aria-hidden="true">${getSearchIcon('icon-search')}</span>
        <input type="text" class="global-search-input" placeholder="Suchen nach Namen, Stadt, E-Mail, …" autocomplete="off" aria-label="Suchbegriff" />
        <span class="global-search-shortcut">${shortcut}</span>
      </div>
      <div class="global-search-results" role="listbox"></div>
      <div class="global-search-footer">
        <span>↑ ↓ Navigieren</span>
        <span>Enter Auswählen</span>
        <span>Esc Schließen</span>
      </div>
    `;

    this.input = this.container.querySelector('.global-search-input');
    this.resultsContainer = this.container.querySelector('.global-search-results');

    this.input.addEventListener('input', () => this.onInput());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') e.preventDefault();
    });

    appRoot.appendChild(this.overlay);
    appRoot.appendChild(this.container);

    this.resultsContainer.addEventListener('click', (e) => {
      const item = e.target.closest('.global-search-result-item');
      if (!item || item.dataset.index === undefined) return;
      const idx = parseInt(item.dataset.index, 10);
      if (!Number.isNaN(idx) && this.results[idx]) this.navigateToResult(this.results[idx]);
    });
  }

  renderResults(items) {
    if (!this.resultsContainer) return;
    if (items.length === 0) {
      if (this._loading) {
        this.resultsContainer.innerHTML = '<div class="global-search-empty">Suche …</div>';
        return;
      }
      const q = (this.input?.value || '').trim();
      if (q.length < MIN_QUERY_LENGTH) {
        this.resultsContainer.innerHTML = '<div class="global-search-empty">Tippe mindestens 2 Zeichen, um zu suchen …</div>';
      } else {
        this.resultsContainer.innerHTML = '<div class="global-search-empty">Keine Ergebnisse gefunden.</div>';
      }
      return;
    }
    const direct = items.filter((it) => !it.isCrossRef);
    const crossRef = items.filter((it) => it.isCrossRef === true);

    const byCategory = {};
    direct.forEach((it) => {
      if (!byCategory[it.category]) byCategory[it.category] = [];
      byCategory[it.category].push(it);
    });
    const order = ['Stammdaten', 'Projektmanagement', 'Content & Strategie'];
    let html = '';
    order.forEach((cat) => {
      const list = byCategory[cat];
      if (!list || list.length === 0) return;
      html += `<div class="global-search-category">${escapeHtml(cat)}</div>`;
      list.forEach((it) => {
        const globalIndex = this.results.indexOf(it);
        const sub = it.sublabel ? `<div class="global-search-result-sublabel">${escapeHtml(it.sublabel)}</div>` : '';
        html += `
          <div class="global-search-result-item" role="option" data-index="${globalIndex}" data-route="${escapeHtml(it.route)}">
            <span class="global-search-result-icon">${getSearchIcon(it.icon) || ''}</span>
            <div class="global-search-result-text">
              <div class="global-search-result-label">${escapeHtml(it.label)}</div>
              ${sub}
            </div>
          </div>`;
      });
    });

    if (crossRef.length > 0) {
      html += `<div class="global-search-category global-search-category-related">${escapeHtml('Verknüpfte Ergebnisse')}</div>`;
      crossRef.forEach((it) => {
        const globalIndex = this.results.indexOf(it);
        const viaHtml = it.viaLabel ? `<div class="global-search-result-via">${escapeHtml(it.viaLabel)}</div>` : '';
        const sub = it.sublabel ? `<div class="global-search-result-sublabel">${escapeHtml(it.sublabel)}</div>` : '';
        html += `
          <div class="global-search-result-item" role="option" data-index="${globalIndex}" data-route="${escapeHtml(it.route)}">
            <span class="global-search-result-icon">${getSearchIcon(it.icon) || ''}</span>
            <div class="global-search-result-text">
              <div class="global-search-result-label">${escapeHtml(it.label)}</div>
              ${viaHtml}
              ${sub}
            </div>
          </div>`;
      });
    }
    this.resultsContainer.innerHTML = html;
  }

  destroy() {
    clearTimeout(this.debounceTimer);
    this.close();
    this.overlay?.remove();
    this.container?.remove();
    this.overlay = null;
    this.container = null;
    this.input = null;
    this.resultsContainer = null;
  }
}

export const globalSearch = new GlobalSearch();
