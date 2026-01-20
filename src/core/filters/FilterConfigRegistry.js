// FilterConfigRegistry.js (ES6-Modul)
// Zentrale Registrierung aller Filter-Konfigurationen

// Importiere alle entitäts-spezifischen Filter-Konfigurationen
import CreatorFilterConfig from '../../modules/creator/filters/CreatorFilterConfig.js';
import AnsprechpartnerFilterConfig from '../../modules/ansprechpartner/filters/AnsprechpartnerFilterConfig.js';
import UnternehmenFilterConfig from '../../modules/unternehmen/filters/UnternehmenFilterConfig.js';
import MarkeFilterConfig from '../../modules/marke/filters/MarkeFilterConfig.js';
import ProduktFilterConfig from '../../modules/produkt/filters/ProduktFilterConfig.js';
import KampagneFilterConfig from '../../modules/kampagne/filters/KampagneFilterConfig.js';
import BriefingFilterConfig from '../../modules/briefing/filters/BriefingFilterConfig.js';
import AuftragFilterConfig from '../../modules/auftrag/filters/AuftragFilterConfig.js';
import AuftragsdetailsFilterConfig from '../../modules/auftrag/filters/AuftragsdetailsFilterConfig.js';
import AuftragCashFlowFilterConfig from '../../modules/auftrag/filters/AuftragCashFlowFilterConfig.js';
import KooperationFilterConfig from '../../modules/kooperation/filters/KooperationFilterConfig.js';
import RechnungFilterConfig from '../../modules/rechnung/filters/RechnungFilterConfig.js';
import VertragFilterConfig from '../../modules/vertrag/filters/VertragFilterConfig.js';

// Importiere Filter-Logik (optional)
import CreatorFilterLogic from '../../modules/creator/filters/CreatorFilterLogic.js';
import KampagneFilterLogic from '../../modules/kampagne/filters/KampagneFilterLogic.js';
import UnternehmenFilterLogic from '../../modules/unternehmen/filters/UnternehmenFilterLogic.js';
import MarkeFilterLogic from '../../modules/marke/filters/MarkeFilterLogic.js';
import AuftragFilterLogic from '../../modules/auftrag/filters/AuftragFilterLogic.js';
import AuftragsdetailsFilterLogic from '../../modules/auftrag/filters/AuftragsdetailsFilterLogic.js';
import KooperationFilterLogic from '../../modules/kooperation/filters/KooperationFilterLogic.js';

/**
 * Zentrale Registrierung aller Filter-Konfigurationen
 */
export const FILTER_CONFIG_REGISTRY = {
  creator: CreatorFilterConfig,
  ansprechpartner: AnsprechpartnerFilterConfig,
  unternehmen: UnternehmenFilterConfig,
  marke: MarkeFilterConfig,
  produkt: ProduktFilterConfig,
  kampagne: KampagneFilterConfig,
  auftrag: AuftragFilterConfig,
  auftragsdetails: AuftragsdetailsFilterConfig,
  auftrag_cashflow: AuftragCashFlowFilterConfig,
  kooperation: KooperationFilterConfig,
  briefing: BriefingFilterConfig,
  rechnung: RechnungFilterConfig,
  vertrag: VertragFilterConfig
};

/**
 * Zentrale Registrierung aller Filter-Logik-Module
 */
export const FILTER_LOGIC_REGISTRY = {
  creator: CreatorFilterLogic,
  kampagne: KampagneFilterLogic,
  unternehmen: UnternehmenFilterLogic,
  marke: MarkeFilterLogic,
  auftrag: AuftragFilterLogic,
  auftragsdetails: AuftragsdetailsFilterLogic,
  kooperation: KooperationFilterLogic
  // Weitere Logik-Module können hier hinzugefügt werden
};

/**
 * Hilfsfunktion: Hole Filter-Konfiguration für eine Entität
 */
export function getFilterConfig(entityType) {
  const config = FILTER_CONFIG_REGISTRY[entityType];
  if (!config) {
    console.warn(`⚠️ Keine Filter-Konfiguration für ${entityType} gefunden`);
    return {
      filters: [],
      groups: [],
      presets: [],
      entityType
    };
  }
  return config;
}

/**
 * Hilfsfunktion: Hole Filter-Logik für eine Entität
 */
export function getFilterLogic(entityType) {
  return FILTER_LOGIC_REGISTRY[entityType] || null;
}

/**
 * Hilfsfunktion: Prüfe ob Filter-Konfiguration verfügbar ist
 */
export function hasFilterConfig(entityType) {
  return !!FILTER_CONFIG_REGISTRY[entityType];
}

/**
 * Hilfsfunktion: Prüfe ob Filter-Logik verfügbar ist
 */
export function hasFilterLogic(entityType) {
  return !!FILTER_LOGIC_REGISTRY[entityType];
}

/**
 * Hilfsfunktion: Alle verfügbaren Entitäts-Typen abrufen
 */
export function getAvailableEntityTypes() {
  return Object.keys(FILTER_CONFIG_REGISTRY);
}