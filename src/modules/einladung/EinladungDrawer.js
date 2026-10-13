// EinladungDrawer.js
// Mitarbeiter laden einen Kunden zu einem Formular ein (ADR 0055):
//  - Briefing: aus der Produktion, mit Briefing-Typ
//  - Produkt: an der Marke (sonst am Unternehmen)
// Link und Code gehen auf Wunsch sofort per Mail an Ansprechpartner oder freie Adressen.
// Zum Kopieren stehen sie direkt nach dem Anlegen bzw. Erneuern im Klartext da.
// Anlegen, Versenden, Rotieren und Widerrufen laufen über die Edge Function `einladung`.

import { BEREICH_OPTIONS } from '../briefing/create/fieldConfig.js';
import { DRAWER_EXIT_MS } from '../../core/animation/drawer.js';
import { einladungAufruf } from './einladungApi.js';
import {
  MAX_EMPFAENGER,
  istGueltigeEmail,
  ladeAnsprechpartnerGruppen,
  mergeEmpfaenger,
  normalisiereEmail
} from './einladungEmpfaenger.js';

const DRAWER_ID = 'einladung-drawer';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TEXTE = {
  briefing: {
    titel: 'Kunde zum Briefing einladen',
    hinweis: 'Der Kunde füllt das Briefing über Link und Code aus. Es landet als Einreichung auf dem Briefing-Tab dieser Produktion, bis Sie es anlegen.',
    platzhalter: 'z.B. Frau Müller, Marketing'
  },
  produkt: {
    titel: 'Kunde zum Produkt einladen',
    hinweis: 'Der Kunde trägt das Produkt über Link und Code ein. Es landet als Einreichung bei den Produkten, bis Sie es anlegen.',
    platzhalter: 'z.B. Frau Müller, Produktmanagement'
  }
};

export class EinladungDrawer {
  constructor() {
    this.overlay = null;
    this.panel = null;
    this.ctx = null;
    this.codes = {};
    this.freieEmails = [];
    this.gruppen = [];
    this._abort = null;
  }

  /**
   * @param {{ art: 'briefing'|'produkt', produktionId?: string, kampagneId?: string|null,
   *           unternehmenId?: string, markeId?: string|null, kontextName?: string }} ctx
   */
  open(ctx) {
    if (!window.isInternal?.()) return;
    this.ctx = ctx;
    this.codes = {};
    this.freieEmails = [];
    this.gruppen = [];
    this.render();
    void this.ladeListe();
    void this.ladeEmpfaenger();
  }

  close() {
    this._abort?.abort();
    this._abort = null;
    const panel = this.panel;
    const overlay = this.overlay;
    this.panel = null;
    this.overlay = null;
    if (!panel && !overlay) return;
    panel?.classList.remove('show');
    setTimeout(() => {
      overlay?.remove();
      panel?.remove();
    }, DRAWER_EXIT_MS);
  }

  entferneAlt() {
    document.getElementById(`${DRAWER_ID}-overlay`)?.remove();
    document.getElementById(DRAWER_ID)?.remove();
  }

  render() {
    this.entferneAlt();
    this._abort?.abort();
    this._abort = new AbortController();
    const { signal } = this._abort;

    const { art, kontextName } = this.ctx;
    const text = TEXTE[art];

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${DRAWER_ID}-overlay`;

    const panel = document.createElement('div');
    panel.className = 'drawer-panel einladung-drawer';
    panel.id = DRAWER_ID;
    panel.setAttribute('role', 'dialog');
    panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">${esc(text.titel)}</span>
          ${kontextName ? `<p class="drawer-subtitle">${esc(kontextName)}</p>` : ''}
        </div>
        <button type="button" class="drawer-close-btn" data-action="close" aria-label="Schließen">&times;</button>
      </div>
      <div class="drawer-body">
        <p class="einladung-hinweis">${esc(text.hinweis)}</p>

        <section class="einladung-abschnitt">
          <div class="form-group">
            <label class="form-label" for="einladung-label">Name der Einladung (optional)</label>
            <input type="text" id="einladung-label" class="input" maxlength="80" placeholder="${esc(text.platzhalter)}">
          </div>
          ${art === 'briefing' ? `
          <div class="form-group">
            <label class="form-label required" for="einladung-typ">Briefing-Typ</label>
            <select id="einladung-typ" class="input">
              <option value="">Typ wählen …</option>
              ${BEREICH_OPTIONS.map((o) => `<option value="${o.value}">${esc(o.label)} – ${esc(o.desc)}</option>`).join('')}
            </select>
          </div>` : ''}
        </section>

        <section class="einladung-abschnitt">
          <h4 class="drawer-section-title">Per E-Mail senden (optional)</h4>
          <div id="einladung-ap" class="einladung-ap">
            <p class="einladung-hinweis">Ansprechpartner werden geladen …</p>
          </div>
          <div class="form-group">
            <label class="form-label" for="einladung-frei-input">Weitere E-Mail-Adresse</label>
            <div class="tag-input-container">
              <div class="tag-input-wrapper">
                <div class="selected-tags" id="einladung-frei-tags"></div>
                <input type="text" class="tag-input" id="einladung-frei-input"
                       placeholder="E-Mail eingeben, Enter zum Hinzufügen" autocomplete="off">
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="einladung-nachricht">Persönliche Notiz (optional)</label>
            <textarea id="einladung-nachricht" class="input" rows="3" maxlength="500"
                      placeholder="Erscheint in der Mail über dem Link."></textarea>
          </div>
        </section>

        <div id="einladung-banner" class="share-code-banner" hidden></div>

        <section class="einladung-abschnitt">
          <h4 class="drawer-section-title">Aktive Einladungen</h4>
          <div id="einladung-liste" class="share-dialog-empty">Wird geladen …</div>
        </section>
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--secondary" data-action="close">Schließen</button>
        <button type="button" id="einladung-submit" class="mdc-btn mdc-btn--create">Einladung erstellen</button>
      </div>`;

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    this.overlay = overlay;
    this.panel = panel;
    requestAnimationFrame(() => panel.classList.add('show'));

    overlay.addEventListener('click', () => this.close(), { signal });
    panel.querySelectorAll('[data-action="close"]').forEach((btn) =>
      btn.addEventListener('click', () => this.close(), { signal }));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    }, { signal });
    panel.querySelector('#einladung-submit').addEventListener('click', () => this.erstellen(), { signal });

    this.bindFreieAdressen(signal);
  }

  // ─── Empfänger ────────────────────────────────────────────

  async ladeEmpfaenger() {
    const host = this.panel?.querySelector('#einladung-ap');
    if (!host || !window.supabase) return;
    const { kampagneId, unternehmenId, markeId } = this.ctx;
    const { gruppen, ohneMail } = await ladeAnsprechpartnerGruppen(window.supabase, {
      kampagneId,
      unternehmenId,
      markeId
    });
    if (!this.panel) return;
    this.gruppen = gruppen;

    if (!gruppen.length) {
      host.innerHTML = `<p class="einladung-hinweis">Keine Ansprechpartner mit E-Mail hinterlegt. Unten eine Adresse eingeben oder Link und Code kopieren.${ohneMail ? ` (${ohneMail} ohne E-Mail)` : ''}</p>`;
      return;
    }

    host.innerHTML = `
      ${gruppen.map((gruppe) => `
        <div class="einladung-ap-gruppe">
          <span class="einladung-ap-titel">${esc(gruppe.titel)}</span>
          ${gruppe.rows.map((row) => `
            <label class="einladung-ap-zeile">
              <input type="checkbox" data-ap-email="${esc(row.email)}">
              <span class="einladung-ap-name">${esc(row.name)}</span>
              <span class="einladung-ap-mail">${esc(row.email)}</span>
            </label>`).join('')}
        </div>`).join('')}
      ${ohneMail ? `<p class="einladung-hinweis">${ohneMail} Ansprechpartner ohne E-Mail ausgeblendet.</p>` : ''}`;

    host.addEventListener('change', () => this.aktualisiereKnopf(), { signal: this._abort?.signal });
  }

  angehakteEmails() {
    return [...(this.panel?.querySelectorAll('[data-ap-email]:checked') || [])].map((el) => el.dataset.apEmail);
  }

  /** Alle Empfänger: angehakte Ansprechpartner plus freie Adressen, ohne Duplikate. */
  empfaenger() {
    return mergeEmpfaenger(this.angehakteEmails(), this.freieEmails);
  }

  aktualisiereKnopf() {
    const knopf = this.panel?.querySelector('#einladung-submit');
    if (!knopf || knopf.disabled) return;
    knopf.textContent = this.empfaenger().length ? 'Einladung erstellen und senden' : 'Einladung erstellen';
  }

  bindFreieAdressen(signal) {
    const input = this.panel.querySelector('#einladung-frei-input');
    const tags = this.panel.querySelector('#einladung-frei-tags');

    const uebernehmen = (warn) => {
      const raw = input.value.trim().replace(/,$/, '');
      if (!raw) return;
      if (!istGueltigeEmail(raw)) {
        if (warn) window.toastSystem?.warning('Ungültige E-Mail-Adresse.');
        return;
      }
      const email = normalisiereEmail(raw);
      if (!this.freieEmails.includes(email)) this.freieEmails.push(email);
      input.value = '';
      this.zeichneFreieTags();
      this.aktualisiereKnopf();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        uebernehmen(true);
      } else if (e.key === 'Backspace' && !input.value && this.freieEmails.length) {
        this.freieEmails.pop();
        this.zeichneFreieTags();
        this.aktualisiereKnopf();
      }
    }, { signal });
    input.addEventListener('blur', () => uebernehmen(false), { signal });
    tags.addEventListener('click', (e) => {
      const entfernen = e.target.closest('.tag-remove');
      if (!entfernen) return;
      this.freieEmails = this.freieEmails.filter((email) => email !== entfernen.dataset.email);
      this.zeichneFreieTags();
      this.aktualisiereKnopf();
    }, { signal });
  }

  zeichneFreieTags() {
    const el = this.panel?.querySelector('#einladung-frei-tags');
    if (!el) return;
    el.innerHTML = this.freieEmails.map((email) => `
      <span class="tag-item" data-email="${esc(email)}">
        ${esc(email)}
        <span class="tag-remove" data-email="${esc(email)}">&times;</span>
      </span>`).join('');
  }

  nachricht() {
    return (this.panel?.querySelector('#einladung-nachricht')?.value || '').trim();
  }

  /** Prüft die Empfängerzahl. Rückgabe: Liste oder null (mit Hinweis). */
  empfaengerOderNull() {
    const emails = this.empfaenger();
    if (emails.length > MAX_EMPFAENGER) {
      window.toastSystem?.warning(`Höchstens ${MAX_EMPFAENGER} Empfänger pro Versand.`);
      return null;
    }
    return emails;
  }

  // ─── Anlegen ──────────────────────────────────────────────

  async erstellen() {
    const { art, produktionId, unternehmenId, markeId } = this.ctx;
    const label = this.panel.querySelector('#einladung-label').value.trim();
    const typ = this.panel.querySelector('#einladung-typ')?.value || '';
    if (art === 'briefing' && !typ) {
      window.toastSystem?.warning('Bitte den Briefing-Typ wählen.');
      return;
    }
    const emails = this.empfaengerOderNull();
    if (!emails) return;

    const knopf = this.panel.querySelector('#einladung-submit');
    knopf.disabled = true;
    knopf.textContent = emails.length ? 'Wird erstellt und gesendet …' : 'Wird erstellt …';
    try {
      const antwort = await einladungAufruf('create', {
        art,
        label,
        produktionId: art === 'briefing' ? produktionId : undefined,
        briefingTyp: art === 'briefing' ? typ : undefined,
        unternehmenId: art === 'produkt' ? unternehmenId : undefined,
        markeId: art === 'produkt' ? (markeId || undefined) : undefined,
        emails: emails.length ? emails : undefined,
        nachricht: emails.length ? this.nachricht() : undefined
      });
      if (!antwort.ok) {
        window.toastSystem?.error(antwort.fehler || 'Einladung konnte nicht angelegt werden.');
        return;
      }
      if (!this.panel) return;
      const { einladungId, link, code } = antwort.data;
      this.codes[einladungId] = code;
      this.meldeVersand(antwort.data, emails);
      this.zeigeBanner(link, code, antwort.data);
      this.panel.querySelector('#einladung-label').value = '';
      this.leereEmpfaenger();
      await this.ladeListe();
    } catch (err) {
      console.error('Einladung anlegen fehlgeschlagen:', err);
      window.toastSystem?.error('Einladung konnte nicht angelegt werden.');
    } finally {
      if (knopf.isConnected) {
        knopf.disabled = false;
        this.aktualisiereKnopf();
      }
    }
  }

  leereEmpfaenger() {
    this.panel?.querySelectorAll('[data-ap-email]:checked').forEach((el) => { el.checked = false; });
    this.freieEmails = [];
    this.zeichneFreieTags();
    const notiz = this.panel?.querySelector('#einladung-nachricht');
    if (notiz) notiz.value = '';
  }

  /** Toast nach Anlegen oder erneutem Senden. */
  meldeVersand(daten, angefragt) {
    const gesendet = daten.gesendet || [];
    const fehl = daten.fehlgeschlagen || [];
    if (!angefragt.length) {
      window.toastSystem?.success('Einladung angelegt.');
      return;
    }
    if (fehl.length && !gesendet.length) {
      const grund = daten.fehler ? ` (${daten.fehler})` : '';
      window.toastSystem?.warning(`Einladung angelegt, aber die Mail ging nicht raus${grund}. Link und Code unten kopieren.`);
    } else if (fehl.length) {
      window.toastSystem?.warning(`Gesendet an ${gesendet.length}, nicht zugestellt an: ${fehl.join(', ')}`);
    } else {
      window.toastSystem?.success(`Einladung angelegt und an ${gesendet.length} gesendet.`);
    }
  }

  zeigeBanner(link, code, daten = {}) {
    const banner = this.panel?.querySelector('#einladung-banner');
    if (!banner || !code) return;
    const gesendet = daten.gesendet || [];
    const fehl = daten.fehlgeschlagen || [];
    const titel = gesendet.length
      ? `Gesendet an ${gesendet.join(', ')}. Der Code steht nur jetzt im Klartext da.`
      : 'Einladung bereit. Der Code steht nur jetzt im Klartext da.';
    banner.hidden = false;
    banner.innerHTML = `
      <div class="share-code-banner-title">${esc(titel)}</div>
      ${fehl.length ? `<div class="einladung-banner-fehler">Nicht zugestellt: ${esc(fehl.join(', '))}${daten.fehler ? ` – ${esc(daten.fehler)}` : ''}</div>` : ''}
      <div class="share-code-banner-row">
        <span class="share-code-value">${esc(code)}</span>
        <button type="button" class="share-inline-btn" data-copy="${esc(code)}">Code kopieren</button>
      </div>
      ${link ? `<div class="share-code-banner-row">
        <span class="share-link-value">${esc(link)}</span>
        <button type="button" class="share-inline-btn" data-copy="${esc(link)}">Link kopieren</button>
      </div>` : ''}`;
    banner.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', () => this.kopiere(btn.dataset.copy, btn));
    });
    banner.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }

  // ─── Liste aktiver Einladungen ────────────────────────────

  async ladeListe() {
    const container = this.panel?.querySelector('#einladung-liste');
    if (!container) return;
    const { art, produktionId, unternehmenId, markeId } = this.ctx;

    let query = window.supabase
      .from('einladung')
      .select('id, token, art, label, briefing_typ, created_at, last_access_at, expires_at')
      .eq('art', art)
      .is('revoked_at', null)
      .order('created_at', { ascending: false });
    if (art === 'briefing') {
      query = query.eq('produktion_id', produktionId);
    } else {
      query = query.eq('unternehmen_id', unternehmenId);
      query = markeId ? query.eq('marke_id', markeId) : query.is('marke_id', null);
    }
    const { data, error } = await query;
    if (!this.panel) return;

    if (error) {
      container.className = '';
      container.innerHTML = '<p class="share-dialog-empty">Fehler beim Laden.</p>';
      return;
    }
    if (!data?.length) {
      container.className = '';
      container.innerHTML = '<p class="share-dialog-empty">Noch keine Einladungen.</p>';
      return;
    }

    const typLabel = Object.fromEntries(BEREICH_OPTIONS.map((o) => [o.value, o.label]));
    container.className = 'share-access-list';
    container.innerHTML = data.map((e) => {
      const zuletzt = e.last_access_at
        ? `zuletzt geöffnet ${new Date(e.last_access_at).toLocaleDateString('de-DE')}`
        : 'noch nicht geöffnet';
      const typ = e.briefing_typ ? `${typLabel[e.briefing_typ] || e.briefing_typ} · ` : '';
      const frisch = this.codes[e.id];
      return `
        <div class="share-recipient-row share-access-row" data-einladung-id="${e.id}">
          <div class="share-recipient-info">
            <span class="share-recipient-email">${esc(e.label || 'Einladung')}</span>
            <span class="share-recipient-meta">${esc(typ)}${zuletzt}</span>
            ${frisch ? `<span class="share-fresh-code">Code: ${esc(frisch)}</span>` : ''}
          </div>
          <div class="share-recipient-actions">
            <button type="button" class="share-recipient-revoke" data-copy="${esc(`${window.location.origin}/einladung/${e.token}`)}">Link</button>
            <button type="button" class="share-recipient-revoke" data-resend="${e.id}">Erneut senden</button>
            <button type="button" class="share-recipient-revoke" data-rotate="${e.id}">Code erneuern</button>
            <button type="button" class="share-recipient-revoke" data-revoke="${e.id}">Widerrufen</button>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', () => this.kopiere(btn.dataset.copy, btn));
    });
    container.querySelectorAll('[data-resend]').forEach((btn) => {
      btn.addEventListener('click', () => this.sendeErneut(btn.dataset.resend, btn));
    });
    container.querySelectorAll('[data-rotate]').forEach((btn) => {
      btn.addEventListener('click', () => this.erneuere(btn.dataset.rotate));
    });
    container.querySelectorAll('[data-revoke]').forEach((btn) => {
      btn.addEventListener('click', () => this.widerrufe(btn.dataset.revoke));
    });
  }

  /** Neuer Code, dann Mail an die oben gewählten Empfänger (der alte Code ist nur als Hash gespeichert). */
  async sendeErneut(einladungId, knopf) {
    const emails = this.empfaengerOderNull();
    if (!emails) return;
    if (!emails.length) {
      window.toastSystem?.warning('Bitte oben Empfänger anhaken oder eine Adresse eingeben.');
      return;
    }
    const vorher = knopf?.textContent;
    if (knopf) {
      knopf.disabled = true;
      knopf.textContent = 'Wird gesendet …';
    }
    try {
      const antwort = await einladungAufruf('resend', { einladungId, emails, nachricht: this.nachricht() });
      if (!antwort.ok) {
        window.toastSystem?.error(antwort.fehler || 'Versand fehlgeschlagen.');
        return;
      }
      if (!this.panel) return;
      this.codes[einladungId] = antwort.data.code;
      this.meldeVersand(antwort.data, emails);
      this.zeigeBanner(antwort.data.link, antwort.data.code, antwort.data);
      this.leereEmpfaenger();
      await this.ladeListe();
    } catch (err) {
      console.error('Erneuter Versand fehlgeschlagen:', err);
      window.toastSystem?.error('Versand fehlgeschlagen.');
    } finally {
      if (knopf?.isConnected) {
        knopf.disabled = false;
        knopf.textContent = vorher;
      }
    }
  }

  async erneuere(einladungId) {
    const antwort = await einladungAufruf('rotate_code', { einladungId });
    if (!antwort.ok || !antwort.data?.code) {
      window.toastSystem?.error(antwort.fehler || 'Code konnte nicht erneuert werden.');
      return;
    }
    this.codes[einladungId] = antwort.data.code;
    this.zeigeBanner(null, antwort.data.code);
    window.toastSystem?.success('Neuer Code erzeugt.');
    await this.ladeListe();
  }

  async widerrufe(einladungId) {
    const antwort = await einladungAufruf('revoke', { einladungId });
    if (!antwort.ok) {
      window.toastSystem?.error(antwort.fehler || 'Widerruf fehlgeschlagen.');
      return;
    }
    delete this.codes[einladungId];
    window.toastSystem?.success('Einladung widerrufen.');
    await this.ladeListe();
  }

  async kopiere(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      const vorher = btn.textContent;
      btn.textContent = 'Kopiert';
      setTimeout(() => { btn.textContent = vorher; }, 1200);
    } catch {
      window.toastSystem?.warning('Kopieren fehlgeschlagen.');
    }
  }
}

export const einladungDrawer = new EinladungDrawer();

export function openEinladungDialog(ctx) {
  einladungDrawer.open(ctx);
}
