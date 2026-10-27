// Drawer: Managements anfragen. Jede Mail bekommt einen eigenen Link.
// Hülle wie das Anschreiben, Empfänger über das Filter-Dropdown.
// Lokal wird der Link nur angezeigt, nicht verschickt.

import { DRAWER_EXIT_MS } from '../../core/animation/drawer.js';
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

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function linkUrl(token) {
  return `${location.origin}/src/bewerbung/bewerbung.html?token=${encodeURIComponent(token)}`;
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
        </section>
        <p class="anschreiben-feedback" data-feedback hidden></p>
        <div data-links></div>
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--secondary" data-action="close">Abbrechen</button>
        <button type="button" class="mdc-btn" data-action="create">Links erzeugen</button>
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
    panel.querySelector('[data-action="create"]').addEventListener('click', () => this._create(), { signal });
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

  async _create() {
    this._feedback('');
    const links = this.panel.querySelector('[data-links]');
    links.innerHTML = '';
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
        recipients.push({ management, email: management.email, ansprechpartnerId: null, name: management.firmenname });
        continue;
      }
      for (const person of chosen) {
        recipients.push({
          management,
          email: person.email,
          ansprechpartnerId: person.id,
          name: personName(person),
        });
      }
    }

    const betreff = this.panel.querySelector('[data-betreff]').value;
    const body = this.panel.querySelector('[data-body]').value;
    const created = [];
    for (const recipient of recipients) {
      const token = randomToken();
      const tokenHash = await sha256Hex(token);
      const { error } = await window.supabase.from('management_anfrage_link').insert({
        creator_auswahl_id: castingId,
        management_id: recipient.management.id,
        ansprechpartner_id: recipient.ansprechpartnerId,
        email: recipient.email,
        token_hash: tokenHash,
        betreff,
        body,
        created_by: window.currentUser?.id || null,
      });
      if (error) {
        this._feedback(error.message.includes('management_anfrage_link')
          ? 'Die Tabelle liegt lokal noch nicht in der Datenbank. Migration zuerst anwenden.'
          : error.message);
        return;
      }
      created.push({ name: recipient.name, email: recipient.email, url: linkUrl(token) });
    }
    links.innerHTML = `
      <section class="anschreiben-section">
        <h4 class="drawer-section-title">Links</h4>
        ${created.map((row) => `
          <p class="anschreiben-hint"><strong>${esc(row.name)}</strong> · ${esc(row.email)}<br>
          <a href="${esc(row.url)}" target="_blank" rel="noopener">${esc(row.url)}</a></p>
        `).join('')}
      </section>
    `;
    window.toastSystem?.show(`${created.length} Link${created.length === 1 ? '' : 's'} erzeugt. Versand bleibt lokal aus.`, 'success');
  }
}
