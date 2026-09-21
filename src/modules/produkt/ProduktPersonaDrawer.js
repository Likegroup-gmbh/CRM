// ProduktPersonaDrawer.js
// Rechter Drawer fuer eine Vorschlags-Karte. Neu: dasselbe Persona-Dokument
// wie beim Anlegen (ohne Liky, ohne Produkte-Band). Match: read-only Profil.
// Uebernehmen legt die Stammdaten-Persona sofort an.

import { renderDocPage, bindDocPage } from '../../core/doc/DocPage.js';
import { personaConfig } from '../../core/form/config/PersonaFormConfig.js';
import { renderPersonaProfil } from '../persona/PersonaProfil.js';
import { PersonaAudienceSituationPanel } from '../persona/PersonaAudienceSituationPanel.js';
import { ProduktPersonaService } from './ProduktPersonaService.js';

const FORM_ID = 'persona-form';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function drawerFields() {
  return personaConfig.fields.filter(f =>
    f.name !== '_slot_produkte' && f.docRole !== 'owner'
  );
}

export class ProduktPersonaDrawer {
  constructor() {
    this.drawerId = 'produkt-persona-drawer';
    this.situationPanel = null;
    this._opts = null;
    this._abort = null;
  }

  /**
   * @param {Object} opts
   * @param {Object} opts.karte
   * @param {Object} opts.persona
   * @param {string|null} opts.unternehmenId
   * @param {string[]} [opts.markeIds]
   * @param {string|null} [opts.produktId]
   * @param {(karte: Object) => void} [opts.onChange]
   */
  open(opts) {
    this.remove();
    const { karte, persona, unternehmenId = null } = opts || {};
    if (!persona || !karte) return;

    this._opts = opts;
    this._abort = new AbortController();

    const istMatch = karte.typ === 'match';
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
    body.className = 'drawer-body persona-drawer__body';
    body.innerHTML = this.fitBlock(karte, istMatch);

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.close());
    header.querySelector('.drawer-close-btn').addEventListener('click', () => this.close());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    if (istMatch) this.renderMatch(body, karte, persona, unternehmenId);
    else this.renderNeu(body, karte, persona, unternehmenId);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });
  }

  fitBlock(karte, istMatch) {
    const luecke = karte?.payload?._luecken_begruendung;
    if (!karte?.fit_grund && !luecke) return '';
    return `<div class="persona-drawer__fit">
      <span class="persona-drawer__fit-label">${istMatch ? 'Warum sie passt' : 'Die Idee dahinter'}</span>
      ${karte.fit_grund ? `<p>${escapeHtml(karte.fit_grund)}</p>` : ''}
      ${luecke ? `<p class="persona-drawer__luecke">Lücke: ${escapeHtml(luecke)}</p>` : ''}
    </div>`;
  }

  renderMatch(body, karte, persona, unternehmenId) {
    const pending = karte.status !== 'accepted';
    const formLink = unternehmenId && karte.persona_id
      ? `<button type="button" class="mdc-btn mdc-btn--secondary persona-drawer__form-link">
           <span class="mdc-btn__label">Im Persona-Formular öffnen</span>
         </button>`
      : '';
    const uebernehmen = pending
      ? `<button type="button" class="mdc-btn mdc-btn--create persona-drawer__uebernehmen">
           <span class="mdc-btn__label">Übernehmen</span>
         </button>`
      : '';

    const wrap = document.createElement('div');
    wrap.innerHTML = renderPersonaProfil(persona)
      + `<div class="persona-drawer__aktionen">${formLink}${uebernehmen}</div>`;
    body.appendChild(wrap);

    wrap.querySelector('.persona-drawer__form-link')?.addEventListener('click', () => {
      this.close();
      window.navigateTo(`/unternehmen/${unternehmenId}/persona?persona=${karte.persona_id}`);
    });
    wrap.querySelector('.persona-drawer__uebernehmen')?.addEventListener('click', () => {
      void this.handleMatchUebernehmen();
    });
  }

  renderNeu(body, karte, persona, unternehmenId) {
    const accepted = karte.status === 'accepted' && karte.persona_id;
    const markeIds = Array.isArray(persona.marke_ids) && persona.marke_ids.length
      ? persona.marke_ids
      : (this._opts.markeIds || []);
    const formData = {
      ...persona,
      marke_ids: markeIds,
      unternehmen_id: unternehmenId || persona.unternehmen_id || '',
      ...(accepted ? { _isEditMode: true, _entityId: karte.persona_id } : {})
    };

    const holder = document.createElement('div');
    holder.className = 'persona-drawer__doc';
    holder.innerHTML = renderDocPage({
      formId: FORM_ID,
      entity: 'persona',
      entityLabel: 'Persona',
      fields: drawerFields(),
      data: formData,
      hidden: { unternehmen_id: unternehmenId || '' },
      side: ''
    });
    body.appendChild(holder);

    const form = holder.querySelector(`#${FORM_ID}`);
    if (!form) return;

    bindDocPage(form, drawerFields(), formData);
    this.relabelSubmit(form, accepted);

    form.querySelector('.mdc-btn--cancel')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.close();
    });
    form.onsubmit = async (e) => {
      e.preventDefault();
      await this.handleNeuSubmit(form);
    };

    void this.bindNeuForm(form, formData, karte, accepted);
  }

  relabelSubmit(form, accepted) {
    const btn = form.querySelector('.mdc-btn--create .mdc-btn__label');
    if (btn) btn.textContent = accepted ? 'Speichern' : 'Übernehmen';
    const submit = form.querySelector('.mdc-btn--create');
    if (submit) {
      submit.dataset.mode = accepted ? 'update' : 'create';
      submit.dataset.entityLabel = 'Persona';
    }
  }

  async bindNeuForm(form, formData, karte, accepted) {
    if (window.formSystem?.bindFormEvents) {
      try {
        await window.formSystem.bindFormEvents('persona', formData);
      } catch (err) {
        console.error('Persona-Drawer: Formular-Init fehlgeschlagen:', err);
      }
    }
    if (!form.isConnected) return;

    form.onsubmit = async (e) => {
      e.preventDefault();
      await this.handleNeuSubmit(form);
    };

    this.situationPanel = new PersonaAudienceSituationPanel();
    await this.situationPanel.mount(form, {
      personaId: accepted ? karte.persona_id : null
    });
    if (!accepted) {
      const situations = Array.isArray(formData._audience_situations)
        ? formData._audience_situations
        : [];
      if (situations.length) this.situationPanel.applyKi(situations);
    }
  }

  collectForm(form) {
    const data = window.formSystem?.collectSubmitData?.(form) || {};
    const markeIds = Array.isArray(data.marke_ids)
      ? data.marke_ids.filter(Boolean)
      : (data.marke_ids ? [data.marke_ids] : []);
    delete data.marke_ids;
    delete data.unternehmen_id;
    delete data.produkt_ids;
    delete data.briefing_ids;
    delete data._slot_audience_situations;
    delete data._slot_produkte;
    return { data, markeIds };
  }

  async handleMatchUebernehmen() {
    const btn = document.querySelector(`#${this.drawerId} .persona-drawer__uebernehmen`);
    try {
      btn?.classList.add('is-loading');
      const next = await this.uebernehmenKarte(this._opts.karte, this._opts.markeIds || []);
      this._opts.onChange?.(next);
      window.toastSystem?.success?.('Persona übernommen');
      this.close();
    } catch (err) {
      console.error('Persona übernehmen fehlgeschlagen:', err);
      window.toastSystem?.error?.(err.message || 'Persona konnte nicht übernommen werden');
      btn?.classList.remove('is-loading');
    }
  }

  async handleNeuSubmit(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const { data, markeIds } = this.collectForm(form);
    const name = String(data.name || '').trim();
    if (name.length < 2) {
      window.toastSystem?.error?.('Bitte Pflichtfelder ausfüllen');
      return;
    }

    const unternehmenId = this._opts.unternehmenId
      || form.querySelector('[name="unternehmen_id"]')?.value
      || null;
    if (!unternehmenId) {
      window.toastSystem?.error?.('Bitte zuerst ein Unternehmen wählen');
      return;
    }

    submitBtn?.classList.add('is-loading');
    try {
      const karte = this._opts.karte;
      const meta = {
        _luecken_begruendung: karte.payload?._luecken_begruendung || null,
        _audience_situations: (this.situationPanel?.getState() || [])
          .filter(r => !r.deleted && String(r.name || '').trim())
          .map(r => ({ name: r.name, beschreibung: r.beschreibung || null })),
        _attached_marke_ids: karte.payload?._attached_marke_ids
      };
      karte.payload = { ...(karte.payload || {}), ...data, ...meta };

      if (karte.status === 'accepted' && karte.persona_id) {
        const next = await ProduktPersonaService.aktualisierePersona(karte, {
          personaPayload: data,
          markeIds,
          audienceSituations: this.situationPanel?.getState() || []
        });
        this._opts.onChange?.(next);
        window.toastSystem?.success?.('Persona gespeichert');
        this.close();
        return;
      }

      const next = await this.uebernehmenKarte(karte, markeIds);
      this._opts.onChange?.(next);
      window.toastSystem?.success?.('Persona übernommen');
      this.close();
    } catch (err) {
      console.error('Persona übernehmen fehlgeschlagen:', err);
      window.toastSystem?.error?.(err.message || 'Persona konnte nicht übernommen werden');
      submitBtn?.classList.remove('is-loading');
    }
  }

  async uebernehmenKarte(karte, markeIds) {
    return ProduktPersonaService.uebernehmen(karte, {
      produktId: this._opts.produktId || null,
      unternehmenId: this._opts.unternehmenId,
      markeIds
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
    this._abort?.abort();
    this._abort = null;
    this.situationPanel?.destroy();
    this.situationPanel = null;
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }

  close() {
    document.getElementById(`${this.drawerId}-overlay`)?.classList.remove('active');
    document.getElementById(this.drawerId)?.classList.remove('show');
    setTimeout(() => this.remove(), 300);
  }
}
