// Werte der Creator-Filterspalte: Kernlogik plus Rezensions-Regel.

import { settleRezensionFilters } from './rezension.js';
import {
  isActive,
  paintFilterValues,
  readFiltersFromColumn as readColumn
} from '../../core/filterColumn/filterColumnValues.js';

export { isActive, paintFilterValues };

export function readFiltersFromColumn(root, filters) {
  return readColumn(root, filters, { settle: settleRezensionFilters });
}
