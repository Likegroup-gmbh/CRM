// ESM-Adapter fuer den CJS-Parser (Generate + UI teilen dieselbe Logik).
import api from '../../../../netlify/functions/_shared/skript-creator-facing.js';

const impl = api?.default || api;

export const extractSkriptAusMaster = impl.extractSkriptAusMaster;
export const zusatzInfosMarkdown = impl.zusatzInfosMarkdown;
export const hatZusatzInfos = impl.hatZusatzInfos;
export const hatGridInhalt = impl.hatGridInhalt;
export const gridFelderFuerSkript = impl.gridFelderFuerSkript;
export const istCreatorFacingSektion = impl.istCreatorFacingSektion;
