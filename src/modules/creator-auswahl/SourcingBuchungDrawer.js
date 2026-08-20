// SourcingBuchungDrawer.js
// Drawer, der nach dem Status "Gebucht" aufgeht: er fuehrt durch die drei
// Folgeschritte der Buchung - CRM-Uebernahme, Management-Info und Kooperation
// in der verknuepften Kampagne. Jeder Schritt ist einzeln ausfuehrbar und der
// Drawer jederzeit schliessbar; der Status "gebucht" selbst haengt nicht von
// ihm ab (der ist mit dem Status-Update laengst gespeichert).

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { icon } from '../../core/icons/IconSystem.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CHECK_ICON = `${icon('check-bold')}`;

export class SourcingBuchungDrawer {
  constructor(detail) {
    this.detail = detail;
    this.drawerId = 'sourcing-buchung-drawer';
    this.item = null;
    // undefined = noch nicht geladen, null = geladen und leer
    this.aktivesManagement = undefined;
    this.managements = null;
    this.kooperation = undefined;
    this.busy = false;
  }

  open(item) {
    this.remove();

    this.item = item;
    this.aktivesManagement = undefined;
    this.managements = null;
    this.kooperation = undefined;
    this.busy = false;

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;

    const header = document.createElement('div');
    header.className = 'drawer-header';
    header.innerHTML = `
      <div>
        <span class="drawer-title">Creator gebucht</span>
        <p class="drawer-subtitle">${escapeHtml(item?.name || 'Creator')} – Übergabe an CRM und Kampagne</p>
      </div>
      <div>
        <button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.drawerId}-body`;

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.close());
    header.querySelector('.drawer-close-btn').addEventListener('click', () => this.close());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });

    this.renderBody();
    this.ladeFolgedaten();
  }

  remove() {
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }

  close() {
    document.getElementById(`${this.drawerId}-overlay`)?.classList.remove('active');
    document.getElementById(this.drawerId)?.classList.remove('show');
    setTimeout(() => this.remove(), 300);
  }

  /** Management-Stand und Kooperations-Check brauchen die CRM-Verknuepfung */
  async ladeFolgedaten() {
    const creatorId = this.item?.creator_id;
    if (!creatorId) {
      this.renderBody();
      return;
    }

    try {
      const kampagneId = this.detail.liste?.kampagne_id;
      const [management, managements, kooperation] = await Promise.all([
        creatorAuswahlService.getAktivesManagement(creatorId),
        creatorAuswahlService.getAlleManagements(),
        kampagneId
          ? creatorAuswahlService.findKooperation(kampagneId, creatorId)
          : Promise.resolve(null)
      ]);

      // Drawer kann in der Zwischenzeit fuer ein anderes Item aufgegangen sein
      if (this.item?.creator_id !== creatorId) return;

      this.aktivesManagement = management;
      this.managements = managements;
      this.kooperation = kooperation;
    } catch (error) {
      console.error('Fehler beim Laden der Buchungsdaten:', error);
      window.toastSystem?.show('Buchungsdaten konnten nicht geladen werden', 'error');
    }

    this.renderBody();
  }

  renderBody() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body || !this.item) return;

    body.innerHTML = `
      ${this.renderCrmSchritt()}
      ${this.renderManagementSchritt()}
      ${this.renderKampagnenSchritt()}
      <div class="drawer-footer">
        <button type="button" class="mdc-btn" id="btn-sourcing-buchung-fertig">Fertig</button>
      </div>
    `;

    this.bindBodyEvents(body);
  }

  // --- Schritt 1: CRM ---

  renderCrmSchritt() {
    const creatorId = this.item.creator_id;

    const inhalt = creatorId
      ? `
        <p class="drawer-info-text sourcing-buchung-done">${CHECK_ICON} Im CRM verknüpft</p>
        <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" id="btn-buchung-crm-open">
          Creator im CRM öffnen
        </button>
      `
      : `
        <p class="drawer-info-text">Der Creator ist noch nicht im CRM. Lege ihn jetzt an, damit Management und Kampagne folgen können.</p>
        <button type="button" class="mdc-btn mdc-btn--sm" id="btn-buchung-crm-transfer" ${this.busy ? 'disabled' : ''}>
          Ins CRM übernehmen
        </button>
      `;

    return `
      <h4 class="drawer-section-title">1. CRM</h4>
      <div class="sourcing-buchung-schritt" data-schritt="crm">${inhalt}</div>
    `;
  }

  // --- Schritt 2: Management ---

  renderManagementSchritt() {
    const creatorId = this.item.creator_id;
    let inhalt;

    if (!creatorId) {
      inhalt = '<p class="drawer-info-text">Erst ins CRM übernehmen, dann folgt die Management-Info.</p>';
    } else if (this.aktivesManagement === undefined) {
      inhalt = '<p class="drawer-info-text">Lade Management-Status…</p>';
    } else if (this.aktivesManagement) {
      const name = this.aktivesManagement.management?.firmenname || 'Unbekannt';
      inhalt = `<p class="drawer-info-text sourcing-buchung-done">${CHECK_ICON} Hat Management: <strong>${escapeHtml(name)}</strong></p>`;
    } else {
      const optionen = (this.managements || [])
        .map(m => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.firmenname)}</option>`)
        .join('');
      inhalt = `
        <p class="drawer-info-text">Kein Management hinterlegt.</p>
        ${optionen ? `
          <div class="form-field">
            <label class="form-label" for="buchung-management-select">Management zuweisen</label>
            <select class="form-input" id="buchung-management-select">
              <option value="">Bitte wählen...</option>
              ${optionen}
            </select>
          </div>
          <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" id="btn-buchung-management-assign" ${this.busy ? 'disabled' : ''}>
            Zuweisen
          </button>
        ` : '<p class="drawer-info-text">Es sind keine Managements angelegt.</p>'}
      `;
    }

    return `
      <h4 class="drawer-section-title">2. Management</h4>
      <div class="sourcing-buchung-schritt" data-schritt="management">${inhalt}</div>
    `;
  }

  // --- Schritt 3: Kampagne ---

  renderKampagnenSchritt() {
    const liste = this.detail.liste || {};
    const kampagneId = liste.kampagne_id;
    const kampagnenname = liste.kampagne?.kampagnenname || '';
    const creatorId = this.item.creator_id;
    let inhalt;

    if (!kampagneId) {
      inhalt = '<p class="drawer-info-text">Diese Liste ist mit keiner Kampagne verknüpft – es wird keine Kooperation angelegt.</p>';
    } else if (!creatorId) {
      inhalt = `<p class="drawer-info-text">Erst ins CRM übernehmen, dann kann der Creator in die Kampagne „${escapeHtml(kampagnenname)}“.</p>`;
    } else if (this.kooperation === undefined) {
      inhalt = '<p class="drawer-info-text">Prüfe Kooperation…</p>';
    } else if (this.kooperation) {
      inhalt = `<p class="drawer-info-text sourcing-buchung-done">${CHECK_ICON} Bereits in der Kampagne „${escapeHtml(kampagnenname)}“</p>`;
    } else {
      inhalt = `
        <p class="drawer-info-text">Noch nicht in der Kampagne „${escapeHtml(kampagnenname)}“.</p>
        <button type="button" class="mdc-btn mdc-btn--sm" id="btn-buchung-kooperation-create" ${this.busy ? 'disabled' : ''}>
          Zur Kampagne hinzufügen
        </button>
      `;
    }

    return `
      <h4 class="drawer-section-title">3. Kampagne</h4>
      <div class="sourcing-buchung-schritt" data-schritt="kampagne">${inhalt}</div>
    `;
  }

  bindBodyEvents(body) {
    body.querySelector('#btn-sourcing-buchung-fertig')
      ?.addEventListener('click', () => this.close());

    body.querySelector('#btn-buchung-crm-open')
      ?.addEventListener('click', () => {
        this.close();
        window.navigateTo(`/creator/${this.item.creator_id}`);
      });

    body.querySelector('#btn-buchung-crm-transfer')
      ?.addEventListener('click', () => this.handleCrmTransfer());

    body.querySelector('#btn-buchung-management-assign')
      ?.addEventListener('click', () => this.handleAssignManagement());

    body.querySelector('#btn-buchung-kooperation-create')
      ?.addEventListener('click', () => this.handleCreateKooperation());
  }

  async mitBusy(aktion) {
    if (this.busy) return;
    this.busy = true;
    this.renderBody();
    try {
      await aktion();
    } catch (error) {
      console.error('Fehler im Buchungs-Drawer:', error);
      window.toastSystem?.show(error.message || 'Aktion fehlgeschlagen', 'error');
    } finally {
      this.busy = false;
      this.renderBody();
    }
  }

  async handleCrmTransfer() {
    await this.mitBusy(async () => {
      const creator = await creatorAuswahlService.transferToCRM(this.item.id);
      this.item.creator_id = creator.id;
      window.toastSystem?.show('Creator ins CRM übernommen', 'success');

      // Die Zeile zeigt die Verknuepfung nicht direkt, aber der Spaeter-Stand
      // der Tabelle soll stimmen
      this.detail.rerenderTable?.();

      // Management und Kooperation haengen an der creator_id - jetzt nachladen
      await this.ladeFolgedaten();
    });
  }

  async handleAssignManagement() {
    const select = document.getElementById('buchung-management-select');
    const managementId = select?.value;
    if (!managementId) {
      window.toastSystem?.show('Bitte ein Management auswählen', 'warning');
      return;
    }

    await this.mitBusy(async () => {
      this.aktivesManagement = await creatorAuswahlService.assignManagement(
        this.item.creator_id, managementId
      );
      window.toastSystem?.show('Management zugewiesen', 'success');
    });
  }

  async handleCreateKooperation() {
    const liste = this.detail.liste || {};

    await this.mitBusy(async () => {
      // Duplikat-Check direkt vor dem Insert - der Stand im Drawer kann veraltet sein
      const bestehend = await creatorAuswahlService.findKooperation(liste.kampagne_id, this.item.creator_id);
      if (bestehend) {
        this.kooperation = bestehend;
        return;
      }

      this.kooperation = await creatorAuswahlService.createKooperation({
        name: this.item.name || 'Kooperation',
        kampagne_id: liste.kampagne_id,
        creator_id: this.item.creator_id,
        unternehmen_id: liste.unternehmen_id
      });
      window.toastSystem?.show('Kooperation in der Kampagne angelegt', 'success');
    });
  }
}
