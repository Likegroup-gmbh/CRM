// Download eines oder mehrerer Skripte als das bestehende Anschreiben-PDF.

import { createSkriptAnhang, creatorFuerAnschreiben, sanitizeSkriptFilename } from './SkriptPdf.js';
import { pdfBloecke } from './editor/dokument/blockModell.js';
import { skriptBildPublicUrl } from './editor/dokument/skriptBild.js';

export { sanitizeSkriptFilename };

/** Sichtbare Freie Bloecke (ohne intern) mit Bild-URLs; null = nur die Skript-Tabelle. */
export function pdfBloeckeAusSkript(skript, db = globalThis.window?.supabase) {
  return pdfBloecke(skript?.dokument_bloecke, (pfad) => skriptBildPublicUrl(db, pfad));
}

/**
 * Eine Zeile aus dem Skript-Loader in das Anschreiben-PDF-Format.
 * Hook-Varianten sind intern (ADR 0024): nur der Editor-Export setzt
 * mitHookVarianten, wenn das Team die Tabelle sieht.
 */
export function pdfItemAusSkript(skript, verknuepfungen = [], { mitHookVarianten = false } = {}) {
  const creator = creatorFuerAnschreiben(skript, verknuepfungen);
  const customerName = skript?.marke?.markenname
    || skript?.unternehmen?.firmenname
    || skript?.kampagne?.kampagnenname
    || skript?.kampagne?.eigener_name
    || '';
  return {
    titel: skript?.titel || 'Skript',
    hook: skript?.hook || '',
    hauptteil: skript?.hauptteil || '',
    cta: skript?.cta || '',
    hook_visuell: skript?.hook_visuell || '',
    hauptteil_visuell: skript?.hauptteil_visuell || '',
    cta_visuell: skript?.cta_visuell || '',
    rezept: skript?.rezept || '',
    caption: skript?.caption || '',
    text_hook: skript?.text_hook || '',
    ...(mitHookVarianten ? {
      hook_variante_1: skript?.hook_variante_1 || '',
      hook_variante_2: skript?.hook_variante_2 || '',
      hook_variante_3: skript?.hook_variante_3 || '',
    } : {}),
    creator,
    instagram: creator?.instagram || '',
    produktName: skript?.produkt?.name || '',
    videoUrl: skript?.strategie_item?.video_link || '',
    customerLogoUrl: skript?.marke?.logo_url || skript?.unternehmen?.logo_url || '',
    customerName,
    dokument_bloecke: pdfBloeckeAusSkript(skript)
  };
}

export async function downloadSkriptePdf(skripte, { dateiname, verknuepfungenNachId, mitHookVarianten = false } = {}) {
  const items = (skripte || []).map((skript) => pdfItemAusSkript(
    skript,
    verknuepfungenNachId?.get?.(skript.id) || [],
    { mitHookVarianten }
  ));
  const result = await createSkriptAnhang(items, {
    dateiname: dateiname || sanitizeSkriptFilename(items[0]?.titel)
  });
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.dateiname;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
