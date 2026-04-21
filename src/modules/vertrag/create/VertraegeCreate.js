// VertraegeCreate.js
// Entry-Point fuer die Vertragserstellung.
// Importiert alle Teil-Module (die per Prototype-Extension Methoden an die Klasse hangen)
// und exportiert ein Singleton fuer den ModuleRegistry.

import { VertraegeCreate } from './VertraegeCreateCore.js';

// Side-effect imports: erweitern VertraegeCreate.prototype
import './ContractTranslations.js';
import './RenderShell.js';
import './KooperationLogic.js';
import './FormEvents.js';
import './SearchableSelects.js';
import './AgenturSection.js';
import './AgenturEditModal.js';
import './DataPersistence.js';
import './types/UgcContract.js';
import './types/InfluencerContract.js';
import './types/VideografContract.js';
import './types/ModelContract.js';
import './pdf/UgcPdf.js';
import './pdf/InfluencerPdf.js';
import './pdf/VideografPdf.js';
import './pdf/ModelPdf.js';

export { VertraegeCreate };
export const vertraegeCreate = new VertraegeCreate();

