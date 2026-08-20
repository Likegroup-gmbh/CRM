// BriefingCreate.js
// Entry-Point fuer den Briefing-Generator.
// Importiert alle Teil-Module (die per Prototype-Extension Methoden an die
// Klasse haengen) und exportiert ein Singleton fuer die ModuleRegistry.

import { BriefingCreate } from './BriefingCreateCore.js';

// Side-effect imports: erweitern BriefingCreate.prototype
import './RenderShell.js';
import './FormEvents.js';
import './DataPersistence.js';

export { BriefingCreate };
export const briefingCreate = new BriefingCreate();
