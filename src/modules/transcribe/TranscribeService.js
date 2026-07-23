// TranscribeService.js
// Kapselt den kompletten Transcribe-Job-Lifecycle (transcription_jobs +
// Netlify Background Function transcribe-background):
//   start(url) -> Job-Insert -> Function-Trigger -> Realtime + Poll-Fallback
// Pro Nutzungsstelle (Testseite, Generator-Formular) eine EIGENE Instanz
// anlegen - kein globaler Singleton, damit sich parallele Formulare nicht
// gegenseitig Updates unterschieben.
//
// Race-Schutz: Jeder start() erhoeht eine runId. Updates von Jobs aelterer
// Laeufe (z.B. nach URL-Wechsel) werden verworfen, damit ein spaeter
// fertig werdender alter Job nicht den aktuellen Zustand ueberschreibt.

/** Client-seitige URL-Validierung (Backend kennt nur TikTok/Instagram). */
export function isSupportedVideoUrl(url) {
  const u = (url || '').trim();
  return !!u && (u.includes('tiktok.com') || u.includes('instagram.com'));
}

export class TranscribeService {
  /**
   * @param {Object} options
   * @param {(job: Object) => void} [options.onUpdate]
   *   Wird bei jedem Job-Update des AKTUELLEN Laufs aufgerufen
   *   (inkl. finalem done/error-Zustand). Stale Updates kommen nie an.
   */
  constructor({ onUpdate } = {}) {
    this.onUpdate = onUpdate || null;
    this.jobId = null;
    this.channel = null;
    this.pollInterval = null;
    this.runId = 0;
  }

  get db() {
    return window.supabase;
  }

  /**
   * Neuen Transcribe-Lauf starten. Ein evtl. laufender alter Lauf wird
   * verworfen (Subscriptions weg, Updates ignoriert).
   * @returns {Promise<Object>} die angelegte Job-Row
   */
  async start(url) {
    const cleanUrl = (url || '').trim();
    if (!isSupportedVideoUrl(cleanUrl)) {
      throw new Error('Bitte eine gültige TikTok- oder Instagram-URL eingeben');
    }

    this.cancel();
    const runId = ++this.runId;

    const { data: { user } } = await this.db.auth.getUser();
    const { data: job, error } = await this.db
      .from('transcription_jobs')
      .insert({ url: cleanUrl, created_by: user.id })
      .select()
      .single();
    if (error) throw new Error(`Job-Insert fehlgeschlagen: ${error.message}`);

    // Zwischen await und jetzt kann ein neuer Lauf gestartet worden sein
    if (runId !== this.runId) return job;

    this.jobId = job.id;
    this.subscribeToJob(job.id, runId);
    this.pollInterval = setInterval(() => this.pollJob(job.id, runId), 5000);

    const session = await this.db.auth.getSession();
    const token = session?.data?.session?.access_token || '';
    const response = await fetch('/.netlify/functions/transcribe-background', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ jobId: job.id, url: cleanUrl })
    });
    if (response.status !== 202 && !response.ok) {
      if (runId === this.runId) this.cancel();
      throw new Error(`Function-Trigger fehlgeschlagen: HTTP ${response.status}`);
    }

    return job;
  }

  subscribeToJob(jobId, runId) {
    this.channel = this.db
      .channel(`transcription-job-${jobId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'transcription_jobs',
        filter: `id=eq.${jobId}`
      }, (payload) => this.handleJobUpdate(payload.new, runId))
      .subscribe();
  }

  async pollJob(jobId, runId) {
    if (runId !== this.runId || jobId !== this.jobId) return;
    const { data } = await this.db
      .from('transcription_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    if (data) this.handleJobUpdate(data, runId);
  }

  handleJobUpdate(job, runId) {
    // Stale Updates verwerfen: falscher Lauf ODER falsche Job-Row
    if (!job || runId !== this.runId || job.id !== this.jobId) return;

    if (job.status === 'done' || job.status === 'error') {
      this.stopWatching();
    }
    this.onUpdate?.(job);
  }

  /** Subscriptions/Polling beenden, Job-Zustand behalten (fuer done). */
  stopWatching() {
    if (this.channel) {
      this.db.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Aktuellen Lauf verwerfen (URL-Wechsel/Clear): Subscriptions weg,
   * spaete Updates des alten Jobs werden durch die runId ignoriert.
   */
  cancel() {
    this.runId++;
    this.stopWatching();
    this.jobId = null;
  }

  destroy() {
    this.cancel();
    this.onUpdate = null;
  }
}
