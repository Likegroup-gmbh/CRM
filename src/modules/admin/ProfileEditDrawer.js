// ProfileEditDrawer.js
// Edit-Drawer der Profilseite: DOM-Aufbau, Close-Logik, Uploader-Mount

import { UploaderField } from '../../core/form/fields/UploaderField.js';
import { icon } from '../../core/icons/IconSystem.js';
import { dateInputValue } from './ProfileDetailFormat.js';
import { handleProfileSave } from './ProfileSave.js';

const OVERLAY_ID = 'profile-edit-overlay';
const PANEL_ID = 'profile-edit-drawer';

function renderCountryOptions(detail) {
  return detail.euLaender
    .map(land => {
      const isSelected = land.id === detail.user?.telefonnummer_firmenhandy_land_id ? 'selected' : '';
      const label = `${land.vorwahl || ''} ${detail.sanitize(land.name_de || '')}`.trim();
      return `<option value="${land.id}" ${isSelected}>${label}</option>`;
    })
    .join('');
}

function renderHeader() {
  return `
    <div>
      <span class="drawer-title">Profil bearbeiten</span>
      <p class="drawer-subtitle">Persönliche Informationen anpassen</p>
    </div>
    <div>
      <button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button>
    </div>
  `;
}

function renderSaveButton() {
  return `
    <button type="button" class="mdc-btn mdc-btn--create" id="profile-save-btn">
      <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
        ${icon('check-filled')}
      </span>
      <span class="mdc-btn__spinner" aria-hidden="true">
        <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
          <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
        </svg>
      </span>
      <span class="mdc-btn__label">Speichern</span>
    </button>
  `;
}

function renderForm(detail) {
  const { user } = detail;
  const currentImageHtml = user?.profile_image_url
    ? `<div class="profile-image-preview">
         <img src="${detail.sanitize(user.profile_image_url)}" alt="Aktuelles Profilbild" class="profile-image-current">
       </div>`
    : '';

  return `
    <form id="profile-edit-form" data-no-submit-guard="true">
      <div class="form-field">
        <label>Profilbild</label>
        <div class="profile-image-field">
          ${currentImageHtml}
          <div class="profile-image-upload-area">
            <div class="uploader" data-name="profile_image"></div>
            <small class="form-hint">PNG oder JPG, max. 200 KB</small>
          </div>
        </div>
      </div>

      <div class="form-field">
        <label for="profile-name">Name *</label>
        <input type="text" id="profile-name" class="form-input" value="${detail.sanitize(user?.name || '')}" placeholder="Vollständiger Name" required>
      </div>

      <div class="form-field">
        <label for="profile-geburtsdatum">Geburtsdatum</label>
        <input type="date" id="profile-geburtsdatum" class="form-input" value="${detail.sanitize(dateInputValue(user?.geburtsdatum))}">
      </div>

      <div class="form-row form-row--gap-sm">
        <div class="form-field form-field--48">
          <label for="profile-firmenhandy-land">Land (Firmenhandy)</label>
          <select id="profile-firmenhandy-land" class="form-input">
            <option value="">Land wählen...</option>
            ${renderCountryOptions(detail)}
          </select>
        </div>
        <div class="form-field">
          <label for="profile-firmenhandy">Firmenhandy</label>
          <input type="tel" id="profile-firmenhandy" class="form-input" value="${detail.sanitize(user?.telefonnummer_firmenhandy || '')}" placeholder="z. B. 15123456789">
        </div>
      </div>

      <div class="form-field">
        <label>E-Mail</label>
        <div class="form-value-readonly">${detail.sanitize(user?.email || 'Über Supabase Auth verwaltet')}</div>
        <small class="form-hint">Die E-Mail wird über die Authentifizierung verwaltet.</small>
      </div>

      <div class="form-field">
        <label>Rolle</label>
        <div class="form-value-readonly">
          <span class="badge badge-${user?.rolle === 'admin' ? 'primary' : 'secondary'}">${detail.sanitize(user?.rolle || 'Nicht definiert')}</span>
        </div>
        <small class="form-hint">Die Rolle wird vom Administrator verwaltet.</small>
      </div>

      <div class="drawer-actions">
        <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        ${renderSaveButton()}
      </div>
    </form>
  `;
}

function mountUploader(detail, panel) {
  const uploaderRoot = panel.querySelector('.uploader[data-name="profile_image"]');
  if (!uploaderRoot) return;

  detail._profileUploader = new UploaderField({
    multiple: false,
    accept: 'image/png, image/jpeg, image/jpg, image/webp',
    maxFileSize: 200 * 1024, // 200 KB
    onFilesChanged: () => {}
  });
  detail._profileUploader.mount(uploaderRoot);
}

export function openProfileEditDrawer(detail) {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(PANEL_ID)?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = OVERLAY_ID;

  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.className = 'drawer-panel';
  panel.id = PANEL_ID;

  const header = document.createElement('div');
  header.className = 'drawer-header';
  header.innerHTML = renderHeader();

  const body = document.createElement('div');
  body.className = 'drawer-body';
  body.innerHTML = renderForm(detail);

  panel.appendChild(header);
  panel.appendChild(body);

  const closeDrawer = () => {
    panel.classList.remove('show');
    setTimeout(() => {
      overlay.remove();
      panel.remove();
    }, 300);
  };

  const save = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await handleProfileSave(detail, closeDrawer);
  };

  overlay.addEventListener('click', closeDrawer);
  header.querySelector('.drawer-close-btn')?.addEventListener('click', closeDrawer);
  panel.querySelectorAll('[data-action="close"]').forEach(btn => btn.addEventListener('click', closeDrawer));
  panel.querySelector('#profile-save-btn')?.addEventListener('click', save);
  // Fallback für Enter-Taste
  panel.querySelector('#profile-edit-form')?.addEventListener('submit', save);

  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  mountUploader(detail, panel);

  // Kurze Verzögerung für die Öffnen-Animation
  requestAnimationFrame(() => panel.classList.add('show'));
}
