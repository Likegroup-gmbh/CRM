// Server-Adapter fuer Anschreiben-Dokumenttypen.
// loadContext liefert Platzhalter-Werte + Draft-Gate.
// afterSend ist optional (Vertrag setzt status = gesendet).

async function loadBriefing(supabase, dokumentId) {
  const { data, error } = await supabase
    .from('campaign_briefings')
    .select('id, aktivierung_name, is_draft, unternehmen:unternehmen_id(firmenname), marke:marke_id(markenname)')
    .eq('id', dokumentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { error: 'Briefing nicht gefunden' };
  if (data.is_draft) return { error: 'Nur finalisierte Briefings können verschickt werden' };
  return {
    ctx: {
      briefing: data.aktivierung_name || '',
      unternehmen: data.unternehmen?.firmenname || '',
      marke: data.marke?.markenname || '',
    },
    defaultFilename: 'briefing.pdf',
  };
}

async function loadVertrag(supabase, dokumentId) {
  const { data, error } = await supabase
    .from('vertraege')
    .select(`
      id, name, is_draft, datei_url, status,
      creator:creator_id(vorname, nachname),
      kunde:kunde_unternehmen_id(firmenname),
      kampagne:kampagne_id(marke:marke_id(markenname))
    `)
    .eq('id', dokumentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { error: 'Vertrag nicht gefunden' };
  if (data.is_draft) return { error: 'Nur finalisierte Verträge können verschickt werden' };
  if (!data.datei_url) return { error: 'Keine PDF-Datei vorhanden' };
  const creator = [data.creator?.vorname, data.creator?.nachname].filter(Boolean).join(' ').trim();
  return {
    ctx: {
      vertrag: data.name || '',
      creator,
      unternehmen: data.kunde?.firmenname || '',
      marke: data.kampagne?.marke?.markenname || '',
    },
    defaultFilename: 'vertrag.pdf',
  };
}

async function loadSkript(supabase, dokumentId) {
  const { data, error } = await supabase
    .from('skripte')
    .select('id, titel, kampagne:kampagne_id(kampagnenname, eigener_name), unternehmen:unternehmen_id(firmenname), marke:marke_id(markenname)')
    .eq('id', dokumentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { error: 'Skript nicht gefunden' };
  return {
    ctx: {
      skript: data.titel || '',
      kampagne: data.kampagne?.kampagnenname || data.kampagne?.eigener_name || '',
      unternehmen: data.unternehmen?.firmenname || '',
      marke: data.marke?.markenname || '',
    },
    defaultFilename: 'skript.pdf',
  };
}

function asDownloadUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  return raw.replace(/[?&]dl=0/, (m) => (m[0] === '?' ? '?raw=1' : '&raw=1'));
}

async function downloadVertragPdf(supabase, dokumentId) {
  const { data, error } = await supabase
    .from('vertraege')
    .select('datei_url, name')
    .eq('id', dokumentId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.datei_url) return { error: 'Keine PDF-Datei vorhanden' };
  const url = asDownloadUrl(data.datei_url);
  const resp = await fetch(url);
  if (!resp.ok) return { error: `PDF konnte nicht geladen werden (${resp.status})` };
  const buf = Buffer.from(await resp.arrayBuffer());
  const base = String(data.name || 'vertrag').replace(/[<>:"|?*\\/]/g, '-').trim() || 'vertrag';
  const dateiname = base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
  return { pdfBase64: buf.toString('base64'), dateiname };
}

async function afterSendVertrag(supabase, { dokumentId, sent }) {
  if (!sent) return;
  const { data, error } = await supabase
    .from('vertraege')
    .select('status, dropbox_file_url, unterschriebener_vertrag_url')
    .eq('id', dokumentId)
    .maybeSingle();
  if (error) throw error;
  if (data?.status === 'unterschrieben') return;
  if (data?.dropbox_file_url || data?.unterschriebener_vertrag_url) return;
  const { error: updateError } = await supabase
    .from('vertraege')
    .update({ status: 'gesendet', gesendet_am: new Date().toISOString() })
    .eq('id', dokumentId);
  if (updateError) throw updateError;
}

const DOKUMENTE = {
  briefing: { loadContext: loadBriefing },
  vertrag: { loadContext: loadVertrag, afterSend: afterSendVertrag, downloadPdf: downloadVertragPdf },
  skript: { loadContext: loadSkript },
};

async function loadDokumentContext(supabase, dokumentTyp, dokumentId) {
  const adapter = DOKUMENTE[dokumentTyp];
  if (!adapter) return { error: 'Unbekannter dokument_typ' };
  return adapter.loadContext(supabase, dokumentId);
}

function getDokumentAdapter(dokumentTyp) {
  return DOKUMENTE[dokumentTyp] || null;
}

module.exports = {
  DOKUMENTE,
  loadDokumentContext,
  getDokumentAdapter,
};
