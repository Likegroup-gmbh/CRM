// ESM-Reexport: Generate (CJS) und UI teilen dieselbe Logik.
// Vite Dev liefert CJS nur als default — Named Re-Export aus der Datei knallt.
import creatorFacing from '../../../../netlify/functions/_shared/skript-creator-facing.js';

export const extractSkriptAusMaster = creatorFacing.extractSkriptAusMaster;
export const zusatzInfosMarkdown = creatorFacing.zusatzInfosMarkdown;
export const hatZusatzInfos = creatorFacing.hatZusatzInfos;
export const hatGridInhalt = creatorFacing.hatGridInhalt;
export const gridFelderFuerSkript = creatorFacing.gridFelderFuerSkript;
export const istCreatorFacingSektion = creatorFacing.istCreatorFacingSektion;
