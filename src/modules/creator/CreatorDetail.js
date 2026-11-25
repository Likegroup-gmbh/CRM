// CreatorDetail.js
// Entry-Point: Importiert Core-Klasse und alle Prototype-Mixins

import { CreatorDetail } from './CreatorDetailCore.js';
import './CreatorDetailDataLoader.js';
import './CreatorDetailRenderers.js';
import './CreatorDetailKampagnen.js';
import './CreatorDetailInstagram.js';
import './CreatorDetailAdresse.js';
import './CreatorDetailEvents.js';
import './CreatorDetailEditSubmit.js';

export { CreatorDetail };
export const creatorDetail = new CreatorDetail();
