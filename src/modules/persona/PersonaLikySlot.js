// PersonaLikySlot.js
// Rechte Spalte des Persona-Worksheets: der Liky-Chat. Composer und Verlauf
// kommen aus likyComposer.js, das Panel (PersonaLikyPanel.js) fuellt den
// Feed und verdrahtet Send. Was Liky hier darf, steht in likyCapabilities
// (persona: extract url, chat true).

import { renderLikyComposer, renderLikySend, renderLikyColumn } from '../../core/chat/likyComposer.js';
import { likyCapability } from '../../core/chat/likyCapabilities.js';

export function renderPersonaLikySlot() {
  const cap = likyCapability('persona');
  const enabled = Boolean(cap);

  return renderLikyColumn({
    feedId: 'persona-liky-feed',
    composer: renderLikyComposer({
      composerId: 'persona-liky-composer',
      label: 'Liky',
      labelFor: 'persona-liky-input',
      disabled: !enabled,
      inputHtml: `
        <div class="doc-chat__input">
          <input type="text" id="persona-liky-input" class="doc-chat__eingabe"
                 ${enabled ? '' : 'disabled '}autocomplete="off"
                 placeholder="${enabled ? 'Shop-URL oder ein paar Sätze zur Persona…' : 'Liky für Personas folgt …'}">
        </div>
      `,
      sendHtml: renderLikySend({
        id: 'persona-liky-send',
        title: enabled ? 'An Liky schicken' : 'Liky für Personas folgt',
        disabled: !enabled
      })
    })
  });
}
