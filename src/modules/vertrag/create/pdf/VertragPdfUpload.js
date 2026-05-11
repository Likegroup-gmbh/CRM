// Zentraler Helper für den Upload von generierten Vertrag-PDFs nach Dropbox.
// Genutzt von UgcPdf.js, InfluencerPdf.js, VideografPdf.js, ModelPdf.js.
//
// Ersetzt den vorherigen Supabase Storage Bucket 'vertraege' / Pfad
// `unternehmen/{unternehmen_id}/{vertrag_id}/...`. Die Datei landet jetzt unter
// dem einheitlichen Dropbox-Pfad:
//   /{Unternehmen}/{Marke}/{Kampagne}/{Kooperation}/Vertraege/{Creator}_{Typ}/{fileName}

import { uploadVertragPdf } from '../../../../core/DropboxDocumentUploader.js';

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

// Lädt das generierte PDF nach Dropbox hoch und speichert URL/Pfad am Vertrag.
// Bei Fehler wird false zurückgegeben damit der Aufrufer lokal speichern kann.
export async function uploadGeneratedVertragPdf(ctx, vertrag, pdfBlob, fileName) {
  try {
    const metadata = await resolveVertragPathMetadata(ctx, vertrag);

    // jsPDF .output('blob') liefert ein Blob ohne .name; uploadVertragPdf
    // braucht aber file.name oder metadata.fileName. Wir packen daher den
    // Dateinamen in metadata.
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

    const result = await uploadVertragPdf({ metadata, file });

    if (result?.fileUrl && window.supabase && vertrag.id) {
      await window.supabase
        .from('vertraege')
        .update({
          datei_url: result.fileUrl,
          datei_path: result.filePath,
        })
        .eq('id', vertrag.id);
    }

    return result;
  } catch (err) {
    console.warn('⚠️ Vertrag-PDF Upload nach Dropbox fehlgeschlagen:', err);
    return null;
  }
}
