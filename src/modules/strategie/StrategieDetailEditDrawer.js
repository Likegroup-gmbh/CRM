// StrategieDetailEditDrawer.js
// Edit-Drawer für Strategie-Items

import { strategieService } from './StrategieService.js';
import { escapeAttr } from '../../core/VideoUploadUtils.js';
import { icon } from '../../core/icons/IconSystem.js';

const DRAWER_ID = 'edit-item-drawer';

/** Nur aus TikTok und Instagram laesst sich eine Tonspur bzw. Untertitel ziehen. */
function isTranscribableUrl(url) {
  const u = (url || '').toLowerCase();
  return u.includes('tiktok.com') || u.includes('instagram.com');
}

export function showEditItemDrawer(detail, itemId) {
  const item = detail.items.find(i => i.id === itemId);
  if (!item) {
    window.toastSystem?.show('Item nicht gefunden', 'error');
    return;
  }

  removeEditItemDrawer();
  
  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = `${DRAWER_ID}-overlay`;
  
  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.className = 'drawer-panel';
  panel.id = DRAWER_ID;

  const header = document.createElement('div');
  header.className = 'drawer-header';
  
  const headerLeft = document.createElement('div');
  const title = document.createElement('span');
  title.className = 'drawer-title';
  title.textContent = 'Item bearbeiten';
  
  const subtitle = document.createElement('p');
  subtitle.className = 'drawer-subtitle';
  subtitle.textContent = item.video_link ? 'Video-Eintrag anpassen' : 'Idee anpassen';
  
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
  body.id = `${DRAWER_ID}-body`;
  body.innerHTML = renderEditItemDrawerBody(detail, item);

  panel.appendChild(header);
  panel.appendChild(body);

  overlay.addEventListener('click', () => closeEditItemDrawer());
  closeBtn.addEventListener('click', () => closeEditItemDrawer());

  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  requestAnimationFrame(() => {
    panel.classList.add('show');
  });
  
  bindEditItemDrawerEvents(detail, itemId);
}

function renderEditItemDrawerBody(detail, item) {
  const teilbereiche = detail.getTeilbereicheFromStrategie();
  
  return `
    <form id="edit-item-form" class="drawer-form">
      <div class="form-field">
        <label for="edit-video-url">Video-URL (optional)</label>
        <input 
          type="url" 
          id="edit-video-url" 
          name="video_link" 
          class="form-input" 
          value="${item.video_link || ''}"
          placeholder="https://tiktok.com/... oder https://instagram.com/reel/... – leer für Idee"
        >
      </div>

      <div class="form-field">
        <label for="edit-teilbereich">Kategorie</label>
        <select id="edit-teilbereich" name="teilbereich" class="form-input">
          <option value="">Ohne Kategorie</option>
          ${teilbereiche.map(tb => `<option value="${escapeAttr(tb)}" ${item.teilbereich === tb ? 'selected' : ''}>${escapeAttr(tb)}</option>`).join('')}
        </select>
      </div>

      <div class="form-field">
        <label for="edit-creator-name">Creator</label>
        <input 
          type="text" 
          id="edit-creator-name" 
          name="creator_name" 
          class="form-input" 
          value="${item.creator_name || ''}"
          placeholder="Creator-Name..."
        >
      </div>

      <div class="form-field">
        <label for="edit-beschreibung">Beschreibung</label>
        <textarea 
          id="edit-beschreibung" 
          name="beschreibung" 
          class="form-input" 
          rows="3"
          placeholder="Beschreibung für das Video/die Idee..."
        >${item.beschreibung || ''}</textarea>
      </div>

      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close-drawer">
          <span class="mdc-btn__icon" aria-hidden="true">
            ${icon('x-circle-filled')}
          </span>
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button type="submit" class="mdc-btn mdc-btn--create">
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
      </div>
    </form>
  `;
}

function bindEditItemDrawerEvents(detail, itemId) {
  const form = document.getElementById('edit-item-form');
  const cancelBtn = form?.querySelector('[data-action="close-drawer"]');
  
  cancelBtn?.addEventListener('click', () => closeEditItemDrawer());
  
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleEditItemSubmit(detail, itemId, new FormData(form));
  });
}

async function handleEditItemSubmit(detail, itemId, formData) {
  const submitBtn = document.querySelector('#edit-item-form button[type="submit"]');
  const originalText = submitBtn?.innerHTML;
  
  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Speichern...';
    }

    const videoUrl = formData.get('video_link')?.trim() || null;
    const teilbereich = formData.get('teilbereich') || null;
    const creatorName = formData.get('creator_name')?.trim() || null;
    const beschreibung = formData.get('beschreibung')?.trim() || null;

    const item = detail.items.find(i => i.id === itemId);
    const urlGeaendert = (videoUrl || null) !== (item?.video_link || null);

    // Nur neue Links werden geprueft - bestehende YouTube-Eintraege aus der Zeit
    // vor der Transkription bleiben unangetastet, solange man sie nicht anfasst.
    if (videoUrl && urlGeaendert && !isTranscribableUrl(videoUrl)) {
      window.toastSystem?.show('Nur TikTok- und Instagram-Links sind erlaubt', 'warning');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
      return;
    }

    let platform = null;
    if (videoUrl) {
      if (videoUrl.includes('tiktok.com')) platform = 'tiktok';
      else if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) platform = 'youtube';
      else if (videoUrl.includes('instagram.com')) platform = 'instagram';
      else platform = 'other';
    }

    const updates = {
      video_link: videoUrl,
      teilbereich: teilbereich,
      creator_name: creatorName,
      beschreibung: beschreibung,
      plattform: platform
    };

    // Wer hier tippt, pflegt von Hand - der KI-Tag verschwindet
    if (beschreibung !== (item?.beschreibung || null)) {
      updates.beschreibung_quelle = beschreibung ? 'user' : null;
    }

    // Neues Video: alte Ergebnisse gehoeren nicht mehr dazu
    if (urlGeaendert) {
      updates.transkript = null;
      updates.transkript_quelle = null;
      updates.caption = null;
      updates.verarbeitung_fehler = null;
      updates.verarbeitung_step = null;
      updates.verarbeitung_status = videoUrl ? 'pending' : null;
    }

    await strategieService.updateStrategieItem(itemId, updates);

    if (item) Object.assign(item, updates);

    if (urlGeaendert && videoUrl) {
      try {
        await strategieService.enqueueItemProcessing(detail.strategieId, itemId);
      } catch (e) {
        console.warn('Verarbeitung konnte nicht gestartet werden:', e);
      }
    }

    window.toastSystem?.show('Änderungen gespeichert', 'success');
    closeEditItemDrawer();
    detail.rerenderItemsTable();

  } catch (error) {
    console.error('Fehler beim Speichern:', error);
    window.toastSystem?.show('Fehler beim Speichern', 'error');
    
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
}

export function removeEditItemDrawer() {
  document.getElementById(`${DRAWER_ID}-overlay`)?.remove();
  document.getElementById(DRAWER_ID)?.remove();
}

export function closeEditItemDrawer() {
  const panel = document.getElementById(DRAWER_ID);
  
  if (panel) {
    panel.classList.remove('show');
    setTimeout(() => {
      removeEditItemDrawer();
    }, 300);
  } else {
    removeEditItemDrawer();
  }
}
