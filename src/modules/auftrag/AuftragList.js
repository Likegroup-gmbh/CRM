// AuftragList.js
// Entry-Point: Importiert Core-Klasse und alle Prototype-Mixins

import { AuftragList } from './AuftragListCore.js';
import './AuftragListFormatters.js';
import './AuftragListDataLoader.js';
import './AuftragListRenderers.js';
import './AuftragListEvents.js';

export { AuftragList };
export const auftragList = new AuftragList();
