// Drawer: Managements anfragen. Jede Mail bekommt einen eigenen Link, kein PDF.
// Hülle wie das Anschreiben, Empfänger über das Filter-Dropdown.
// Der Versand läuft über management-anfrage-send.

import { DRAWER_EXIT_MS } from '../../core/animation/drawer.js';
import { authorizedFetch } from '../../core/auth/getAccessToken.js';
import {
  bindFilterSelects,
  closeFilterSelects,
  readFilterSelectValues,
  renderFilterSelect
} from '../../core/filters/FilterSelect.js';
import { loadAnsprechpartner } from '../ansprechpartner/betreuung.js';

const DRAWER_ID = 'management-anfrage-drawer';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadCastings(kampagneId, currentId) {
  if (!kampagneId) return [];
  const { data, error } = await window.supabase
    .from('creator_auswahl')
    .select('id, name')
    .eq('kampagne_id', kampagneId)
    .order('name');
  if (error) throw error;
  return (data || []).map((row) => ({ ...row, current: row.id === currentId }));
}

async function loadManagements() {
  const { data, error } = await window.supabase
    .from('management')
    .select('id, firmenname, email')
    .order('firmenname')
    .limit(1000);
  if (error) throw error;
  return data || [];
}

function personName(person) {
  return `${person.vorname || ''} ${person.nachname || ''}`.trim();
}

export async function openManagementAnfrage({ liste }) {
  const drawer = new ManagementAnfrageDrawer(liste);
  await drawer.open();
}

class ManagementAnfrageDrawer {
  constructor(liste) {
    this.liste = liste;
    this.overlay = null;
    this.panel = null;
    this._abort = null;
    this.managements = new Map();
    this.people = new Map();
    this._peopleLauf = 0;
    this.sending = false;
  }

  async open() {
    this._build();
    const [castings, managements] = await Promise.all([
      loadCastings(this.liste?.kampagne_id, this.liste?.id).catch(() => []),
      loadManagements().catch(() => []),
    ]);
    if (!this.panel) return;
    const lists = castings.length ? castings : [{ id: this.liste?.id, name: this.liste?.name, current: true }];
    managements.forEach((row) => this.managements.set(row.id, row));
    this._paintCasting(lists);
    this._paintManagements();
    bindFilterSelects(this.panel, { signal: this._abort.signal });
    this.panel.addEventListener('change', (event) => {
      const wrapper = event.target.closest?.('[data-filter-select]') || event.target;
      if (wrapper?.id === 'filter-select-management-anfrage-management') this._paintPeople();
    }, { signal: this._abort.signal });
  }

  close() {
    this._abort?.abort();
    this._abort = null;
    const panel = this.panel;
    const overlay = this.overlay;
    closeFilterSelects(panel);
    this.panel = null;
    this.overlay = null;
    if (!panel && !overlay) return;
    panel?.classList.remove('show');
    setTimeout(() => {
      overlay?.remove();
      panel?.remove();
    }, DRAWER_EXIT_MS);
  }

  _build() {
    document.getElementById(`${DRAWER_ID}-overlay`)?.remove();
    document.getElementById(DRAWER_ID)?.remove();
    this._abort?.abort();
    this._abort = new AbortController();
    const { signal } = this._abort;

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${DRAWER_ID}-overlay`;

    const panel = document.createElement('div');
    panel.className = 'drawer-panel anschreiben-drawer';
    panel.id = DRAWER_ID;
    panel.setAttribute('role', 'dialog');
    panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">Managements anfragen</span>
          ${this.liste?.name ? `<p class="drawer-subtitle">${esc(this.liste.name)}</p>` : ''}
        </div>
        <button type="button" class="drawer-close-btn" data-action="close" aria-label="Schließen">&times;</button>
      </div>
      <div class="drawer-body">
        <section class="anschreiben-section">
          <h4 class="drawer-section-title">Casting</h4>
          <div data-casting></div>
        </section>
        <section class="anschreiben-section">
          <h4 class="drawer-section-title">Empfänger</h4>
          <p class="anschreiben-hint">Jede Person bekommt eine eigene Mail und einen eigenen Link.</p>
          <div data-management></div>
          <div data-personen></div>
        </section>
        <section class="anschreiben-section">
          <h4 class="drawer-section-title">Betreff</h4>
          <input type="text" class="input" data-betreff maxlength="200" value="Creator für ${esc(this.liste?.name || 'das Casting')}">
        </section>
        <section class="anschreiben-section">
          <h4 class="drawer-section-title">Text</h4>
          <textarea class="input" data-body rows="8">Über den Link kannst du Creator für dieses Casting vorschlagen.</textarea>
          <p class="anschreiben-hint">Die Mail enthält den Link. Das Briefing liegt auf der Seite, nicht als Anhang.</p>
        </section>
        <p class="anschreiben-feedback" data-feedback hidden></p>
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--secondary" data-action="close">Abbrechen</button>
        <button type="button" class="mdc-btn" data-action="send">Senden</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    this.overlay = overlay;
    this.panel = panel;
    requestAnimationFrame(() => panel.classList.add('show'));

    overlay.addEventListener('click', () => this.close(), { signal });
    panel.querySelectorAll('[data-action="close"]').forEach((btn) =>
      btn.addEventListener('click', () => this.close(), { signal }));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.close();
    }, { signal });
    panel.querySelector('[data-action="send"]').addEventListener('click', () => this._send(), { signal });
  }

  _paintCasting(lists) {
    const current = lists.find((row) => row.current) || lists[0];
    this.panel.querySelector('[data-casting]').innerHTML = renderFilterSelect({
      id: 'management-anfrage-casting',
      label: 'Casting',
      type: 'select',
      emptyLabel: 'Casting wählen',
      noEmpty: true,
      portal: true,
    }, current?.id || '', lists.map((row) => ({ value: row.id, label: row.name || 'Casting' })));
  }

  _paintManagements() {
    const options = [...this.managements.values()].map((row) => ({
      value: row.id,
      label: row.email ? row.firmenname : `${row.firmenname} · ohne E-Mail`,
    }));
    this.panel.querySelector('[data-management]').innerHTML = renderFilterSelect({
      id: 'management-anfrage-management',
      label: 'Management',
      type: 'multiSelect',
      emptyLabel: 'Management wählen',
      placeholder: 'Management suchen...',
      searchable: true,
      portal: true,
    }, [], options);
  }

  async _paintPeople() {
    const host = this.panel?.querySelector('[data-personen]');
    if (!host) return;
    const lauf = ++this._peopleLauf;
    const managementIds = readFilterSelectValues(this.panel.querySelector('#filter-select-management-anfrage-management'));
    const keep = new Set(readFilterSelectValues(this.panel.querySelector('#filter-select-management-anfrage-personen')));
    closeFilterSelects(host);
    if (!managementIds.length) {
      host.innerHTML = '';
      this.people = new Map();
      return;
    }
    const rows = await loadAnsprechpartner(managementIds).catch(() => []);
    if (lauf !== this._peopleLauf || !this.panel) return;
    this.people = new Map();
    const options = [];
    let ohneMail = 0;
    for (const person of rows) {
      if (!person.email) {
        ohneMail += 1;
        continue;
      }
      this.people.set(person.id, person);
      const management = this.managements.get(person.management_id)?.firmenname || '';
      options.push({
        value: person.id,
        label: [personName(person), management].filter(Boolean).join(' · '),
      });
    }
    const selected = [...keep].filter((id) => this.people.has(id));
    host.innerHTML = `
      ${renderFilterSelect({
        id: 'management-anfrage-personen',
        label: 'Ansprechpartner',
        type: 'multiSelect',
        emptyLabel: 'Ansprechpartner wählen',
        placeholder: 'Ansprechpartner suchen...',
        searchable: true,
        portal: true,
      }, selected, options)}
      <p class="anschreiben-hint">Ohne Auswahl geht der Link an die Adresse des Managements.${ohneMail ? ` ${ohneMail} ohne E-Mail ausgeblendet.` : ''}</p>
    `;
  }

  _feedback(text) {
    const el = this.panel?.querySelector('[data-feedback]');
    if (!el) return;
    el.hidden = !text;
    el.classList.toggle('is-error', Boolean(text));
    el.textContent = text || '';
  }

  _setSending(on) {
    const btn = this.panel?.querySelector('[data-action="send"]');
    if (!btn) return;
    btn.disabled = on;
    btn.textContent = on ? 'Wird gesendet …' : 'Senden';
  }

  async _send() {
    if (this.sending || !this.panel) return;
    this._feedback('');
    const castingId = readFilterSelectValues(this.panel.querySelector('#filter-select-management-anfrage-casting'));
    const managementIds = readFilterSelectValues(this.panel.querySelector('#filter-select-management-anfrage-management'));
    const personIds = new Set(readFilterSelectValues(this.panel.querySelector('#filter-select-management-anfrage-personen')));
    if (!castingId) {
      this._feedback('Wähle ein Casting.');
      return;
    }
    if (!managementIds.length) {
      this._feedback('Wähle mindestens ein Management.');
      return;
    }

    const recipients = [];
    for (const managementId of managementIds) {
      const management = this.managements.get(managementId);
      const chosen = [...this.people.values()].filter((person) => person.management_id === managementId && personIds.has(person.id));
      if (!chosen.length) {
        if (!management?.email) {
          this._feedback(`${management?.firmenname || 'Management'} hat keine E-Mail.`);
          return;
        }
        recipients.push({ managementId, ansprechpartnerId: null });
        continue;
      }
      for (const person of chosen) {
        recipients.push({ managementId, ansprechpartnerId: person.id });
      }
    }

    const betreff = this.panel.querySelector('[data-betreff]').value.trim();
    const body = this.panel.querySelector('[data-body]').value.trim();
    if (!betreff || !body) {
      this._feedback('Betreff und Text sind Pflicht.');
      return;
    }

    this.sending = true;
    this._setSending(true);
    let sentOk = false;
    try {
      const response = await authorizedFetch('/.netlify/functions/management-anfrage-send', {
        method: 'POST',
        body: JSON.stringify({ castingId, betreff, body, empfaenger: recipients }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Senden fehlgeschlagen (HTTP ${response.status})`);
      const parts = [`${result.sent} gesendet`];
      if (result.failed) parts.push(`${result.failed} fehlgeschlagen`);
      const detail = (result.errors || [])
        .map((row) => [row.name || row.email, row.error].filter(Boolean).join(': '))
        .filter(Boolean)
        .join(' · ');
      this._feedback(result.failed ? detail : '', Boolean(result.failed));
      window.toastSystem?.show(`Anfrage: ${parts.join(', ')}`, result.failed ? 'warning' : 'success');
      if (!result.failed) {
        sentOk = true;
        setTimeout(() => this.close(), 1200);
      }
    } catch (err) {
      this._feedback(err.message || 'Senden fehlgeschlagen', true);
      window.toastSystem?.show(err.message || 'Senden fehlgeschlagen', 'error');
    } finally {
      if (!sentOk) {
        this.sending = false;
        this._setSending(false);
      }
    }
  }
}
