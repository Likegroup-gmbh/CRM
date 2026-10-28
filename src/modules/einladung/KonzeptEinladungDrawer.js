// KonzeptEinladungDrawer.js
// „Konzept einholen“ (ADR 0059): je Casting-Eintrag eine eigene Einladung, über die der Creator
// das Creator-Sheet ausfüllt. Ein Eintrag hat höchstens eine aktive Einladung, eine neue löst
// die alte ab. Die Mail geht an die Creator-Mail, sonst an die Management-Mail der aktiven
// Zuordnung; ohne beides bleibt Link und Code zum Kopieren. Der Code steht nur direkt nach dem
// Anlegen im Klartext da (die Datenbank hält nur den Hash).
// Anlegen läuft über die Edge Function `einladung` (art `konzept`).

import { DRAWER_EXIT_MS } from '../../core/animation/drawer.js';
import { einladungAufruf } from './einladungApi.js';

const DRAWER_ID = 'konzept-einladung-drawer';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Mailziel wie in der Edge Function: Creator-Mail, sonst aktive Management-Mail, sonst null. */
export function konzeptMailziel(creator) {
  const direkt = String(creator?.mail ?? '').trim().toLowerCase();
  if (direkt) return direkt;
  for (const z of creator?.creator_management || []) {
    const m = String(z?.management?.email ?? '').trim().toLowerCase();
    if (z?.ist_aktiv && m) return m;
  }
  return null;
}

/** Eintrag mit Mailziel und aktiver Einladung für die Anzeige im Drawer. */
export async function ladeKonzeptEintraege(itemIds) {
  if (!window.supabase || !itemIds.length) return [];
  const { data: items, error } = await window.supabase
    .from('creator_auswahl_items')
    .select('id, name, creator_id, creator:creator_id(mail, creator_management(ist_aktiv, management:management_id(email)))')
    .in('id', itemIds);
  if (error) throw error;

  const { data: aktive } = await window.supabase
    .from('einladung')
    .select('creator_auswahl_item_id')
    .eq('art', 'konzept')
    .is('revoked_at', null)
    .in('creator_auswahl_item_id', itemIds);
  const aktivIds = new Set((aktive || []).map((e) => e.creator_auswahl_item_id));

  const nachId = new Map((items || []).map((i) => [i.id, i]));
  return itemIds.map((id) => nachId.get(id)).filter(Boolean).map((i) => ({
    id: i.id,
    name: i.name || 'Ohne Namen',
    mailAn: konzeptMailziel(i.creator),
    hatAktive: aktivIds.has(i.id)
  }));
}

export class KonzeptEinladungDrawer {
  constructor() {
    this.overlay = null;
    this.panel = null;
    this.ctx = null;
    this.eintraege = [];
    this._abort = null;
  }

  /** @param {{ art: 'konzept', itemIds: string[], kontextName?: string, uebersprungen?: number, onFertig?: () => void }} ctx */
  async open(ctx) {
    if (!window.isInternal?.()) return;
    this.ctx = ctx;
    this.eintraege = [];
    this.render();
    try {
      this.eintraege = await ladeKonzeptEintraege(ctx.itemIds);
    } catch (error) {
      console.error('Konzept-Einladung: Einträge laden fehlgeschlagen:', error);
      window.toastSystem?.error('Die Einträge konnten nicht geladen werden.');
      this.close();
      return;
    }
    if (!this.panel) return;
    this.zeichneEintraege();
  }

  close() {
    this._abort?.abort();
    this._abort = null;
    const { panel, overlay } = this;
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
    const { kontextName, uebersprungen } = this.ctx;

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
          <span class="drawer-title">Konzept einholen</span>
          ${kontextName ? `<p class="drawer-subtitle">${esc(kontextName)}</p>` : ''}
        </div>
        <button type="button" class="drawer-close-btn" data-action="close" aria-label="Schließen">&times;</button>
      </div>
      <div class="drawer-body">
        <p class="einladung-hinweis">Jeder Creator bekommt einen eigenen Link mit Code und füllt das Creator-Sheet aus. Die Idee landet als Einreichung auf dem Konzepte-Tab dieser Linie, bis du sie anlegst. Eine bestehende Einladung desselben Eintrags wird abgelöst.</p>
        ${uebersprungen ? `<p class="einladung-hinweis">${uebersprungen} Eintrag${uebersprungen === 1 ? '' : 'e'} übersprungen (vom Kunden abgelehnt, abgesagt oder unter „Nicht umsetzen“).</p>` : ''}

        <section class="einladung-abschnitt">
          <h4 class="drawer-section-title">Creator</h4>
          <div id="konzept-einladung-liste" class="share-dialog-empty">Wird geladen …</div>
        </section>

        <section class="einladung-abschnitt">
          <label class="einladung-ap-zeile">
            <input type="checkbox" id="konzept-einladung-senden" checked>
            <span class="einladung-ap-name">Per E-Mail senden, wo eine Adresse hinterlegt ist</span>
          </label>
          <div class="form-group">
            <label class="form-label" for="konzept-einladung-nachricht">Persönliche Notiz (optional)</label>
            <textarea id="konzept-einladung-nachricht" class="input" rows="3" maxlength="500"
                      placeholder="Erscheint in der Mail über dem Link."></textarea>
          </div>
        </section>

        <section class="einladung-abschnitt" id="konzept-einladung-ergebnis" hidden>
          <h4 class="drawer-section-title">Link und Code</h4>
          <p class="einladung-hinweis">Die Codes stehen nur jetzt im Klartext da.</p>
          <div id="konzept-einladung-ergebnis-liste" class="share-access-list"></div>
        </section>
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--secondary" data-action="close">Schließen</button>
        <button type="button" id="konzept-einladung-submit" class="mdc-btn mdc-btn--create" disabled>Einladungen erstellen</button>
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
    panel.querySelector('#konzept-einladung-submit').addEventListener('click', () => this.erstellen(), { signal });
    panel.querySelector('#konzept-einladung-senden').addEventListener('change', () => this.aktualisiereKnopf(), { signal });
  }

  zeichneEintraege() {
    const host = this.panel?.querySelector('#konzept-einladung-liste');
    if (!host) return;
    host.className = 'einladung-ap';
    host.innerHTML = this.eintraege.map((e) => `
      <div class="einladung-ap-zeile" data-eintrag-id="${esc(e.id)}">
        <span class="einladung-ap-name">${esc(e.name)}</span>
        <span class="einladung-ap-mail">${e.mailAn ? esc(e.mailAn) : 'nur Link und Code'}${e.hatAktive ? ' · löst aktive Einladung ab' : ''}</span>
      </div>`).join('') || '<p class="einladung-hinweis">Keine Einträge.</p>';
    this.aktualisiereKnopf();
  }

  senden() {
    return this.panel?.querySelector('#konzept-einladung-senden')?.checked !== false;
  }

  aktualisiereKnopf() {
    const knopf = this.panel?.querySelector('#konzept-einladung-submit');
    if (!knopf) return;
    knopf.disabled = this.eintraege.length === 0;
    const mails = this.eintraege.filter((e) => e.mailAn).length;
    knopf.textContent = this.senden() && mails ? 'Einladungen erstellen und senden' : 'Einladungen erstellen';
  }

  async erstellen() {
    const knopf = this.panel.querySelector('#konzept-einladung-submit');
    knopf.disabled = true;
    knopf.textContent = 'Wird erstellt …';
    try {
      const antwort = await einladungAufruf('create', {
        art: 'konzept',
        creatorAuswahlItemIds: this.eintraege.map((e) => e.id),
        versenden: this.senden(),
        nachricht: this.panel.querySelector('#konzept-einladung-nachricht').value.trim() || undefined
      });
      if (!antwort.ok) {
        window.toastSystem?.error(antwort.fehler || 'Einladungen konnten nicht angelegt werden.');
        return;
      }
      if (!this.panel) return;
      this.zeigeErgebnis(antwort.data.einladungen || []);
      this.ctx.onFertig?.();
    } catch (err) {
      console.error('Konzept-Einladung anlegen fehlgeschlagen:', err);
      window.toastSystem?.error('Einladungen konnten nicht angelegt werden.');
    } finally {
      if (knopf.isConnected) {
        knopf.disabled = true;
        knopf.textContent = 'Erledigt';
      }
    }
  }

  zeigeErgebnis(ergebnisse) {
    const bereich = this.panel?.querySelector('#konzept-einladung-ergebnis');
    const liste = this.panel?.querySelector('#konzept-einladung-ergebnis-liste');
    if (!bereich || !liste) return;
    const ok = ergebnisse.filter((r) => r.einladungId);
    const fehler = ergebnisse.filter((r) => !r.einladungId);
    const gesendet = ok.filter((r) => r.gesendet).length;

    liste.innerHTML = [
      ...ok.map((r) => `
        <div class="share-recipient-row share-access-row">
          <div class="share-recipient-info">
            <span class="share-recipient-email">${esc(r.name || 'Creator')}</span>
            <span class="share-recipient-meta">${r.gesendet ? `Gesendet an ${esc(r.mailAn)}` : (r.mailAn ? `Mail an ${esc(r.mailAn)} nicht zugestellt${r.fehler ? ` (${esc(r.fehler)})` : ''}` : 'Keine Adresse hinterlegt')}</span>
            <span class="share-fresh-code">Code: ${esc(r.code)}</span>
          </div>
          <div class="share-recipient-actions">
            <button type="button" class="share-recipient-revoke" data-copy="${esc(r.code)}">Code kopieren</button>
            <button type="button" class="share-recipient-revoke" data-copy="${esc(r.link)}">Link kopieren</button>
          </div>
        </div>`),
      ...fehler.map((r) => `
        <div class="share-recipient-row share-access-row">
          <div class="share-recipient-info">
            <span class="share-recipient-email">${esc(r.name || 'Eintrag')}</span>
            <span class="einladung-banner-fehler">${esc(r.fehler || 'Nicht angelegt.')}</span>
          </div>
        </div>`)
    ].join('');
    bereich.hidden = false;
    liste.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', () => this.kopiere(btn.dataset.copy, btn));
    });

    if (ok.length) {
      window.toastSystem?.success(gesendet
        ? `${ok.length} Einladung${ok.length === 1 ? '' : 'en'} angelegt, ${gesendet} per Mail gesendet.`
        : `${ok.length} Einladung${ok.length === 1 ? '' : 'en'} angelegt.`);
    }
    if (fehler.length) window.toastSystem?.warning(`${fehler.length} Eintrag${fehler.length === 1 ? '' : 'e'} nicht eingeladen.`);
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

export const konzeptEinladungDrawer = new KonzeptEinladungDrawer();

export function openKonzeptEinladung(ctx) {
  return konzeptEinladungDrawer.open(ctx);
}
