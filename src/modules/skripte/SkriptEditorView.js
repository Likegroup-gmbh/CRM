// SkriptEditorView.js
// Chat-basierter Skript-Editor (3 Spalten in einer Shell, nach Figma):
//   links   Skriptliste zum Umschalten
//   mitte   Skript (Hook/Hauptteil/CTA) mit Selektions-Menue + Chat-Eingabe
//   rechts  Chat-Verlauf ("Liky") mit Aktions-Tag, Status und Annehmen/Ablehnen
// Die Assistant-Message in skript_chat_messages ist der Job (Realtime + Poll).

import { skripteService, FUNNEL_STUFEN, VIDEO_LAENGEN } from './SkripteService.js';
import { SkriptGeneratorForm } from './SkriptGeneratorForm.js';
import { SkriptFeedbackDrawer } from './SkriptFeedbackDrawer.js';
import { escapeHtml, formatDate, badge, formatUsageCost } from './SkripteUtils.js';

const AKTION_LABELS = {
  neu_schreiben: 'Neu schreiben',
  kuerzen: 'Kürzen',
  laenger: 'Länger',
  anderer_ton: 'Anderer Ton',
  feedback: 'Feedback geben',
  chat: 'Chat',
  rueckfrage: 'Rückfrage'
};

// Phosphor-Icons (Inline-SVG, skalieren ueber CSS, Farbe via currentColor)
const AKTION_ICONS = {
  neu_schreiben: '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M48,64a8,8,0,0,1,8-8H72V40a8,8,0,0,1,16,0V56h16a8,8,0,0,1,0,16H88V88a8,8,0,0,1-16,0V72H56A8,8,0,0,1,48,64ZM184,192h-8v-8a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0v-8h8a8,8,0,0,0,0-16Zm56-48H224V128a8,8,0,0,0-16,0v16H192a8,8,0,0,0,0,16h16v16a8,8,0,0,0,16,0V160h16a8,8,0,0,0,0-16ZM219.31,80,80,219.31a16,16,0,0,1-22.62,0L36.68,198.63a16,16,0,0,1,0-22.63L176,36.69a16,16,0,0,1,22.63,0l20.68,20.68A16,16,0,0,1,219.31,80Zm-54.63,32L144,91.31l-96,96L68.68,208ZM208,68.69,187.31,48l-32,32L176,100.69Z"></path></svg>',
  kuerzen: '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M157.73,113.13A8,8,0,0,1,159.82,102L227.48,55.7a8,8,0,0,1,9,13.21l-67.67,46.3a7.92,7.92,0,0,1-4.51,1.4A8,8,0,0,1,157.73,113.13Zm80.87,85.09a8,8,0,0,1-11.12,2.08L136,137.7,93.49,166.78a36,36,0,1,1-9-13.19L121.83,128,84.44,102.41a35.86,35.86,0,1,1,9-13.19l143,97.87A8,8,0,0,1,238.6,198.22ZM80,180a20,20,0,1,0-5.86,14.14A19.85,19.85,0,0,0,80,180ZM74.14,90.13a20,20,0,1,0-28.28,0A19.85,19.85,0,0,0,74.14,90.13Z"></path></svg>',
  laenger: '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M216,48V96a8,8,0,0,1-16,0V67.31l-50.34,50.35a8,8,0,0,1-11.32-11.32L188.69,56H160a8,8,0,0,1,0-16h48A8,8,0,0,1,216,48ZM106.34,138.34,56,188.69V160a8,8,0,0,0-16,0v48a8,8,0,0,0,8,8H96a8,8,0,0,0,0-16H67.31l50.35-50.34a8,8,0,0,0-11.32-11.32Z"></path></svg>',
  anderer_ton: '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M56,96v64a8,8,0,0,1-16,0V96a8,8,0,0,1,16,0ZM88,24a8,8,0,0,0-8,8V224a8,8,0,0,0,16,0V32A8,8,0,0,0,88,24Zm40,32a8,8,0,0,0-8,8V192a8,8,0,0,0,16,0V64A8,8,0,0,0,128,56Zm40,32a8,8,0,0,0-8,8v64a8,8,0,0,0,16,0V96A8,8,0,0,0,168,88Zm40-16a8,8,0,0,0-8,8v96a8,8,0,0,0,16,0V80A8,8,0,0,0,208,72Z"></path></svg>',
  feedback: '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M216,48H40A16,16,0,0,0,24,64V224a15.85,15.85,0,0,0,9.24,14.5A16.13,16.13,0,0,0,40,240a15.89,15.89,0,0,0,10.25-3.78l.09-.07L83,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM40,224h0ZM216,192H80a8,8,0,0,0-5.23,1.95L40,224V64H216ZM88,112a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H96A8,8,0,0,1,88,112Zm0,32a8,8,0,0,1,8-8h64a8,8,0,1,1,0,16H96A8,8,0,0,1,88,144Z"></path></svg>',
  chat: ''
};

const SEND_ICON = '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M231.87,114l-168-95.89A16,16,0,0,0,40.92,37.34L71.55,128,40.92,218.67A16,16,0,0,0,56,240a16.15,16.15,0,0,0,7.93-2.1l167.92-96.05a16,16,0,0,0,.05-27.89ZM56,224a.56.56,0,0,0,0-.12L85.74,136H144a8,8,0,0,0,0-16H85.74L56.06,32.16A.46.46,0,0,0,56,32l168,95.83Z"></path></svg>';

const SEKTION_LABELS = { hook: 'HOOK', hauptteil: 'HAUPTTEIL', cta: 'CTA', gesamt: 'GESAMT' };

const PLACEHOLDER_DEFAULT = 'Feedback geben oder Frage stellen…';
const PLACEHOLDER_AKTION = 'Anweisung ergänzen (optional) – Enter startet';
const PLACEHOLDER_NEU = 'Erst Skript generieren – danach kannst du hier verfeinern';
const PLACEHOLDER_FRAGEN = 'Antwort auf die Rückfrage schreiben…';

const GEN_STEP_LABELS = {
  pending: 'Warte auf Start…',
  kontext: 'Ich sammle den Kontext aus den CRM-Daten…',
  briefing: 'Ich durchforste das PDF-Briefing…',
  generierung: 'Ich schreibe das Skript…',
  speichern: 'Fast fertig – ich speichere…',
  done: 'Fertig!'
};

export class SkriptEditorView {
  constructor(page) {
    this.page = page;
    this.skript = null;
    this.skripte = [];
    this.messages = [];
    this.versionen = [];
    this.aktiveVersion = { version_nr: 1, sub_nr: 0 };
    this.selektion = null; // { sektion, text }
    this.pendingAktion = null; // 'neu_schreiben' | 'kuerzen' | 'laenger' | 'anderer_ton' | null
    this.channel = null;
    this.pollInterval = null;
    this.onMouseUp = null;
    this.onDocMouseDown = null;
    this.feedbackDrawer = new SkriptFeedbackDrawer();

    // Neu-Modus: Generator-Formular in der Mitte statt Hook/Hauptteil/CTA
    this.neuModus = false;
    this.genForm = null;
    this.genStatus = null; // null | { laeuft: true, step } | { error }
    this.genPayload = null; // RAM-Kopie fuer "Nochmal versuchen"
    this.genStubId = null; // persistenter Stub (Payload ueberlebt Fehler/Reload)
    this.genJobId = null;
    this.genChannel = null;
    this.genPoll = null;
  }

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------
  async render(container, skriptId) {
    this.cleanup();
    this.container = container;

    container.innerHTML = '<div class="empty-state"><p>Skript wird geladen...</p></div>';

    // Neu-Modus: Editor-Shell mit leerer Mitte (Generator) statt Skript-Load
    if (skriptId === 'neu') {
      this.skripte = await skripteService.loadSkripte();
      this.skript = null;
      this.messages = [];
      this.neuModus = true;
      this.genStatus = null;
      this.updateBreadcrumb();
      this.renderLayout();
      this.bindEvents();
      this.setChatInputAktiv(false);
      return;
    }

    const [skript, skripte, messages, versionen] = await Promise.all([
      skripteService.loadSkript(skriptId),
      skripteService.loadSkripte(),
      skripteService.getChatMessages(skriptId),
      skripteService.getVersionen(skriptId)
    ]);

    if (!skript) {
      container.innerHTML = '<div class="empty-state"><p>Skript nicht gefunden.</p></div>';
      return;
    }

    this.skript = skript;
    this.skripte = skripte;
    this.messages = messages;
    this.setVersionsState(versionen);
    this.neuModus = false;

    this.updateBreadcrumb();
    this.renderLayout();
    this.bindEvents();
    this.subscribe();

    // Nach Reload waehrend laufender Anfrage: Poll-Fallback direkt starten
    if (this.messages.some((m) => m.status === 'pending' || m.status === 'running')) {
      this.ensurePolling();
    }
  }

  renderLayout() {
    this.container.innerHTML = `
      <div class="skripte-editor">
        <div class="skripte-editor-shell">
          <aside class="skripte-editor-liste" id="ed-liste"></aside>
          <main class="skripte-editor-main">
            <div class="skripte-editor-doc" id="ed-doc"></div>
            <div class="skripte-editor-inputwrap">
              <div class="skripte-editor-chip" id="ed-chip" hidden></div>
              <div class="skripte-editor-input">
                <textarea id="ed-input" rows="2" placeholder="${PLACEHOLDER_DEFAULT}"></textarea>
                <div class="skripte-editor-input-footer">
                  <div class="skripte-editor-input-left">
                    <div class="skripte-editor-version" id="ed-version-wrap"></div>
                    <div class="skripte-editor-input-meta" id="ed-meta">${this.metaBadgesHtml()}</div>
                  </div>
                  <div class="skripte-editor-input-actions">
                    <span class="skripte-editor-cost" id="ed-cost"></span>
                    <button id="ed-send" class="skripte-editor-send" title="Senden" aria-label="Senden">${SEND_ICON}</button>
                  </div>
                </div>
              </div>
            </div>
          </main>
          <aside class="skripte-editor-chat" id="ed-chat"></aside>
        </div>
        <div class="skripte-editor-selmenu" id="ed-selmenu" hidden></div>
      </div>
    `;

    this.renderListe();
    this.renderDoc();
    this.renderChat();
    this.renderCost();
    this.renderVersionSelect();
  }

  // ------------------------------------------------------------------
  // Versionen: aktive Version bestimmen, Auswahl-Dropdown, Wechsel
  // ------------------------------------------------------------------
  /** Aktive Version aus dem Skript-Merker bestimmen, Fallback: neueste Version. */
  setVersionsState(versionen) {
    this.versionen = versionen || [];
    if (!this.versionen.length) {
      this.aktiveVersion = { version_nr: 1, sub_nr: 0 };
      return;
    }
    const gemerkt = this.skript?.aktive_version_nr
      ? this.versionen.find((v) => v.version_nr === this.skript.aktive_version_nr
        && (v.sub_nr || 0) === (this.skript.aktive_sub_nr || 0))
      : null;
    const v = gemerkt || this.versionen[this.versionen.length - 1];
    this.aktiveVersion = { version_nr: v.version_nr, sub_nr: v.sub_nr || 0 };
  }

  /** Version-Dropdown ganz links im Input-Footer der mittleren Spalte. */
  renderVersionSelect() {
    const wrap = document.getElementById('ed-version-wrap');
    if (!wrap) return;
    if (this.neuModus || !this.skript || !this.versionen.length) {
      wrap.innerHTML = '';
      return;
    }

    const key = (v) => `${v.version_nr}.${v.sub_nr || 0}`;
    const aktivKey = `${this.aktiveVersion.version_nr}.${this.aktiveVersion.sub_nr || 0}`;
    wrap.innerHTML = `
      <select id="ed-version" class="skripte-editor-version-select"
        title="Version auswählen – der gewählte Stand wird in den Editor geladen">
        ${this.versionen.map((v) => `
          <option value="${key(v)}" ${key(v) === aktivKey ? 'selected' : ''}>
            ${skripteService.versionLabel(v)}${v.aenderung_beschreibung ? ` · ${escapeHtml(v.aenderung_beschreibung)}` : ''}
          </option>
        `).join('')}
      </select>
    `;
    wrap.querySelector('#ed-version').addEventListener('change', (e) => this.onVersionChange(e.target.value));
  }

  /** Gewaehlten Versions-Snapshot in die Arbeitskopie laden. */
  async onVersionChange(versionKey) {
    const [nr, sub] = versionKey.split('.').map(Number);
    if (nr === this.aktiveVersion.version_nr && sub === (this.aktiveVersion.sub_nr || 0)) return;
    const version = this.versionen.find((v) => v.version_nr === nr && (v.sub_nr || 0) === sub);
    if (!version) return;

    try {
      await skripteService.wechsleVersion(this.skript.id, version);
      Object.assign(this.skript, {
        titel: version.titel,
        hook: version.hook,
        hauptteil: version.hauptteil,
        cta: version.cta,
        aktive_version_nr: nr,
        aktive_sub_nr: sub
      });
      this.aktiveVersion = { version_nr: nr, sub_nr: sub };
      this.clearPending();
      this.renderDoc();
      this.renderChat();
      this.renderVersionSelect();
      window.toastSystem?.success(`${skripteService.versionLabel(version)} geladen – Änderungen setzen hier auf`);
    } catch (err) {
      window.toastSystem?.error(err.message);
      this.renderVersionSelect();
    }
  }

  /** Hinweis im rechten Chat, wenn nicht auf der neuesten Hauptversion gearbeitet wird. */
  versionsHinweisHtml() {
    if (this.neuModus || !this.versionen.length) return '';
    const maxHaupt = Math.max(...this.versionen.map((v) => v.version_nr));
    const aeltere = this.aktiveVersion.version_nr < maxHaupt || (this.aktiveVersion.sub_nr || 0) > 0;
    if (!aeltere) return '';
    return `
      <div class="skripte-editor-version-hinweis">
        Du arbeitest gerade an <strong>${skripteService.versionLabel(this.aktiveVersion)}</strong>
        (neueste: v${maxHaupt}) – angenommene Änderungen werden als Unterversion
        v${this.aktiveVersion.version_nr}.x gespeichert.
      </div>
    `;
  }

  /** Breadcrumb: "Skripte" (klickbar, fuehrt zur Hauptseite) > aktueller Skript-Titel. */
  updateBreadcrumb() {
    window.breadcrumbSystem?.updateBreadcrumb([
      { label: 'Skripte', url: '/skripte', clickable: true },
      { label: this.neuModus ? 'Neues Skript' : (this.skript?.titel || 'Skript'), clickable: false }
    ]);
  }

  metaBadgesHtml() {
    if (!this.skript) return '';
    return `
      ${this.skript.unternehmen?.firmenname ? badge(this.skript.unternehmen.firmenname) : ''}
      ${this.skript.marke?.markenname ? badge(this.skript.marke.markenname) : ''}
      ${this.skript.personas?.name ? badge(skripteService.personaLabel(this.skript.personas), 'info') : ''}
      ${badge(this.skript.mit_dna === false ? 'ohne DNA' : 'mit DNA', this.skript.mit_dna === false ? 'neutral' : 'success')}
    `;
  }

  /**
   * Skript-Wechsel in-place: Layout, Liste und Input bleiben stehen,
   * nur Breadcrumb, Footer-Badges, Doc und Chat werden ausgetauscht.
   */
  async switchSkript(skriptId) {
    if (this.skript && skriptId === this.skript.id) return;

    // Offener Feedback-Drawer gehoert zum alten Skript -> schliessen,
    // sonst wuerde Speichern/Loeschen das falsche Skript treffen
    this.feedbackDrawer.close();

    // Verbindungen des alten Skripts beenden (DOM und Maus-Listener bleiben)
    if (this.channel) {
      window.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.clearPending();
    const menu = document.getElementById('ed-selmenu');
    if (menu) menu.hidden = true;

    // Ggf. Neu-Modus verlassen (laufende Generierung bleibt bewusst bestehen,
    // ihr Ergebnis wird beim Job-Done trotzdem geladen)
    if (this.neuModus) {
      this.neuModus = false;
      this.genStatus = null;
      this.genForm?.destroy?.();
      this.genForm = null;
      this.setChatInputAktiv(true);
    }

    // Sofortiges Feedback: Active-State umschalten, Inhalte dimmen
    this.container.querySelectorAll('.skripte-editor-liste-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.id === skriptId);
    });
    document.getElementById('ed-doc')?.classList.add('skripte-editor--laedt');
    document.getElementById('ed-chat')?.classList.add('skripte-editor--laedt');

    try {
      const [skript, messages, versionen] = await Promise.all([
        skripteService.loadSkript(skriptId),
        skripteService.getChatMessages(skriptId),
        skripteService.getVersionen(skriptId)
      ]);

      if (!skript) {
        window.toastSystem?.error('Skript nicht gefunden');
        this.renderListe(); // Active-State zuruecksetzen
        return;
      }

      this.skript = skript;
      this.messages = messages;
      this.setVersionsState(versionen);

      // URL fuer Reload/Teilen stabil halten
      const url = new URL(window.location.href);
      url.searchParams.set('skript', skriptId);
      window.history.replaceState({ route: url.pathname + url.search }, '', url);
      this.page._merkeKontext({ skript: skriptId });

      this.updateBreadcrumb();
      const meta = document.getElementById('ed-meta');
      if (meta) meta.innerHTML = this.metaBadgesHtml();
      this.renderListe();
      this.renderDoc();
      this.renderChat({ forceScroll: true });
      this.renderCost();
      this.renderVersionSelect();

      this.subscribe();
      if (this.messages.some((m) => m.status === 'pending' || m.status === 'running')) {
        this.ensurePolling();
      }
    } catch (err) {
      window.toastSystem?.error(err.message);
      this.renderListe();
    } finally {
      document.getElementById('ed-doc')?.classList.remove('skripte-editor--laedt');
      document.getElementById('ed-chat')?.classList.remove('skripte-editor--laedt');
    }
  }

  // ------------------------------------------------------------------
  // Neu-Modus: Generator direkt im Editor
  // ------------------------------------------------------------------
  startNeuModus() {
    if (this.neuModus) return;

    this.feedbackDrawer.close();

    // Verbindungen des offenen Skripts beenden
    if (this.channel) {
      window.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.clearPending();
    const menu = document.getElementById('ed-selmenu');
    if (menu) menu.hidden = true;

    this.skript = null;
    this.messages = [];
    this.versionen = [];
    this.aktiveVersion = { version_nr: 1, sub_nr: 0 };
    this.neuModus = true;
    this.genStatus = null;

    // URL fuer Reload stabil halten
    const url = new URL(window.location.href);
    url.searchParams.set('skript', 'neu');
    window.history.replaceState({ route: url.pathname + url.search }, '', url);
    this.page._merkeKontext({ skript: 'neu' });

    this.updateBreadcrumb();
    const meta = document.getElementById('ed-meta');
    if (meta) meta.innerHTML = '';
    this.renderListe();
    this.renderDoc();
    this.renderChat();
    this.renderCost();
    this.renderVersionSelect();
    this.setChatInputAktiv(false);
  }

  setChatInputAktiv(aktiv) {
    const input = document.getElementById('ed-input');
    const send = document.getElementById('ed-send');
    if (input) {
      input.disabled = !aktiv;
      input.placeholder = aktiv ? PLACEHOLDER_DEFAULT : PLACEHOLDER_NEU;
    }
    if (send) send.disabled = !aktiv;
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

  /** Rueckfragen-Phase: Stub existiert, Skript ist noch nicht generiert. */
  istFragenModus() {
    return this.skript?.status === 'fragen';
  }

  // ------------------------------------------------------------------
  // Rueckfragen-Flow (Slot-Filling vor der Generierung)
  // ------------------------------------------------------------------
  /**
   * Standard-Weg: Stub anlegen, Editor oeffnet ihn, Liky stellt Rueckfragen.
   * Erst wenn alles geklaert ist (oder der User skippt), wird generiert.
   */
  async startFragenFlow() {
    let payload;
    try {
      payload = await this.genForm.getPayloadMitUpload();
    } catch (err) {
      window.toastSystem?.error(err.message);
      return;
    }

    this.setGenButtonAktiv(false);
    try {
      const stub = await skripteService.createSkriptStub(payload);
      this.skripte = await skripteService.loadSkripte();
      await this.switchSkript(stub.id);
      await this.startFragenRunde();
    } catch (err) {
      window.toastSystem?.error(err.message);
      this.setGenButtonAktiv(true);
    }
  }

  /** Neue Rueckfragen-Runde: pending Assistant-Message anlegen und Function triggern. */
  async startFragenRunde() {
    const assistantMsg = await skripteService.createChatMessage({
      skript_id: this.skript.id,
      rolle: 'assistant',
      aktion: 'rueckfrage',
      sektion: 'gesamt',
      status: 'pending'
    });
    this.messages.push(assistantMsg);
    this.renderChat({ forceScroll: true });
    this.ensurePolling();
    await skripteService.triggerFunction('skript-fragen-background', { messageId: assistantMsg.id });
  }

  /** Finale Generierung in den Stub (nach geklaerten Fragen oder per Skip). */
  async startGenerationAusFragen() {
    if (!this.skript || this.genStatus?.laeuft) return;

    const payload = this.skript.prompt_kontext?.generator_payload || {
      unternehmen_id: this.skript.unternehmen_id,
      marke_id: this.skript.marke_id,
      kampagne_id: this.skript.kampagne_id,
      produkt_id: this.skript.produkt_id,
      persona_id: this.skript.persona_id,
      branche_id: this.skript.branche_id,
      mit_dna: this.skript.mit_dna,
      video_idee: this.skript.video_idee,
      location: this.skript.location,
      regieanweisung: this.skript.regieanweisung,
      video_laenge: this.skript.video_laenge,
      funnel_stufe: this.skript.funnel_stufe,
      tonalitaet: this.skript.tonalitaet
    };

    this.cleanupGenJob();
    this.genStatus = { laeuft: true, step: 'pending' };
    this.renderDoc();
    this.renderChat({ forceScroll: true });

    try {
      const job = await skripteService.createJob();
      this.genJobId = job.id;

      this.genChannel = skripteService.subscribeToJob(job.id, (j) => this.handleGenJobUpdate(j));
      this.genPoll = setInterval(async () => {
        if (!this.genJobId) return;
        const j = await skripteService.pollJob(this.genJobId);
        if (j) this.handleGenJobUpdate(j);
      }, 5000);

      await skripteService.triggerFunction('skript-generate-background', {
        jobId: job.id,
        skript_id: this.skript.id,
        ...payload
      });
    } catch (err) {
      this.cleanupGenJob();
      this.genStatus = { error: err.message };
      this.renderDoc();
      this.renderChat({ forceScroll: true });
    }
  }

  async startGenerationImEditor({ retry = false } = {}) {
    let payload;
    if (retry && this.genPayload) {
      payload = this.genPayload;
    } else {
      try {
        payload = await this.genForm.getPayloadMitUpload();
      } catch (err) {
        window.toastSystem?.error(err.message);
        return;
      }
    }
    this.genPayload = payload;

    this.cleanupGenJob();
    this.setGenButtonAktiv(false);
    this.genStatus = { laeuft: true, step: 'pending' };
    this.renderChat({ forceScroll: true });

    try {
      // Persistenter Stub: Payload inkl. Videovorlage ueberlebt Fehler und
      // Reload (der Stub taucht in der Liste auf und kann dort weiter
      // generiert werden). Retry aktualisiert denselben Stub.
      if (this.genStubId) {
        await skripteService.updateSkriptStub(this.genStubId, payload);
      } else {
        const stub = await skripteService.createSkriptStub(payload);
        this.genStubId = stub.id;
      }

      const job = await skripteService.createJob();
      this.genJobId = job.id;

      this.genChannel = skripteService.subscribeToJob(job.id, (j) => this.handleGenJobUpdate(j));
      this.genPoll = setInterval(async () => {
        if (!this.genJobId) return;
        const j = await skripteService.pollJob(this.genJobId);
        if (j) this.handleGenJobUpdate(j);
      }, 5000);

      await skripteService.triggerFunction('skript-generate-background', {
        jobId: job.id,
        skript_id: this.genStubId,
        ...payload
      });
    } catch (err) {
      this.cleanupGenJob();
      this.genStatus = { error: err.message };
      this.renderChat({ forceScroll: true });
      this.setGenButtonAktiv(true);
    }
  }

  handleGenJobUpdate(job) {
    if (!job || job.id !== this.genJobId) return;

    if (job.status === 'done' && job.skript_id) {
      this.finishGeneration(job.skript_id);
      return;
    }
    if (job.status === 'error') {
      this.cleanupGenJob();
      this.genStatus = { error: job.error_message || 'Unbekannt' };
      this.renderChat({ forceScroll: true });
      this.setGenButtonAktiv(true);
      return;
    }

    // Fortschritt in der Bubble aktualisieren (ohne komplettes Re-Render)
    if (job.progress_step && this.genStatus?.laeuft) {
      this.genStatus.step = job.progress_step;
      const stepEl = document.getElementById('ed-gen-step');
      if (stepEl) stepEl.textContent = GEN_STEP_LABELS[job.progress_step] || job.progress_step;
    }
  }

  async finishGeneration(skriptId) {
    this.cleanupGenJob();
    this.genStatus = null;
    this.genPayload = null;
    this.genStubId = null;
    window.toastSystem?.success('Skript generiert');

    // Liste aktualisieren, damit das neue Skript links auftaucht
    this.skripte = await skripteService.loadSkripte();

    if (this.neuModus) {
      // In-place ins neue Skript wechseln
      this.neuModus = false;
      this.setChatInputAktiv(true);
      await this.switchSkript(skriptId);
    } else if (this.skript?.id === skriptId) {
      // Rueckfragen-Stub wurde befuellt -> gleiches Skript neu laden
      this.skript = null;
      await this.switchSkript(skriptId);
    } else {
      // User hat waehrenddessen ein anderes Skript geoeffnet -> nur Liste auffrischen
      this.renderListe();
    }
  }

  cleanupGenJob() {
    if (this.genChannel) {
      window.supabase.removeChannel(this.genChannel);
      this.genChannel = null;
    }
    if (this.genPoll) {
      clearInterval(this.genPoll);
      this.genPoll = null;
    }
    this.genJobId = null;
  }

  cleanup() {
    this.feedbackDrawer.close();
    this.cleanupGenJob();
    this.neuModus = false;
    this.genStatus = null;
    this.genForm?.destroy?.();
    this.genForm = null;
    if (this.channel) {
      window.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.onMouseUp) {
      document.removeEventListener('mouseup', this.onMouseUp);
      this.onMouseUp = null;
    }
    if (this.onDocMouseDown) {
      document.removeEventListener('mousedown', this.onDocMouseDown);
      this.onDocMouseDown = null;
    }
    this.selektion = null;
    this.pendingAktion = null;
  }

  // ------------------------------------------------------------------
  // Linke Spalte: Skriptliste
  // ------------------------------------------------------------------
  renderListe() {
    const el = document.getElementById('ed-liste');
    if (!el) return;
    el.innerHTML = `
      <div class="skripte-editor-liste-head">
        <span>Skripte</span>
        <button class="skripte-editor-neu-btn" id="ed-neu" title="Neues Skript erstellen">+ Neues Skript</button>
      </div>
      ${this.skripte.map((s) => `
        <button class="skripte-editor-liste-item ${s.id === this.skript?.id ? 'active' : ''}" data-id="${s.id}">
          <span class="skripte-editor-liste-titel">${escapeHtml(s.titel || s.hook?.slice(0, 50) || '(ohne Titel)')}</span>
          <span class="skripte-editor-liste-sub">${escapeHtml([s.marke?.markenname || s.unternehmen?.firmenname, formatDate(s.created_at)].filter(Boolean).join(' · '))}</span>
        </button>
      `).join('')}
    `;
    el.querySelector('#ed-neu')?.addEventListener('click', () => this.startNeuModus());
    el.querySelectorAll('.skripte-editor-liste-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.id !== this.skript?.id) this.switchSkript(btn.dataset.id);
      });
    });
  }

  // ------------------------------------------------------------------
  // Mitte: Skript-Dokument
  // ------------------------------------------------------------------
  renderDoc() {
    const el = document.getElementById('ed-doc');
    if (!el) return;

    // Neu-Modus: Generator-Formular statt Skript-Inhalt
    if (this.neuModus) {
      el.innerHTML = `
        <div class="skripte-editor-doc-head">
          <h2>Neues Skript</h2>
        </div>
        <div class="skripte-editor-genform" id="ed-genform"></div>
        <div class="skripte-actions-row">
          <button id="ed-gen-start" class="primary-btn" title="Liky stellt erst kluge Rückfragen zu fehlenden Infos (z.B. CTA), dann wird generiert">Skript generieren</button>
          <button id="ed-gen-direkt" class="secondary-btn" title="Rückfragen überspringen und sofort generieren">Direkt generieren</button>
        </div>
      `;
      // Alte Instanz sauber abbauen (Transcribe-Subscriptions!), sonst
      // leaken Channels/Polls bei jedem Re-Render im Neu-Modus
      this.genForm?.destroy?.();
      this.genForm = new SkriptGeneratorForm({ prefix: 'edgen' });
      // Selects laden asynchron nach – Formular steht sofort
      this.genForm.render(el.querySelector('#ed-genform'));
      el.querySelector('#ed-gen-start').addEventListener('click', () => this.startFragenFlow());
      el.querySelector('#ed-gen-direkt').addEventListener('click', () => this.startGenerationImEditor());
      if (this.genStatus?.laeuft) this.setGenButtonAktiv(false);
      return;
    }

    // Rueckfragen-Phase: Vorgaben + Hinweis statt (noch leerem) Skript-Inhalt
    if (this.istFragenModus()) {
      el.innerHTML = `
        <div class="skripte-editor-doc-head">
          <h2>${escapeHtml(this.skript.titel || 'Neues Skript')}</h2>
          <span class="skripte-badge skripte-badge--info" title="Liky klärt erst offene Fragen, dann wird das Skript geschrieben">Rückfragen</span>
        </div>
        ${this.vorgabenPanelHtml()}
        <div class="skripte-editor-fragen-info">
          <p>Liky prüft die Vorgaben und stellt dir rechts Rückfragen, bevor das Skript geschrieben wird.</p>
          <p class="skripte-hint">Antworte unten im Chat. Du kannst die Fragen auch überspringen und sofort generieren lassen.</p>
        </div>
        <div class="skripte-actions-row">
          <button id="ed-fragen-gen" class="primary-btn" ${this.genStatus?.laeuft ? 'disabled' : ''}>
            ${this.genStatus?.laeuft ? 'Läuft…' : 'Skript jetzt generieren'}
          </button>
        </div>
      `;
      el.querySelector('#ed-fragen-gen')?.addEventListener('click', () => this.startGenerationAusFragen());
      const input = document.getElementById('ed-input');
      if (input && !input.disabled) input.placeholder = PLACEHOLDER_FRAGEN;
      return;
    }

    const inputEl = document.getElementById('ed-input');
    if (inputEl && inputEl.placeholder === PLACEHOLDER_FRAGEN) inputEl.placeholder = PLACEHOLDER_DEFAULT;

    el.innerHTML = `
      <div class="skripte-editor-doc-head">
        <h2>${escapeHtml(this.skript.titel || 'Skript')}</h2>
        <button class="skripte-editor-feedback-btn" id="ed-feedback" title="Skript komplett bewerten (Score, Performance-Label)">
          <span class="skripte-editor-tag-icon">${AKTION_ICONS.feedback}</span>
          <span>Feedback</span>
        </button>
      </div>
      ${this.vorgabenPanelHtml()}
      <div class="skripte-editor-doc-box">
        ${['hook', 'hauptteil', 'cta'].map((sektion) => `
          <div class="skripte-editor-sektion" data-sektion="${sektion}">
            <div class="skripte-sektion-label">${SEKTION_LABELS[sektion]}</div>
            <div class="skripte-editor-sektion-text" data-sektion="${sektion}">${escapeHtml(this.skript[sektion] || '–')}</div>
          </div>
        `).join('')}
      </div>
      <p class="skripte-hint">Text markieren, um eine Stelle gezielt zu überarbeiten oder Feedback zu geben – oder unten in den Chat schreiben.</p>
    `;
    el.querySelector('#ed-feedback')?.addEventListener('click', () => this.openVollFeedback());
  }

  /** Read-only Info: mit welchen Vorgaben das Skript generiert wurde. */
  vorgabenPanelHtml() {
    const s = this.skript;
    if (!s) return '';
    // Nach der Generierung liegt briefing_pdf top-level in prompt_kontext,
    // in der Rueckfragen-Phase noch im generator_payload des Stubs
    const briefingPdf = s.prompt_kontext?.briefing_pdf
      || s.prompt_kontext?.generator_payload?.briefing_pdf || null;
    // Videovorlage: nach der Generierung top-level Snapshot, davor im Payload
    const referenz = s.prompt_kontext?.referenz_video
      || s.prompt_kontext?.generator_payload?.referenz_video || null;
    const referenzInfo = referenz ? [
      referenz.platform === 'tiktok' ? 'TikTok' : referenz.platform === 'instagram' ? 'Instagram' : null,
      referenz.author_name ? `@${referenz.author_name}` : null,
      referenz.duration_seconds ? `${Math.round(referenz.duration_seconds)}s` : null,
      referenz.url
    ].filter(Boolean).join(' · ') : null;
    const transkriptAuszug = referenz?.transkript_verwendet
      ? (referenz.transkript_verwendet.length > 220
        ? `${referenz.transkript_verwendet.slice(0, 220)}…`
        : referenz.transkript_verwendet)
      : null;
    const zeilen = [
      ['Unternehmen', s.unternehmen?.firmenname],
      ['PDF-Briefing', briefingPdf?.name],
      ['Videovorlage', referenzInfo],
      ['Vorlage-Transkript', transkriptAuszug],
      ['Marke', s.marke?.markenname],
      ['Kampagne', s.kampagne?.eigener_name || s.kampagne?.kampagnenname],
      ['Produkt', s.produkt?.name],
      ['Persona', s.personas ? skripteService.personaLabel(s.personas) : null],
      ['Branche', s.branchen?.name],
      ['Video-Länge', s.video_laenge ? (VIDEO_LAENGEN[s.video_laenge] || s.video_laenge) : null],
      ['Funnel-Stufe', s.funnel_stufe ? (FUNNEL_STUFEN[s.funnel_stufe] || s.funnel_stufe) : null],
      ['Tonalität', s.tonalitaet],
      ['Skript-DNA', s.mit_dna === false ? 'Ohne DNA (Blindvergleich)' : 'Mit DNA'],
      ['Video-Idee', s.video_idee],
      ['Location', s.location],
      ['Regieanweisung', s.regieanweisung]
    ].filter(([, wert]) => wert);

    if (!zeilen.length) return '';

    return `
      <details class="skripte-editor-vorgaben">
        <summary>Vorgaben aus dem Generator</summary>
        <dl class="skripte-editor-vorgaben-grid">
          ${zeilen.map(([label, wert]) => `
            <div class="skripte-editor-vorgaben-zeile">
              <dt>${escapeHtml(label)}</dt>
              <dd>${escapeHtml(String(wert))}</dd>
            </div>
          `).join('')}
        </dl>
      </details>
    `;
  }

  // ------------------------------------------------------------------
  // Rechte Spalte: Chat-Verlauf ("Liky")
  // ------------------------------------------------------------------
  renderChat({ forceScroll = false } = {}) {
    const el = document.getElementById('ed-chat');
    if (!el) return;

    // Neu-Modus: Generierungs-Fortschritt als Liky-Bubble (lokal, ohne DB-Message)
    if (this.neuModus) {
      const bubble = this.genStatusBubbleHtml();
      if (bubble) {
        el.innerHTML = bubble;
        this.bindGenRetry(el);
      } else {
        el.innerHTML = `
          <div class="skripte-editor-chat-empty">
            <p>Noch kein Skript.</p>
            <p class="skripte-hint">Füll links die Vorgaben aus und klick auf „Skript generieren“ – ich melde mich hier, sobald ich arbeite.</p>
          </div>
        `;
      }
      if (forceScroll) el.scrollTop = el.scrollHeight;
      return;
    }

    if (!this.messages.length) {
      el.innerHTML = `
        ${this.versionsHinweisHtml()}
        ${this.genStatusBubbleHtml()}
        <div class="skripte-editor-chat-empty">
          <p>Noch kein Verlauf.</p>
          <p class="skripte-hint">Markiere eine Stelle im Skript und wähle eine Aktion – oder schreib unten dein Feedback. Vorschläge kannst du hier annehmen oder ablehnen.</p>
        </div>
      `;
      this.bindGenRetry(el);
      return;
    }

    // Scrollposition erhalten: nur ans Ende springen, wenn der User schon
    // (nahezu) unten war oder gerade selbst etwas abgeschickt hat
    const warUnten = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    const vorherigerScroll = el.scrollTop;

    el.innerHTML = this.versionsHinweisHtml()
      + this.messages.map((m) => this.renderMessage(m)).join('')
      + this.genStatusBubbleHtml();

    el.querySelectorAll('[data-msg-action]').forEach((btn) => {
      btn.addEventListener('click', () => this.handleMessageAction(btn.dataset.msgAction, btn.dataset.msgId));
    });
    this.bindGenRetry(el);

    if (forceScroll || warUnten) {
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTop = vorherigerScroll;
    }
  }

  /** Lokale Liky-Bubble fuer den Generierungs-Fortschritt (ohne DB-Message). */
  genStatusBubbleHtml() {
    if (!this.genStatus) return '';
    const head = `
      <div class="skripte-editor-msg-head">
        <span class="skripte-editor-avatar">L</span>
        <span class="skripte-editor-msg-name">Liky</span>
      </div>
    `;
    if (this.genStatus.laeuft) {
      return `
        <div class="skripte-editor-msg skripte-editor-msg--assistant">
          ${head}
          <div class="skripte-editor-working"><span class="skripte-editor-dots"><i></i><i></i><i></i></span> Ich arbeite gerade…</div>
          <div class="skripte-editor-msg-text" id="ed-gen-step">${escapeHtml(GEN_STEP_LABELS[this.genStatus.step] || 'Starte…')}</div>
        </div>
      `;
    }
    if (this.genStatus.error) {
      return `
        <div class="skripte-editor-msg skripte-editor-msg--assistant">
          ${head}
          <div class="skripte-editor-msg-error">Fehler: ${escapeHtml(this.genStatus.error)}</div>
          <div class="skripte-editor-msg-actions">
            <button class="skripte-editor-pill-btn" id="ed-gen-retry">Nochmal versuchen</button>
          </div>
        </div>
      `;
    }
    return '';
  }

  bindGenRetry(el) {
    el.querySelector('#ed-gen-retry')?.addEventListener('click', () => {
      if (this.neuModus) this.startGenerationImEditor({ retry: true });
      else this.startGenerationAusFragen();
    });
  }

  renderAktionTag(m) {
    if (!m.aktion || m.aktion === 'chat') return '';
    const icon = AKTION_ICONS[m.aktion] ? `<span class="skripte-editor-tag-icon">${AKTION_ICONS[m.aktion]}</span>` : '';
    const sektion = m.sektion && m.sektion !== 'gesamt' ? ` · ${SEKTION_LABELS[m.sektion]}` : '';
    return `<span class="skripte-editor-tag">${icon}${escapeHtml(AKTION_LABELS[m.aktion])}${sektion}</span>`;
  }

  renderMessage(m) {
    if (m.rolle === 'user') {
      return `
        <div class="skripte-editor-msg skripte-editor-msg--user">
          ${this.renderAktionTag(m)}
          ${m.inhalt ? `<div class="skripte-editor-msg-text">${escapeHtml(m.inhalt)}</div>` : ''}
          ${m.selektion_text ? `<div class="skripte-editor-msg-quote">${escapeHtml(m.selektion_text)}</div>` : ''}
        </div>
      `;
    }

    // Assistant ("Liky")
    const head = `
      <div class="skripte-editor-msg-head">
        <span class="skripte-editor-avatar">L</span>
        <span class="skripte-editor-msg-name">Liky</span>
      </div>
    `;
    const tag = this.renderAktionTag(m);

    if (m.status === 'pending' || m.status === 'running') {
      return `
        <div class="skripte-editor-msg skripte-editor-msg--assistant">
          ${head}
          ${tag}
          <div class="skripte-editor-working"><span class="skripte-editor-dots"><i></i><i></i><i></i></span> Ich arbeite gerade…</div>
        </div>
      `;
    }

    if (m.status === 'error') {
      return `
        <div class="skripte-editor-msg skripte-editor-msg--assistant">
          ${head}
          ${tag}
          <div class="skripte-editor-msg-error">Fehler: ${escapeHtml(m.error_message || 'Unbekannt')}</div>
          <div class="skripte-editor-msg-actions">
            <button class="skripte-editor-pill-btn" data-msg-action="retry" data-msg-id="${m.id}">Nochmal versuchen</button>
          </div>
        </div>
      `;
    }

    const vorschlagBlock = m.vorschlag_text ? `
      <div class="skripte-editor-vorschlag ${m.status === 'angenommen' ? 'is-angenommen' : ''} ${m.status === 'abgelehnt' ? 'is-abgelehnt' : ''}">
        <div class="skripte-editor-vorschlag-label">Vorschlag${m.sektion && m.sektion !== 'gesamt' ? ` · ${SEKTION_LABELS[m.sektion]}` : ''}</div>
        <div class="skripte-editor-vorschlag-text">${escapeHtml(m.vorschlag_text)}</div>
      </div>
    ` : '';

    let footer = '';
    if (m.aktion === 'rueckfrage') {
      // status 'vorschlag' = alle Fragen geklaert -> Generierung anbieten
      if (m.status === 'vorschlag' && this.istFragenModus() && !this.genStatus?.laeuft) {
        footer = `
          <div class="skripte-editor-msg-actions">
            <button class="skripte-editor-pill-btn skripte-editor-pill-btn--primary" data-msg-action="generieren" data-msg-id="${m.id}">Skript jetzt generieren</button>
          </div>
        `;
      }
    } else if (m.status === 'vorschlag') {
      footer = `
        <div class="skripte-editor-msg-actions">
          <button class="skripte-editor-pill-btn skripte-editor-pill-btn--primary" data-msg-action="accept" data-msg-id="${m.id}">Änderung annehmen</button>
          <button class="skripte-editor-pill-btn" data-msg-action="reject" data-msg-id="${m.id}">Änderung ablehnen</button>
          <button class="skripte-editor-pill-btn" data-msg-action="retry" data-msg-id="${m.id}">Neu schreiben</button>
        </div>
      `;
    } else if (m.status === 'angenommen') {
      footer = `<div class="skripte-editor-msg-state">${badge('Angenommen', 'success')}</div>`;
    } else if (m.status === 'abgelehnt') {
      footer = `<div class="skripte-editor-msg-state">${badge('Abgelehnt', 'danger')}</div>`;
    } else if (m.status === 'fertig' && m.vorschlag_text) {
      // Vorschlag ohne zuordenbare Sektion: kein Annehmen moeglich
      footer = `<p class="skripte-hint">Der Vorschlag konnte keiner Sektion zugeordnet werden und kann nicht automatisch übernommen werden – Text bei Bedarf manuell einarbeiten oder die Anfrage mit Markierung wiederholen.</p>`;
    }

    return `
      <div class="skripte-editor-msg skripte-editor-msg--assistant">
        ${head}
        ${tag}
        ${m.inhalt ? `<div class="skripte-editor-msg-text">${escapeHtml(m.inhalt)}</div>` : ''}
        ${vorschlagBlock}
        ${footer}
      </div>
    `;
  }

  renderCost() {
    const el = document.getElementById('ed-cost');
    if (!el) return;
    if (!this.skript) {
      el.textContent = '';
      el.title = '';
      return;
    }
    const entries = [
      { model: this.skript.model, usage: this.skript.prompt_kontext?.usage },
      ...this.messages.map((m) => ({ model: m.model, usage: m.usage }))
    ];
    const cost = formatUsageCost(entries);
    el.textContent = cost ? cost.label : '';
    if (cost) el.title = cost.tooltip;
  }

  // ------------------------------------------------------------------
  // Events: Selektion, Menue, Chat-Input
  // ------------------------------------------------------------------
  bindEvents() {
    const input = document.getElementById('ed-input');
    document.getElementById('ed-send')?.addEventListener('click', () => this.sendChat());
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChat();
      }
      if (e.key === 'Escape' && this.pendingAktion) {
        this.clearPending();
      }
    });

    // Selektions-Menue: nach Mouseup pruefen, ob Auswahl in einer Sektion liegt
    this.onMouseUp = (e) => {
      const menu = document.getElementById('ed-selmenu');
      if (!menu || menu.contains(e.target)) return;
      // Timeout: Selection ist erst nach dem Event final
      setTimeout(() => this.checkSelection(), 10);
    };
    document.addEventListener('mouseup', this.onMouseUp);

    this.onDocMouseDown = (e) => {
      const menu = document.getElementById('ed-selmenu');
      if (menu && !menu.hidden && !menu.contains(e.target)) {
        menu.hidden = true;
      }
    };
    document.addEventListener('mousedown', this.onDocMouseDown);
  }

  checkSelection() {
    const menu = document.getElementById('ed-selmenu');
    const doc = document.getElementById('ed-doc');
    if (!menu || !doc) return;

    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!sel || sel.isCollapsed || !text) {
      menu.hidden = true;
      return;
    }

    // Beide Enden der Auswahl muessen in derselben Sektion liegen
    const findSektion = (node) => {
      let el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      return el?.closest?.('.skripte-editor-sektion-text') || null;
    };
    const start = findSektion(sel.anchorNode);
    const end = findSektion(sel.focusNode);
    if (!start || start !== end) {
      menu.hidden = true;
      return;
    }

    const sektion = start.dataset.sektion;
    this.selektion = { sektion, text };
    this.pendingAktion = null;
    this.updateChip();

    menu.innerHTML = ['neu_schreiben', 'kuerzen', 'laenger', 'anderer_ton', 'feedback'].map((aktion) => `
      <button data-aktion="${aktion}">
        <span class="skripte-editor-selmenu-icon">${AKTION_ICONS[aktion]}</span>
        <span>${AKTION_LABELS[aktion]}</span>
      </button>
    `).join('');
    menu.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        menu.hidden = true;
        if (btn.dataset.aktion === 'feedback') {
          this.openSektionsFeedback();
        } else {
          this.setPendingAktion(btn.dataset.aktion);
        }
      });
    });

    // Position: unter dem Ende der Auswahl, relativ zum Editor-Wrapper
    // (dynamische Koordinaten gehen nur per JS)
    const wrap = this.container.querySelector('.skripte-editor');
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    menu.hidden = false;
    menu.style.top = `${rect.bottom - wrapRect.top + 6}px`;
    menu.style.left = `${Math.max(8, Math.min(rect.left - wrapRect.left, wrap.clientWidth - 220))}px`;
  }

  /**
   * Aktion vormerken statt sofort auszufuehren: Der User kann erst noch
   * eine Anweisung eintippen (optional), Senden startet die Aktion.
   */
  setPendingAktion(aktion) {
    if (!this.selektion) return;
    this.pendingAktion = aktion;
    window.getSelection()?.removeAllRanges();
    this.updateChip();

    const input = document.getElementById('ed-input');
    if (input) {
      input.placeholder = PLACEHOLDER_AKTION;
      input.focus();
    }
  }

  clearPending() {
    this.selektion = null;
    this.pendingAktion = null;
    this.updateChip();
    window.getSelection()?.removeAllRanges();
    const input = document.getElementById('ed-input');
    if (input) input.placeholder = PLACEHOLDER_DEFAULT;
  }

  updateChip() {
    const chip = document.getElementById('ed-chip');
    if (!chip) return;
    if (!this.selektion) {
      chip.hidden = true;
      return;
    }
    const kurz = this.selektion.text.length > 60 ? `${this.selektion.text.slice(0, 60)}…` : this.selektion.text;
    const prefix = this.pendingAktion
      ? `${AKTION_LABELS[this.pendingAktion]} · ${SEKTION_LABELS[this.selektion.sektion]}`
      : `Auswahl · ${SEKTION_LABELS[this.selektion.sektion]}`;
    chip.hidden = false;
    chip.innerHTML = `
      ${this.pendingAktion && AKTION_ICONS[this.pendingAktion] ? `<span class="skripte-editor-tag-icon">${AKTION_ICONS[this.pendingAktion]}</span>` : ''}
      <span>${escapeHtml(prefix)}: „${escapeHtml(kurz)}“</span>
      <button id="ed-chip-clear" title="Abbrechen" aria-label="Abbrechen">&times;</button>
    `;
    chip.querySelector('#ed-chip-clear').addEventListener('click', () => this.clearPending());
  }

  // ------------------------------------------------------------------
  // Senden (freies Feedback oder vorgemerkte Aktion)
  // ------------------------------------------------------------------
  async sendChat() {
    const input = document.getElementById('ed-input');
    const text = input?.value.trim() || '';

    // Rueckfragen-Phase: Antwort geht an die Fragen-Function, nicht an den Editor
    if (this.istFragenModus()) {
      if (!text) return;
      input.value = '';
      this.clearPending();
      await this.sendMessagePair({ aktion: 'rueckfrage', sektion: 'gesamt', selektion_text: null, inhalt: text });
      return;
    }

    // Vorgemerkte Aktion: Anweisung ist optional, leer erlaubt
    if (this.pendingAktion && this.selektion) {
      const { sektion, text: selektionText } = this.selektion;
      const aktion = this.pendingAktion;
      input.value = '';
      this.clearPending();
      await this.sendMessagePair({ aktion, sektion, selektion_text: selektionText, inhalt: text || null });
      return;
    }

    // Freies Feedback braucht Text
    if (!text) return;
    input.value = '';

    const sel = this.selektion;
    this.clearPending();

    await this.sendMessagePair({
      aktion: 'chat',
      sektion: sel?.sektion || 'gesamt',
      selektion_text: sel?.text || null,
      inhalt: text
    });
  }

  /** User-Message + pending Assistant-Message anlegen, dann Function triggern. */
  async sendMessagePair({ aktion, sektion, selektion_text, inhalt }) {
    try {
      const userMsg = await skripteService.createChatMessage({
        skript_id: this.skript.id,
        rolle: 'user',
        aktion,
        sektion,
        selektion_text,
        inhalt,
        status: 'fertig'
      });
      this.messages.push(userMsg);

      // inhalt der pending Message = User-Anweisung (wird von der Function
      // als Auftrag gelesen und mit der Modell-Antwort ueberschrieben)
      const assistantMsg = await skripteService.createChatMessage({
        skript_id: this.skript.id,
        rolle: 'assistant',
        aktion,
        sektion,
        selektion_text,
        inhalt,
        status: 'pending'
      });
      this.messages.push(assistantMsg);
      this.renderChat({ forceScroll: true });

      this.ensurePolling();
      const fn = aktion === 'rueckfrage' ? 'skript-fragen-background' : 'skript-edit-background';
      await skripteService.triggerFunction(fn, { messageId: assistantMsg.id });
      return assistantMsg;
    } catch (err) {
      window.toastSystem?.error(err.message);
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Feedback (Drawer): Sektions-Feedback loest Ueberarbeitung aus,
  // Voll-Feedback ist reine Bewertung (Score, Performance-Label)
  // ------------------------------------------------------------------
  async openSektionsFeedback() {
    if (!this.selektion || !this.skript) return;
    const { sektion, text: selektionText } = this.selektion;
    this.clearPending();

    await this.feedbackDrawer.openSektion({
      skript: this.skript,
      sektion,
      selektionText,
      onSubmit: ({ score, begruendung, korrektur }) =>
        this.submitSektionsFeedback({ sektion, selektionText, score, begruendung, korrektur })
    });
  }

  /**
   * 1. Feedback-Zeile speichern (die Bewertung darf nie verloren gehen;
   *    sie bezieht sich auf den Stand VOR der Aenderung, siehe version_nr),
   * 2. Message-Paar mit aktion 'feedback' anlegen (startet die Ueberarbeitung),
   * 3. chat_message_id am Feedback-Eintrag nachtragen (best effort).
   */
  async submitSektionsFeedback({ sektion, selektionText, score, begruendung, korrektur }) {
    let gespeichert;
    try {
      gespeichert = await skripteService.saveFeedback(this.skript.id, [{
        sektion,
        score,
        begruendung,
        korrigierte_version: korrektur,
        selektion_text: selektionText,
        version_nr: this.aktiveVersion.version_nr
      }]);
    } catch (err) {
      window.toastSystem?.error(`Feedback konnte nicht gespeichert werden: ${err.message}`);
      return;
    }

    const teile = [];
    if (score != null) teile.push(`Bewertung der markierten Stelle: ${String(score).replace('.', ',')}/5`);
    if (begruendung) teile.push(begruendung);
    if (korrektur) teile.push(`So sollte es sein: ${korrektur}`);

    const assistantMsg = await this.sendMessagePair({
      aktion: 'feedback',
      sektion,
      selektion_text: selektionText,
      inhalt: teile.join('\n')
    });

    if (!assistantMsg) {
      const melden = window.toastSystem?.warning || window.toastSystem?.error;
      melden?.call(window.toastSystem, 'Feedback gespeichert – Überarbeitung konnte nicht gestartet werden. Du kannst sie unten im Chat erneut anstoßen.');
      return;
    }

    // Verknuepfung Bewertung <-> Ueberarbeitung (fuer spaetere Auswertung,
    // ob der aus dem Feedback generierte Vorschlag angenommen wurde)
    const feedbackRow = gespeichert?.[0];
    if (feedbackRow) {
      try {
        await skripteService.updateFeedback(feedbackRow.id, { chat_message_id: assistantMsg.id });
      } catch (_) { /* Verknuepfung ist best effort, Feedback + Job stehen bereits */ }
    }

    window.toastSystem?.success('Feedback gespeichert – Liky überarbeitet die Stelle');
  }

  async openVollFeedback() {
    if (!this.skript) return;
    await this.feedbackDrawer.openVoll({
      skript: this.skript,
      versionNr: this.aktiveVersion.version_nr,
      onSaved: async () => {
        // Branche/Label/Status koennen sich geaendert haben -> Skript neu laden
        const fresh = await skripteService.loadSkript(this.skript.id);
        if (fresh) {
          this.skript = fresh;
          const meta = document.getElementById('ed-meta');
          if (meta) meta.innerHTML = this.metaBadgesHtml();
          this.renderDoc();
        }
      },
      onDeleted: async () => {
        this.skripte = await skripteService.loadSkripte();
        const naechstes = this.skripte.find((s) => s.id !== this.skript.id);
        if (naechstes) {
          this.skript = null;
          await this.switchSkript(naechstes.id);
        } else {
          this.startNeuModus();
        }
      }
    });
  }

  /** Erneuter Versuch: gleiche Anfrage als neue pending Assistant-Message. */
  async retryMessage(msg) {
    // Zugehoerige User-Anweisung aus dem Verlauf ziehen (letzte User-Message davor)
    const idx = this.messages.findIndex((m) => m.id === msg.id);
    let userInhalt = null;
    for (let i = idx - 1; i >= 0; i--) {
      if (this.messages[i].rolle === 'user') {
        userInhalt = this.messages[i].inhalt;
        break;
      }
    }

    try {
      if (msg.status === 'vorschlag') {
        await skripteService.updateChatMessage(msg.id, { status: 'abgelehnt' });
        msg.status = 'abgelehnt';
      }
      const assistantMsg = await skripteService.createChatMessage({
        skript_id: this.skript.id,
        rolle: 'assistant',
        aktion: msg.aktion,
        sektion: msg.sektion,
        selektion_text: msg.selektion_text,
        inhalt: userInhalt,
        status: 'pending'
      });
      this.messages.push(assistantMsg);
      this.renderChat({ forceScroll: true });
      this.ensurePolling();
      const fn = msg.aktion === 'rueckfrage' ? 'skript-fragen-background' : 'skript-edit-background';
      await skripteService.triggerFunction(fn, { messageId: assistantMsg.id });
    } catch (err) {
      window.toastSystem?.error(err.message);
    }
  }

  // ------------------------------------------------------------------
  // Vorschlag annehmen / ablehnen
  // ------------------------------------------------------------------
  async handleMessageAction(action, messageId) {
    const msg = this.messages.find((m) => m.id === messageId);
    if (!msg) return;

    if (action === 'retry') {
      await this.retryMessage(msg);
      return;
    }

    // Rueckfragen-Phase abgeschlossen -> finale Generierung starten
    if (action === 'generieren') {
      await this.startGenerationAusFragen();
      return;
    }

    if (action === 'reject') {
      try {
        await skripteService.updateChatMessage(msg.id, { status: 'abgelehnt' });
        msg.status = 'abgelehnt';
        this.renderChat();
      } catch (err) {
        window.toastSystem?.error(err.message);
      }
      return;
    }

    if (action === 'accept') {
      await this.acceptVorschlag(msg);
    }
  }

  async acceptVorschlag(msg) {
    // Doppelklick-Guard: parallele Accepts kollidieren auf version_nr
    if (this.acceptLaeuft) return;

    const sektion = msg.sektion;
    if (!['hook', 'hauptteil', 'cta'].includes(sektion) || !msg.vorschlag_text) {
      window.toastSystem?.error('Vorschlag kann nicht zugeordnet werden');
      return;
    }

    const alt = this.skript[sektion] || '';
    let neu;
    if (msg.selektion_text && alt.includes(msg.selektion_text)) {
      neu = alt.replace(msg.selektion_text, msg.vorschlag_text);
    } else if (msg.selektion_text) {
      // Markierte Stelle existiert nicht mehr (Sektion wurde zwischenzeitlich
      // geaendert) -> nicht still die ganze Sektion ueberschreiben
      const res = await window.confirmationModal?.open({
        title: 'Markierte Stelle nicht mehr gefunden',
        message: `Die ursprünglich markierte Stelle kommt in der Sektion ${SEKTION_LABELS[sektion]} nicht mehr vor (wurde sie zwischenzeitlich geändert?). Soll der Vorschlag die GESAMTE Sektion ersetzen?`,
        confirmText: 'Gesamte Sektion ersetzen',
        danger: true
      });
      if (!res?.confirmed) return;
      neu = msg.vorschlag_text;
    } else {
      neu = msg.vorschlag_text;
    }

    const vorherigerStand = {
      titel: this.skript.titel,
      hook: this.skript.hook,
      hauptteil: this.skript.hauptteil,
      cta: this.skript.cta
    };

    this.acceptLaeuft = true;
    const btns = this.container?.querySelectorAll(`[data-msg-id="${msg.id}"]`) || [];
    btns.forEach((b) => { b.disabled = true; });

    try {
      await skripteService.updateSkript(this.skript.id, { [sektion]: neu });
      this.skript[sektion] = neu;

      const beschreibung = `${AKTION_LABELS[msg.aktion] || 'Änderung'} · ${SEKTION_LABELS[sektion]}`;
      const neu = await skripteService.createVersion(this.skript, beschreibung, vorherigerStand, this.aktiveVersion);
      this.aktiveVersion = neu;
      this.skript.aktive_version_nr = neu.version_nr;
      this.skript.aktive_sub_nr = neu.sub_nr;
      this.versionen = await skripteService.getVersionen(this.skript.id);

      await skripteService.updateChatMessage(msg.id, { status: 'angenommen' });
      msg.status = 'angenommen';

      this.renderDoc();
      this.renderChat();
      this.renderVersionSelect();
      window.toastSystem?.success(`Übernommen – jetzt ${skripteService.versionLabel(neu)}`);
    } catch (err) {
      window.toastSystem?.error(err.message);
      btns.forEach((b) => { b.disabled = false; });
    } finally {
      this.acceptLaeuft = false;
    }
  }

  // ------------------------------------------------------------------
  // Realtime + Poll-Fallback
  // ------------------------------------------------------------------
  subscribe() {
    this.channel = skripteService.subscribeToChat(this.skript.id, (row, eventType) => {
      this.applyMessageUpdate(row, eventType);
    });
  }

  ensurePolling() {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(async () => {
      const offen = this.messages.filter((m) => m.status === 'pending' || m.status === 'running');
      if (!offen.length) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
        return;
      }
      for (const m of offen) {
        const fresh = await skripteService.pollChatMessage(m.id);
        if (fresh) this.applyMessageUpdate(fresh, 'UPDATE');
      }
    }, 5000);
  }

  applyMessageUpdate(row, eventType) {
    if (!row || row.skript_id !== this.skript?.id) return;
    const idx = this.messages.findIndex((m) => m.id === row.id);
    if (idx === -1) {
      if (eventType !== 'INSERT' && eventType !== 'UPDATE') return;
      this.messages.push(row);
    } else {
      // Lokal bereits final gesetzte Status (angenommen/abgelehnt) nicht
      // durch verspaetete Realtime-Events zuruecksetzen
      const lokal = this.messages[idx];
      if (['angenommen', 'abgelehnt'].includes(lokal.status) && ['vorschlag', 'running', 'pending'].includes(row.status)) return;
      // Kein Re-Render, wenn sich nichts Sichtbares geaendert hat
      // (Poll-Fallback liefert alle 5s auch unveraenderte Rows)
      const unveraendert = lokal.status === row.status
        && lokal.inhalt === row.inhalt
        && lokal.vorschlag_text === row.vorschlag_text
        && lokal.error_message === row.error_message;
      this.messages[idx] = row;
      if (unveraendert) return;
    }
    this.renderChat();
    this.renderCost();
  }
}
