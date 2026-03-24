import { VertragUtils } from '../vertrag/VertragUtils.js';

const EXTERNAL_LINK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>`;

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
