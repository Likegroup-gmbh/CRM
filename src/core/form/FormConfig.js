// FormConfig.js
// Registry der Formular-Konfigurationen. Die Felddefinitionen selbst liegen
// pro Entitaet unter ./config/ - hier steht nur die Zuordnung.

import { rechnungContractingConfig } from './config/RechnungContractingFormConfig.js';
import { creatorConfig } from './config/CreatorFormConfig.js';
import { unternehmenConfig } from './config/UnternehmenFormConfig.js';
import { kampagneConfig } from './config/KampagneFormConfig.js';
import { markeConfig } from './config/MarkeFormConfig.js';
import { auftragConfig } from './config/AuftragFormConfig.js';
import { kooperationConfig } from './config/KooperationFormConfig.js';
import { ansprechpartnerConfig } from './config/AnsprechpartnerFormConfig.js';
import { briefingConfig } from './config/BriefingFormConfig.js';
import { produktConfig } from './config/ProduktFormConfig.js';
import { personaConfig } from './config/PersonaFormConfig.js';
import { rechnungConfig } from './config/RechnungFormConfig.js';
import { sourcingConfig } from './config/SourcingFormConfig.js';
import { strategieConfig } from './config/StrategieFormConfig.js';
import { kickoffEmbeddedConfig } from './config/KickoffEmbeddedFormConfig.js';
import { strategiebriefingEmbeddedConfig } from './config/StrategiebriefingEmbeddedFormConfig.js';
import { managementConfig } from './config/ManagementFormConfig.js';
import { firmaConfig } from './config/FirmaFormConfig.js';

const FORM_CONFIGS = {
  rechnung_contracting: rechnungContractingConfig,
  creator: creatorConfig,
  unternehmen: unternehmenConfig,
  kampagne: kampagneConfig,
  marke: markeConfig,
  auftrag: auftragConfig,
  kooperation: kooperationConfig,
  ansprechpartner: ansprechpartnerConfig,
  briefing: briefingConfig,
  produkt: produktConfig,
  persona: personaConfig,
  rechnung: rechnungConfig,
  sourcing: sourcingConfig,
  strategie: strategieConfig,
  kickoff_embedded: kickoffEmbeddedConfig,
  strategiebriefing_embedded: strategiebriefingEmbeddedConfig,
  management: managementConfig,
  firma: firmaConfig,
};

export class FormConfig {
  getFormConfig(entity) {
    return FORM_CONFIGS[entity] || null;
  }
}
