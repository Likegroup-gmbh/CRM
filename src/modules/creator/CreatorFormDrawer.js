// CreatorFormDrawer.js
// Das Creator-Anlegeformular (FormSystem + CreatorFormConfig) als Drawer.
// Prefill kommt vom Casting-Eintrag; Submit legt den Stammdatensatz an.

import { injectFirmaCreateButton } from './FirmaCreateDrawer.js';

const FOLLOWER_BUCKETS = [
  [2500, '0-2500'],
  [5000, '2500-5000'],
  [10000, '5000-10000'],
  [25000, '10000-25000'],
  [50000, '25000-50000'],
  [100000, '50000-100000'],
  [250000, '100000-250000'],
  [500000, '250000-500000'],
  [1000000, '500000-1000000']
];

function followerToBucket(n) {
  if (n == null || n === '') return '';
  const s = String(n);
  if (s.includes('-') || s.endsWith('+')) return s;
  const num = Number(n);
  if (!Number.isFinite(num)) return '';
  for (const [max, value] of FOLLOWER_BUCKETS) {
    if (num < max) return value;
  }
  return '1000000+';
}

function resolveFollowerSubmit(formValue, original) {
  if (formValue == null || formValue === '') {
    return original == null || original === '' ? null : Number(original);
  }
  if (/^\d+$/.test(String(formValue))) return Number(formValue);
  const bucket = String(formValue);
  if (original != null && followerToBucket(original) === bucket) return Number(original);
  if (bucket.endsWith('+')) return 1000000;
  const low = parseInt(bucket.split('-')[0], 10);
  return Number.isFinite(low) ? low : (original == null ? null : Number(original));
}

const DRAWER_ID = 'creator-form-drawer';
const OVERLAY_ID = 'creator-form-drawer-overlay';

export class CreatorFormDrawer {
  constructor() {
    this.prefill = {};
    this.originalFollowers = {};
    this.extraInsert = {};
    this.onCreated = null;
    this.onUseExisting = null;
    this.onCancel = null;
    this._closed = false;
  }

  open({ prefill = {}, originalFollowers = {}, extraInsert = {}, onCreated, onUseExisting, onCancel } = {}) {
    this.remove();

    this.prefill = prefill;
    this.originalFollowers = originalFollowers;
    this.extraInsert = extraInsert;
    this.onCreated = onCreated || null;
    this.onUseExisting = onUseExisting || null;
    this.onCancel = onCancel || null;
    this._closed = false;

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = OVERLAY_ID;
    overlay.style.zIndex = '1600';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel drawer-panel--xwide';
    panel.id = DRAWER_ID;
    panel.style.zIndex = '1700';

    const name = `${prefill.vorname || ''} ${prefill.nachname || ''}`.trim();

    panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">Neuen Creator anlegen</span>
          <p class="drawer-subtitle">${escapeHtml(name || prefill.instagram || 'Aus dem Casting')}</p>
        </div>
        <div>
          <button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button>
        </div>
      </div>
      <div class="drawer-body" id="${DRAWER_ID}-body"></div>
    `;

    overlay.addEventListener('click', () => this.close({ cancelled: true }));
    panel.querySelector('.drawer-close-btn').addEventListener('click', () => this.close({ cancelled: true }));

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });

    this.renderForm();
  }

  renderForm() {
    const body = document.getElementById(`${DRAWER_ID}-body`);
    if (!body || !window.formSystem) return;

    body.innerHTML = window.formSystem.renderFormOnly('creator', this.prefill);

    const form = body.querySelector('#creator-form');
    if (!form) return;

    const cancelBtn = form.querySelector('.mdc-btn--cancel');
    if (cancelBtn) {
      cancelBtn.removeAttribute('onclick');
      cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.close({ cancelled: true });
      });
    }

    const submitBtn = form.querySelector('.mdc-btn--create');
    if (submitBtn) {
      submitBtn.dataset.mode = 'create';
      const label = submitBtn.querySelector('.mdc-btn__label');
      if (label) label.textContent = 'Erstellen';
    }

    form.onsubmit = async (e) => {
      e.preventDefault();
      await this.handleSubmit(form);
    };

    void window.formSystem.bindFormEvents('creator', null).then(() => {
      if (!form.isConnected) return;
      injectFirmaCreateButton();
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleSubmit(form);
      };
      this.setupDuplicateValidation(form);
    }).catch(error => {
      console.error('CreatorFormDrawer: Formular-Init fehlgeschlagen:', error);
    });
  }

  setupDuplicateValidation(form) {
    const vornameField = form.querySelector('#vorname, input[name="vorname"]');
    const nachnameField = form.querySelector('#nachname, input[name="nachname"]');
    if (!vornameField || !nachnameField) return;

    let messageContainer = nachnameField.parentElement.querySelector('.duplicate-message-container');
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.className = 'duplicate-message-container';
      nachnameField.parentElement.appendChild(messageContainer);
    }

    const runCheck = async () => {
      const vorname = vornameField.value.trim();
      const nachname = nachnameField.value.trim();
      if (!vorname || !nachname || !window.duplicateChecker) {
        messageContainer.innerHTML = '';
        this.setSubmitDisabled(form, false);
        return;
      }
      try {
        const result = await window.duplicateChecker.checkCreator(vorname, nachname, null);
        if (result.exact) {
          this.renderDuplicate(messageContainer, result.similar, true);
          this.setSubmitDisabled(form, true);
        } else if (result.similar?.length) {
          this.renderDuplicate(messageContainer, result.similar, false);
          this.setSubmitDisabled(form, false);
        } else {
          messageContainer.innerHTML = '';
          this.setSubmitDisabled(form, false);
        }
      } catch (error) {
        console.error('Duplikat-Check fehlgeschlagen:', error);
      }
    };

    [vornameField, nachnameField].forEach(field => {
      field.addEventListener('blur', runCheck);
      field.addEventListener('input', () => {
        messageContainer.innerHTML = '';
        this.setSubmitDisabled(form, false);
      });
    });
  }

  renderDuplicate(container, entries, isError) {
    const list = (entries || []).map(entry => {
      const name = `${entry.vorname || ''} ${entry.nachname || ''}`.trim();
      const handle = entry.instagram ? ` (@${escapeHtml(entry.instagram)})` : '';
      return `
        <li class="duplicate-list-item">
          <a href="#" class="duplicate-link" data-entity-id="${escapeHtml(entry.id)}">
            <span class="duplicate-name">${escapeHtml(name)}${handle}</span>
          </a>
        </li>`;
    }).join('');

    container.innerHTML = `
      <div class="${isError ? 'duplicate-error' : 'duplicate-warning'}">
        <strong>${isError ? 'Dieser Creator existiert bereits!' : 'Folgende ähnliche Einträge gefunden:'}</strong>
        ${list ? `<ul class="duplicate-list">${list}</ul>` : ''}
      </div>
    `;

    container.querySelectorAll('.duplicate-link[data-entity-id]').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const id = link.dataset.entityId;
        if (!id || !this.onUseExisting) return;
        try {
          await this.onUseExisting(id);
          this.close({ cancelled: false });
        } catch (error) {
          console.error('Bestehenden Creator verknüpfen fehlgeschlagen:', error);
          window.toastSystem?.show(error.message || 'Verknüpfen fehlgeschlagen', 'error');
        }
      });
    });
  }

  setSubmitDisabled(form, disabled) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = disabled;
    btn.style.opacity = disabled ? '0.5' : '';
    btn.style.cursor = disabled ? 'not-allowed' : '';
  }

  async handleSubmit(form) {
    const btn = form.querySelector('.mdc-btn.mdc-btn--create');
    if (btn?.dataset.locked === 'true' || btn?.disabled) return;

    if (btn) {
      btn.dataset.locked = 'true';
      btn.classList.add('is-loading');
      const labelEl = btn.querySelector('.mdc-btn__label');
      if (labelEl) labelEl.textContent = 'Wird angelegt…';
    }

    try {
      const submitData = window.formSystem.collectSubmitData(form);
      submitData.instagram_follower = resolveFollowerSubmit(
        submitData.instagram_follower,
        this.originalFollowers.instagram
      );
      submitData.tiktok_follower = resolveFollowerSubmit(
        submitData.tiktok_follower,
        this.originalFollowers.tiktok
      );

      if (this.extraInsert.profilbild_url && !submitData.profilbild_url) {
        submitData.profilbild_url = this.extraInsert.profilbild_url;
      }

      const validation = window.validatorSystem.validateForm(submitData, {
        vorname: { type: 'text', minLength: 2, required: true },
        nachname: { type: 'text', minLength: 2, required: true },
        mail: { type: 'email' },
        telefonnummer: { type: 'phone' },
        portfolio_link: { type: 'url' }
      });

      if (!validation.isValid) {
        this.resetSubmitBtn(btn);
        this.showValidationErrors(form, validation.errors);
        return;
      }

      const result = await window.dataService.createEntity('creator', submitData);
      if (!result.success) throw new Error(result.error || 'Creator konnte nicht angelegt werden');

      window.toastSystem?.show('Creator angelegt', 'success');
      if (this.onCreated) await this.onCreated({ id: result.id, ...submitData });
      this.close({ cancelled: false });
    } catch (error) {
      console.error('CreatorFormDrawer: Anlegen fehlgeschlagen:', error);
      window.toastSystem?.show(error.message || 'Fehler beim Anlegen', 'error');
      this.resetSubmitBtn(btn);
    }
  }

  resetSubmitBtn(btn) {
    if (!btn) return;
    btn.dataset.locked = 'false';
    btn.classList.remove('is-loading');
    const labelEl = btn.querySelector('.mdc-btn__label');
    if (labelEl) labelEl.textContent = 'Erstellen';
  }

  showValidationErrors(form, errors) {
    form.querySelectorAll('.field-error').forEach(el => el.remove());
    Object.entries(errors).forEach(([field, message]) => {
      const fieldElement = form.querySelector(`[name="${field}"]`);
      if (!fieldElement) return;
      const errorElement = document.createElement('div');
      errorElement.className = 'field-error';
      errorElement.textContent = message;
      fieldElement.parentNode.appendChild(errorElement);
    });
  }

  close({ cancelled } = {}) {
    if (this._closed) return;
    this._closed = true;

    if (cancelled && this.onCancel) this.onCancel();

    const panel = document.getElementById(DRAWER_ID);
    document.getElementById(OVERLAY_ID)?.classList.remove('active');
    if (panel) {
      panel.classList.remove('show');
      setTimeout(() => this.remove(), 250);
    } else {
      this.remove();
    }
  }

  remove() {
    document.getElementById(OVERLAY_ID)?.remove();
    document.getElementById(DRAWER_ID)?.remove();
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
