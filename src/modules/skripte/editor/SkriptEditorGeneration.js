// SkriptEditorGeneration.js
// Generierungs-Flow im Editor: Neu-Modus, Rueckfragen (Slot-Filling) und
// Job-Handling (Realtime + Poll-Fallback) fuer skript-generate-background.

import { skripteService } from '../SkripteService.js';
import { skriptAuftrag } from '../SkriptAuftrag.js';
import { replaceSkriptUrl } from '../SkripteUtils.js';
import { pendingThinking, renderThinking } from '../../../core/chat/thinking.js';

export class SkriptEditorGeneration {
  constructor(view) {
    this.view = view;
  }

  startNeuModus() {
    const v = this.view;
    if (v.isReadonly || v.neuModus) return;

    v.feedbackDrawer.close();

    // Verbindungen des offenen Skripts beenden
    if (v.channel) {
      window.supabase.removeChannel(v.channel);
      v.channel = null;
    }
    if (v.pollInterval) {
      clearInterval(v.pollInterval);
      v.pollInterval = null;
    }
    v.clearPending();
    const menu = document.getElementById('ed-selmenu');
    if (menu) menu.hidden = true;
    v.closeVersionMenu();

    v.skript = null;
    v.messages = [];
    v.versionen = [];
    v.aktiveVersion = { version_nr: 1, sub_nr: 0 };
    v.neuModus = true;
    v.genStatus = null;

    replaceSkriptUrl('neu');
    v.page._merkeKontext({ skript: 'neu' });

    v.updateBreadcrumb();
    v.setListeCollapsed(true, { persist: false });
    v.renderListe();
    v.renderDoc();
    v.renderChat();
    v.renderCost();
    v.setChatInputAktiv(false);
  }

  setGenButtonAktiv(aktiv) {
    const btn = document.getElementById('ed-gen-start');
    if (btn) {
      btn.disabled = !aktiv;
      btn.textContent = aktiv ? 'Skript generieren' : 'Läuft…';
    }
    const direkt = document.getElementById('ed-gen-direkt');
    if (direkt) direkt.disabled = !aktiv;
  }

  // ------------------------------------------------------------------
  // Rueckfragen-Flow (Slot-Filling vor der Generierung)
  // ------------------------------------------------------------------
  /**
   * Standard-Weg: Stub anlegen, Editor oeffnet ihn, Liky stellt Rueckfragen.
   * Erst wenn alles geklaert ist (oder der User skippt), wird generiert.
   */
  async startFragenFlow() {
    const v = this.view;
    let payload;
    try {
      payload = v.genForm.getPayload();
    } catch (err) {
      window.toastSystem?.error(err.message);
      return;
    }

    this.setGenButtonAktiv(false);
    try {
      const stub = await skripteService.createSkriptStub(payload);
      // Lokal upserten statt die volle Liste neu zu laden (Join-Namen
      // kommen aus dem Formular-State)
      v.upsertSkriptInListe(stub);
      await v.switchSkript(stub.id);
      await this.startFragenRunde();
    } catch (err) {
      window.toastSystem?.error(err.message);
      this.setGenButtonAktiv(true);
    }
  }

  /** Neue Rueckfragen-Runde: pending Assistant-Message anlegen und Function triggern. */
  async startFragenRunde() {
    const v = this.view;
    const assistantMsg = await skripteService.createChatMessage({
      skript_id: v.skript.id,
      rolle: 'assistant',
      aktion: 'rueckfrage',
      sektion: 'gesamt',
      status: 'pending',
      progress_steps: pendingThinking()
    });
    v.messages.push(assistantMsg);
    v.renderChat({ forceScroll: true });
    v.ensurePolling();
    try {
      await skriptAuftrag.starteVonNachricht({ art: 'fragen', messageId: assistantMsg.id });
    } catch (err) {
      // Transiente Invoke-Fehler (502/503/Netz): kein Toast und kein
      // Propagieren an startFragenFlow - Poll + Pending-Timeout regeln
      if (!err.transient) throw err;
    }
  }

  /** Finale Generierung in den Stub (nach geklaerten Fragen oder per Skip). */
  async startGenerationAusFragen() {
    const v = this.view;
    if (!v.skript || v.genStatus?.laeuft) return;

    const payload = v.skript.prompt_kontext?.generator_payload || {
      unternehmen_id: v.skript.unternehmen_id,
      marke_id: v.skript.marke_id,
      kampagne_id: v.skript.kampagne_id,
      produkt_id: v.skript.produkt_id,
      persona_id: v.skript.persona_id,
      branche_id: v.skript.branche_id,
      briefing_id: v.skript.briefing_id,
      bereich: v.skript.bereich,
      modus: v.skript.prompt_kontext?.modus || v.skript.prompt_kontext?.generator_payload?.modus || null,
      mit_dna: v.skript.mit_dna,
      video_idee: v.skript.video_idee,
      location: v.skript.location,
      regieanweisung: v.skript.regieanweisung,
      video_laenge: v.skript.video_laenge,
      funnel_stufe: v.skript.funnel_stufe,
      tonalitaet: v.skript.tonalitaet
    };

    this.cleanupGenJob();
    v.genStatus = { laeuft: true, step: 'pending', progress_steps: pendingThinking() };
    v.renderDoc();
    v.renderChat({ forceScroll: true });

    try {
      const { jobId, stop } = await skriptAuftrag.starteJob({
        art: 'generate',
        skriptId: v.skript.id,
        payload,
        onUpdate: (j) => this.handleGenJobUpdate(j)
      });
      v.genJobId = jobId;
      v.genJobStop = stop;
    } catch (err) {
      this.cleanupGenJob();
      v.genStatus = { error: err.message };
      v.renderDoc();
      v.renderChat({ forceScroll: true });
    }
  }

  async startGenerationImEditor({ retry = false } = {}) {
    const v = this.view;
    let payload;
    if (retry && v.genPayload) {
      payload = v.genPayload;
    } else {
      try {
        payload = v.genForm.getPayload();
      } catch (err) {
        window.toastSystem?.error(err.message);
        return;
      }
    }
    v.genPayload = payload;

    this.cleanupGenJob();
    this.setGenButtonAktiv(false);
    v.genStatus = { laeuft: true, step: 'pending', progress_steps: pendingThinking() };
    v.renderChat({ forceScroll: true });

    try {
      // Persistenter Stub: Payload inkl. Videovorlage ueberlebt Fehler und
      // Reload (der Stub taucht in der Liste auf und kann dort weiter
      // generiert werden). Retry aktualisiert denselben Stub.
      if (v.genStubId) {
        await skripteService.updateSkriptStub(v.genStubId, payload);
      } else {
        const stub = await skripteService.createSkriptStub(payload);
        v.genStubId = stub.id;
      }

      const { jobId, stop } = await skriptAuftrag.starteJob({
        art: 'generate',
        skriptId: v.genStubId,
        payload,
        onUpdate: (j) => this.handleGenJobUpdate(j)
      });
      v.genJobId = jobId;
      v.genJobStop = stop;
    } catch (err) {
      this.cleanupGenJob();
      v.genStatus = { error: err.message };
      v.renderChat({ forceScroll: true });
      this.setGenButtonAktiv(true);
    }
  }

  handleGenJobUpdate(job) {
    const v = this.view;
    if (!job || job.id !== v.genJobId) return;

    if (job.status === 'done' && job.skript_id) {
      this.finishGeneration(job.skript_id);
      return;
    }
    if (job.status === 'error') {
      this.cleanupGenJob();
      v.genStatus = { error: job.error_message || 'Unbekannt' };
      v.renderChat({ forceScroll: true });
      this.setGenButtonAktiv(true);
      return;
    }

    if (v.genStatus?.laeuft) {
      if (job.progress_step) v.genStatus.step = job.progress_step;
      if (Array.isArray(job.progress_steps) && job.progress_steps.length) {
        v.genStatus.progress_steps = job.progress_steps;
        const slot = document.getElementById('ed-gen-thinking');
        if (slot) renderThinking(slot, job.progress_steps);
      }
    }
  }

  async finishGeneration(skriptId) {
    const v = this.view;
    this.cleanupGenJob();
    v.genStatus = null;
    v.genPayload = null;
    v.genStubId = null;
    window.toastSystem?.success('Skript generiert');

    // Liste aktualisieren, damit das neue Skript links auftaucht -
    // gezielt eine Row statt der vollen Liste (loadSkript bringt die
    // Joins fuer die Sidebar-Badges mit)
    const fresh = await skripteService.loadSkript(skriptId);
    if (fresh) v.upsertSkriptInListe(fresh);

    v.setListeCollapsed(false);

    if (v.neuModus) {
      // In-place ins neue Skript wechseln
      v.neuModus = false;
      v.setChatInputAktiv(true);
      await v.switchSkript(skriptId);
    } else if (v.skript?.id === skriptId) {
      // Rueckfragen-Stub wurde befuellt -> gleiches Skript neu laden
      v.skript = null;
      await v.switchSkript(skriptId);
    } else {
      // User hat waehrenddessen ein anderes Skript geoeffnet -> nur Liste auffrischen
      v.renderListe();
    }
  }

  cleanupGenJob() {
    const v = this.view;
    // stop() ist idempotent und raeumt Channel + Poll + In-Flight auf
    v.genJobStop?.();
    v.genJobStop = null;
    v.genJobId = null;
  }

  /** Abbruch-Button an der Gen-Bubble: Job stornieren, UI sofort loesen. */
  async brichGenerationAb() {
    const v = this.view;
    if (!v.genJobId) return;
    const jobId = v.genJobId;
    try {
      await skriptAuftrag.brichAb(jobId);
    } catch (err) {
      window.toastSystem?.error(err.message);
      return;
    }
    this.cleanupGenJob();
    v.genStatus = { error: 'Abgebrochen' };
    v.renderDoc();
    v.renderChat({ forceScroll: true });
    this.setGenButtonAktiv(true);
  }
}
