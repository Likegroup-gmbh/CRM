// ProduktList.js
// Top-Level-Liste aller Produkte. Selbe Tabelle und derselbe Create-Button wie
// der Produkte-Tab, nur hier mit Unternehmens-Spalte und eigenem Empty State.
// Anlegen und Bearbeiten laufen ueber das Produkt-Formular (/produkt/new,
// /produkt/:id), der nested Flow unter Unternehmen/Marke bleibt unangetastet.

import { renderEmptyState, renderSectionHeader } from '../../core/components/EmptyState.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { ProduktService } from './ProduktService.js';

const CREATE_BTN_HTML = '<button type="button" class="mdc-btn mdc-btn--create produkt-create-btn">Produkt anlegen</button>';

export class ProduktList {
  constructor() {
    this.produkte = [];
    this._abortController = null;
  }

  async init() {
    window.setHeadline('Produkte Übersicht');

    const canView = (window.canViewPage && window.canViewPage('produkt')) ||
                    (window.isAdmin() || window.currentUser?.permissions?.produkt?.can_view);
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Produkte anzuzeigen.</p>
        </div>
      `;
      return;
    }

    await this.loadAndRender();
    this.bindEvents();
  }

  async loadAndRender() {
    try {
      this.produkte = await ProduktService.loadAll();
      this.render();
    } catch (error) {
      window.ErrorHandler?.handle?.(error, 'ProduktList.loadAndRender');
      window.content.innerHTML = `
        <div class="error-message">
          <p>Produkte konnten nicht geladen werden.</p>
        </div>
      `;
    }
  }

  _sanitize(value) {
    return window.validatorSystem.sanitizeHtml(value ?? '-');
  }

  _renderThumb(produkt) {
    const bild = ProduktService.hauptbild(produkt);
    const url = bild ? ProduktService.publicUrl(bild.storage_pfad) : null;
    if (!url) return '-';
    return `<img src="${this._sanitize(url)}" class="table-logo" width="24" height="24" alt="" loading="lazy">`;
  }

  _renderUnternehmen(produkt) {
    const u = produkt.unternehmen;
    if (!u?.firmenname) return '-';

    return avatarBubbles.renderBubbles([{
      name: u.firmenname,
      label: u.firmenname,
      type: 'org',
      id: u.id,
      entityType: 'unternehmen',
      logo_url: u.logo_url || null
    }], { showLabel: true });
  }

  _renderMarken(produkt) {
    const namen = ProduktService.markenNamen(produkt);
    if (!namen.length) return '<span class="text-muted">Nur Unternehmen</span>';
    return namen.map(name => `<span class="status-badge">${this._sanitize(name)}</span>`).join(' ');
  }

  render() {
    const isKunde = window.isKunde?.();

    if (this.produkte.length === 0) {
      window.content.innerHTML = renderEmptyState({
        icon: 'cube',
        title: 'Keine Produkte vorhanden',
        text: 'Produkte werden dauerhaft angelegt und bilden gemeinsam mit Marke, Persona und Briefing die Datenbasis für Strategie, Content und Creator Matching.',
        actionsHtml: isKunde ? '' : CREATE_BTN_HTML
      });
      return;
    }

    const rows = this.produkte.map(produkt => {
      const variantenAnzahl = (produkt.varianten || []).length;
      return `
      <tr class="table-row-clickable produkt-row-open" data-produkt-id="${produkt.id}">
        <td>${this._renderThumb(produkt)}</td>
        <td>
          <a href="#" class="table-link produkt-row-open" data-produkt-id="${produkt.id}">
            ${this._sanitize(produkt.name)}
          </a>
        </td>
        <td>${this._renderUnternehmen(produkt)}</td>
        <td>${this._renderMarken(produkt)}</td>
        <td>${this._sanitize(ProduktService.preisLabel(produkt))}</td>
        <td>${variantenAnzahl > 0 ? variantenAnzahl : '-'}</td>
        <td>${produkt.created_at ? new Date(produkt.created_at).toLocaleDateString('de-DE') : '-'}</td>
        <td>
          <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm produkt-row-open" data-produkt-id="${produkt.id}">Öffnen</button>
        </td>
      </tr>
    `;
    }).join('');

    window.content.innerHTML = `
      ${renderSectionHeader({ title: 'Produkte', actionsHtml: isKunde ? '' : CREATE_BTN_HTML })}
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Bild</th>
              <th>Produkt</th>
              <th>Unternehmen</th>
              <th>Marken</th>
              <th>Preis</th>
              <th>Varianten</th>
              <th>Erstellt</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  bindEvents() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    document.addEventListener('click', (e) => {
      if (e.target.closest('.produkt-create-btn')) {
        e.preventDefault();
        window.navigateTo('/produkt/new');
        return;
      }

      const produktRow = e.target.closest('.produkt-row-open');
      if (produktRow) {
        e.preventDefault();
        window.navigateTo(`/produkt/${produktRow.dataset.produktId}`);
      }
    }, { signal });

    window.addEventListener('entityUpdated', (e) => {
      if (e.detail?.entity === 'produkt') {
        this.loadAndRender();
      }
    }, { signal });
  }

  destroy() {
    this._abortController?.abort();
    this._abortController = null;
  }
}

export const produktList = new ProduktList();
