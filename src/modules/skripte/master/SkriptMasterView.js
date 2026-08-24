// SkriptMasterView.js
// Master-Regelwerk verwalten: Docs reviewen/editieren, freigeben
// (aktiviert, archiviert Vorgaenger desselben Bereichs), neue Version anlegen.

import { skripteService, MASTER_BEREICHE } from '../SkripteService.js';
import { escapeHtml, formatDate, badge } from '../SkripteUtils.js';
import { createSkriptDrawer, removeSkriptDrawer } from '../SkriptDrawer.js';

const STATUS_VARIANT = { entwurf: 'info', aktiv: 'success', archiviert: 'neutral' };
const DRAWER_ID = 'skripte-master-drawer';

export class SkriptMasterView {
  constructor() {
    this.dokumente = [];
  }

  async render(container) {
    container.innerHTML = `
      <div class="skripte-actions-row u-mb-md">
        <button id="master-neu-btn" class="mdc-btn mdc-btn--secondary">Neue Version anlegen</button>
        <span class="skripte-hint">Basis + Owned / Paid / Influencer. Freigabe aktiviert die Version und archiviert die bisher aktive desselben Bereichs.</span>
      </div>
      <div id="master-wrap"></div>
    `;
    container.querySelector('#master-neu-btn').addEventListener('click', () => this.openNeuDrawer());
    await this.reload();
  }

  async reload() {
    this.dokumente = await skripteService.loadMasterDokumente();
    this.renderListe();
  }

  renderListe() {
    const wrap = document.getElementById('master-wrap');
    if (!wrap) return;

    if (!this.dokumente.length) {
      wrap.innerHTML = `<div class="empty-state"><p>Noch keine Master-Dokumente.</p></div>`;
      return;
    }

    wrap.innerHTML = `
      <table class="skripte-table">
        <thead>
          <tr><th>Name</th><th>Bereich</th><th>Version</th><th>Status</th><th>Freigegeben</th><th>Erstellt</th><th></th></tr>
        </thead>
        <tbody>
          ${this.dokumente.map((d) => `
            <tr data-id="${d.id}">
              <td class="skripte-table-titel">${escapeHtml(d.name || '–')}</td>
              <td>${badge(MASTER_BEREICHE[d.bereich] || d.bereich, 'info')}</td>
              <td>v${d.version}</td>
              <td>${badge(d.status, STATUS_VARIANT[d.status])}</td>
              <td>${d.freigegeben_am ? formatDate(d.freigegeben_am) : '–'}</td>
              <td>${formatDate(d.created_at)}</td>
              <td><button class="mdc-btn mdc-btn--secondary master-row-open">Öffnen</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    wrap.querySelectorAll('.master-row-open').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('tr').dataset.id;
        const doc = this.dokumente.find((d) => d.id === id);
        if (doc) this.openDetailDrawer(doc);
      });
    });
  }

  openDetailDrawer(doc) {
    const body = `
      <div class="skripte-detail-meta">
        ${badge(MASTER_BEREICHE[doc.bereich] || doc.bereich, 'info')}
        ${badge(`v${doc.version}`)}
        ${badge(doc.status, STATUS_VARIANT[doc.status])}
      </div>
      <p class="skripte-hint">Inhalt vor der Freigabe reviewen und bei Bedarf direkt editieren.
      "Freigeben" aktiviert diese Version und archiviert die bisher aktive desselben Bereichs.</p>
      <div class="form-group">
        <label class="form-label">Name</label>
        <input id="master-name" class="form-input" type="text" value="${escapeHtml(doc.name || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">Inhalt (Markdown)</label>
        <textarea id="master-inhalt" class="form-input skripte-dna-editor" rows="22">${escapeHtml(doc.inhalt)}</textarea>
      </div>
    `;

    const readForm = () => ({
      name: document.getElementById('master-name').value.trim() || null,
      inhalt: document.getElementById('master-inhalt').value
    });

    const buttons = [];
    if (doc.status !== 'archiviert') {
      buttons.push({ label: 'Archivieren', onClick: async () => {
        await skripteService.updateMaster(doc.id, { status: 'archiviert' });
        window.toastSystem?.success('Archiviert');
        await this.reload();
        return true;
      } });
    }
    buttons.push({ label: 'Speichern', onClick: async () => {
      try {
        await skripteService.updateMaster(doc.id, readForm());
        window.toastSystem?.success('Gespeichert');
        await this.reload();
        return true;
      } catch (err) {
        window.toastSystem?.error(err.message);
        return false;
      }
    } });
    if (doc.status !== 'aktiv') {
      buttons.push({ label: 'Freigeben & aktivieren', primary: true, onClick: async () => {
        try {
          await skripteService.updateMaster(doc.id, readForm());
          await skripteService.aktiviereMaster(doc);
          window.toastSystem?.success(`Master v${doc.version} ist jetzt aktiv`);
          await this.reload();
          return true;
        } catch (err) {
          window.toastSystem?.error(err.message);
          return false;
        }
      } });
    }

    createSkriptDrawer(DRAWER_ID, `${MASTER_BEREICHE[doc.bereich] || doc.bereich} v${doc.version}`, body, buttons);
  }

  openNeuDrawer() {
    const body = `
      <div class="form-group">
        <label class="form-label">Bereich *</label>
        <select id="mastern-bereich" class="form-input">
          ${Object.entries(MASTER_BEREICHE).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Name</label>
        <input id="mastern-name" class="form-input" type="text" placeholder="z.B. Owned Media v2" />
      </div>
      <div class="form-group">
        <label class="form-label">Inhalt (Markdown) *</label>
        <textarea id="mastern-inhalt" class="form-input skripte-dna-editor" rows="16"
          placeholder="# Regeln für diesen Bereich"></textarea>
      </div>
    `;

    createSkriptDrawer(DRAWER_ID, 'Master-Version anlegen', body, [
      { label: 'Als Entwurf speichern', primary: true, onClick: async () => {
        const bereich = document.getElementById('mastern-bereich').value;
        const inhalt = document.getElementById('mastern-inhalt').value.trim();
        if (!inhalt) {
          window.toastSystem?.error('Inhalt fehlt');
          return false;
        }
        const max = this.dokumente
          .filter((d) => d.bereich === bereich)
          .reduce((m, d) => Math.max(m, d.version || 0), 0);
        const { error } = await window.supabase.from('skript_master').insert({
          name: document.getElementById('mastern-name').value.trim() || MASTER_BEREICHE[bereich] || bereich,
          bereich,
          version: max + 1,
          inhalt,
          status: 'entwurf'
        });
        if (error) {
          window.toastSystem?.error(error.message);
          return false;
        }
        window.toastSystem?.success('Master-Entwurf angelegt');
        await this.reload();
        return true;
      } }
    ]);
  }

  cleanup() {
    removeSkriptDrawer(DRAWER_ID);
  }
}
