// PersonaLikySlot.js
// Rechte Spalte des Persona-Worksheets: der Liky-Chat. Aktuell nur die
// strukturelle Huelle (Composer deaktiviert, Begruessung im Verlauf) - die
// KI-Befuellung der Persona-Felder kommt als eigener Schritt mit Job und
// Background-Function dazu, wie am Produkt.

import { icon } from '../../core/icons/IconSystem.js';

const GRUSS = 'Ich kann Personas bald selbst ausfüllen und verbessern. Aktuell bin ich nur am Produkt verdrahtet – schreib mir dort eine Shop-URL.';

export function renderPersonaLikySlot() {
  return `
    <div class="doc-chat__composer doc-chat__composer--bald">
      <div class="form-field doc-chat__field">
        <label for="persona-liky-input">Liky</label>
        <div class="doc-chat__input">
          <input type="text" id="persona-liky-input" class="doc-chat__eingabe"
                 disabled autocomplete="off"
                 placeholder="Liky für Personas folgt …">
        </div>
        <div class="doc-chat__footer">
          <div class="doc-chat__meta"></div>
          <button type="button" class="doc-chat__send" disabled
                  title="Liky für Personas folgt" aria-label="Liky für Personas folgt">
            ${icon('paper-airplane')}
          </button>
        </div>
      </div>
    </div>
    <div class="doc-chat__feed">
      <div class="doc-chat__msg doc-chat__msg--liky">
        <div class="doc-chat__head">
          <span class="doc-chat__avatar" aria-hidden="true">L</span>
          <span class="doc-chat__name">Liky</span>
        </div>
        <div class="doc-chat__text">${GRUSS}</div>
      </div>
    </div>
  `;
}
