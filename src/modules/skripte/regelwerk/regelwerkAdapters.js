// regelwerkAdapters.js
// Unterschiede DNA vs. Master: Pfade, Meta, Service. Liste und Detail
// teilen sich diese Adapter, keine zweite UI-Kopie.

import { skripteService, DNA_LAYER, MASTER_BEREICHE } from '../SkripteService.js';
import { escapeHtml, formatDate, badge } from '../SkripteUtils.js';

export const STATUS_VARIANT = { entwurf: 'info', aktiv: 'success', archiviert: 'neutral' };

function dnaScopeLabel(doc) {
  if (doc.layer_typ === 'global') return 'Global';
  if (doc.layer_typ === 'branche') return `Branche: ${doc.branchen?.name || '?'}`;
  if (doc.layer_typ === 'zielgruppe') return `Persona: ${skripteService.personaLabel(doc.personas) || '?'}`;
  if (doc.layer_typ === 'marke') return `Marke: ${doc.marke?.markenname || '?'}`;
  return doc.layer_typ;
}

function optionenHtml(items, { id, label }) {
  return '<option value="">– Wählen –</option>'
    + items.map((item) => `<option value="${escapeHtml(item[id])}">${escapeHtml(item[label])}</option>`).join('');
}

export const dnaAdapter = {
  kind: 'dna',
  listPath: '/skripte/dna',
  label: 'DNA',
  headline: 'Skript-DNA',
  neuLabel: 'DNA anlegen',
  titlePlaceholder: 'Name der DNA',
  bodyPlaceholder: '# Regeln für diesen Layer\n## Hook\n- …',
  columns: ['Name', 'Layer', 'Scope', 'Version', 'Status', 'Freigegeben', 'Erstellt'],

  loadAll() { return skripteService.loadDnaDokumente(); },
  loadOne(id) { return skripteService.loadDna(id); },
  create(payload) { return skripteService.createDna(payload); },
  update(id, patch) { return skripteService.updateDna(id, patch); },
  activate(doc) { return skripteService.aktiviereDna(doc); },
  archive(id) { return skripteService.updateDna(id, { status: 'archiviert' }); },

  titleOf(doc) { return doc?.name || `DNA v${doc?.version || 1}`; },
  scopeLabel: dnaScopeLabel,

  rowCells(doc) {
    return [
      escapeHtml(doc.name || '–'),
      badge(DNA_LAYER[doc.layer_typ] || doc.layer_typ, 'info'),
      escapeHtml(dnaScopeLabel(doc)),
      `v${doc.version}`,
      badge(doc.status, STATUS_VARIANT[doc.status]),
      doc.freigegeben_am ? formatDate(doc.freigegeben_am) : '–',
      formatDate(doc.created_at)
    ];
  },

  metaBadgesHtml(doc) {
    return [
      badge(DNA_LAYER[doc.layer_typ] || doc.layer_typ, 'info'),
      badge(dnaScopeLabel(doc)),
      badge(`v${doc.version}`),
      badge(doc.status, STATUS_VARIANT[doc.status])
    ].join('');
  },

  async loadMetaOptions() {
    const [marken, branchen, personas] = await Promise.all([
      skripteService.loadMarken(),
      skripteService.loadBranchen(),
      skripteService.loadPersonas()
    ]);
    return { marken, branchen, personas };
  },

  metaFormHtml() {
    return `
      <div class="form-group">
        <label class="form-label" for="rw-layer">Layer *</label>
        <select id="rw-layer" class="form-input">
          ${Object.entries(DNA_LAYER).map(([v, l]) => `<option value="${v}">${escapeHtml(l)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" id="rw-scope-wrap" hidden>
        <label class="form-label" for="rw-scope">Scope *</label>
        <select id="rw-scope" class="form-input"></select>
      </div>
    `;
  },

  bindMetaForm(root, options) {
    const layerEl = root.querySelector('#rw-layer');
    const fillScope = () => {
      const layer = layerEl?.value;
      const wrap = root.querySelector('#rw-scope-wrap');
      const select = root.querySelector('#rw-scope');
      if (!wrap || !select) return;
      if (layer === 'global') {
        wrap.hidden = true;
        select.innerHTML = '';
        return;
      }
      wrap.hidden = false;
      const items = layer === 'branche'
        ? (options.branchen || []).map((b) => ({ id: b.id, label: b.name }))
        : layer === 'zielgruppe'
          ? (options.personas || []).map((p) => ({ id: p.id, label: skripteService.personaLabel(p) || p.name }))
          : (options.marken || []).map((m) => ({ id: m.id, label: m.markenname }));
      select.innerHTML = optionenHtml(items, { id: 'id', label: 'label' });
    };
    layerEl?.addEventListener('change', fillScope);
    fillScope();
  },

  readMeta(root) {
    const layer = root.querySelector('#rw-layer')?.value || 'global';
    const scope = root.querySelector('#rw-scope')?.value || null;
    return {
      layer_typ: layer,
      branche_id: layer === 'branche' ? scope : null,
      persona_id: layer === 'zielgruppe' ? scope : null,
      marke_id: layer === 'marke' ? scope : null
    };
  },

  metaGueltig(meta) {
    if (!meta?.layer_typ) return false;
    if (meta.layer_typ === 'global') return true;
    return Boolean(meta.branche_id || meta.persona_id || meta.marke_id);
  },

  metaFehler() { return 'Layer und Scope wählen'; }
};

export const masterAdapter = {
  kind: 'master',
  listPath: '/skripte/master',
  label: 'Master-Regelwerk',
  headline: 'Skript-Master',
  neuLabel: 'Neue Version anlegen',
  titlePlaceholder: 'Name des Master-Dokuments',
  bodyPlaceholder: '# Regeln für diesen Bereich',
  columns: ['Name', 'Bereich', 'Version', 'Status', 'Freigegeben', 'Erstellt'],

  loadAll() { return skripteService.loadMasterDokumente(); },
  loadOne(id) { return skripteService.loadMaster(id); },
  create(payload) { return skripteService.createMaster(payload); },
  update(id, patch) { return skripteService.updateMaster(id, patch); },
  activate(doc) { return skripteService.aktiviereMaster(doc); },
  archive(id) { return skripteService.updateMaster(id, { status: 'archiviert' }); },

  titleOf(doc) { return doc?.name || MASTER_BEREICHE[doc?.bereich] || 'Master'; },
  scopeLabel(doc) { return MASTER_BEREICHE[doc.bereich] || doc.bereich; },

  rowCells(doc) {
    return [
      escapeHtml(doc.name || '–'),
      badge(MASTER_BEREICHE[doc.bereich] || doc.bereich, 'info'),
      `v${doc.version}`,
      badge(doc.status, STATUS_VARIANT[doc.status]),
      doc.freigegeben_am ? formatDate(doc.freigegeben_am) : '–',
      formatDate(doc.created_at)
    ];
  },

  metaBadgesHtml(doc) {
    return [
      badge(MASTER_BEREICHE[doc.bereich] || doc.bereich, 'info'),
      badge(`v${doc.version}`),
      badge(doc.status, STATUS_VARIANT[doc.status])
    ].join('');
  },

  async loadMetaOptions() { return {}; },

  metaFormHtml() {
    return `
      <div class="form-group">
        <label class="form-label" for="rw-bereich">Bereich *</label>
        <select id="rw-bereich" class="form-input">
          ${Object.entries(MASTER_BEREICHE).map(([v, l]) => `<option value="${v}">${escapeHtml(l)}</option>`).join('')}
        </select>
      </div>
    `;
  },

  bindMetaForm() {},

  readMeta(root) {
    return { bereich: root.querySelector('#rw-bereich')?.value || 'basis' };
  },

  metaGueltig(meta) { return Boolean(meta?.bereich); },
  metaFehler() { return 'Bereich wählen'; }
};

export function adapterFor(kind) {
  if (kind === 'master') return masterAdapter;
  return dnaAdapter;
}
