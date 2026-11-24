// personaFormEinbettung.js
// Wo das Personaformular lebt: als eigene Seite (Headline, Breadcrumb) oder eingebettet
// im Personas-Tab der Produktion (ADR 0079), dann wie /persona/:id, nur im Pane.
// Gemeinsames liegt in core/doc/docEinbettung.js.

import { installDocEinbettung } from '../../core/doc/docEinbettung.js';
import { nestedSwitcherContext } from '../../core/breadcrumbSwitcher.js';

function seitenKopf(titel, blatt) {
  window.setHeadline(titel);
  if (this.isStandalone) {
    // Schlichter Kontext statt nestedSwitcherContext: ctx.basePath ist '/persona',
    // damit wuerde nestedOwnerRoute '/persona/persona?persona=<id>' bauen. Der
    // Fallback '/persona/<id>' ist die korrekte Standalone-Route.
    window.breadcrumbSystem?.updateBreadcrumb([
      { label: 'Personas', url: '/persona', clickable: true },
      { label: blatt, clickable: false }
    ], null, {
      switcher: this.isEdit ? { segment: 'persona', id: this.personaId } : null
    });
    return;
  }
  window.breadcrumbSystem?.updateBreadcrumb([
    { label: this.ctx.listLabel, url: this.ctx.listPath, clickable: true },
    { label: this.ctx.ownerLabel, url: this.ctx.basePath, clickable: true },
    { label: 'Personas', url: this.returnRoute, clickable: true },
    { label: blatt, clickable: false }
  ], null, {
    switcher: this.isEdit ? nestedSwitcherContext('persona', this.personaId, this.ctx) : null
  });
}

export function installPersonaFormEinbettung(proto) {
  installDocEinbettung(proto, { seitenKopf });

  // Eingebettet zählt das Formular als /persona/:id, egal welche Seite drumherum steht
  Object.defineProperty(proto, 'isStandalone', {
    configurable: true,
    get() {
      return this.embedded || window.location.pathname.split('/').filter(Boolean)[0] === 'persona';
    }
  });

  /**
   * Bearbeiten im Tab.
   * @param {HTMLElement} host
   * @param {string} personaId
   * @param {{ onTitel?: (label: string) => void, onSchliessen?: () => void }} [opts]
   */
  proto.mountEmbedded = async function mountEmbedded(host, personaId, { onTitel, onSchliessen } = {}) {
    this._einbetten({ host, onTitel, onSchliessen });
    await this.init(personaId);
  };
}
