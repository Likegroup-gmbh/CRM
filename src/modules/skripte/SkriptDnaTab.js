// SkriptDnaTab.js
// Geschichtete Skript-DNA verwalten: Entwuerfe reviewen/editieren, freigeben
// (aktivieren, archiviert Vorgaenger), neue Layer anlegen und Destillation triggern.

import { skripteService, DNA_LAYER } from './SkripteService.js';
import { escapeHtml, formatDate, badge } from './SkripteUtils.js';

const STATUS_VARIANT = { entwurf: 'info', aktiv: 'success', archiviert: 'neutral' };

export class SkriptDnaTab {
  constructor(page) {
    this.page = page;
    this.dokumente = [];
    this.marken = [];
    this.branchen = [];
    this.personas = [];
    this.channel = null;
    this.pollInterval = null;
  }

  async render(container) {
    container.innerHTML = `
      <div class="skripte-actions-row" style="margin-bottom: var(--space-md);">
        <button id="dna-destill-btn" class="primary-btn">Destillation starten</button>
        <button id="dna-neu-btn" class="secondary-btn">DNA manuell anlegen</button>
        <span class="skripte-hint">Destillation verdichtet Feedback zu einem neuen DNA-Entwurf – Freigabe bleibt bei euch.</span>
      </div>
      <div id="dna-job-status" class="skripte-card" style="display:none;">
        <div id="dna-job-log" class="skripte-log"></div>
      </div>
      <div id="dna-wrap"></div>
    `;
    container.querySelector('#dna-destill-btn').addEventListener('click', () => this.openDestillDrawer());
    container.querySelector('#dna-neu-btn').addEventListener('click', () => this.openNeuDrawer());
    await this.reload();
  }

  async reload() {
    [this.dokumente, this.marken, this.branchen] = await Promise.all([
      skripteService.loadDnaDokumente(),
      skripteService.loadMarken(),
      skripteService.loadBranchen()
    ]);
    this.personas = await skripteService.loadPersonas();
    this.renderListe();
  }

  scopeLabel(doc) {
    if (doc.layer_typ === 'global') return 'Global';
    if (doc.layer_typ === 'branche') return `Branche: ${doc.branchen?.name || '?'}`;
    if (doc.layer_typ === 'zielgruppe') return `Persona: ${skripteService.personaLabel(doc.personas) || '?'}`;
    if (doc.layer_typ === 'marke') return `Marke: ${doc.marke?.markenname || '?'}`;
    return doc.layer_typ;
  }

  renderListe() {
    const wrap = document.getElementById('dna-wrap');
    if (!wrap) return;

    if (!this.dokumente.length) {
      wrap.innerHTML = `<div class="empty-state"><p>Noch keine DNA-Dokumente.</p></div>`;
      return;
    }

    wrap.innerHTML = `
      <table class="skripte-table">
        <thead>
          <tr><th>Name</th><th>Layer</th><th>Scope</th><th>Version</th><th>Status</th><th>Freigegeben</th><th>Erstellt</th><th></th></tr>
        </thead>
        <tbody>
          ${this.dokumente.map((d) => `
            <tr data-id="${d.id}">
              <td class="skripte-table-titel">${escapeHtml(d.name || '–')}</td>
              <td>${badge(DNA_LAYER[d.layer_typ] || d.layer_typ, 'info')}</td>
              <td>${escapeHtml(this.scopeLabel(d))}</td>
              <td>v${d.version}</td>
              <td>${badge(d.status, STATUS_VARIANT[d.status])}</td>
              <td>${d.freigegeben_am ? formatDate(d.freigegeben_am) : '–'}</td>
              <td>${formatDate(d.created_at)}</td>
              <td><button class="secondary-btn dna-row-open">Öffnen</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    wrap.querySelectorAll('.dna-row-open').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('tr').dataset.id;
        const doc = this.dokumente.find((d) => d.id === id);
        if (doc) this.openDetailDrawer(doc);
      });
    });
  }

  // ------------------------------------------------------------------
  // Detail: Review, Edit, Freigabe
  // ------------------------------------------------------------------
  openDetailDrawer(doc) {
    const body = `
      <div class="skripte-detail-meta">
        ${badge(DNA_LAYER[doc.layer_typ], 'info')}
        ${badge(this.scopeLabel(doc))}
        ${badge(`v${doc.version}`)}
        ${badge(doc.status, STATUS_VARIANT[doc.status])}
      </div>
      <p class="skripte-hint">Inhalt vor der Freigabe reviewen und bei Bedarf direkt editieren.
      "Freigeben" aktiviert diese Version und archiviert die bisher aktive desselben Scopes.</p>
      <div class="form-group">
        <label class="form-label">Name (für die Auswahl im Generator)</label>
        <input id="dna-name" class="form-input" type="text" value="${escapeHtml(doc.name || '')}"
          placeholder="z.B. 'Conversion-DNA Beauty', 'Storytelling weich'" />
      </div>
      <div class="form-group">
        <label class="form-label">DNA-Inhalt (Markdown)</label>
        <textarea id="dna-inhalt" class="form-input skripte-dna-editor" rows="22">${escapeHtml(doc.inhalt)}</textarea>
      </div>
    `;

    const readForm = () => ({
      name: document.getElementById('dna-name').value.trim() || null,
      inhalt: document.getElementById('dna-inhalt').value
    });

    const buttons = [];
    if (doc.status !== 'archiviert') {
      buttons.push({ label: 'Archivieren', onClick: async () => {
        await skripteService.updateDna(doc.id, { status: 'archiviert' });
        window.toastSystem?.success('Archiviert');
        await this.reload();
        return true;
      } });
    }
    buttons.push({ label: 'Speichern', onClick: async () => {
      try {
        await skripteService.updateDna(doc.id, readForm());
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
          await skripteService.updateDna(doc.id, readForm());
          await skripteService.aktiviereDna(doc);
          window.toastSystem?.success(`DNA v${doc.version} ist jetzt aktiv`);
          await this.reload();
          return true;
        } catch (err) {
          window.toastSystem?.error(err.message);
          return false;
        }
      } });
    }

    this.page.listeTab.createDrawer(`DNA ${this.scopeLabel(doc)} v${doc.version}`, body, buttons);
  }

  // ------------------------------------------------------------------
  // Neue DNA manuell anlegen (Kaltstart weiterer Layer)
  // ------------------------------------------------------------------
  openNeuDrawer() {
    const body = `
      <div class="form-group">
        <label class="form-label">Name</label>
        <input id="dnan-name" class="form-input" type="text"
          placeholder="z.B. 'Conversion-DNA Beauty', 'Storytelling weich'" />
      </div>
      <div class="skripte-form-grid">
        <div class="form-group">
          <label class="form-label">Layer *</label>
          <select id="dnan-layer" class="form-input">
            ${Object.entries(DNA_LAYER).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" id="dnan-scope-wrap" style="display:none;">
          <label class="form-label">Scope *</label>
          <select id="dnan-scope" class="form-input"></select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Inhalt (Markdown) *</label>
        <textarea id="dnan-inhalt" class="form-input skripte-dna-editor" rows="16"
          placeholder="# Regeln für diesen Layer&#10;## Hook&#10;- ..."></textarea>
      </div>
    `;

    this.page.listeTab.createDrawer('DNA manuell anlegen', body, [
      { label: 'Als Entwurf speichern', primary: true, onClick: async () => {
        const layer = document.getElementById('dnan-layer').value;
        const scope = document.getElementById('dnan-scope').value;
        const inhalt = document.getElementById('dnan-inhalt').value.trim();
        if (!inhalt) {
          window.toastSystem?.error('Inhalt fehlt');
          return false;
        }
        if (layer !== 'global' && !scope) {
          window.toastSystem?.error('Scope fehlt');
          return false;
        }
        const { error } = await window.supabase.from('skript_dna').insert({
          name: document.getElementById('dnan-name').value.trim() || null,
          layer_typ: layer,
          branche_id: layer === 'branche' ? scope : null,
          persona_id: layer === 'zielgruppe' ? scope : null,
          marke_id: layer === 'marke' ? scope : null,
          inhalt,
          status: 'entwurf'
        });
        if (error) {
          window.toastSystem?.error(error.message);
          return false;
        }
        window.toastSystem?.success('DNA-Entwurf angelegt');
        await this.reload();
        return true;
      } }
    ]);

    const layerSelect = document.getElementById('dnan-layer');
    layerSelect.addEventListener('change', () => this.updateScopeSelect('dnan-layer', 'dnan-scope', 'dnan-scope-wrap'));
  }

  updateScopeSelect(layerId, scopeId, wrapId) {
    const layer = document.getElementById(layerId).value;
    const wrap = document.getElementById(wrapId);
    const select = document.getElementById(scopeId);
    if (!wrap || !select) return;

    if (layer === 'global') {
      wrap.style.display = 'none';
      select.innerHTML = '';
      return;
    }
    wrap.style.display = '';
    const optionen = layer === 'branche'
      ? this.branchen.map((b) => ({ id: b.id, label: b.name }))
      : layer === 'zielgruppe'
        ? this.personas.map((p) => ({ id: p.id, label: p.name }))
        : this.marken.map((m) => ({ id: m.id, label: m.markenname }));
    select.innerHTML = '<option value="">– Wählen –</option>'
      + optionen.map((o) => `<option value="${o.id}">${escapeHtml(o.label)}</option>`).join('');
  }

  // ------------------------------------------------------------------
  // Destillation triggern (Background Function)
  // ------------------------------------------------------------------
  openDestillDrawer() {
    const body = `
      <p class="skripte-hint">Die KI verdichtet vorhandenes Feedback und Performance-Labels zu einem
      neuen DNA-Entwurf für den gewählten Layer. Der Entwurf wird NICHT automatisch aktiv –
      ihr reviewt und gebt frei.</p>
      <div class="skripte-form-grid">
        <div class="form-group">
          <label class="form-label">Layer *</label>
          <select id="dest-layer" class="form-input">
            ${Object.entries(DNA_LAYER).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" id="dest-scope-wrap" style="display:none;">
          <label class="form-label">Scope *</label>
          <select id="dest-scope" class="form-input"></select>
        </div>
        <div class="form-group">
          <label class="form-label">Name (optional)</label>
          <input id="dest-name" class="form-input" type="text"
            placeholder="Leer = Name der bisherigen DNA übernehmen" />
        </div>
      </div>
    `;

    this.page.listeTab.createDrawer('DNA-Destillation starten', body, [
      { label: 'Destillieren', primary: true, onClick: async () => {
        const layer = document.getElementById('dest-layer').value;
        const scope = document.getElementById('dest-scope').value;
        const name = document.getElementById('dest-name').value.trim() || null;
        if (layer !== 'global' && !scope) {
          window.toastSystem?.error('Scope fehlt');
          return false;
        }
        try {
          await this.startDestillation(layer, scope, name);
          return true;
        } catch (err) {
          window.toastSystem?.error(err.message);
          return false;
        }
      } }
    ]);

    document.getElementById('dest-layer').addEventListener('change',
      () => this.updateScopeSelect('dest-layer', 'dest-scope', 'dest-scope-wrap'));
  }

  async startDestillation(layer, scope, name) {
    const job = await skripteService.createJob();
    const statusCard = document.getElementById('dna-job-status');
    const logEl = document.getElementById('dna-job-log');
    statusCard.style.display = 'block';
    logEl.textContent = `[Client] Destillations-Job gestartet (${layer})...`;

    let renderedLogs = 0;
    const handleUpdate = async (j) => {
      const logs = Array.isArray(j.logs) ? j.logs : [];
      for (let i = renderedLogs; i < logs.length; i++) {
        logEl.textContent += `\n[Server] ${logs[i].msg}`;
      }
      renderedLogs = Math.max(renderedLogs, logs.length);
      logEl.scrollTop = logEl.scrollHeight;

      if (j.status === 'done') {
        this.stopJobWatch();
        window.toastSystem?.success('DNA-Entwurf erstellt – bitte reviewen und freigeben');
        await this.reload();
      } else if (j.status === 'error') {
        this.stopJobWatch();
        window.toastSystem?.error(`Destillation fehlgeschlagen: ${j.error_message || 'Unbekannt'}`);
      }
    };

    this.channel = skripteService.subscribeToJob(job.id, handleUpdate);
    this.pollInterval = setInterval(async () => {
      const j = await skripteService.pollJob(job.id);
      if (j) handleUpdate(j);
    }, 5000);

    await skripteService.triggerFunction('skript-distill-background', {
      jobId: job.id,
      layer_typ: layer,
      branche_id: layer === 'branche' ? scope : null,
      persona_id: layer === 'zielgruppe' ? scope : null,
      marke_id: layer === 'marke' ? scope : null,
      name: name || null
    });
  }

  stopJobWatch() {
    if (this.channel) {
      window.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  cleanup() {
    this.stopJobWatch();
  }
}
