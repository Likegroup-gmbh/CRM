// EinladungDialog.js
// Mitarbeiter laden einen Kunden zu einem Formular ein (ADR 0055):
//  - Briefing: aus der Produktion, mit Briefing-Typ
//  - Produkt: an der Marke (sonst am Unternehmen)
// Link und Code stehen nur direkt nach dem Anlegen bzw. Erneuern im Klartext da.
// Anlegen, Rotieren und Widerrufen laufen über die Edge Function `einladung`.

import { BEREICH_OPTIONS } from '../briefing/create/fieldConfig.js';
import { einladungAufruf } from './einladungApi.js';

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
    standardName: 'Briefing-Einladung',
    platzhalter: 'z.B. Frau Müller, Marketing'
  },
  produkt: {
    titel: 'Kunde zum Produkt einladen',
    hinweis: 'Der Kunde trägt das Produkt über Link und Code ein. Es landet als Einreichung bei den Produkten, bis Sie es anlegen.',
    standardName: 'Produkt-Einladung',
    platzhalter: 'z.B. Frau Müller, Produktmanagement'
  }
};

export class EinladungDialog {
  constructor() {
    this.overlay = null;
    this.ctx = null;
    this.codes = {};
  }

  /**
   * @param {{ art: 'briefing'|'produkt', produktionId?: string, unternehmenId?: string, markeId?: string|null,
   *           kontextName?: string }} ctx
   */
  open(ctx) {
    if (!window.isInternal?.()) return;
    this.ctx = ctx;
    this.codes = {};
    this.render();
    void this.ladeListe();
  }

  close() {
    this.overlay?.remove();
    this.overlay = null;
  }

  render() {
    this.close();
    const { art, kontextName } = this.ctx;
    const text = TEXTE[art];
    const overlay = document.createElement('div');
    overlay.className = 'modal overlay-modal share-list-modal einladung-dialog';
    overlay.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>${esc(text.titel)}</h3>
          <button type="button" class="modal-close" data-action="close" aria-label="Schließen">&times;</button>
        </div>
        <div class="modal-body">
          ${kontextName ? `<p class="modal-description">Für: <strong>${esc(kontextName)}</strong></p>` : ''}
          <p class="modal-description">${esc(text.hinweis)}</p>
          <div class="share-dialog-form">
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
          </div>
          <div id="einladung-banner" class="share-code-banner" hidden></div>
          <div class="share-dialog-list">
            <h4 class="nutzungsrechte-section-title">Aktive Einladungen</h4>
            <div id="einladung-liste" class="share-dialog-empty">Wird geladen …</div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="mdc-btn mdc-btn--secondary" data-action="cancel">Schließen</button>
          <button type="button" id="einladung-submit" class="mdc-btn mdc-btn--create">Einladung erstellen</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    this.overlay = overlay;

    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.close(); });
    overlay.querySelector('[data-action="close"]').addEventListener('click', () => this.close());
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => this.close());
    overlay.querySelector('#einladung-submit').addEventListener('click', () => this.erstellen());
  }

  async erstellen() {
    const { art, produktionId, unternehmenId, markeId } = this.ctx;
    const label = this.overlay.querySelector('#einladung-label').value.trim();
    const typ = this.overlay.querySelector('#einladung-typ')?.value || '';
    if (art === 'briefing' && !typ) {
      window.toastSystem?.warning('Bitte den Briefing-Typ wählen.');
      return;
    }

    const knopf = this.overlay.querySelector('#einladung-submit');
    knopf.disabled = true;
    knopf.textContent = 'Wird erstellt …';
    try {
      const antwort = await einladungAufruf('create', {
        art,
        label,
        produktionId: art === 'briefing' ? produktionId : undefined,
        briefingTyp: art === 'briefing' ? typ : undefined,
        unternehmenId: art === 'produkt' ? unternehmenId : undefined,
        markeId: art === 'produkt' ? (markeId || undefined) : undefined
      });
      if (!antwort.ok) {
        window.toastSystem?.error(antwort.fehler || 'Einladung konnte nicht angelegt werden.');
        return;
      }
      const { einladungId, link, code } = antwort.data;
      this.codes[einladungId] = code;
      this.zeigeBanner(link, code);
      window.toastSystem?.success('Einladung angelegt.');
      this.overlay.querySelector('#einladung-label').value = '';
      await this.ladeListe();
    } catch (err) {
      console.error('Einladung anlegen fehlgeschlagen:', err);
      window.toastSystem?.error('Einladung konnte nicht angelegt werden.');
    } finally {
      knopf.disabled = false;
      knopf.textContent = 'Einladung erstellen';
    }
  }

  zeigeBanner(link, code) {
    const banner = this.overlay?.querySelector('#einladung-banner');
    if (!banner || !code) return;
    banner.hidden = false;
    banner.innerHTML = `
      <div class="share-code-banner-title">Einladung bereit. Der Code steht nur jetzt im Klartext da.</div>
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
  }

  async ladeListe() {
    const container = this.overlay?.querySelector('#einladung-liste');
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
    if (!this.overlay) return;

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
            <button type="button" class="share-recipient-revoke" data-rotate="${e.id}">Code erneuern</button>
            <button type="button" class="share-recipient-revoke" data-revoke="${e.id}">Widerrufen</button>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', () => this.kopiere(btn.dataset.copy, btn));
    });
    container.querySelectorAll('[data-rotate]').forEach((btn) => {
      btn.addEventListener('click', () => this.erneuere(btn.dataset.rotate));
    });
    container.querySelectorAll('[data-revoke]').forEach((btn) => {
      btn.addEventListener('click', () => this.widerrufe(btn.dataset.revoke));
    });
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

export const einladungDialog = new EinladungDialog();

export function openEinladungDialog(ctx) {
  einladungDialog.open(ctx);
}
