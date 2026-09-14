// CastingVorschlagPanel.js
// Kopf + Job-Trigger fuer KI-Vorschlaege (ADR 0013). Die Pending-Zeilen
// selbst rendert die Casting-Tabelle (virtuelle Items). Gaeste und Kunden
// sehen den Block nie.

import { CastingVorschlagService } from './CastingVorschlagService.js';
import { getTeilbereicheFromListe } from './CreatorAuswahlTemplates.js';
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
    // Eigener Listener-Lifecycle: der Shared-Cleanup in
    // CreatorAuswahlDetail.bindEvents() wuerde einen dort registrierten
    // Handler sofort wieder entfernen (init: render() vor bindEvents()).
    this._clickHandler = null;
    this._boundBlock = null;
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
      this.syncTable();
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
    this.unbindClick();
  }

  unbindClick() {
    if (this._boundBlock && this._clickHandler) {
      this._boundBlock.removeEventListener('click', this._clickHandler);
    }
    this._boundBlock = null;
    this._clickHandler = null;
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
            <p class="casting-vorschlag__sub">Aus der eigenen Creator-Datenbank · in der Liste mit Rand markiert</p>
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
      </div>
    `;
  }

  syncTable() {
    this.detail?.rerenderTable?.();
  }

  // --- Events ---

  bind() {
    const block = document.getElementById('casting-vorschlag-block');
    if (!block) return;
    // Alter Block (falls noch referenziert) loest seinen Handler selbst;
    // der neue Block bekommt genau einen. Das Shared-Set des Details wird
    // bewusst nicht benutzt (siehe Constructor-Kommentar).
    this.unbindClick();
    this._boundBlock = block;
    this._clickHandler = (e) => this.handleClick(e);
    block.addEventListener('click', this._clickHandler);
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
      this.syncTable();
    } catch (error) {
      if (token !== this._token) return;
      console.error('Fehler beim Neuladen der Casting-Vorschläge:', error);
    }
  }

  async aktivieren(vorschlagId) {
    const vorschlag = this.vorschlaege.find(v => v.id === vorschlagId);
    if (!vorschlag) return;
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
      this.syncTable();
    } catch (error) {
      console.error('Fehler beim Aktivieren:', error);
      window.toastSystem?.show(error.message || 'Aktivieren fehlgeschlagen', 'error');
    }
  }

  async verwerfen(vorschlagId) {
    try {
      await CastingVorschlagService.verwerfen(vorschlagId);
      this.vorschlaege = this.vorschlaege.filter(v => v.id !== vorschlagId);
      this.render();
      this.syncTable();
    } catch (error) {
      console.error('Fehler beim Verwerfen:', error);
      window.toastSystem?.show(error.message || 'Verwerfen fehlgeschlagen', 'error');
    }
  }
}
