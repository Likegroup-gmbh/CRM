// RechnungNotizModal.js
// Modal zum Erstellen/Bearbeiten/Löschen von Rückfrage-Notizen an Rechnungen

export class RechnungNotizModal {
  constructor() {
    this._open = false;
    this._currentModal = null;
  }

  /**
   * Öffnet das Notiz-Modal.
   * @param {object} opts
   * @param {string} opts.rechnungId - Die Rechnungs-ID
   * @param {'create'|'edit'} opts.mode - Modus (create = nach Status-Wechsel, edit = Klick auf Indikator)
   * @returns {Promise<{action: 'save'|'cancel'|'delete', text?: string}>}
   */
  async open({ rechnungId, mode = 'create' }) {
    if (this._open && this._currentModal) {
      this._currentModal.remove();
      this._open = false;
      this._currentModal = null;
    }

    const existing = await this._loadNotiz(rechnungId);
    const canDelete = existing && this._canDeleteNotiz(existing);

    this._open = true;

    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal overlay-modal rechnung-notiz-modal';

      const title = mode === 'create' ? 'Rückfrage-Notiz hinzufügen' : 'Rückfrage-Notiz';
      const formatDate = (v) => v ? new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(v)) : '';

      modal.innerHTML = `
        <div class="modal-dialog notiz-modal-dialog">
          <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" data-action="close">&times;</button>
          </div>
          <div class="modal-body">
            ${existing ? `
              <div class="notiz-meta">
                <span class="notiz-meta-author">${existing.benutzer_name || 'Unbekannt'}</span>
                <span class="notiz-meta-date">${formatDate(existing.erstellt_am)}</span>
              </div>
            ` : ''}
            <textarea class="notiz-textarea" placeholder="Notiz zur Rückfrage eingeben..." rows="4">${existing?.notiz || ''}</textarea>
          </div>
          <div class="modal-footer">
            ${canDelete ? `<button type="button" class="danger-btn notiz-btn-delete" data-action="delete">Löschen</button>` : ''}
            <div class="notiz-footer-right">
              <button type="button" class="secondary-btn" data-action="cancel">Abbrechen</button>
              <button type="button" class="primary-btn" data-action="save">Speichern</button>
            </div>
          </div>
        </div>`;

      document.body.appendChild(modal);
      this._currentModal = modal;

      const textarea = modal.querySelector('.notiz-textarea');
      setTimeout(() => textarea.focus(), 50);

      const close = (result) => {
        if (!modal.parentNode) return;
        window.removeEventListener('keydown', onKey);
        modal.remove();
        this._open = false;
        this._currentModal = null;
        resolve(result);
      };

      modal.querySelector('[data-action="close"]').addEventListener('click', () => close({ action: 'cancel' }));
      modal.querySelector('[data-action="cancel"]').addEventListener('click', () => close({ action: 'cancel' }));
      modal.querySelector('[data-action="save"]').addEventListener('click', () => {
        close({ action: 'save', text: textarea.value.trim() });
      });

      const deleteBtn = modal.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => close({ action: 'delete' }));
      }

      modal.addEventListener('click', (e) => {
        if (e.target === modal) close({ action: 'cancel' });
      });

      const onKey = (ev) => {
        if (ev.key === 'Escape') close({ action: 'cancel' });
      };
      window.addEventListener('keydown', onKey);
    });
  }

  /**
   * Speichert/aktualisiert eine Notiz (UPSERT via DELETE + INSERT wegen UNIQUE constraint).
   */
  async saveNotiz(rechnungId, text) {
    if (!text) return;
    const userId = window.currentUser?.id;
    if (!userId) return;

    await window.supabase
      .from('rechnung_notizen')
      .delete()
      .eq('rechnung_id', rechnungId);

    const { error } = await window.supabase
      .from('rechnung_notizen')
      .insert({ rechnung_id: rechnungId, notiz: text, erstellt_von: userId });

    if (error) throw error;
  }

  async deleteNotiz(rechnungId) {
    const { error } = await window.supabase
      .from('rechnung_notizen')
      .delete()
      .eq('rechnung_id', rechnungId);
    if (error) throw error;
  }

  async hasNotiz(rechnungId) {
    const { data } = await window.supabase
      .from('rechnung_notizen')
      .select('id')
      .eq('rechnung_id', rechnungId)
      .maybeSingle();
    return !!data;
  }

  async _loadNotiz(rechnungId) {
    const { data } = await window.supabase
      .from('rechnung_notizen')
      .select('id, notiz, erstellt_von, erstellt_am, benutzer:erstellt_von(name)')
      .eq('rechnung_id', rechnungId)
      .maybeSingle();

    if (!data) return null;
    return {
      ...data,
      benutzer_name: data.benutzer?.name || null
    };
  }

  _canDeleteNotiz(notiz) {
    if (window.isAdmin()) return true;
    return notiz.erstellt_von === window.currentUser?.id;
  }
}

export const rechnungNotizModal = new RechnungNotizModal();
