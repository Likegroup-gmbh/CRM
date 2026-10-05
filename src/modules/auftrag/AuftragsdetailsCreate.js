// AuftragsdetailsCreate.js
// Entry-Point: Importiert Core-Klasse und alle Prototype-Mixins

import { AuftragsdetailsCreateController } from './AuftragsdetailsCreateCore.js';
import './AuftragsdetailsCreateData.js';
import './AuftragsdetailsCreateSelects.js';
import './AuftragsdetailsCreateEvents.js';

export { AuftragsdetailsCreateController };

// Exportiere Instanz für globale Nutzung
export const auftragsdetailsCreate = new AuftragsdetailsCreateController();
