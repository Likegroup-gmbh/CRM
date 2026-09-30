// StrategieService.js
// Fassade für Strategie-Datenbank-Operationen

import { getAllStrategien } from './service/strategieAccess.js';
import {
  assignCastingItem,
  getZuordbareCastingItems,
  getZuordbareVideoideen,
  linkCasting,
  unassignCastingItem,
  unlinkCasting
} from './service/strategieCasting.js';
import {
  assignProdukt,
  getBriefingProdukte,
  setSkriptFreigabe,
  unassignProdukt
} from './service/strategieFreigabe.js';
import { assertKeinVorschlag, hasSkriptForItem } from './service/strategieItemGuards.js';
import {
  createStrategieItem,
  deleteStrategieItem,
  enqueueItemProcessing,
  generiereKundenadaption,
  getStrategieItems,
  MAX_PARALLELE_VERARBEITUNGEN,
  reprocessItem,
  triggerItemProcessing,
  updateItemsSortierung,
  updateItemsSortierungWithTeilbereich,
  updateStrategieItem
} from './service/strategieItems.js';
import {
  getAllAuftraege,
  getAllKampagnen,
  getAllMarken,
  getAllUnternehmen,
  searchCreators
} from './service/strategieLookups.js';
import {
  deleteStrategie,
  getStrategieById,
  insertStrategie,
  updateStrategie
} from './service/strategieRecord.js';
import { deleteScreenshot, extractStoragePath } from './service/strategieScreenshots.js';

export { strategieItemsSelect } from './service/strategieItems.js';
export { skriptFreigabeClearPatch } from './service/strategieItemGuards.js';

export class StrategieService {
  static MAX_PARALLELE_VERARBEITUNGEN = MAX_PARALLELE_VERARBEITUNGEN;

  constructor() {
    // Supabase Client wird bei jedem Aufruf direkt verwendet
  }

  getAllStrategien() {
    return getAllStrategien();
  }

  getStrategieById(id, options) {
    return getStrategieById(id, options);
  }

  async createStrategie(strategieData) {
    const { data, castingId } = await insertStrategie(strategieData);

    if (castingId && data?.id) {
      try {
        await linkCasting(data.id, castingId);
      } catch (linkError) {
        // Konzept bleibt angelegt; manueller Link im Detail bleibt moeglich.
        console.error('Fehler beim Verknüpfen des Castings:', linkError);
        window.toastSystem?.show('Konzept angelegt, Verknüpfung mit dem Casting fehlgeschlagen – bitte im Detail manuell verknüpfen', 'warning');
      }
    }

    return data;
  }

  updateStrategie(id, updates) {
    return updateStrategie(id, updates);
  }

  deleteStrategie(id) {
    return deleteStrategie(id);
  }

  extractStoragePath(url) {
    return extractStoragePath(url);
  }

  deleteScreenshot(screenshotUrl) {
    return deleteScreenshot(screenshotUrl);
  }

  getStrategieItems(strategieId) {
    return getStrategieItems(strategieId);
  }

  createStrategieItem(itemData) {
    return createStrategieItem(itemData);
  }

  updateStrategieItem(id, updates) {
    return updateStrategieItem(id, updates);
  }

  deleteStrategieItem(id) {
    return deleteStrategieItem(id);
  }

  updateItemsSortierung(items) {
    return updateItemsSortierung(items);
  }

  updateItemsSortierungWithTeilbereich(items) {
    return updateItemsSortierungWithTeilbereich(items);
  }

  triggerItemProcessing(itemId) {
    return triggerItemProcessing(itemId);
  }

  enqueueItemProcessing(strategieId, itemId) {
    return enqueueItemProcessing(strategieId, itemId);
  }

  generiereKundenadaption(itemId) {
    return generiereKundenadaption(itemId);
  }

  reprocessItem(itemId) {
    return reprocessItem(itemId);
  }

  getAllUnternehmen() {
    return getAllUnternehmen();
  }

  getAllMarken(unternehmenId) {
    return getAllMarken(unternehmenId);
  }

  getAllKampagnen(markeId) {
    return getAllKampagnen(markeId);
  }

  getAllAuftraege(unternehmenId) {
    return getAllAuftraege(unternehmenId);
  }

  searchCreators(searchTerm) {
    return searchCreators(searchTerm);
  }

  hasSkriptForItem(itemId) {
    return hasSkriptForItem(itemId);
  }

  linkCasting(strategieId, creatorAuswahlId) {
    return linkCasting(strategieId, creatorAuswahlId);
  }

  unlinkCasting(strategieId) {
    return unlinkCasting(strategieId);
  }

  assignCastingItem(itemId, auswahlItemId) {
    return assignCastingItem(itemId, auswahlItemId);
  }

  unassignCastingItem(itemId) {
    return unassignCastingItem(itemId);
  }

  getBriefingProdukte(strategieId) {
    return getBriefingProdukte(strategieId);
  }

  assignProdukt(itemId, produktId) {
    return assignProdukt(itemId, produktId);
  }

  unassignProdukt(itemId) {
    return unassignProdukt(itemId);
  }

  setSkriptFreigabe(itemId, flag) {
    return setSkriptFreigabe(itemId, flag);
  }

  getZuordbareCastingItems(strategieId) {
    return getZuordbareCastingItems(strategieId);
  }

  getZuordbareVideoideen(strategieId, auswahlItemId) {
    return getZuordbareVideoideen(strategieId, auswahlItemId);
  }

  assertKeinVorschlag(itemId) {
    return assertKeinVorschlag(itemId);
  }
}

export const strategieService = new StrategieService();
