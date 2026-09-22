import { fetchDokumentPdf } from '../fetchDokumentPdf.js';

function creatorName(creator) {
  return [creator?.vorname, creator?.nachname].filter(Boolean).join(' ').trim();
}

function fileName(vertrag) {
  const base = String(vertrag?.name || 'Vertrag').replace(/[<>:"|?*\\/]/g, '-').trim() || 'Vertrag';
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

export const vertragAdapter = {
  platzhalter: ['vorname', 'name', 'vertrag', 'creator', 'unternehmen', 'marke'],

  async prepare(opts) {
    const vertrag = opts.vertrag;
    if (!vertrag || vertrag.is_draft) {
      window.toastSystem?.show('Nur finalisierte Verträge können verschickt werden', 'warning');
      return null;
    }
    if (!vertrag.datei_url) {
      window.toastSystem?.show('Keine PDF-Datei vorhanden', 'warning');
      return null;
    }
    if (!window.isInternal?.()) return null;

    const creator = vertrag.creator;
    const prefill = [];
    if (creator?.id) {
      const mail = String(creator.mail || '').trim();
      prefill.push({
        typ: 'creator',
        id: creator.id,
        email: mail,
        name: creatorName(creator) || mail,
        vorname: creator.vorname || '',
      });
    }

    return {
      dokumentName: vertrag.name || 'Vertrag',
      unternehmenId: vertrag.kunde_unternehmen_id,
      markeId: vertrag.kampagne?.marke?.id || null,
      dateiUrl: vertrag.datei_url,
      dateiname: fileName(vertrag),
      prefill,
      empfaengerFest: Boolean(creator?.id),
    };
  },

  async createPdf(prepared) {
    try {
      return await fetchDokumentPdf({
        url: prepared.dateiUrl,
        dateiname: prepared.dateiname,
      });
    } catch (err) {
      console.warn('Vertrags-PDF clientseitig nicht ladbar, Server-Fallback:', err);
      return { blob: null, dateiname: prepared.dateiname, serverFallback: true };
    }
  },
};
