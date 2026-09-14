// CastingVorschlagPanel.js
// Zweite Liste ueber der echten Casting-Tabelle: KI-Vorschlaege aus der
// eigenen Creator-Datenbank (ADR 0013). Eigene Zeilen, kein Casting-Eintrag -
// erst Aktivieren legt das Item mit creator_id an. Gaeste und Kunden sehen
// den Block nie.

import { CastingVorschlagService, SLOT_LABELS } from './CastingVorschlagService.js';
import { getTeilbereicheFromListe } from './CreatorAuswahlTemplates.js';
import { escapeAttr } from '../../core/VideoUploadUtils.js';
import { icon } from '../../core/icons/IconSystem.js';

function esc(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

export class CastingVorschlagPanel {
  constructor(detail) {
    this.detail = detail;
    this.vorschlaege = [];
    this.laeuft = false;
    this.fortschritt = '';
    this.fehler = '';
    this._token = 0;
    this._onProgress = null;
    this._onFinished = null;
  }

  get sichtbar() {
    if (!this.detail || this.detail.isKunde) return false;
    if (window.isGastReadonly?.()) return false;
    return true;
  }

  async mount() {
    const block = document.getElementById('casting-vorschlag-block');
    if (!block) return;
    if (!this.sichtbar) {
      block.remove();
      return;
    }
    const token = ++this._token;
    this.render();
    this.bind();
    try {
      const vorschlaege = await CastingVorschlagService.loadVorschlaege(this.detail.listeId);
      if (token !== this._token) return;
      this.vorschlaege = vorschlaege;
      this.render();
    } catch (error) {
      if (token !== this._token) return;
      console.error('Fehler beim Laden der Casting-Vorschläge:', error);
      this.fehler = 'Vorschläge konnten nicht geladen werden.';
      this.render();
    }
  }

  unmount() {
    this._token++;
    this.unbindProgress();
  }

  // --- Rendering ---

  render() {
    const block = document.getElementById('casting-vorschlag-block');
    if (!block || !this.sichtbar) return;

    const count = this.vorschlaege.length;
    const hatListeBriefing = !!this.detail.liste?.briefing_id;

    block.innerHTML = `
      <div class="casting-vorschlag">
        <div class="casting-vorschlag__kopf">
          <div>
            <span class="casting-vorschlag__titel">KI-Vorschläge ${count ? `(${count})` : ''}</span>
            <p class="casting-vorschlag__sub">Aus der eigenen Creator-Datenbank · Aktivieren legt den Eintrag an</p>
          </div>
          <div class="casting-vorschlag__aktionen">
            ${this.laeuft
              ? `<span class="casting-vorschlag__progress">${esc(this.fortschritt || 'Läuft…')}</span>`
              : `<button type="button" class="mdc-btn mdc-btn--secondary" id="btn-casting-vorschlag-holen"
                   ${hatListeBriefing ? '' : 'disabled title="Casting ohne Briefing: ohne Bedarf kein Lauf"'}>
                  ${icon('sparkles', { className: 'icon-16' })}
                  ${count ? 'Neu vorschlagen' : 'Vorschläge holen'}
                </button>`}
          </div>
        </div>
        ${this.fehler ? `<p class="casting-vorschlag__fehler">${esc(this.fehler)}</p>` : ''}
        ${!hatListeBriefing && !count
          ? '<p class="casting-vorschlag__hinweis">Dieses Casting hat kein Briefing – ohne Bedarf gibt es keine Vorschläge.</p>'
          : ''}
        ${count ? `<div class="casting-vorschlag__grid">${this.vorschlaege.map(v => this.renderKarte(v)).join('')}</div>` : ''}
      </div>
    `;
  }

  renderKarte(v) {
    const c = v.creator || {};
    const name = `${c.vorname || ''} ${c.nachname || ''}`.trim() || 'Unbekannt';
    const socials = [c.instagram ? `@${String(c.instagram).replace(/^@/, '')}` : null, c.tiktok ? `TT: ${c.tiktok}` : null]
      .filter(Boolean).join(' · ');
    const scores = v.scores || {};
    const coverage = v.coverage || {};
    const duenn = Object.entries(coverage)
      .filter(([k, wert]) => k !== 'persona_ids' && (wert === 'unbekannt' || wert === 'unverified' || wert === 'kein_treffer'))
      .map(([k]) => k);

    return `
      <article class="casting-vorschlag__karte" data-vorschlag-id="${escapeAttr(v.id)}">
        <div class="casting-vorschlag__karte-kopf">
          <div>
            <span class="casting-vorschlag__name">${esc(name)}</span>
            ${socials ? `<span class="casting-vorschlag__socials">${esc(socials)}</span>` : ''}
          </div>
          <span class="casting-vorschlag__slot casting-vorschlag__slot--${escapeAttr(v.slot || 'tight')}">${esc(SLOT_LABELS[v.slot] || v.slot)}</span>
        </div>
        <div class="casting-vorschlag__scores">
          ${this.renderScore('Fit', scores.fit)}${this.renderScore('Track', scores.track)}${this.renderScore('Fresh', scores.fresh)}
        </div>
        ${v.fit_grund ? `<p class="casting-vorschlag__fit">${esc(v.fit_grund)}</p>` : ''}
        ${v.risiken ? `<p class="casting-vorschlag__risiken">Risiko: ${esc(v.risiken)}</p>` : ''}
        ${v.kategorie_hint ? `<p class="casting-vorschlag__kat">Kategorie: ${esc(v.kategorie_hint)}</p>` : ''}
        ${duenn.length ? `<p class="casting-vorschlag__duenn">Profil dünn: ${esc(duenn.join(', '))}</p>` : ''}
        <div class="casting-vorschlag__karte-aktionen">
          <button type="button" class="mdc-btn mdc-btn--create" data-vorschlag-aktivieren="${escapeAttr(v.id)}">Aktivieren</button>
          <button type="button" class="mdc-btn mdc-btn--secondary" data-vorschlag-verwerfen="${escapeAttr(v.id)}">Verwerfen</button>
        </div>
      </article>
    `;
  }

  renderScore(label, wert) {
    if (wert === null || wert === undefined) return '';
    return `<span class="casting-vorschlag__score" title="${escapeAttr(label)}">${escapeAttr(label)} ${escapeAttr(String(wert))}</span>`;
  }

  // --- Events ---

  bind() {
    const block = document.getElementById('casting-vorschlag-block');
    if (!block || block.dataset.gebunden) return;
    block.dataset.gebunden = '1';

    const clickHandler = (e) => this.handleClick(e);
    block.addEventListener('click', clickHandler);
    this.detail._boundEventListeners.add(() => block.removeEventListener('click', clickHandler));
  }

  bindProgress() {
    this.unbindProgress();
    this._onProgress = (e) => {
      this.fortschritt = e.detail?.label || 'Läuft…';
      this.render();
    };
    this._onFinished = () => {
      this.laeuft = false;
      this.fortschritt = '';
      this.render();
      this.neuLaden();
    };
    document.addEventListener('castingVorschlagProgress', this._onProgress);
    document.addEventListener('castingVorschlagFinished', this._onFinished);
  }

  unbindProgress() {
    if (this._onProgress) document.removeEventListener('castingVorschlagProgress', this._onProgress);
    if (this._onFinished) document.removeEventListener('castingVorschlagFinished', this._onFinished);
    this._onProgress = null;
    this._onFinished = null;
  }

  async handleClick(e) {
    const holenBtn = e.target.closest('#btn-casting-vorschlag-holen');
    if (holenBtn && !holenBtn.disabled) {
      e.preventDefault();
      await this.holen();
      return;
    }

    const aktivierenBtn = e.target.closest('[data-vorschlag-aktivieren]');
    if (aktivierenBtn) {
      e.preventDefault();
      await this.aktivieren(aktivierenBtn.dataset.vorschlagAktivieren, aktivierenBtn);
      return;
    }

    const verwerfenBtn = e.target.closest('[data-vorschlag-verwerfen]');
    if (verwerfenBtn) {
      e.preventDefault();
      await this.verwerfen(verwerfenBtn.dataset.vorschlagVerwerfen, verwerfenBtn);
    }
  }

  async holen() {
    if (this.laeuft) return;
    this.laeuft = true;
    this.fehler = '';
    this.fortschritt = 'Vorschläge sind unterwegs…';
    this.bindProgress();
    this.render();
    try {
      await CastingVorschlagService.starteJob({ castingId: this.detail.listeId, input: {} });
    } catch (error) {
      console.error('Fehler bei den Casting-Vorschlägen:', error);
      this.laeuft = false;
      this.fortschritt = '';
      this.fehler = error.message || 'Generierung fehlgeschlagen.';
      this.unbindProgress();
      this.render();
      return;
    }
    // Erfolgspfad: _onFinished setzt laeuft zurueck und laedt neu
    if (!this.laeuft) return;
  }

  async neuLaden() {
    const token = ++this._token;
    try {
      const vorschlaege = await CastingVorschlagService.loadVorschlaege(this.detail.listeId);
      if (token !== this._token) return;
      this.vorschlaege = vorschlaege;
      this.render();
    } catch (error) {
      if (token !== this._token) return;
      console.error('Fehler beim Neuladen der Casting-Vorschläge:', error);
    }
  }

  async aktivieren(vorschlagId, btn) {
    const vorschlag = this.vorschlaege.find(v => v.id === vorschlagId);
    if (!vorschlag) return;
    btn.disabled = true;
    try {
      const item = await CastingVorschlagService.aktivieren(vorschlag, {
        listeId: this.detail.listeId,
        listeTyp: this.detail.liste?.liste_typ,
        kategorien: getTeilbereicheFromListe(this.detail.liste)
      });
      this.vorschlaege = this.vorschlaege.filter(v => v.id !== vorschlagId);
      this.detail.items.push(item);
      window.toastSystem?.show('Vorschlag als Eintrag übernommen', 'success');
      this.render();
      this.detail.rerenderTable();
    } catch (error) {
      console.error('Fehler beim Aktivieren:', error);
      window.toastSystem?.show(error.message || 'Aktivieren fehlgeschlagen', 'error');
      btn.disabled = false;
    }
  }

  async verwerfen(vorschlagId, btn) {
    btn.disabled = true;
    try {
      await CastingVorschlagService.verwerfen(vorschlagId);
      this.vorschlaege = this.vorschlaege.filter(v => v.id !== vorschlagId);
      this.render();
    } catch (error) {
      console.error('Fehler beim Verwerfen:', error);
      window.toastSystem?.show(error.message || 'Verwerfen fehlgeschlagen', 'error');
      btn.disabled = false;
    }
  }
}
