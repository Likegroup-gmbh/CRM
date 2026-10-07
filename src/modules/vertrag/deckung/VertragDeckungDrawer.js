// VertragDeckungDrawer.js
// Zwei Einstiege in dieselbe Verknuepfung (ADR 0047):
//   openVertrag(vertragId)      am Vertrag: gedeckte Kooperationen, Rest, weitere Kooperation hinzufuegen
//   openKooperation(koopId)     an der Kooperation: bestehenden Vertrag verknuepfen
// Das PDF aendert sich nie; die Verknuepfung ist operativ.

import { escapeHtml } from '../../../core/format.js';
import { vertragStatusLabel } from '../vertragStatus.js';
import {
  ladeGedeckteKooperationen,
  ladeVerknuepfbareVertraege,
  verknuepfeKooperation,
  loeseKooperation,
  verknuepfSperre,
  videoDeckung,
  geldDeckung,
  deckungGrundText
} from './vertragDeckung.js';

const KOOP_COLS = 'id, name, creator_id, kampagne_id, videoanzahl, einkaufspreis_netto, ksk_selbstzahler, ksk_betrag, created_at';
const VERTRAG_COLS = 'id, name, typ, status, creator_id, kampagne_id, anzahl_videos, verguetung_netto, kooperation_id';

const euro = (n) => `${(Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const koopLabel = (k) => `${escapeHtml(k.name || k.id)} · ${k.videoanzahl || 0} Video(s)`;

function toast(message, type = 'success') {
  window.toastSystem?.show(message, type);
}

export class VertragDeckungDrawer {
  constructor() {
    this.drawerId = 'vertrag-deckung-drawer';
    this.onDone = null;
    this._busy = false;
    this._reload = null;
    this._changed = false;
  }

  async openVertrag(vertragId, onDone) {
    this.onDone = onDone || null;
    this._reload = () => this._renderVertrag(vertragId);
    this._create('Kooperationen am Vertrag');
    await this._reload();
  }

  async openKooperation(kooperationId, onDone) {
    this.onDone = onDone || null;
    this._reload = () => this._renderKooperation(kooperationId);
    this._create('Bestehenden Vertrag verknüpfen');
    await this._reload();
  }

  // ---------------------------------------------------------------- Vertrag-Sicht

  async _renderVertrag(vertragId) {
    this._body('<div class="text-muted">Lädt…</div>');
    try {
      const db = window.supabase;
      const { data: vertrag, error } = await db.from('vertraege').select(VERTRAG_COLS).eq('id', vertragId).single();
      if (error || !vertrag) throw new Error(error?.message || 'Vertrag nicht gefunden');

      const gedeckt = (await ladeGedeckteKooperationen([vertragId], db)).get(vertragId) || [];
      const kandidaten = await this._kandidaten(vertrag, gedeckt);
      const video = videoDeckung(vertrag, gedeckt);
      const geld = geldDeckung(vertrag, gedeckt);

      const videoZeile = video.aktiv
        ? `${video.summe} von ${video.limit} Videos verplant, Rest ${video.rest}`
        : `${video.summe} Videos verplant (der Vertrag nennt keine Videoanzahl)`;
      const geldHinweis = geld.ueber
        ? `<div class="deckung-hinweis deckung-hinweis--warn">Einkauf der Kooperationen ${euro(geld.summe)} liegt über der Vertragsvergütung ${euro(geld.verguetung)}. Das ist ein Hinweis, keine Sperre.</div>`
        : '';

      this._body(`
        <div class="deckung-section">
          <div class="deckung-titel">${escapeHtml(vertrag.name || 'Vertrag')}</div>
          <div class="deckung-meta">${escapeHtml(vertrag.typ || '')} · ${escapeHtml(vertragStatusLabel(vertrag.status))}</div>
          <div class="deckung-meta" data-deckung-videos>${videoZeile}</div>
          ${geldHinweis}
        </div>
        <div class="deckung-section">
          <div class="deckung-titel">Gedeckte Kooperationen</div>
          ${gedeckt.length ? gedeckt.map((k) => `
            <div class="deckung-row" data-koop-id="${k.id}">
              <span>${koopLabel(k)}</span>
              ${gedeckt.length > 1 ? `<button type="button" class="mdc-btn mdc-btn--cancel" data-deckung-loesen="${k.id}">Lösen</button>` : ''}
            </div>`).join('') : '<div class="text-muted">Keine Kooperation gedeckt.</div>'}
        </div>
        <div class="deckung-section">
          <div class="deckung-titel">Kooperation hinzufügen</div>
          ${kandidaten.length ? kandidaten.map(({ koop, sperre }) => `
            <div class="deckung-row" data-koop-id="${koop.id}">
              <span>${koopLabel(koop)}</span>
              ${sperre
                ? `<span class="text-muted" data-deckung-sperre>${escapeHtml(deckungGrundText(sperre, vertrag, gedeckt, koop))}</span>`
                : `<button type="button" class="mdc-btn mdc-btn--primary" data-deckung-add="${koop.id}">Hinzufügen</button>`}
            </div>`).join('') : '<div class="text-muted">Keine weiteren Kooperationen dieses Creators in dieser Kampagne.</div>'}
        </div>
      `);

      this._bind({
        add: (koopId) => this._run(() => verknuepfeKooperation(vertragId, koopId), 'Kooperation hinzugefügt'),
        loesen: (koopId) => this._run(() => loeseKooperation(vertragId, koopId), 'Kooperation gelöst')
      });
    } catch (err) {
      this._body(`<div class="upload-error-msg">${escapeHtml(err.message || String(err))}</div>`);
    }
  }

  /** Kooperationen desselben Creators und derselben Kampagne, die der Vertrag noch nicht deckt. */
  async _kandidaten(vertrag, gedeckt) {
    if (!vertrag.creator_id || !vertrag.kampagne_id || vertrag.typ === 'Contracting' || vertrag.status === 'abgelehnt') {
      return [];
    }
    const db = window.supabase;
    const { data: koops, error } = await db.from('kooperationen').select(KOOP_COLS)
      .eq('creator_id', vertrag.creator_id).eq('kampagne_id', vertrag.kampagne_id)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);

    const gedecktIds = new Set(gedeckt.map((k) => k.id));
    const offen = (koops || []).filter((k) => !gedecktIds.has(k.id));
    if (!offen.length) return [];

    // Kooperationen mit eigenem, nicht abgelehntem Vertrag sind belegt
    const ids = offen.map((k) => k.id);
    const [junction, erzeuger] = await Promise.all([
      db.from('vertrag_kooperation').select('kooperation_id').in('kooperation_id', ids),
      db.from('vertraege').select('kooperation_id').in('kooperation_id', ids).neq('status', 'abgelehnt').neq('id', vertrag.id)
    ]);
    const belegt = new Set([...(junction.data || []), ...(erzeuger.data || [])].map((r) => r.kooperation_id));

    return offen.map((koop) => ({
      koop,
      sperre: belegt.has(koop.id) ? 'bereits_gedeckt' : verknuepfSperre(vertrag, koop, gedeckt)
    }));
  }

  // ---------------------------------------------------------------- Kooperation-Sicht

  async _renderKooperation(kooperationId) {
    this._body('<div class="text-muted">Lädt…</div>');
    try {
      const db = window.supabase;
      const { data: koop, error } = await db.from('kooperationen').select(KOOP_COLS).eq('id', kooperationId).single();
      if (error || !koop) throw new Error(error?.message || 'Kooperation nicht gefunden');

      const { data: bindung } = await db.from('vertrag_kooperation')
        .select('vertrag_id, vertraege(id, name, typ, status)').eq('kooperation_id', kooperationId).maybeSingle();
      if (bindung?.vertraege) {
        const v = bindung.vertraege;
        const gedeckt = (await ladeGedeckteKooperationen([v.id], db)).get(v.id) || [];
        this._body(`
          <div class="deckung-section">
            <div class="deckung-titel">${koopLabel(koop)}</div>
            <div class="deckung-row">
              <span>Gedeckt von ${escapeHtml(v.name || 'Vertrag')} (${escapeHtml(vertragStatusLabel(v.status))})</span>
              ${gedeckt.length > 1 ? `<button type="button" class="mdc-btn mdc-btn--cancel" data-deckung-loesen="${v.id}">Lösen</button>` : ''}
            </div>
          </div>`);
        this._bind({ loesen: (vertragId) => this._run(() => loeseKooperation(vertragId, kooperationId), 'Verknüpfung gelöst') });
        return;
      }

      const treffer = await ladeVerknuepfbareVertraege(koop, db);
      this._body(`
        <div class="deckung-section">
          <div class="deckung-titel">${koopLabel(koop)}</div>
          <div class="deckung-meta">Gleicher Creator, gleiche Kampagne, der Vertrag nennt noch genug Videos.</div>
        </div>
        <div class="deckung-section">
          ${treffer.length ? treffer.map(({ vertrag, deckung }) => `
            <div class="deckung-row" data-vertrag-id="${vertrag.id}">
              <span>${escapeHtml(vertrag.name || 'Vertrag')} · ${escapeHtml(vertrag.typ || '')} · ${escapeHtml(vertragStatusLabel(vertrag.status))}
                ${deckung.aktiv ? ` · mit dieser Kooperation ${deckung.summe} von ${deckung.limit} Videos` : ''}</span>
              <button type="button" class="mdc-btn mdc-btn--primary" data-deckung-add="${vertrag.id}">Verknüpfen</button>
            </div>`).join('') : '<div class="text-muted">Kein passender Vertrag. Lege einen neuen Vertrag an.</div>'}
        </div>`);
      this._bind({ add: (vertragId) => this._run(() => verknuepfeKooperation(vertragId, kooperationId), 'Vertrag verknüpft') });
    } catch (err) {
      this._body(`<div class="upload-error-msg">${escapeHtml(err.message || String(err))}</div>`);
    }
  }

  // ---------------------------------------------------------------- Gerüst

  _bind({ add, loesen }) {
    const body = document.getElementById(`${this.drawerId}-body`);
    body?.querySelectorAll('[data-deckung-add]').forEach((btn) => {
      btn.addEventListener('click', () => add?.(btn.dataset.deckungAdd));
    });
    body?.querySelectorAll('[data-deckung-loesen]').forEach((btn) => {
      btn.addEventListener('click', () => loesen?.(btn.dataset.deckungLoesen));
    });
  }

  async _run(aktion, erfolgText) {
    if (this._busy) return;
    this._busy = true;
    try {
      await aktion();
      this._changed = true;
      toast(erfolgText, 'success');
      await this._reload?.();
    } catch (err) {
      toast(err.message || String(err), 'error');
    } finally {
      this._busy = false;
    }
  }

  _body(html) {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (body) body.innerHTML = `<div class="vertrag-deckung-content">${html}</div>`;
  }

  _create(titel) {
    this.close(true);
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;
    overlay.addEventListener('click', () => this.close());

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;
    panel.innerHTML = `
      <div class="drawer-header">
        <div><span class="drawer-title">${escapeHtml(titel)}</span></div>
        <div><button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button></div>
      </div>
      <div class="drawer-body" id="${this.drawerId}-body"></div>`;
    panel.querySelector('.drawer-close-btn').addEventListener('click', () => this.close());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('show'));
  }

  close(sofort = false) {
    const panel = document.getElementById(this.drawerId);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    if (!panel && !overlay) return;
    // Der Aufrufer laedt einmal nach dem Schliessen neu, nicht nach jeder Aktion
    if (this._changed && this.onDone) {
      this._changed = false;
      this.onDone();
    }
    const entfernen = () => { panel?.remove(); overlay?.remove(); };
    if (sofort) {
      entfernen();
      return;
    }
    panel?.classList.remove('show');
    setTimeout(entfernen, 300);
  }
}

export function openVertragKooperationen(vertragId, onDone) {
  return new VertragDeckungDrawer().openVertrag(vertragId, onDone);
}

export function openVertragVerknuepfen(kooperationId, onDone) {
  return new VertragDeckungDrawer().openKooperation(kooperationId, onDone);
}
