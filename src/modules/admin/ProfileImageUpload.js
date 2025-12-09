// ProfileImageUpload.js
// Profilbild-Upload mit Drawer (ähnlich wie Logo-Upload bei Marken/Unternehmen)

import { UploaderField } from '../../core/form/fields/UploaderField.js';

export class ProfileImageUpload {
  constructor() {
    this.drawer = null;
    this.uploader = null;
    this.userId = null;
    this.onUploadComplete = null;
  }

  /**
   * Öffnet den Upload-Drawer
   * @param {string} userId - ID des Benutzers
   * @param {Function} onComplete - Callback nach erfolgreichem Upload
   */
  open(userId, onComplete = null) {
    this.userId = userId;
    this.onUploadComplete = onComplete;
    this.renderDrawer();
    this.initUploader();
    this.bind();
  }

  renderDrawer() {
    // Entferne alten Drawer falls vorhanden
    this.removeDrawer();

    // Erstelle Overlay
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'profile-image-upload-overlay';
    
    // Erstelle Panel
    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = 'profile-image-upload-drawer';

    // Header
    const header = document.createElement('div');
    header.className = 'drawer-header';
    
    const headerLeft = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Profilbild hochladen';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Erlaubt: PNG, JPG (max. 200 KB)';
    
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

    // Body
    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.innerHTML = `
      <form id="profile-image-form">
        <div class="form-field">
          <label>Profilbild</label>
          <div class="uploader" data-name="profile_image"></div>
        </div>

        <!-- Actions innerhalb des Body -->
        <div class="drawer-actions">
          <button type="button" class="mdc-btn mdc-btn--cancel" data-action="cancel">
            <span class="mdc-btn__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </span>
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button type="submit" class="mdc-btn mdc-btn--create" id="profile-image-submit">
            <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/>
              </svg>
            </span>
            <span class="mdc-btn__spinner" aria-hidden="true">
              <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
                <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
              </svg>
            </span>
            <span class="mdc-btn__label">Speichern</span>
          </button>
        </div>
      </form>
    `;

    panel.appendChild(header);
    panel.appendChild(body);

    // Events
    overlay.addEventListener('click', () => this.close());
    closeBtn.addEventListener('click', () => this.close());

    // Zum DOM hinzufügen
    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    this.drawer = panel;
    this.overlay = overlay;

    // Slide-in Animation nach kurzer Verzögerung
    requestAnimationFrame(() => {
      panel.classList.add('show');
    });
  }

  removeDrawer() {
    const panel = document.getElementById('profile-image-upload-drawer');
    const overlay = document.getElementById('profile-image-upload-overlay');
    if (panel) panel.remove();
    if (overlay) overlay.remove();
  }

  initUploader() {
    const uploaderRoot = this.drawer.querySelector('.uploader[data-name="profile_image"]');
    if (!uploaderRoot) {
      console.error('❌ Uploader-Root nicht gefunden');
      return;
    }

    this.uploader = new UploaderField({
      multiple: false,
      accept: 'image/png, image/jpeg, image/jpg',
      onFilesChanged: () => {
        console.log('📁 Dateien geändert:', this.uploader.files);
      }
    });

    this.uploader.mount(uploaderRoot);
  }

  bind() {
    // Cancel-Button
    this.drawer.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
      this.close();
    });

    // Submit-Button (kein form submit mehr, direkter Click)
    const submitBtn = this.drawer.querySelector('#profile-image-submit');
    submitBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      await this.handleUpload();
    });
  }

  async handleUpload() {
    try {
      const uploaderRoot = this.drawer.querySelector('.uploader[data-name="profile_image"]');
      
      if (!uploaderRoot || !uploaderRoot.__uploaderInstance || !uploaderRoot.__uploaderInstance.files.length) {
        alert('Bitte wähle ein Bild aus');
        return;
      }

      const uploaderInstance = uploaderRoot.__uploaderInstance;
      const file = uploaderInstance.files[0];

      // Validierung
      const MAX_FILE_SIZE = 200 * 1024; // 200 KB
      const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

      if (file.size > MAX_FILE_SIZE) {
        alert(`Bild ist zu groß (max. 200 KB). Dein Bild: ${(file.size / 1024).toFixed(2)} KB`);
        return;
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        alert('Nur PNG und JPG Dateien sind erlaubt');
        return;
      }

      // Upload-Button deaktivieren
      const submitBtn = this.drawer.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
      }

      // Upload zu Supabase
      await this.uploadToSupabase(file);

      // Success
      if (this.onUploadComplete) {
        this.onUploadComplete();
      }

      this.close();
      alert('Profilbild erfolgreich hochgeladen!');

    } catch (error) {
      console.error('❌ Fehler beim Hochladen:', error);
      alert('Fehler beim Hochladen des Bildes');
      
      // Button wieder aktivieren
      const submitBtn = this.drawer.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
      }
    }
  }

  async uploadToSupabase(file) {
    if (!window.supabase) {
      throw new Error('Supabase nicht verfügbar');
    }

    // Hole die auth_user_id für Storage (Policies basieren auf auth.uid())
    const { data: { user } } = await window.supabase.auth.getUser();
    if (!user) {
      throw new Error('Nicht eingeloggt');
    }
    const authUserId = user.id;

    const bucket = 'profile-images';
    const ext = file.name.split('.').pop().toLowerCase();
    const path = `${authUserId}/profile.${ext}`;

    console.log(`📤 Uploading Profilbild: ${file.name} -> ${path}`);

    // Altes Bild löschen (falls vorhanden)
    try {
      const { data: existingFiles } = await window.supabase.storage
        .from(bucket)
        .list(authUserId);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(f => `${authUserId}/${f.name}`);
        await window.supabase.storage
          .from(bucket)
          .remove(filesToDelete);
        console.log('🗑️ Alte Profilbilder gelöscht');
      }
    } catch (error) {
      console.warn('⚠️ Fehler beim Löschen alter Bilder:', error);
    }

    // Neues Bild hochladen
    const { data, error: uploadError } = await window.supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Upload-Fehler:', uploadError);
      throw uploadError;
    }

    console.log('✅ Upload erfolgreich:', data);

    // Public URL generieren
    const { data: urlData } = window.supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;
    console.log('🔗 Public URL:', publicUrl);

    // URL in Datenbank speichern
    const { error: dbError } = await window.supabase
      .from('benutzer')
      .update({
        profile_image_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', this.userId);

    if (dbError) {
      console.error('❌ DB-Update-Fehler:', dbError);
      throw dbError;
    }

    console.log('✅ Profilbild-URL in DB gespeichert');

    // Aktualisiere currentUser
    if (window.currentUser && window.currentUser.id === this.userId) {
      window.currentUser.profile_image_url = publicUrl;
      // Update auch Header
      if (window.setupHeaderUI) {
        window.setupHeaderUI();
      }
    }
  }

  close() {
    if (!this.drawer) return;

    this.drawer.classList.remove('show');
    setTimeout(() => {
      this.removeDrawer();
      this.drawer = null;
      this.overlay = null;
      this.uploader = null;
    }, 300);
  }
}

export const profileImageUpload = new ProfileImageUpload();

