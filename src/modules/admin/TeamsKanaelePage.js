// TeamsKanaelePage.js
// Teams-Kanäle im Accounting-Bereich (nur Admins, ADR 0066). Liste der Kanäle mit
// abgedeckten Unternehmen und Stand der letzten Teams-Meldung; anlegen und ändern im
// Drawer (teamsKanalDrawer.js), Testmeldung über die Function teams-kanal.
// Kanäle und Zuordnung liest und schreibt die Seite direkt (RLS: nur Admins).

import { escapeHtml } from '../../core/format.js';
import { navMark } from '../../core/dev/navTrace.js';
import { authorizedFetch } from '../../core/auth/getAccessToken.js';
import { relativ, gross, datumZeit, bestaetigen, setBusy } from './medienablageFormat.js';
import { openTeamsKanalDrawer } from './teamsKanalDrawer.js';

const TEST_ENDPOINT = '/.netlify/functions/teams-kanal';
const CHIPS_MAX = 6;

export class TeamsKanaelePage {
  constructor() {
    this.kanaele = [];
    this.zuordnung = new Map();
    this.unternehmen = [];
    this._docClickHandler = null;
    this._ladeId = 0;
    this._busy = false;
    this.ready = Promise.resolve();
  }

  async init() {
    this._ladeId += 1;
    window.setContentSafely(window.content, '<div class="admin-loading">Lade Teams-Kanäle …</div>');
    navMark('skeleton:shown');
    this.ready = this.ladeInitial(this._ladeId);
  }

  async ladeInitial(ladeId) {
    try {
      await this.loadData();
    } catch (e) {
      if (ladeId !== this._ladeId) return;
      console.error('❌ Teams-Kanäle: Laden fehlgeschlagen', e);
      window.setContentSafely(window.content, `
        <div class="empty-state"><p>Fehler beim Laden: ${escapeHtml(e?.message || 'Unbekannt')}</p></div>
      `);
      return;
    }
    navMark('daten:geladen');
    if (ladeId !== this._ladeId) return;
    this.render();
    this.bindEvents();
    navMark('render:done');
  }

  async loadData() {
    const sb = window.supabase;
    const [kanaele, zuordnung, unternehmen] = await Promise.all([
      sb.from('teams_kanal')
        .select('id, name, webhook_url, aktiv, letzte_meldung_at, letzter_fehler, letzter_fehler_at, created_at')
        .order('name'),
      sb.from('teams_kanal_unternehmen').select('kanal_id, unternehmen_id'),
      sb.from('unternehmen').select('id, firmenname, ist_test').order('firmenname'),
    ]);
    const fehler = kanaele.error || zuordnung.error || unternehmen.error;
    if (fehler) throw fehler;

    this.kanaele = kanaele.data || [];
    this.unternehmen = unternehmen.data || [];
    this.zuordnung = new Map();
    for (const z of zuordnung.data || []) {
      const key = String(z.kanal_id);
      if (!this.zuordnung.has(key)) this.zuordnung.set(key, []);
      this.zuordnung.get(key).push(String(z.unternehmen_id));
    }
  }

  async neuLaden() {
    const ladeId = this._ladeId;
    try {
      await this.loadData();
    } catch (e) {
      if (ladeId !== this._ladeId) return;
      console.error('❌ Teams-Kanäle: Neu laden fehlgeschlagen', e);
      this.toast('Teams-Kanäle konnten nicht neu geladen werden.', 'error');
      return;
    }
    if (ladeId !== this._ladeId) return;
    this.render();
  }

  toast(text, type) {
    window.toastSystem?.show?.(text, type);
  }

  kanal(id) {
    return this.kanaele.find(k => String(k.id) === String(id)) || null;
  }

  firmen(kanalId) {
    const namen = new Map(this.unternehmen.map(u => [String(u.id), u.firmenname || 'Ohne Namen']));
    return (this.zuordnung.get(String(kanalId)) || [])
      .map(id => namen.get(id))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'de'));
  }

  // ---------- Rendering ----------

  render() {
    const aktiv = this.kanaele.filter(k => k.aktiv).length;
    window.setContentSafely(window.content, `
      <div class="admin-page tk-page">
        <div class="admin-header">
          <p class="admin-hint">Schreibt die Kundenseite im Videos-Tab einen Kommentar, bekommt jeder aktive Teams-Kanal, der das Unternehmen abdeckt, eine Teams-Meldung. Kanal und Mitglieder legst du in Teams an; hier stehen der Workflow-Link und die Unternehmen.</p>
        </div>
        <div class="dq-list-card">
          <div class="dq-list-header ma-list-header">
            <div>
              <h2 class="dq-list-title">Teams-Kanäle</h2>
              <p class="dq-list-hint">${this.kanaele.length} Kanäle · ${aktiv} aktiv</p>
            </div>
            <button type="button" class="mdc-btn mdc-btn--create" data-tk-neu>
              <span class="mdc-btn__label">Kanal hinzufügen</span>
            </button>
          </div>
          ${this.kanaele.length ? this.tabelleHtml() : '<div class="dq-leer">Noch kein Teams-Kanal. Ohne Kanal gibt es keine Teams-Meldungen.</div>'}
        </div>
      </div>
    `);
  }

  tabelleHtml() {
    return `
      <div class="dq-scroll-x">
      <table class="dq-table ma-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Unternehmen</th>
            <th>Stand</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${this.kanaele.map(k => this.zeileHtml(k)).join('')}
        </tbody>
      </table>
      </div>
    `;
  }

  zeileHtml(k) {
    const id = escapeHtml(k.id);
    return `
      <tr data-tk-kanal="${id}">
        <td>
          <span class="dq-name">${escapeHtml(k.name)}</span>
          ${k.aktiv ? '' : '<span class="status-badge inactive ma-badge">Inaktiv</span>'}
        </td>
        <td>${this.firmenHtml(k.id)}</td>
        <td>${this.standHtml(k)}</td>
        <td class="ma-zeilen-aktionen">
          <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-tk-test="${id}">Testmeldung</button>
          <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-tk-bearbeiten="${id}">Bearbeiten</button>
          <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-tk-loeschen="${id}">Löschen</button>
        </td>
      </tr>
    `;
  }

  firmenHtml(kanalId) {
    const firmen = this.firmen(kanalId);
    if (!firmen.length) return '<span class="ma-leise">Keine – der Kanal bekommt nichts</span>';
    const rest = firmen.length - CHIPS_MAX;
    return `
      <div class="tk-chips">
        ${firmen.slice(0, CHIPS_MAX).map(f => `<span class="tag">${escapeHtml(f)}</span>`).join('')}
        ${rest > 0 ? `<span class="ma-leise" title="${escapeHtml(firmen.slice(CHIPS_MAX).join(', '))}">+${rest} weitere</span>` : ''}
      </div>
    `;
  }

  standHtml(k) {
    const fehlerNeuer = k.letzter_fehler
      && (!k.letzte_meldung_at || new Date(k.letzter_fehler_at) >= new Date(k.letzte_meldung_at));
    if (fehlerNeuer) {
      return `
        <span class="status-badge danger">Fehler</span>
        <div class="ma-leise" title="${escapeHtml(datumZeit(k.letzter_fehler_at))}">${escapeHtml(gross(relativ(k.letzter_fehler_at)))}: ${escapeHtml(k.letzter_fehler)}</div>
      `;
    }
    if (k.letzte_meldung_at) {
      return `<span class="ma-leise" title="${escapeHtml(datumZeit(k.letzte_meldung_at))}">Letzte Meldung ${escapeHtml(relativ(k.letzte_meldung_at))}</span>`;
    }
    return '<span class="ma-leise">Noch keine Meldung</span>';
  }

  // ---------- Aktionen ----------

  oeffnen(kanal = null) {
    openTeamsKanalDrawer({
      kanal,
      unternehmen: this.unternehmen,
      gewaehlt: kanal ? (this.zuordnung.get(String(kanal.id)) || []) : [],
      onGespeichert: () => void this.neuLaden(),
    });
  }

  async testmeldung(button) {
    if (this._busy) return;
    const kanal = this.kanal(button.dataset.tkTest);
    if (!kanal) return;
    this._busy = true;
    setBusy(button, true);
    try {
      const res = await authorizedFetch(TEST_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ aktion: 'test', kanal_id: kanal.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Fehler (${res.status})`);
      if (data.ok) this.toast(`Testmeldung an „${kanal.name}“ abgeschickt. Sie sollte gleich im Kanal stehen.`, 'success');
      else this.toast(`Testmeldung fehlgeschlagen: ${data.fehler || 'Unbekannt'}`, 'error');
    } catch (e) {
      console.error('❌ Teams-Kanäle: Testmeldung fehlgeschlagen', e);
      this.toast(`Testmeldung fehlgeschlagen: ${e?.message || 'Unbekannt'}`, 'error');
    } finally {
      this._busy = false;
      setBusy(button, false);
    }
    await this.neuLaden();
  }

  async loeschen(button) {
    if (this._busy) return;
    const kanal = this.kanal(button.dataset.tkLoeschen);
    if (!kanal) return;
    const ok = await bestaetigen({
      title: 'Teams-Kanal löschen',
      message: `„${kanal.name}“ bekommt danach keine Teams-Meldungen mehr. Der Kanal in Teams und der Workflow bleiben bestehen.`,
      confirmText: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    this._busy = true;
    setBusy(button, true);
    try {
      const { error } = await window.supabase.from('teams_kanal').delete().eq('id', kanal.id);
      if (error) throw error;
      this.toast(`Teams-Kanal „${kanal.name}“ gelöscht.`, 'success');
    } catch (e) {
      console.error('❌ Teams-Kanäle: Löschen fehlgeschlagen', e);
      this.toast(`Löschen fehlgeschlagen: ${e?.message || 'Unbekannt'}`, 'error');
    } finally {
      this._busy = false;
      setBusy(button, false);
    }
    await this.neuLaden();
  }

  // ---------- Events ----------

  bindEvents() {
    if (this._docClickHandler) return;
    this._docClickHandler = (e) => {
      if (!window.content?.contains(e.target)) return;
      if (e.target.closest('[data-tk-neu]')) {
        this.oeffnen();
        return;
      }
      const bearbeiten = e.target.closest('[data-tk-bearbeiten]');
      if (bearbeiten) {
        const kanal = this.kanal(bearbeiten.dataset.tkBearbeiten);
        if (kanal) this.oeffnen(kanal);
        return;
      }
      const test = e.target.closest('[data-tk-test]');
      if (test) {
        void this.testmeldung(test);
        return;
      }
      const loeschen = e.target.closest('[data-tk-loeschen]');
      if (loeschen) void this.loeschen(loeschen);
    };
    document.addEventListener('click', this._docClickHandler);
  }

  destroy() {
    this._ladeId += 1;
    if (this._docClickHandler) {
      document.removeEventListener('click', this._docClickHandler);
      this._docClickHandler = null;
    }
  }
}
