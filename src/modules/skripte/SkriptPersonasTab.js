// SkriptPersonasTab.js
// Globale Zielgruppen-Personas verwalten: Liste + Anlegen/Bearbeiten/Loeschen.
// Personas sind bewusst NICHT an Marke/Kampagne gebunden.

import { skripteService } from './SkripteService.js';
import { escapeHtml, formatDate, badge } from './SkripteUtils.js';

const BUDGET_LABELS = { niedrig: 'Niedrig', mittel: 'Mittel', hoch: 'Hoch' };

const LEBENSSITUATIONEN = [
  'Single', 'Familie', 'Paar ohne Kinder', 'Alleinerziehend',
  'Student/in', 'Rentner/in', 'Mensch mit Behinderung', 'WG / Wohngemeinschaft'
];

const GESCHLECHTER = ['Weiblich', 'Männlich', 'Divers', 'Gemischt'];

export class SkriptPersonasTab {
  constructor(page) {
    this.page = page;
    this.personas = [];
  }

  async render(container) {
    container.innerHTML = `
      <div class="skripte-actions-row" style="margin-bottom: var(--space-md);">
        <button id="persona-neu-btn" class="primary-btn">Persona anlegen</button>
        <span class="skripte-hint">Personas sind global und stehen in jeder Generierung zur Auswahl.</span>
      </div>
      <div id="persona-wrap"></div>
    `;
    container.querySelector('#persona-neu-btn').addEventListener('click', () => this.openDrawer(null));
    await this.reload();
  }

  async reload() {
    this.personas = await skripteService.loadPersonas();
    this.renderListe();
  }

  alterLabel(p) {
    if (p.alter_von && p.alter_bis) return `${p.alter_von}–${p.alter_bis}`;
    if (p.alter_von) return `ab ${p.alter_von}`;
    if (p.alter_bis) return `bis ${p.alter_bis}`;
    return '–';
  }

  renderListe() {
    const wrap = document.getElementById('persona-wrap');
    if (!wrap) return;

    if (!this.personas.length) {
      wrap.innerHTML = `<div class="empty-state"><p>Noch keine Personas.
        Lege die erste Zielgruppen-Persona an – sie fließt als Kontext in jede Skript-Generierung ein.</p></div>`;
      return;
    }

    wrap.innerHTML = `
      <table class="skripte-table">
        <thead>
          <tr>
            <th>Oberbegriff</th><th>Name</th><th>Alter</th><th>Geschlecht</th><th>Region</th>
            <th>Budget</th><th>Lebenssituation</th><th>Erstellt</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${this.personas.map((p) => `
            <tr data-id="${p.id}">
              <td class="skripte-table-titel">${escapeHtml(p.oberbegriff || '–')}</td>
              <td>${escapeHtml(p.name)}</td>
              <td>${escapeHtml(this.alterLabel(p))}</td>
              <td>${escapeHtml(p.geschlecht || '–')}</td>
              <td>${escapeHtml(p.wohnort_region || '–')}</td>
              <td>${p.budgetrahmen ? badge(BUDGET_LABELS[p.budgetrahmen] || p.budgetrahmen, 'info') : '–'}</td>
              <td>${escapeHtml(p.lebenssituation || '–')}</td>
              <td>${formatDate(p.created_at)}</td>
              <td><button class="secondary-btn persona-row-open">Öffnen</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    wrap.querySelectorAll('.persona-row-open').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('tr').dataset.id;
        const persona = this.personas.find((p) => p.id === id);
        if (persona) this.openDrawer(persona);
      });
    });
  }

  // ------------------------------------------------------------------
  // Drawer: Anlegen (persona=null) oder Bearbeiten
  // ------------------------------------------------------------------
  openDrawer(persona) {
    const p = persona || {};
    const val = (v) => escapeHtml(v ?? '');

    const lebenssituationOptions = [...LEBENSSITUATIONEN];
    if (p.lebenssituation && !lebenssituationOptions.includes(p.lebenssituation)) {
      lebenssituationOptions.push(p.lebenssituation);
    }

    const body = `
      <div class="skripte-form-grid">
        <div class="form-group">
          <label class="form-label">Oberbegriff</label>
          <input id="per-oberbegriff" class="form-input" type="text" value="${val(p.oberbegriff)}"
            placeholder="z.B. 'Sparsame Studentin'" />
          <span class="skripte-hint">Kategorie zur Zuordnung – wird überall mit angezeigt.</span>
        </div>
        <div class="form-group">
          <label class="form-label">Name *</label>
          <input id="per-name" class="form-input" type="text" value="${val(p.name)}"
            placeholder="z.B. 'Sarah'" />
        </div>
      </div>
      <div class="skripte-form-grid">
        <div class="form-group">
          <label class="form-label">Alter von</label>
          <input id="per-alter-von" class="form-input" type="number" min="0" max="120" value="${p.alter_von ?? ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Alter bis</label>
          <input id="per-alter-bis" class="form-input" type="number" min="0" max="120" value="${p.alter_bis ?? ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Geschlecht</label>
          <select id="per-geschlecht" class="form-input">
            <option value="">– Keine Angabe –</option>
            ${GESCHLECHTER.map((g) => `<option value="${g}" ${p.geschlecht === g ? 'selected' : ''}>${g}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Wohnort / Region</label>
          <input id="per-region" class="form-input" type="text" value="${val(p.wohnort_region)}"
            placeholder="z.B. Großstadt Süddeutschland, ländlich NRW" />
        </div>
        <div class="form-group">
          <label class="form-label">Beruf</label>
          <input id="per-beruf" class="form-input" type="text" value="${val(p.beruf)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Budgetrahmen (Einkommen)</label>
          <select id="per-budget" class="form-input">
            <option value="">– Keine Angabe –</option>
            ${Object.entries(BUDGET_LABELS).map(([v, l]) =>
              `<option value="${v}" ${p.budgetrahmen === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Bildungsstand</label>
          <input id="per-bildung" class="form-input" type="text" value="${val(p.bildungsstand)}"
            placeholder="z.B. Abitur, Studium, Ausbildung" />
        </div>
        <div class="form-group">
          <label class="form-label">Lebenssituation</label>
          <select id="per-lebenssituation" class="form-input">
            <option value="">– Keine Angabe –</option>
            ${lebenssituationOptions.map((l) =>
              `<option value="${l}" ${p.lebenssituation === l ? 'selected' : ''}>${l}</option>`).join('')}
            <option value="__custom">Andere (Freitext)...</option>
          </select>
          <input id="per-lebenssituation-custom" class="form-input" type="text"
            style="display:none; margin-top: var(--space-xs);" placeholder="Lebenssituation eintragen" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Kontext / Lebensrealität</label>
        <textarea id="per-kontext" class="form-input" rows="3"
          placeholder="Alltag, Mediennutzung, Werte, was sie/ihn beschäftigt...">${val(p.kontext)}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Pain Points</label>
        <textarea id="per-painpoints" class="form-input" rows="3"
          placeholder="Konkrete Probleme/Frustrationen, die das Produkt lösen kann...">${val(p.pain_points)}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Beschreibung (frei)</label>
        <textarea id="per-beschreibung" class="form-input" rows="3"
          placeholder="Alles, was sonst noch wichtig ist...">${val(p.beschreibung)}</textarea>
      </div>
    `;

    const buttons = [];
    if (persona) {
      buttons.push({ label: 'Löschen', danger: true, onClick: async () => {
        const res = await window.confirmationModal?.open({
          title: 'Persona löschen?',
          message: `"${persona.name}" wird gelöscht. Zielgruppen-DNA dieser Persona wird mit entfernt, Skripte bleiben erhalten.`,
          confirmText: 'Löschen',
          danger: true
        });
        if (res && !res.confirmed) return false;
        try {
          await skripteService.deletePersona(persona.id);
          window.toastSystem?.success('Persona gelöscht');
          await this.reload();
          return true;
        } catch (err) {
          window.toastSystem?.error(err.message);
          return false;
        }
      } });
    }
    buttons.push({ label: persona ? 'Speichern' : 'Anlegen', primary: true, onClick: async () => {
      const name = document.getElementById('per-name').value.trim();
      if (!name) {
        window.toastSystem?.error('Name ist Pflicht');
        return false;
      }

      const situationSelect = document.getElementById('per-lebenssituation').value;
      const lebenssituation = situationSelect === '__custom'
        ? document.getElementById('per-lebenssituation-custom').value.trim() || null
        : situationSelect || null;

      const parseAlter = (id) => {
        const n = parseInt(document.getElementById(id).value, 10);
        return Number.isFinite(n) ? n : null;
      };

      const payload = {
        name,
        oberbegriff: document.getElementById('per-oberbegriff').value.trim() || null,
        alter_von: parseAlter('per-alter-von'),
        alter_bis: parseAlter('per-alter-bis'),
        geschlecht: document.getElementById('per-geschlecht').value || null,
        wohnort_region: document.getElementById('per-region').value.trim() || null,
        beruf: document.getElementById('per-beruf').value.trim() || null,
        budgetrahmen: document.getElementById('per-budget').value || null,
        bildungsstand: document.getElementById('per-bildung').value.trim() || null,
        lebenssituation,
        kontext: document.getElementById('per-kontext').value.trim() || null,
        pain_points: document.getElementById('per-painpoints').value.trim() || null,
        beschreibung: document.getElementById('per-beschreibung').value.trim() || null
      };

      try {
        if (persona) {
          await skripteService.updatePersona(persona.id, payload);
          window.toastSystem?.success('Persona gespeichert');
        } else {
          await skripteService.createPersona(payload);
          window.toastSystem?.success('Persona angelegt');
        }
        await this.reload();
        return true;
      } catch (err) {
        window.toastSystem?.error(err.message);
        return false;
      }
    } });

    this.page.listeTab.createDrawer(
      persona ? [persona.oberbegriff, persona.name].filter(Boolean).join(' · ') : 'Neue Persona',
      body, buttons
    );

    // Freitext-Feld fuer "Andere" Lebenssituation ein-/ausblenden
    document.getElementById('per-lebenssituation').addEventListener('change', (e) => {
      const custom = document.getElementById('per-lebenssituation-custom');
      custom.style.display = e.target.value === '__custom' ? '' : 'none';
    });
  }

  cleanup() {}
}
