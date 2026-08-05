// SourcingTabelleAnpassenDrawer.js (ES6-Modul)
// Drawer "Tabelle anpassen" der Sourcing-Detailseite. Zwei Bereiche:
//   1. Listeneinstellungen - Art der Liste, Plattform, Format, TKP.
//      Das sind genau die Felder aus dem Anlege-Formular, die nichts mit der
//      Kampagnenzuordnung zu tun haben; Unternehmen, Marke und Kampagne
//      bleiben bewusst draussen.
//   2. Spalten - welche Spalte sichtbar ist.
//
// Beides speichert sofort (kein Speichern-Button). Aendert sich Typ, Plattform
// oder Format, werden die zugehoerigen Spalten neu vorbelegt; von Hand
// abgeschaltete Spalten wie Mail oder eigene Spalten bleiben erhalten.

import {
  DEAKTIVIERTE_SPALTEN,
  getListenTkp,
  SOURCING_SPALTEN,
  SOURCING_SPALTEN_LABELS
} from './CreatorAuswahlTemplates.js';
import {
  LISTE_TYP_OPTIONEN,
  PLATTFORM_OPTIONEN,
  IG_FORMAT_OPTIONEN,
  wendePresetAn
} from './sourcingSpaltenPreset.js';

/** Spaltenreihenfolge im Drawer, abgeleitet aus SOURCING_SPALTEN */
const SPALTEN_LABELS = SOURCING_SPALTEN
  .filter(c => SOURCING_SPALTEN_LABELS[c])
  .map(c => ({ className: c, label: SOURCING_SPALTEN_LABELS[c] }));

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSelect(name, label, optionen, value, sichtbar) {
  const options = optionen.map(opt => (
    `<option value="${escapeHtml(opt.value)}"${String(value) === String(opt.value) ? ' selected' : ''}>${escapeHtml(opt.label)}</option>`
  )).join('');

  return `
    <div class="form-field${sichtbar ? '' : ' form-field--hidden'}" data-listen-feld="${name}">
      <label class="form-label" for="sourcing-liste-${name}">${escapeHtml(label)}</label>
      <select class="form-input" id="sourcing-liste-${name}" data-listen-einstellung="${name}">
        <option value="">Bitte wählen...</option>
        ${options}
      </select>
    </div>
  `;
}

export class SourcingTabelleAnpassenDrawer {
  /**
   * @param {object} config
   * @param {object} config.liste geladene Sourcing-Liste (tkp, liste_typ, ...)
   * @param {string[]} config.hiddenColumns
   * @param {Array<{className: string, label: string}>} [config.customColumns]
   * @param {(hiddenColumns: string[]) => Promise<void>|void} config.onHiddenColumnsChange
   * @param {(updates: object) => Promise<void>|void} config.onListeChange
   */
  constructor({ liste, hiddenColumns, customColumns = [], onHiddenColumnsChange, onListeChange }) {
    this.liste = liste || {};
    this.hiddenColumns = hiddenColumns || [];
    this.onHiddenColumnsChange = onHiddenColumnsChange;
    this.onListeChange = onListeChange;
    this.drawerId = 'sourcing-tabelle-anpassen-drawer';

    // Name und Aktionen sind immer sichtbar und tauchen deshalb nicht auf
    this.columns = [
      ...SPALTEN_LABELS,
      // Eigene Spalten (className = "custom:{uuid}")
      ...(customColumns || []).map(c => ({ className: c.className, label: c.label }))
    ].filter(c => !DEAKTIVIERTE_SPALTEN.includes(c.className));
  }

  open() {
    this.removeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;

    const header = document.createElement('div');
    header.className = 'drawer-header';

    const headerLeft = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Tabelle anpassen';

    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Einstellungen der Liste und Sichtbarkeit der Spalten';

    headerLeft.appendChild(title);
    headerLeft.appendChild(subtitle);

    const headerRight = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close-btn';
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.innerHTML = '&times;';
    headerRight.appendChild(closeBtn);

    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.drawerId}-body`;
    body.innerHTML = this.renderContent();

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.close());
    closeBtn.addEventListener('click', () => this.close());
    body.querySelector('#btn-close-sourcing-tabelle-anpassen-drawer')
      .addEventListener('click', () => this.close());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });

    this.bindEvents();
  }

  removeDrawer() {
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const panel = document.getElementById(this.drawerId);
    if (overlay) overlay.remove();
    if (panel) panel.remove();
  }

  close() {
    const panel = document.getElementById(this.drawerId);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);

    if (overlay) overlay.classList.remove('active');
    if (panel) panel.classList.remove('show');

    setTimeout(() => {
      if (overlay) overlay.remove();
      if (panel) panel.remove();
    }, 300);
  }

  /** Plattform nur bei Influencer, Format nur wenn Instagram dabei ist */
  zeigtPlattform() {
    return this.liste.liste_typ === 'influencer';
  }

  zeigtIgFormat() {
    return this.zeigtPlattform() && String(this.liste.plattformen || '').includes('instagram');
  }

  renderListenEinstellungen() {
    return `
      <div class="sourcing-listen-einstellungen">
        ${renderSelect('liste_typ', 'Art der Liste', LISTE_TYP_OPTIONEN, this.liste.liste_typ, true)}
        ${renderSelect('plattformen', 'Plattform', PLATTFORM_OPTIONEN, this.liste.plattformen, this.zeigtPlattform())}
        ${renderSelect('ig_formate', 'Instagram-Format', IG_FORMAT_OPTIONEN, this.liste.ig_formate, this.zeigtIgFormat())}
        <div class="form-field">
          <label class="form-label" for="sourcing-liste-tkp">TKP (€ pro 1.000 Views)</label>
          <input type="number" class="form-input" id="sourcing-liste-tkp"
                 data-listen-einstellung="tkp" min="0" step="0.01"
                 value="${getListenTkp(this.liste)}">
        </div>
      </div>
      <p class="drawer-info-text">
        Der TKP ist die Basis für Preis 8 / 30 / Ø Reels – eine Änderung rechnet
        die Tabelle sofort neu. Art der Liste, Plattform und Format belegen die
        zugehörigen Spalten unten neu vor.
      </p>
    `;
  }

  renderContent() {
    const rows = this.columns.map(col => {
      const isVisible = !this.hiddenColumns.includes(col.className);
      return `
        <tr>
          <td style="text-align: left;">${escapeHtml(col.label)}</td>
          <td style="text-align: right;">
            <label class="toggle-switch">
              <input
                type="checkbox"
                class="column-visibility-toggle"
                data-column="${escapeHtml(col.className)}"
                ${isVisible ? 'checked' : ''}
              >
              <span class="toggle-slider"></span>
            </label>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <h4 class="drawer-section-title">Liste</h4>
      ${this.renderListenEinstellungen()}

      <h4 class="drawer-section-title">Spalten</h4>
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="text-align: left;">Spalte</th>
              <th style="text-align: right;">Sichtbar</th>
            </tr>
          </thead>
          <tbody id="sourcing-tabelle-anpassen-spalten">
            ${rows}
          </tbody>
        </table>
      </div>
      <p class="drawer-info-text">
        <strong>Hinweis:</strong> Die Spalten "Name" und "Aktionen" sind immer sichtbar und können nicht ausgeblendet werden.
      </p>
      <div class="drawer-footer">
        <button type="button" class="primary-btn" id="btn-close-sourcing-tabelle-anpassen-drawer">
          Fertig
        </button>
      </div>
    `;
  }

  bindEvents() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    body.querySelectorAll('.column-visibility-toggle').forEach(toggle => {
      toggle.addEventListener('change', (e) => this.handleToggle(e));
    });

    body.querySelectorAll('[data-listen-einstellung]').forEach(field => {
      field.addEventListener('change', (e) => this.handleListenEinstellung(e));
    });
  }

  handleToggle(event) {
    const columnClass = event.target.dataset.column;
    const isVisible = event.target.checked;

    if (isVisible) {
      this.hiddenColumns = this.hiddenColumns.filter(col => col !== columnClass);
    } else if (!this.hiddenColumns.includes(columnClass)) {
      this.hiddenColumns.push(columnClass);
    }

    this.onHiddenColumnsChange?.(this.hiddenColumns);
  }

  async handleListenEinstellung(event) {
    const feld = event.target.dataset.listenEinstellung;

    if (feld === 'tkp') {
      const tkp = Number(event.target.value);
      if (!Number.isFinite(tkp) || tkp < 0) {
        event.target.value = getListenTkp(this.liste);
        return;
      }
      this.liste.tkp = tkp;
      await this.onListeChange?.({ tkp });
      return;
    }

    const wert = event.target.value || null;
    const updates = { [feld]: wert };

    // Ein anderer Typ macht die Folgefragen sinnlos: nur Influencer hat eine
    // Plattform, nur Instagram ein Format. Sonst bliebe ein alter Wert stehen
    // und das Preset wuerde falsche Spalten setzen.
    if (feld === 'liste_typ' && wert !== 'influencer') {
      updates.plattformen = null;
      updates.ig_formate = null;
    }
    if (feld === 'plattformen' && !String(wert || '').includes('instagram')) {
      updates.ig_formate = null;
    }

    Object.assign(this.liste, updates);
    this.hiddenColumns = wendePresetAn(this.hiddenColumns, this.liste);

    await this.onListeChange?.({ ...updates, hidden_columns: this.hiddenColumns });
    this.refreshFelder();
  }

  /** Sichtbarkeit der Folgefelder und Spalten-Toggles neu setzen */
  refreshFelder() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const sichtbarkeit = {
      plattformen: this.zeigtPlattform(),
      ig_formate: this.zeigtIgFormat()
    };

    for (const [name, sichtbar] of Object.entries(sichtbarkeit)) {
      const wrapper = body.querySelector(`[data-listen-feld="${name}"]`);
      if (!wrapper) continue;
      wrapper.classList.toggle('form-field--hidden', !sichtbar);

      const select = wrapper.querySelector('select');
      if (select) select.value = this.liste[name] || '';
    }

    body.querySelectorAll('.column-visibility-toggle').forEach(toggle => {
      toggle.checked = !this.hiddenColumns.includes(toggle.dataset.column);
    });
  }
}
