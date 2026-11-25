// Creator-IDs fuer den Vertrag-Picker: Casting Zusage/Gebucht plus Kooperation-Union.

import { hatZusageOderGebucht } from '../../creator-auswahl/sourcingStatusOptions.js';

export function vertragCreatorIds(castingItems = [], kooperationen = []) {
  const fromCasting = (castingItems || [])
    .filter(item => item?.creator_id && hatZusageOderGebucht(item))
    .map(item => item.creator_id);
  const fromKoop = (kooperationen || [])
    .map(k => k.creator_id)
    .filter(Boolean);
  return [...new Set([...fromCasting, ...fromKoop])];
}
