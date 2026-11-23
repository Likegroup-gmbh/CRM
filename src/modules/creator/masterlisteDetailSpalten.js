// Masterliste-Detail: Reihenfolge per Ziehen und sichtbare Spalten.

import { ANCHOR_COLUMNS, ANCHOR_LABELS, canManageMasterliste } from './masterliste.js';
import { renderSpalteHinzufuegen, renderSpaltenName } from '../../core/customColumns/tabelleSpaltenPflege.js';

export function installMasterlisteSpalten(proto) {
  Object.assign(proto, {
    bindRowDrag() {
      const tbody = document.getElementById('masterliste-body');
      if (!tbody) return;
      const signal = this._abortController?.signal;
      let dragged = null;

      tbody.querySelectorAll('tr[data-member-id]').forEach(row => {
        const handle = row.querySelector('.drag-handle');
        if (!handle) return;
        handle.addEventListener('mousedown', () => row.setAttribute('draggable', 'true'), { signal });
        row.addEventListener('dragstart', (event) => {
          dragged = row;
          row.classList.add('is-dragging');
          event.dataTransfer.effectAllowed = 'move';
        }, { signal });
        row.addEventListener('dragend', () => {
          row.classList.remove('is-dragging');
          row.setAttribute('draggable', 'false');
          dragged = null;
        }, { signal });
        row.addEventListener('dragover', (event) => {
          if (!dragged || dragged === row) return;
          event.preventDefault();
          const rect = row.getBoundingClientRect();
          const after = event.clientY > rect.top + rect.height / 2;
          tbody.insertBefore(dragged, after ? row.nextSibling : row);
        }, { signal });
        row.addEventListener('drop', (event) => {
          event.preventDefault();
          this.persistOrder();
        }, { signal });
      });
    },

    async persistOrder() {
      const tbody = document.getElementById('masterliste-body');
      if (!tbody) return;
      const ids = [...tbody.querySelectorAll('tr[data-member-id]')].map(row => row.dataset.memberId);
      const byId = new Map(this.members.map(member => [member.memberId, member]));
      this.members = ids.map((id, index) => {
        const member = byId.get(id);
        if (member) member.position = index;
        return member;
      }).filter(Boolean);

      const results = await Promise.all(ids.map((id, index) =>
        window.supabase.from('creator_list_member').update({ position: index }).eq('id', id)
      ));
      if (results.some(result => result.error)) {
        window.toastSystem?.show('Reihenfolge konnte nicht gespeichert werden.', 'error');
      }
    },

    openColumnsDrawer() {
      if (!canManageMasterliste()) return;
      this.closeDrawers(true);
      const overlay = document.createElement('div');
      overlay.className = 'drawer-overlay';
      overlay.id = 'masterliste-columns-overlay';
      const panel = document.createElement('div');
      panel.className = 'drawer-panel';
      panel.id = 'masterliste-columns-drawer';
      panel.setAttribute('role', 'dialog');

      const toggles = [
        ...ANCHOR_COLUMNS.map(key => ({ key, label: ANCHOR_LABELS[key] })),
        ...this.customColumns.getOrderedColumns().map(col => ({
          key: `custom:${col.id}`,
          label: col.name
        }))
      ];
      const rows = toggles.map(item => `
        <div class="sourcing-spalten-item">
          <span aria-hidden="true"></span>
          ${renderSpaltenName(item.label, item.key)}
          <label class="toggle-switch">
            <input type="checkbox" class="column-visibility-toggle" data-column="${item.key}" ${this.hidden.includes(item.key) ? '' : 'checked'}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      `).join('');
      panel.innerHTML = `
        <div class="drawer-header">
          <div>
            <span class="drawer-title">Tabelle anpassen</span>
            <p class="drawer-subtitle">Sichtbarkeit der Spalten, nur für diese Masterliste</p>
          </div>
          <div><button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button></div>
        </div>
        <div class="drawer-body">
          <h4 class="drawer-section-title">Spalten</h4>
          <div class="sourcing-spalten-kopf">
            <span class="sourcing-spalten-kopf-griff" aria-hidden="true"></span>
            <span>Spalte</span>
            <span class="sourcing-spalten-kopf-sichtbar">Sichtbar</span>
          </div>
          <div class="sourcing-spalten-liste">${rows}</div>
          ${renderSpalteHinzufuegen()}
          <p class="drawer-info-text">„Name“ und „Aktionen“ bleiben fest und können nicht ausgeblendet werden.</p>
          <div class="drawer-footer">
            <button type="button" class="mdc-btn" data-action="close-masterliste-columns">Fertig</button>
          </div>
        </div>
      `;
      const close = () => this.closeDrawers();
      overlay.addEventListener('click', close);
      panel.querySelector('.drawer-close-btn').addEventListener('click', close);
      panel.querySelector('[data-action="close-masterliste-columns"]').addEventListener('click', close);
      const bindToggles = () => {
        panel.querySelectorAll('.column-visibility-toggle').forEach(toggle => {
          toggle.addEventListener('change', () => {
            const shown = new Set([...panel.querySelectorAll('.column-visibility-toggle:checked')].map(input => input.dataset.column));
            const keys = [
              ...ANCHOR_COLUMNS,
              ...this.customColumns.getOrderedColumns().map(col => `custom:${col.id}`)
            ];
            const hidden = keys.filter(key => !shown.has(key));
            this.saveHidden(hidden, { close: false });
          });
        });
      };
      bindToggles();
      const body = panel.querySelector('.drawer-body');
      body.addEventListener('click', (event) => {
        const add = event.target.closest('[data-action="spalte-hinzufuegen"]');
        const edit = event.target.closest('[data-action="spalte-bearbeiten"]');
        if ((!add && !edit) || !body.contains(event.target)) return;
        event.preventDefault();
        this.customColumns.mountEditor(body, {
          columnId: edit ? edit.dataset.column : null,
          onChange: () => this.renderTable(),
          onBack: () => this.openColumnsDrawer()
        });
      });
      document.body.appendChild(overlay);
      document.body.appendChild(panel);
      requestAnimationFrame(() => panel.classList.add('show'));
    },

    async saveHidden(hidden, { close = true } = {}) {
      const { error } = await window.supabase
        .from('creator_list')
        .update({ hidden_columns: hidden })
        .eq('id', this.listId);
      if (error) {
        window.toastSystem?.show('Spalten konnten nicht gespeichert werden.', 'error');
        return;
      }
      this.hidden = hidden;
      this.list.hidden_columns = hidden;
      if (close) this.closeDrawers();
      this.renderTable();
    }
  });
}
