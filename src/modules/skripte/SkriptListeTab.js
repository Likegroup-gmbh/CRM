// SkriptListeTab.js
// Liste aller Skripte (generiert + historisch) + Import-Drawer fuer Backfill.
// Feedback (Score-Regler + Begruendung pro Sektion) wird im Skript-Editor
// gegeben (SkriptFeedbackDrawer), nicht mehr hier.

import { skripteService, PERFORMANCE_LABELS, FUNNEL_STUFEN } from './SkripteService.js';
import { escapeHtml, formatDate, badge, PERFORMANCE_BADGE_VARIANT, STATUS_LABELS } from './SkripteUtils.js';

export class SkriptListeTab {
  constructor(page) {
    this.page = page;
    this.skripte = [];
    this.marken = [];
    this.branchen = [];
    this.brancheFilter = '';
  }

  async render(container) {
    container.innerHTML = `
      <div class="skripte-actions-row" style="margin-bottom: var(--space-md);">
        <button id="liste-import-btn" class="secondary-btn">Historisches Skript importieren</button>
        <select id="liste-branche-filter" class="form-input" style="width:auto;">
          <option value="">Alle Branchen</option>
        </select>
        <span class="skripte-hint">Backfill: alte Skripte mit Performance-Label anlegen, damit die KI Beispiele hat.</span>
      </div>
      <div id="liste-wrap"></div>
    `;
    container.querySelector('#liste-import-btn').addEventListener('click', () => this.openImportDrawer());
    container.querySelector('#liste-branche-filter').addEventListener('change', (e) => {
      this.brancheFilter = e.target.value;
      this.renderListe();
    });
    await this.reload();
  }

  async reload() {
    [this.skripte, this.marken, this.branchen] = await Promise.all([
      skripteService.loadSkripte(),
      skripteService.loadMarken(),
      skripteService.loadBranchen()
    ]);

    const filterSelect = document.getElementById('liste-branche-filter');
    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">Alle Branchen</option>'
        + this.branchen.map((b) =>
          `<option value="${b.id}" ${this.brancheFilter === b.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('');
    }

    this.renderListe();
  }

  renderListe() {
    const wrap = document.getElementById('liste-wrap');
    if (!wrap) return;

    if (!this.skripte.length) {
      wrap.innerHTML = `<div class="empty-state"><p>Noch keine Skripte. Generiere eins im Generator-Tab oder importiere historische Skripte.</p></div>`;
      return;
    }

    const gefiltert = this.brancheFilter
      ? this.skripte.filter((s) => s.branche_id === this.brancheFilter)
      : this.skripte;

    if (!gefiltert.length) {
      wrap.innerHTML = `<div class="empty-state"><p>Keine Skripte in dieser Branche.</p></div>`;
      return;
    }

    wrap.innerHTML = `
      <table class="skripte-table">
        <thead>
          <tr>
            <th>Titel</th><th>Unternehmen / Marke</th><th>Branche</th><th>Herkunft</th><th>Status</th><th>Performance</th><th>DNA</th><th>Datum</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${gefiltert.map((s) => `
            <tr data-id="${s.id}">
              <td class="skripte-table-titel">${escapeHtml(s.titel || s.hook?.slice(0, 60) || '(ohne Titel)')}</td>
              <td>${escapeHtml([s.unternehmen?.firmenname, s.marke?.markenname].filter(Boolean).join(' / ') || '–')}</td>
              <td>${escapeHtml(s.branchen?.name || '–')}</td>
              <td>${badge(s.herkunft === 'historisch' ? 'Historisch' : 'Generiert', s.herkunft === 'historisch' ? 'neutral' : 'info')}</td>
              <td>${badge(STATUS_LABELS[s.status] || s.status)}</td>
              <td>${badge(PERFORMANCE_LABELS[s.performance_label] || s.performance_label, PERFORMANCE_BADGE_VARIANT[s.performance_label])}</td>
              <td>${s.herkunft === 'generiert' ? (s.mit_dna ? 'mit' : 'ohne') : '–'}</td>
              <td>${formatDate(s.created_at)}</td>
              <td class="skripte-row-actions">
                <button class="primary-btn skripte-row-open">Öffnen</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    wrap.querySelectorAll('.skripte-row-open').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('tr').dataset.id;
        this.page.openEditor(id);
      });
    });
  }

  // ------------------------------------------------------------------
  // Import-Drawer (Backfill historischer Skripte)
  // ------------------------------------------------------------------
  openImportDrawer() {
    const body = `
      <p class="skripte-hint">Hook/Hauptteil/CTA getrennt eintragen – so kann die KI sektionsweise lernen.
      Performance-Label ehrlich setzen: falsches Label = falsche DNA.</p>
      <div class="form-group">
        <label class="form-label">Titel *</label>
        <input id="imp-titel" class="form-input" type="text" placeholder="z.B. 'EDEKA Herbstkampagne – Rezept-Hook'" />
      </div>
      <div class="skripte-form-grid">
        <div class="form-group">
          <label class="form-label">Marke</label>
          <select id="imp-marke" class="form-input">
            <option value="">– Keine –</option>
            ${this.marken.map((m) => `<option value="${m.id}">${escapeHtml(m.markenname)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Branche</label>
          <select id="imp-branche" class="form-input">
            <option value="">– Keine –</option>
            ${this.branchen.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Performance-Label *</label>
          <select id="imp-label" class="form-input">
            ${Object.entries(PERFORMANCE_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Funnel-Stufe</label>
          <select id="imp-funnel" class="form-input">
            <option value="">– Unbekannt –</option>
            ${Object.entries(FUNNEL_STUFEN).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Hook *</label>
        <textarea id="imp-hook" class="form-input" rows="2"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Hauptteil *</label>
        <textarea id="imp-hauptteil" class="form-input" rows="5"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">CTA *</label>
        <textarea id="imp-cta" class="form-input" rows="2"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Performance-Notiz (Zahlen, Kontext)</label>
        <textarea id="imp-notiz" class="form-input" rows="2" placeholder="z.B. '450k Views, 3,2% CTR, lief 6 Wochen als Paid'"></textarea>
      </div>
    `;

    this.createDrawer('Historisches Skript importieren', body, [
      { label: 'Importieren', primary: true, onClick: async () => {
        const titel = document.getElementById('imp-titel').value.trim();
        const hook = document.getElementById('imp-hook').value.trim();
        const hauptteil = document.getElementById('imp-hauptteil').value.trim();
        const cta = document.getElementById('imp-cta').value.trim();
        if (!titel || !hook || !hauptteil || !cta) {
          window.toastSystem?.error('Titel, Hook, Hauptteil und CTA sind Pflicht');
          return false;
        }
        try {
          await skripteService.importSkript({
            titel,
            hook,
            hauptteil,
            cta,
            marke_id: document.getElementById('imp-marke').value || null,
            branche_id: document.getElementById('imp-branche').value || null,
            funnel_stufe: document.getElementById('imp-funnel').value || null,
            performance_label: document.getElementById('imp-label').value,
            performance_notiz: document.getElementById('imp-notiz').value.trim() || null
          });
          window.toastSystem?.success('Skript importiert');
          await this.reload();
          return true;
        } catch (err) {
          window.toastSystem?.error(err.message);
          return false;
        }
      } }
    ]);

    // Branche der gewaehlten Marke vorbelegen (manuell ueberschreibbar)
    document.getElementById('imp-marke').addEventListener('change', (e) => {
      const marke = this.marken.find((m) => m.id === e.target.value);
      if (marke?.branche_id) document.getElementById('imp-branche').value = marke.branche_id;
    });
  }

  // ------------------------------------------------------------------
  // Drawer-Helfer (Pattern wie FirmaCreateDrawer)
  // ------------------------------------------------------------------
  createDrawer(title, bodyHtml, buttons) {
    this.removeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay show';
    overlay.id = 'skripte-drawer-overlay';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel show skripte-drawer';
    panel.id = 'skripte-drawer';
    panel.innerHTML = `
      <div class="skripte-drawer-header">
        <h2>${escapeHtml(title)}</h2>
        <button class="skripte-drawer-close" aria-label="Schließen">&times;</button>
      </div>
      <div class="skripte-drawer-body">${bodyHtml}</div>
      <div class="skripte-drawer-footer"></div>
    `;

    const footer = panel.querySelector('.skripte-drawer-footer');
    for (const btn of buttons) {
      const el = document.createElement('button');
      el.className = btn.primary ? 'primary-btn' : (btn.danger ? 'danger-btn' : 'secondary-btn');
      el.textContent = btn.label;
      el.addEventListener('click', async () => {
        el.disabled = true;
        const close = await btn.onClick();
        el.disabled = false;
        if (close !== false) this.removeDrawer();
      });
      footer.appendChild(el);
    }

    overlay.addEventListener('click', () => this.removeDrawer());
    panel.querySelector('.skripte-drawer-close').addEventListener('click', () => this.removeDrawer());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
  }

  removeDrawer() {
    document.getElementById('skripte-drawer-overlay')?.remove();
    document.getElementById('skripte-drawer')?.remove();
  }

  cleanup() {
    this.removeDrawer();
  }
}
