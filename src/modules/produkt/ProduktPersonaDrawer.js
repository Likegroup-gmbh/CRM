// ProduktPersonaDrawer.js
// Seitlicher Drawer mit dem vollstaendigen Persona-Profil einer
// Vorschlags-Karte. Oeffnet bei Klick auf die Karte (oder das Daten-Icon).
//
// Datenquelle: bei "Neuer Vorschlag" das generierte payload, bei "Bekannte
// Persona" der Datensatz aus der DB (plus Link ins PersonaForm). Die Ansicht
// baut der gemeinsame Renderer aus personaConfig.fields (PersonaProfil.js),
// damit Drawer und Formular nie auseinanderlaufen.

import { renderPersonaProfil } from '../persona/PersonaProfil.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class ProduktPersonaDrawer {
  constructor() {
    this.drawerId = 'produkt-persona-drawer';
  }

  /**
   * @param {Object} opts
   * @param {Object} opts.karte - { typ, fit_grund, luecken_begruendung }
   * @param {Object} opts.persona - DB-Record (match) oder payload (neu)
   * @param {string|null} opts.unternehmenId - fuer den PersonaForm-Link bei match
   */
  open({ karte, persona, unternehmenId = null }) {
    this.remove();
    if (!persona) return;

    const istMatch = karte?.typ === 'match';
    const titel = [persona.name, persona.alter_von != null ? this.alterLabel(persona) : null]
      .filter(Boolean).join(', ');

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel drawer-panel--xwide';
    panel.id = this.drawerId;

    const header = document.createElement('div');
    header.className = 'drawer-header';
    header.innerHTML = `
      <div>
        <span class="drawer-title">${escapeHtml(titel || 'Persona')}</span>
        <p class="drawer-subtitle">
          <span class="tag rel-card__badge ${istMatch ? 'rel-card__badge--match' : 'rel-card__badge--neu'}">${istMatch ? 'Bekannte Persona' : 'Neuer Vorschlag'}</span>
          ${persona.oberbegriff ? ` ${escapeHtml(persona.oberbegriff)}` : ''}
        </p>
      </div>
      <div>
        <button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'drawer-body';

    const luecke = karte?.payload?._luecken_begruendung;
    const fitBlock = karte?.fit_grund
      ? `<div class="persona-drawer__fit">
           <span class="persona-drawer__fit-label">${istMatch ? 'Warum sie passt' : 'Die Idee dahinter'}</span>
           <p>${escapeHtml(karte.fit_grund)}</p>
           ${luecke ? `<p class="persona-drawer__luecke">Lücke: ${escapeHtml(luecke)}</p>` : ''}
         </div>`
      : '';

    const formLink = istMatch && unternehmenId && karte?.persona_id
      ? `<div class="persona-drawer__aktionen">
           <button type="button" class="mdc-btn mdc-btn--secondary persona-drawer__form-link">
             <span class="mdc-btn__label">Im Persona-Formular öffnen</span>
           </button>
         </div>`
      : '';

    body.innerHTML = fitBlock + renderPersonaProfil(persona) + formLink;

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.close());
    header.querySelector('.drawer-close-btn').addEventListener('click', () => this.close());
    body.querySelector('.persona-drawer__form-link')?.addEventListener('click', () => {
      this.close();
      window.navigateTo(`/unternehmen/${unternehmenId}/persona?persona=${karte.persona_id}`);
    });

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });
  }

  alterLabel(persona) {
    const { alter_von: von, alter_bis: bis } = persona || {};
    if (von && bis) return `${von}–${bis}`;
    if (von) return `ab ${von}`;
    if (bis) return `bis ${bis}`;
    return null;
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
}
