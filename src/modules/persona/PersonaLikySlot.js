// PersonaLikySlot.js
// Rechte Spalte des Persona-Worksheets: der Liky-Chat. Aktuell nur die
// strukturelle Huelle (Composer deaktiviert, Begruessung im Verlauf) - die
// KI-Befuellung der Persona-Felder kommt als eigener Schritt mit Job und
// Background-Function dazu, wie am Produkt. Markup kommt komplett aus
// likyComposer.js, damit die Spalte ueberall gleich gebaut ist.

import { renderLikyComposer, renderLikySend, renderLikyColumn } from '../../core/chat/likyComposer.js';

const GRUSS = 'Ich kann Personas bald selbst ausfüllen und verbessern. Aktuell bin ich nur am Produkt verdrahtet – schreib mir dort eine Shop-URL.';

export function renderPersonaLikySlot() {
  return renderLikyColumn({
    feedHtml: `
      <div class="doc-chat__msg doc-chat__msg--liky">
        <div class="doc-chat__head">
          <span class="doc-chat__avatar" aria-hidden="true">L</span>
          <span class="doc-chat__name">Liky</span>
        </div>
        <div class="doc-chat__text">${GRUSS}</div>
      </div>
    `,
    composer: renderLikyComposer({
      label: 'Liky',
      labelFor: 'persona-liky-input',
      disabled: true,
      inputHtml: `
        <div class="doc-chat__input">
          <input type="text" id="persona-liky-input" class="doc-chat__eingabe"
                 disabled autocomplete="off"
                 placeholder="Liky für Personas folgt …">
        </div>
      `,
      sendHtml: renderLikySend({
        title: 'Liky für Personas folgt',
        disabled: true
      })
    })
  });
}
