// Zentraler Helper für den Upload von generierten Vertrag-PDFs.
// Genutzt von UgcPdf.js, InfluencerPdf.js, VideografPdf.js, ModelPdf.js u. a.
//
// Ziel (ADR 0068): SharePoint Daten/{Unternehmen}/Verträge/[{Marke}/]{Kampagne}/{fileName}

import { dokumentHochladen } from '../../../../core/ablage/dokumentAblage.js';

// Lädt das generierte PDF hoch und speichert URL/Pfad am Vertrag.
// Neu generiert = neue Version derselben SharePoint-Datei.
// Jeder Fehler wirft — ohne datei_url gilt der Vertrag nicht als erstellt.
export async function uploadGeneratedVertragPdf(vertrag, pdfBlob, fileName) {
  if (!window.supabase || !vertrag?.id) {
    throw new Error('Vertrag ohne ID');
  }

  // jsPDF .output('blob') liefert ein Blob ohne .name
  const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

  const r = await dokumentHochladen({
    typ: 'vertrag',
    bezugId: vertrag.id,
    file,
    speichern: async (spalten) => {
      const { error } = await window.supabase.from('vertraege').update(spalten).eq('id', vertrag.id);
      if (error) {
        console.warn('⚠️ Vertrag-PDF konnte nicht in der Übersicht verknüpft werden:', error);
        throw new Error(error.message || 'Vertrag-PDF konnte nicht verknüpft werden');
      }
    },
  });

  return { fileUrl: r.fileUrl, filePath: r.filePath };
}
