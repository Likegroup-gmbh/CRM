// SkriptAuftrag.js
// Client-Haelfte des Skript-Auftrags: eine Stelle fuer anlegen, triggern,
// beobachten (Realtime + Poll-Fallback) und abbrechen. Die Call-Sites
// (Generation, DNA-Destillation, Chat-Aktionen) orchestrieren das nicht
// mehr selbst.
//
// Zwei Adapter dahinter, bewusst getrennt:
//   - skript_generation_jobs  (Generate, Distill)
//   - skript_chat_messages    (Edit/Fragen/Visuell: die pending
//     Assistant-Message IST der Auftrag und gleichzeitig der Verlauf)

import { skripteService } from './SkripteService.js';

const FUNCTION_NAMEN = {
  generate: 'skript-generate-background',
  distill: 'skript-distill-background',
  edit: 'skript-edit-background',
  fragen: 'skript-fragen-background'
};

const POLL_MS = 5000;
const END_STATUS = ['done', 'error', 'cancelled'];

export class SkriptAuftrag {
  constructor(service = skripteService) {
    this.service = service;
    this.inFlight = new Set();
  }

  hatLaufenden(key) {
    return this.inFlight.has(key);
  }

  /**
   * Job-Row anlegen, Function triggern, Fortschritt per Realtime + Poll
   * liefern. Bei done/error/cancelled raeumt der Auftrag selbst auf.
   * Liefert { jobId, stop }.
   */
  async starteJob({ art, skriptId = null, payload = {}, onUpdate }) {
    const fn = FUNCTION_NAMEN[art];
    if (!fn) throw new Error(`Unbekannte Auftrags-Art: ${art}`);
    const key = `${art}:${skriptId || 'global'}`;
    if (this.inFlight.has(key)) {
      throw new Error('Dieser Auftrag läuft bereits');
    }
    this.inFlight.add(key);

    let channel = null;
    let poll = null;
    let beendet = false;
    const stop = () => {
      if (beendet) return;
      beendet = true;
      if (channel) { window.supabase.removeChannel(channel); channel = null; }
      if (poll) { clearInterval(poll); poll = null; }
      this.inFlight.delete(key);
    };
    const handle = (j) => {
      if (beendet || !j) return;
      onUpdate?.(j);
      if (END_STATUS.includes(j.status)) stop();
    };

    try {
      const job = await this.service.createJob({ skriptId });
      channel = this.service.subscribeToJob(job.id, handle);
      poll = setInterval(async () => {
        try {
          handle(await this.service.pollJob(job.id));
        } catch (_) { /* Poll-Fehler ignorieren, Realtime traegt */ }
      }, POLL_MS);
      await this.service.triggerFunction(fn, {
        jobId: job.id,
        ...(skriptId ? { skript_id: skriptId } : {}),
        ...payload
      });
      return { jobId: job.id, stop };
    } catch (err) {
      stop();
      throw err;
    }
  }

  /**
   * Chat-Auftrag: die pending Assistant-Message wurde vom Aufrufer schon
   * angelegt (sie ist der Verlauf). Hier nur In-Flight-Guard + Trigger;
   * die Beobachtung laeuft ueber den Chat-Channel des Editors.
   */
  async starteVonNachricht({ art, messageId }) {
    const fn = FUNCTION_NAMEN[art];
    if (!fn) throw new Error(`Unbekannte Auftrags-Art: ${art}`);
    const key = `msg:${messageId}`;
    if (this.inFlight.has(key)) return false;
    this.inFlight.add(key);
    try {
      await this.service.triggerFunction(fn, { messageId });
      return true;
    } finally {
      this.inFlight.delete(key);
    }
  }

  /** Abbruch: Function verwirft den Lauf vor bzw. nach dem Claude-Call. */
  async brichAb(jobId) {
    await this.service.updateJob(jobId, {
      status: 'cancelled',
      error_message: 'Vom Nutzer abgebrochen'
    });
  }

  async brichNachrichtAb(messageId) {
    await this.service.updateChatMessage(messageId, {
      status: 'cancelled',
      error_message: 'Vom Nutzer abgebrochen'
    });
  }
}

export const skriptAuftrag = new SkriptAuftrag();
