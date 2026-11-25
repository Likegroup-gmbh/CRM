// AuftragDetail.js
// Entry-Point: Importiert Core-Klasse und alle Prototype-Mixins

import { AuftragDetail } from './AuftragDetailCore.js';
import './AuftragDetailDataLoader.js';
import './AuftragDetailRenderer.js';
import './AuftragDetailFinanzen.js';
import './AuftragDetailProduktion.js';

export { AuftragDetail };
export const auftragDetail = new AuftragDetail();
