// CreatorDetail.js
// Entry-Point: Importiert Core-Klasse und alle Prototype-Mixins

import { CreatorDetail } from './CreatorDetailCore.js';
import './CreatorDetailDataLoader.js';
import './CreatorDetailRenderers.js';
import './CreatorDetailEvents.js';

export { CreatorDetail };
export const creatorDetail = new CreatorDetail();
