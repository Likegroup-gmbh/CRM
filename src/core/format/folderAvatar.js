// Bild der Ordner-Karten im Grid (Unternehmen, Marke, Kampagne): dieselbe Kachel wie in den Tabellen.
// Logo ganz sichtbar (contain), ohne Logo das Ordner-Icon. Groesse über --size-table-avatar an .folder-icon.

import { icon } from '../icons/IconSystem.js';
import { renderTableAvatar } from './tableIdentity.js';

export function renderFolderAvatar({ url = null, name = '' } = {}) {
  return renderTableAvatar({ url, name, logo: true, iconHtml: icon('folder-open') });
}
