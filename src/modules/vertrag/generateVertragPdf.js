// Erzeugt das Vertrags-PDF nachträglich (Liste / Kampagnen-Tab),
// wenn Create ohne datei_url durchgelaufen ist.

import { VertraegeCreate } from './create/VertraegeCreate.js';

export async function generateVertragPdf(list, id) {
  if (!list?.getVertragPermissions?.().canEdit) {
    window.toastSystem?.show('Sie haben keine Berechtigung, Verträge zu bearbeiten.', 'warning');
    return null;
  }

  const existing = list.vertraege?.find((v) => v.id === id);
  if (!existing || existing.is_draft) return null;
  if (existing.datei_url) return { fileUrl: existing.datei_url };

  window.toastSystem?.show('PDF wird erzeugt …', 'info');

  const inst = new VertraegeCreate();
  await inst.loadStammdaten();
  await inst.loadDraftFromDB(id);

  const { data: row, error } = await window.supabase
    .from('vertraege')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !row) {
    throw new Error(error?.message || 'Vertrag nicht gefunden');
  }

  row._pdfTemplate = inst.formData.vertrag_template || 'legacy';
  if (inst.formData.ksk_selbstzahler !== undefined) {
    row.ksk_selbstzahler = inst.formData.ksk_selbstzahler === true;
  }

  const pdf = await inst.generatePDF(row);
  if (!pdf?.fileUrl) {
    throw new Error('PDF konnte nicht gespeichert werden');
  }

  window.toastSystem?.show('PDF erzeugt', 'success');
  await list.reloadData?.();
  return pdf;
}
