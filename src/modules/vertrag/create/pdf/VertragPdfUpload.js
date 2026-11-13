// Zentraler Helper für den Upload von generierten Vertrag-PDFs.
// Genutzt von UgcPdf.js, InfluencerPdf.js, VideografPdf.js, ModelPdf.js.
//
// Ziel je Weiche Dokumente (ADR 0068):
//   SharePoint: Daten/{Unternehmen}/Verträge/[{Marke}/]{Kampagne}/{fileName}
//   Dropbox:    /{Unternehmen}/{Marke}/{Kampagne}/{Kooperation}/Vertraege/{Creator}_{Typ}/{fileName}

import { uploadVertragPdf } from '../../../../core/DropboxDocumentUploader.js';
import { dokumentHochladen } from '../../../../core/ablage/dokumentAblage.js';

// Baut die Pfad-Metadaten aus dem Vertrag und den in VertraegeCreate gehaltenen
// Listen (this.unternehmen, this.creators, this.kampagnen). Kooperation wird
// bei Bedarf live aus Supabase nachgeladen, weil sie nicht im Cache liegt.
async function resolveVertragPathMetadata(ctx, vertrag) {
  const kunde = ctx.unternehmen?.find(u => u.id === vertrag.kunde_unternehmen_id);
  const creator = ctx.creators?.find(c => c.id === vertrag.creator_id);
  const kampagne = ctx.kampagnen?.find(k => k.id === vertrag.kampagne_id);

  let kooperationName = '';
  if (vertrag.kooperation_id && window.supabase) {
    try {
      const { data } = await window.supabase
        .from('kooperationen')
        .select('name')
        .eq('id', vertrag.kooperation_id)
        .single();
      if (data?.name) kooperationName = data.name;
    } catch {
      /* ignore – Kooperation ist optional */
    }
  }

  const creatorName = creator
    ? `${creator.vorname || ''} ${creator.nachname || ''}`.trim()
    : '';

  return {
    unternehmen: kunde?.firmenname || '',
    marke: kampagne?.marke?.markenname || '',
    kampagne: kampagne?.eigener_name || kampagne?.kampagnenname || '',
    kooperation: kooperationName,
    creator: creatorName,
    vertragstyp: vertrag.typ || '',
  };
}

// Lädt das generierte PDF hoch (SharePoint oder Dropbox je Weiche) und speichert URL/Pfad am Vertrag.
// Neu generiert = neue Version derselben SharePoint-Datei.
// Jeder Fehler wirft — ohne datei_url gilt der Vertrag nicht als erstellt.
export async function uploadGeneratedVertragPdf(ctx, vertrag, pdfBlob, fileName) {
  if (!window.supabase || !vertrag?.id) {
    throw new Error('Vertrag ohne ID');
  }

  // jsPDF .output('blob') liefert ein Blob ohne .name
  const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

  const r = await dokumentHochladen({
    typ: 'vertrag',
    bezugId: vertrag.id,
    file,
    dropbox: async () => {
      const metadata = await resolveVertragPathMetadata(ctx, vertrag);
      const result = await uploadVertragPdf({ metadata, file });
      if (!result?.fileUrl) throw new Error('Dropbox-Upload ohne Datei-URL');
      return result;
    },
    speichern: async (spalten) => {
      const { error } = await window.supabase.from('vertraege').update(spalten).eq('id', vertrag.id);
      if (error) {
        console.warn('⚠️ Vertrag-PDF konnte nicht in der Übersicht verknüpft werden:', error);
        throw new Error(error.message || 'Vertrag-PDF konnte nicht verknüpft werden');
      }
    },
  });

  return { fileUrl: r.fileUrl, filePath: r.filePath, ziel: r.ziel };
}
