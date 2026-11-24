// produktFormEinbettung.js
// Wo das Produktformular lebt: als eigene Seite (Produkt und Kontext aus der URL,
// Headline, Breadcrumb) oder eingebettet im Produkte-Tab der Produktion (ADR 0079),
// dann wie /produkt/:id, nur im Pane. Gemeinsames liegt in core/doc/docEinbettung.js.

import { installDocEinbettung } from '../../core/doc/docEinbettung.js';
import { nestedSwitcherContext } from '../../core/breadcrumbSwitcher.js';
import { isStandaloneProduktPath } from './ProduktService.js';

export function readProduktCreateScope(search) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const unternehmenId = params.get('unternehmen');
  const markeId = params.get('marke');
  const briefingId = params.get('briefing');
  const produktionId = params.get('produktion');
  if (!unternehmenId && !markeId && !briefingId && !produktionId) return null;
  return {
    unternehmenId: unternehmenId || null,
    markeId: markeId || null,
    briefingId: briefingId || null,
    produktionId: produktionId || null
  };
}

export function standaloneProduktContext() {
  return {
    typ: 'produkt',
    markeId: null,
    unternehmenId: null,
    owner: null,
    basePath: '/produkt',
    listPath: '/produkt',
    listLabel: 'Produkte',
    ownerLabel: null,
    markenAnzahl: 0,
    standalone: true
  };
}

function ausUrl() {
  const { pathname, search } = window.location;
  const standalone = isStandaloneProduktPath(pathname);
  const pathId = pathname.split('/').filter(Boolean)[1];
  const produktId = standalone
    ? (pathId && pathId !== 'new' ? pathId : null)
    : new URLSearchParams(search).get('produkt');
  const createScope = produktId ? null : readProduktCreateScope(search);
  // Kontext-Briefing der Produktion: im Create über den Scope, im Edit
  // über den URL-Param (ProduktList.openProdukt hängt ihn an).
  const kontextBriefingId = createScope?.briefingId || new URLSearchParams(search).get('briefing') || null;
  return { standalone, produktId, createScope, kontextBriefingId };
}

function seitenKopf(titel, blatt) {
  window.setHeadline(titel);
  const crumbs = this.isStandalone
    ? [
        { label: 'Produkte', url: '/produkt', clickable: true },
        { label: blatt, clickable: false }
      ]
    : [
        { label: this.ctx.listLabel, url: this.ctx.listPath, clickable: true },
        { label: this.ctx.ownerLabel, url: this.ctx.basePath, clickable: true },
        { label: 'Produkte', url: this.returnRoute, clickable: true },
        { label: blatt, clickable: false }
      ];
  window.breadcrumbSystem?.updateBreadcrumb(crumbs, null, {
    switcher: this.isEdit
      ? (this.isStandalone
        ? { segment: 'produkt', id: this.produktId }
        : nestedSwitcherContext('produkt', this.produktId, this.ctx))
      : null
  });
}

export function installProduktFormEinbettung(proto) {
  installDocEinbettung(proto, { seitenKopf });

  /**
   * Bearbeiten im Tab. briefingId ist die Linie (Kontext-Briefing für die Personas).
   * @param {HTMLElement} host
   * @param {string} produktId
   * @param {{ briefingId?: string, onTitel?: (label: string) => void, onSchliessen?: () => void }} [opts]
   */
  proto.mountEmbedded = async function mountEmbedded(host, produktId, { briefingId = null, onTitel, onSchliessen } = {}) {
    this._einbetten({ host, produktId, briefingId, onTitel, onSchliessen });
    await this.init(null);
  };

  /** Was das Formular zeigt: { standalone, produktId, createScope, kontextBriefingId } */
  proto._ausgangslage = function _ausgangslage() {
    if (!this._einbettung) return ausUrl();
    const { produktId, briefingId } = this._einbettung;
    return { standalone: true, produktId, createScope: null, kontextBriefingId: briefingId };
  };
}
