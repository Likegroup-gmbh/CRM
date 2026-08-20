import { VertragUtils } from '../vertrag/VertragUtils.js';
import { icon } from '../../core/icons/IconSystem.js';

const EXTERNAL_LINK_ICON = `${icon('external-link')}`;

export function renderVertragCell(rechnung) {
  const vertrag = rechnung?.vertrag;

  if (!vertrag) {
    return '<span class="status-dot status-dot--inactive" title="Kein Vertrag erstellt"></span>';
  }

  const status = VertragUtils.getVertragStatus(vertrag);

  if (status === 'unterschrieben') {
    const url = VertragUtils.getVertragLinkUrl(vertrag);
    return `<span class="status-dot status-dot--active" title="Unterschriebener Vertrag vorhanden"></span> <a href="${url}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="Vertrag öffnen">${EXTERNAL_LINK_ICON}</a>`;
  }

  return '<span class="status-dot status-dot--warning" title="Vertrag erstellt, nicht unterschrieben"></span>';
}
