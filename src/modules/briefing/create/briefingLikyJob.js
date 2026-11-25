// briefingLikyJob.js
// Liky am Briefing: Kundenbriefing hochladen, Job in briefing_pdf_jobs anlegen,
// briefing-pdf-background anstoßen und das Ergebnis pollen.

const ENDPOINT = '/.netlify/functions/briefing-pdf-background';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

export function installBriefingLikyJob(proto) {
  proto.uploadPdf = async function(file) {
    const briefingId = this.briefing.editId;
    const entityType = this.briefing.formData.marke_id ? 'marke' : 'unternehmen';
    const entityId = this.briefing.formData.marke_id || this.briefing.formData.unternehmen_id;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `kundenbriefings/${entityType}/${entityId}/${briefingId}_${Date.now()}_${safeName}`;

    const { error } = await window.supabase.storage
      .from('documents')
      .upload(path, file, { upsert: false });
    if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`);

    // 1:1 - das alte Kundenbriefing wird ersetzt
    if (this.kundenbriefing?.storage_path) {
      await window.supabase.storage.from('documents').remove([this.kundenbriefing.storage_path]);
    }

    const { data: { user } } = await window.supabase.auth.getUser();
    const { data: row, error: dbError } = await window.supabase
      .from('kundenbriefings')
      .upsert({
        briefing_id: briefingId,
        entity_type: entityType,
        entity_id: entityId,
        storage_path: path,
        dateiname: file.name,
        created_by: user?.id
      }, { onConflict: 'briefing_id' })
      .select()
      .single();
    if (dbError) throw new Error(`DB fehlgeschlagen: ${dbError.message}`);

    this.kundenbriefing = row;
    return path;
  };

  proto.runJob = async function(modus, extra) {
    const session = await window.supabase.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) throw new Error('Keine aktive Sitzung');

    const { data: job, error: insertError } = await window.supabase
      .from('briefing_pdf_jobs')
      .insert({
        briefing_id: this.briefing.editId,
        modus,
        created_by: session.data.session.user.id
      })
      .select('id')
      .single();
    if (insertError) throw new Error(`Job konnte nicht angelegt werden: ${insertError.message}`);

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        jobId: job.id,
        briefing_id: this.briefing.editId,
        modus,
        ...extra
      })
    });
    if (response.status !== 202 && !response.ok) {
      throw new Error(`Liky konnte nicht gestartet werden (HTTP ${response.status})`);
    }

    return this.pollJob(job.id);
  };

  proto.pollJob = async function(jobId) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    const signal = this._laufAbort?.signal;
    let letzterStep = null;

    while (Date.now() < deadline) {
      if (signal?.aborted) {
        throw new DOMException('Vom Nutzer abgebrochen', 'AbortError');
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const { data: row, error } = await window.supabase
        .from('briefing_pdf_jobs')
        .select('status, progress_step, progress_steps, result, error_message')
        .eq('id', jobId)
        .maybeSingle();
      if (error || !row) continue;

      if (row.status === 'done') {
        const payload = row.result || {};
        if (!payload.success) throw new Error(payload.error || 'Kein Ergebnis');
        return payload;
      }
      if (row.status === 'error') {
        throw new Error(row.error_message || 'Das hat nicht geklappt');
      }

      if (row.progress_step && row.progress_step !== letzterStep) {
        letzterStep = row.progress_step;
        this.setSteps(Array.isArray(row.progress_steps) ? row.progress_steps : []);
      }
    }

    throw new Error('Zeitlimit erreicht - bitte später erneut versuchen.');
  };
}
