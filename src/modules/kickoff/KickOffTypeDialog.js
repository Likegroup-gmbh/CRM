// KickOffTypeDialog.js
// Auswahl-Dialog für Strategiebriefing-Typ (Influencer/Organic/Paid) – Standard-Modal-Pattern

export class KickOffTypeDialog {
  static show() {
    return new Promise((resolve) => {
      const existing = document.querySelector('.kickoff-type-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.className = 'modal overlay-modal kickoff-type-modal';
      modal.innerHTML = `
        <div class="modal-dialog" style="max-width: 560px;">
          <div class="modal-header">
            <h3>Strategiebriefing anlegen</h3>
            <button class="modal-close" data-action="close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="kickoff-type-options">
              <button type="button" class="kickoff-type-option" data-type="influencer">
                <span class="kickoff-type-option__label">Influencer</span>
                <span class="kickoff-type-option__desc">Creator-Content mit klarem Ziel und Format</span>
              </button>
              <button type="button" class="kickoff-type-option" data-type="organic">
                <span class="kickoff-type-option__label">Organic</span>
                <span class="kickoff-type-option__desc">Organische Reichweite, Format und Content-Logik</span>
              </button>
              <button type="button" class="kickoff-type-option" data-type="paid">
                <span class="kickoff-type-option__label">Paid</span>
                <span class="kickoff-type-option__desc">Bezahlte Kampagnen, Funnel und Performance-Ziel</span>
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="secondary-btn" data-action="cancel">Abbrechen</button>
          </div>
        </div>`;

      document.body.appendChild(modal);

      const cleanup = (result) => {
        if (!modal.parentNode) return;
        window.removeEventListener('keydown', onKey);
        modal.remove();
        resolve(result);
      };

      modal.querySelector('[data-action="close"]').addEventListener('click', () => cleanup(null));
      modal.querySelector('[data-action="cancel"]').addEventListener('click', () => cleanup(null));

      modal.addEventListener('click', (e) => {
        if (e.target === modal) cleanup(null);
      });

      modal.querySelectorAll('.kickoff-type-option').forEach(btn => {
        btn.addEventListener('click', () => cleanup(btn.dataset.type));
      });

      const onKey = (ev) => { if (ev.key === 'Escape') cleanup(null); };
      window.addEventListener('keydown', onKey);
    });
  }
}
