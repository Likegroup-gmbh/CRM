// SkriptRegelwerkList.js
// Gemeinsame Liste fuer DNA und Master. Oeffnen/Neu navigiert auf die Detailseite.

export class SkriptRegelwerkList {
  constructor(adapter) {
    this.adapter = adapter;
    this.dokumente = [];
    this.container = null;
  }

  async render(container) {
    this.container = container;
    container.innerHTML = `
      <div class="skripte-actions-row u-mb-md">
        <button type="button" class="mdc-btn" data-rw-neu>${this.adapter.neuLabel}</button>
      </div>
      <div data-rw-list></div>
    `;
    container.querySelector('[data-rw-neu]')?.addEventListener('click', () => {
      window.navigateTo(`${this.adapter.listPath}/new`);
    });
    await this.reload();
  }

  async reload() {
    this.dokumente = await this.adapter.loadAll();
    this.renderListe();
  }

  renderListe() {
    const wrap = this.container?.querySelector('[data-rw-list]');
    if (!wrap) return;

    if (!this.dokumente.length) {
      wrap.innerHTML = `<div class="empty-state"><p>Noch keine ${this.adapter.label}-Dokumente.</p></div>`;
      return;
    }

    wrap.innerHTML = `
      <table class="skripte-table regelwerk-list">
        <thead>
          <tr>${this.adapter.columns.map((c) => `<th>${c}</th>`).join('')}<th></th></tr>
        </thead>
        <tbody>
          ${this.dokumente.map((d) => `
            <tr data-id="${d.id}">
              ${this.adapter.rowCells(d).map((cell) => `<td>${cell}</td>`).join('')}
              <td><button type="button" class="mdc-btn mdc-btn--secondary" data-rw-open>Öffnen</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    wrap.querySelectorAll('tr[data-id]').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button') && !e.target.closest('[data-rw-open]')) return;
        window.navigateTo(`${this.adapter.listPath}/${row.dataset.id}`);
      });
    });
  }

  cleanup() {
    this.container = null;
    this.dokumente = [];
  }
}
