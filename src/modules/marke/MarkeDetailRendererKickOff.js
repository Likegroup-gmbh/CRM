// MarkeDetailRendererKickOff.js
// Strategiebriefing Tab für Marke – delegiert an shared Renderer

import { renderStrategiebriefing, bindStrategiebriefingCreateButton } from '../kickoff/StrategiebriefingRenderer.js';

export function renderKickOff(detail) {
  return renderStrategiebriefing(detail, { parentType: 'marke' });
}

export function bindKickOffCreateButton(detail) {
  bindStrategiebriefingCreateButton(detail, { parentType: 'marke' });
}
