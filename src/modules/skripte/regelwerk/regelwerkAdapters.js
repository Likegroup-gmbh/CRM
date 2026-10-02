// regelwerkAdapters.js
// Regelwerk-Adapter (Master): Pfade, Meta, Service. Liste und Detail
// bekommen ihre Unterschiede ueber den Adapter, keine zweite UI-Kopie.

import { skripteService, MASTER_BEREICHE } from '../SkripteService.js';
import { escapeHtml, formatDate, badge } from '../SkripteUtils.js';

export const STATUS_VARIANT = { entwurf: 'info', aktiv: 'success', archiviert: 'neutral' };

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

export function adapterFor() {
  return masterAdapter;
}
