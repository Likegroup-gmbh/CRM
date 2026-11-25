// PersonaLikySlot.js
// Rechte Spalte des Persona-Worksheets: der Liky-Chat. Composer und Verlauf
// kommen aus likyComposer.js, das Panel (PersonaLikyPanel.js) fuellt den
// Feed und verdrahtet Send. Was Liky hier darf, steht in likyCapabilities
// (persona: extract url+pdf, chat true).

import { renderLikyComposer, renderLikySend, renderLikyColumn, renderLikyEingabe } from '../../core/chat/likyComposer.js';
import { likyCapability, likyCanExtractPdf, likyCanExtractUrl } from '../../core/chat/likyCapabilities.js';

export function personaLikyPlaceholder() {
  const url = likyCanExtractUrl('persona');
  const pdf = likyCanExtractPdf('persona');
  if (url && pdf) return 'Shop-URL, PDF oder ein paar Sätze zur Persona…';
  if (url) return 'Shop-URL oder ein paar Sätze zur Persona…';
  if (pdf) return 'PDF oder ein paar Sätze zur Persona…';
  return 'Ein paar Sätze zur Persona…';
}

export function renderPersonaLikySlot() {
  const cap = likyCapability('persona');
  const enabled = Boolean(cap);
  const mitPdf = enabled && likyCanExtractPdf('persona');

  return renderLikyColumn({
    feedId: 'persona-liky-feed',
    composer: renderLikyComposer({
      composerId: 'persona-liky-composer',
      label: 'Liky',
      labelFor: 'persona-liky-input',
      disabled: !enabled,
      inputHtml: `
        ${mitPdf ? '<div class="doc-chat__chips" id="persona-liky-chips"></div>' : ''}
        ${renderLikyEingabe({
          id: 'persona-liky-input',
          disabled: !enabled,
          placeholder: enabled ? personaLikyPlaceholder() : 'Liky für Personas folgt …'
        })}
      `,
      sendHtml: renderLikySend({
        id: 'persona-liky-send',
        title: enabled ? 'An Liky schicken' : 'Liky für Personas folgt',
        disabled: !enabled
      })
    })
  });
}
