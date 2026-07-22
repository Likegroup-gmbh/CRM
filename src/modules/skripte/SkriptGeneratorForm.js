// SkriptGeneratorForm.js
// Wiederverwendbares Generator-Formular (Kontext + Video-Vorgaben) mit
// Kaskade Unternehmen -> Marke -> Kampagne/Produkt. Wird vom Generator-Tab
// und vom Chat-Editor (Neu-Modus) genutzt. Liefert den Payload fuer die
// Background Function skript-generate-background.

import { skripteService, FUNNEL_STUFEN, VIDEO_LAENGEN } from './SkripteService.js';
import { escapeHtml } from './SkripteUtils.js';

const BRIEFING_MAX_BYTES = 10 * 1024 * 1024; // Bucket-Limit 'documents': 10 MB

export class SkriptGeneratorForm {
  constructor({ prefix = 'gen' } = {}) {
    this.prefix = prefix;
    this.container = null;
    this.unternehmen = [];
    this.marken = [];
    this.briefingFile = null; // gewaehltes PDF (File), Upload erst beim Generieren
  }

  el(name) {
    return this.container?.querySelector(`#${this.prefix}-${name}`) || null;
  }

  async render(container) {
    this.container = container;
    const p = this.prefix;
    container.innerHTML = `
      <div class="skripte-card">
        <h3>Kontext auswählen</h3>
        <p class="skripte-hint">Unternehmen wählen – Marke ist optional (nicht jedes Unternehmen hat eine). Briefing, Kickoff und Produktdaten werden automatisch aus dem CRM gezogen.</p>
        <div class="skripte-form-grid">
          <div class="form-group">
            <label class="form-label">Unternehmen *</label>
            <select id="${p}-unternehmen" class="form-input"><option value="">Laden...</option></select>
          </div>
          <div class="form-group">
            <label class="form-label">Marke</label>
            <select id="${p}-marke" class="form-input" disabled><option value="">– Erst Unternehmen wählen –</option></select>
          </div>
          <div class="form-group">
            <label class="form-label">Kampagne</label>
            <select id="${p}-kampagne" class="form-input" disabled><option value="">– Erst Unternehmen wählen –</option></select>
          </div>
          <div class="form-group">
            <label class="form-label">Produkt</label>
            <select id="${p}-produkt" class="form-input" disabled><option value="">– Erst Unternehmen wählen –</option></select>
          </div>
          <div class="form-group">
            <label class="form-label">Persona (Zielgruppe)</label>
            <select id="${p}-persona" class="form-input"><option value="">Laden...</option></select>
          </div>
          <div class="form-group">
            <label class="form-label">Branche</label>
            <select id="${p}-branche" class="form-input"><option value="">Laden...</option></select>
            <span class="skripte-hint">Wird bei Markenwahl automatisch gesetzt, kann überschrieben werden.</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">PDF-Briefing (optional)</label>
          <input id="${p}-briefing-pdf" type="file" accept="application/pdf,.pdf" hidden />
          <div class="skripte-briefing-upload" id="${p}-briefing-wrap">
            <button type="button" id="${p}-briefing-btn" class="secondary-btn">PDF auswählen</button>
            <span class="skripte-briefing-name" id="${p}-briefing-name" hidden></span>
            <button type="button" id="${p}-briefing-clear" class="skripte-briefing-clear" title="PDF entfernen" aria-label="PDF entfernen" hidden>&times;</button>
          </div>
          <span class="skripte-hint">Liky durchforstet das Briefing und nutzt die Fakten als verbindliche Basis für das Skript (max. 10 MB).</span>
        </div>
      </div>

      <div class="skripte-card">
        <h3>Vorgaben für dieses Video</h3>
        <div class="form-group">
          <label class="form-label">Video-Idee *</label>
          <textarea id="${p}-idee" class="form-input" rows="3"
            placeholder="Worum soll es in dem Video gehen? (z.B. 'Morgenroutine mit Produkt X, Fokus auf Zeitersparnis')"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Location</label>
          <textarea id="${p}-location" class="form-input" rows="3"
            placeholder="Wo findet der Dreh statt? (z.B. 'Zuhause in der Küche, morgens bei Tageslicht; zweiter Teil im Auto auf dem Weg zur Arbeit')"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Regieanweisung</label>
          <textarea id="${p}-regie" class="form-input" rows="3"
            placeholder="Hinweise für den Creator zur Umsetzung (z.B. 'direkt in die Kamera sprechen, Produkt erst ab Sekunde 5 zeigen'). Fließt NICHT in die Skript-Generierung ein."></textarea>
          <span class="skripte-hint">Wird nur als Zusatzinfo am Skript gespeichert – kein Einfluss auf den generierten Text.</span>
        </div>
        <div class="skripte-form-grid">
          <div class="form-group">
            <label class="form-label">Video-Länge (gesamt)</label>
            <select id="${p}-laenge" class="form-input">
              <option value="">– Keine Vorgabe –</option>
              ${Object.entries(VIDEO_LAENGEN).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
            <span class="skripte-hint">Das Skript wird auf diese gesprochene Länge dimensioniert.</span>
          </div>
          <div class="form-group">
            <label class="form-label">Funnel-Stufe</label>
            <select id="${p}-funnel" class="form-input">
              <option value="">– Keine Vorgabe –</option>
              ${Object.entries(FUNNEL_STUFEN).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Tonalität</label>
            <input id="${p}-tonalitaet" class="form-input" type="text"
              placeholder="z.B. locker & humorvoll, seriös, emotional" />
          </div>
          <div class="form-group">
            <label class="form-label">Skript-DNA</label>
            <select id="${p}-dna" class="form-input"><option value="auto">Laden...</option></select>
            <span class="skripte-hint">"Automatisch" nutzt alle zum Kontext passenden aktiven DNA-Layer.</span>
          </div>
        </div>
      </div>
    `;

    this.el('unternehmen').addEventListener('change', () => this.onUnternehmenChange());
    this.el('marke').addEventListener('change', () => this.onMarkeChange());
    this.bindBriefingUpload();

    await Promise.all([this.loadUnternehmen(), this.loadPersonas(), this.loadBranchen(), this.loadDnaOptionen()]);
  }

  // ------------------------------------------------------------------
  // PDF-Briefing: Auswahl im Formular, Upload erst beim Generieren
  // ------------------------------------------------------------------
  bindBriefingUpload() {
    const input = this.el('briefing-pdf');
    const btn = this.el('briefing-btn');
    const clear = this.el('briefing-clear');
    if (!input || !btn) return;

    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      const file = input.files?.[0] || null;
      if (!file) return;
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        window.toastSystem?.error('Bitte eine PDF-Datei wählen');
        input.value = '';
        return;
      }
      if (file.size > BRIEFING_MAX_BYTES) {
        window.toastSystem?.error('PDF ist zu groß (max. 10 MB)');
        input.value = '';
        return;
      }
      this.briefingFile = file;
      this.renderBriefingState();
    });
    clear?.addEventListener('click', () => {
      this.briefingFile = null;
      input.value = '';
      this.renderBriefingState();
    });
  }

  renderBriefingState() {
    const name = this.el('briefing-name');
    const clear = this.el('briefing-clear');
    const btn = this.el('briefing-btn');
    if (!name || !btn) return;
    const hatDatei = !!this.briefingFile;
    name.hidden = !hatDatei;
    name.textContent = hatDatei ? this.briefingFile.name : '';
    if (clear) clear.hidden = !hatDatei;
    btn.textContent = hatDatei ? 'Anderes PDF wählen' : 'PDF auswählen';
  }

  /**
   * Gewaehltes PDF in den Storage-Bucket 'documents' hochladen.
   * Pfad MUSS unter 'briefings/' liegen (Storage-INSERT-Policy erlaubt nur
   * die Top-Level-Ordner 'briefings' und 'kampagnen').
   */
  async uploadBriefingPdf() {
    if (!this.briefingFile) return null;
    const safeName = this.briefingFile.name.replace(/[^a-zA-Z0-9äöüÄÖÜß._-]/g, '_');
    const pfad = `briefings/skript-generator/${Date.now()}-${safeName}`;
    const { error } = await window.supabase.storage.from('documents')
      .upload(pfad, this.briefingFile, { contentType: 'application/pdf', upsert: false });
    if (error) throw new Error(`PDF-Upload fehlgeschlagen: ${error.message}`);
    return { pfad, name: this.briefingFile.name };
  }

  /**
   * Wie getPayload(), laedt aber zusaetzlich ein gewaehltes PDF-Briefing hoch
   * und haengt es als briefing_pdf { pfad, name } an den Payload.
   */
  async getPayloadMitUpload() {
    const payload = this.getPayload();
    const briefingPdf = await this.uploadBriefingPdf();
    if (briefingPdf) payload.briefing_pdf = briefingPdf;
    return payload;
  }

  async loadUnternehmen() {
    this.unternehmen = await skripteService.loadUnternehmen();
    const select = this.el('unternehmen');
    if (!select) return;
    select.innerHTML = '<option value="">– Unternehmen wählen –</option>'
      + this.unternehmen.map((u) => `<option value="${u.id}">${escapeHtml(u.firmenname)}</option>`).join('');
  }

  // Personas sind global (nicht an Marke gebunden) und werden sofort geladen
  async loadPersonas() {
    const personas = await skripteService.loadPersonas();
    const select = this.el('persona');
    if (!select) return;
    select.innerHTML = '<option value="">– Keine –</option>'
      + personas.map((p) => `<option value="${p.id}">${escapeHtml(skripteService.personaLabel(p))}</option>`).join('');
  }

  async loadBranchen() {
    const branchen = await skripteService.loadBranchen();
    const select = this.el('branche');
    if (!select) return;
    select.innerHTML = '<option value="">– Keine –</option>'
      + branchen.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
  }

  // DNA-Auswahl: Automatisch (Layer-Logik), Ohne (Blindvergleich) oder gezielt EIN Dokument
  async loadDnaOptionen() {
    const dokumente = await skripteService.loadAktiveDna();
    const select = this.el('dna');
    if (!select) return;

    const scopeLabel = (d) => {
      if (d.layer_typ === 'branche') return d.branchen?.name;
      if (d.layer_typ === 'zielgruppe') return d.personas ? skripteService.personaLabel(d.personas) : null;
      if (d.layer_typ === 'marke') return d.marke?.markenname;
      return null;
    };

    select.innerHTML = '<option value="auto">Automatisch (passende aktive Layer)</option>'
      + '<option value="ohne">Ohne DNA (Blindvergleich)</option>'
      + dokumente.map((d) => {
        const scope = scopeLabel(d);
        const label = d.name || `${d.layer_typ}${scope ? `: ${scope}` : ''} v${d.version}`;
        return `<option value="${d.id}">${escapeHtml(label)}${d.name && scope ? ` (${escapeHtml(scope)})` : ''}</option>`;
      }).join('');
  }

  async onUnternehmenChange() {
    const unternehmenId = this.el('unternehmen').value;
    const markeSelect = this.el('marke');
    const kampagneSelect = this.el('kampagne');
    const produktSelect = this.el('produkt');

    // Kampagne/Produkt bei Unternehmenswechsel zuruecksetzen
    for (const el of [kampagneSelect, produktSelect]) {
      el.disabled = true;
      el.innerHTML = '<option value="">– Erst Unternehmen wählen –</option>';
    }

    if (!unternehmenId) {
      markeSelect.disabled = true;
      markeSelect.innerHTML = '<option value="">– Erst Unternehmen wählen –</option>';
      return;
    }

    // Branche des Unternehmens vorbelegen (Marke kann sie gleich ueberschreiben)
    const unternehmen = this.unternehmen.find((u) => u.id === unternehmenId);
    const brancheSelect = this.el('branche');
    if (brancheSelect && unternehmen?.branche_id) brancheSelect.value = unternehmen.branche_id;

    this.marken = await skripteService.loadMarken(unternehmenId);
    markeSelect.disabled = false;
    markeSelect.innerHTML = (this.marken.length
      ? '<option value="">– Keine –</option>'
      : '<option value="">– Keine Marke vorhanden –</option>')
      + this.marken.map((m) => `<option value="${m.id}">${escapeHtml(m.markenname)}</option>`).join('');

    // Ohne (gewaehlte) Marke haengen Kampagne/Produkt direkt am Unternehmen
    await this.loadKampagnenUndProdukte();
  }

  async onMarkeChange() {
    const markeId = this.el('marke').value;

    // Branche der Marke vorbelegen (manuell ueberschreibbar)
    const marke = this.marken.find((m) => m.id === markeId);
    const brancheSelect = this.el('branche');
    if (brancheSelect && marke?.branche_id) brancheSelect.value = marke.branche_id;

    await this.loadKampagnenUndProdukte();
  }

  /**
   * Kampagnen/Produkte passend zum Kontext laden: mit Marke nach Marke
   * gefiltert, ohne Marke faellt die Filterung aufs Unternehmen zurueck
   * (z.B. wenn das Unternehmen gar keine Marke hat).
   */
  async loadKampagnenUndProdukte() {
    const unternehmenId = this.el('unternehmen')?.value || null;
    const markeId = this.el('marke')?.value || null;
    const kampagneSelect = this.el('kampagne');
    const produktSelect = this.el('produkt');
    if (!kampagneSelect || !produktSelect) return;

    if (!unternehmenId) {
      for (const el of [kampagneSelect, produktSelect]) {
        el.disabled = true;
        el.innerHTML = '<option value="">– Erst Unternehmen wählen –</option>';
      }
      return;
    }

    const filter = { markeId, unternehmenId };
    const [kampagnen, produkte] = await Promise.all([
      skripteService.loadKampagnen(filter),
      skripteService.loadProdukte(filter)
    ]);

    kampagneSelect.disabled = false;
    kampagneSelect.innerHTML = '<option value="">– Keine –</option>'
      + kampagnen.map((k) => `<option value="${k.id}">${escapeHtml(k.eigener_name || k.kampagnenname || k.id)}</option>`).join('');

    produktSelect.disabled = false;
    produktSelect.innerHTML = '<option value="">– Keins –</option>'
      + produkte.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  }

  /** Payload fuer skript-generate-background. Wirft Error bei fehlenden Pflichtfeldern. */
  getPayload() {
    const unternehmenId = this.el('unternehmen')?.value;
    const videoIdee = this.el('idee')?.value.trim();

    if (!unternehmenId) throw new Error('Bitte ein Unternehmen wählen');
    if (!videoIdee) throw new Error('Bitte eine Video-Idee eingeben');

    const dnaWahl = this.el('dna').value;
    return {
      unternehmen_id: unternehmenId,
      marke_id: this.el('marke').value || null,
      kampagne_id: this.el('kampagne').value || null,
      produkt_id: this.el('produkt').value || null,
      persona_id: this.el('persona').value || null,
      branche_id: this.el('branche').value || null,
      video_idee: videoIdee,
      location: this.el('location').value.trim() || null,
      regieanweisung: this.el('regie').value.trim() || null,
      video_laenge: this.el('laenge').value || null,
      funnel_stufe: this.el('funnel').value || null,
      tonalitaet: this.el('tonalitaet').value.trim() || null,
      mit_dna: dnaWahl !== 'ohne',
      dna_id: dnaWahl !== 'auto' && dnaWahl !== 'ohne' ? dnaWahl : null
    };
  }
}
